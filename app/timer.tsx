import { useReducer, useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radii, Spacing, Shadows } from "@/constants/Colors";
import { CURRENT_STUDENT_ID } from "@/constants/config";
import { createSession } from "@/lib/api";
import type { SessionType } from "@/types/api";

// ============================================================
// Config — preset durations per type, in minutes (not specced, our design call)
// ============================================================

const DURATIONS: Record<SessionType, number[]> = {
  deep_focus: [25, 45, 60],
  quick_sprint: [5, 10, 15],
  pomodoro: [25, 30, 45],
};

const TYPE_LABELS: Record<SessionType, string> = {
  deep_focus: "Deep Focus",
  quick_sprint: "Quick Sprint",
  pomodoro: "Pomodoro",
};

const TYPE_ICONS: Record<SessionType, keyof typeof Ionicons.glyphMap> = {
  deep_focus: "moon",
  quick_sprint: "flash",
  pomodoro: "timer",
};

// Set to false before final submission — true lets you test with seconds instead of minutes
const DEV_FAST_MODE = false;
const MS_PER_UNIT = DEV_FAST_MODE ? 1000 : 60 * 1000;

// ============================================================
// Navigation helper — handles the case where this screen was
// reached with no back-history (e.g. typed the URL directly)
// ============================================================

function safeGoBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

// ============================================================
// State machine
// ============================================================

type State =
  | { phase: "idle" }
  | {
      phase: "running" | "paused";
      type: SessionType;
      totalMs: number;
      endAt: number;
      remainingMs: number;
      sessionStartedAt: string;
    }
  | { phase: "completed"; coins: number };

type Action =
  | { type: "START"; sessionType: SessionType; totalMs: number }
  | { type: "TICK" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "COMPLETE"; coins: number }
  | { type: "RESET" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START":
      return {
        phase: "running",
        type: action.sessionType,
        totalMs: action.totalMs,
        endAt: Date.now() + action.totalMs,
        remainingMs: action.totalMs,
        sessionStartedAt: new Date().toISOString(),
      };
    case "TICK": {
      if (state.phase !== "running") return state;
      const remainingMs = Math.max(0, state.endAt - Date.now());
      return { ...state, remainingMs };
    }
    case "PAUSE":
      if (state.phase !== "running") return state;
      return { ...state, phase: "paused" };
    case "RESUME":
      if (state.phase !== "paused") return state;
      // Recompute endAt from remainingMs — real pause, not a frozen display
      // while time keeps draining underneath
      return {
        ...state,
        phase: "running",
        endAt: Date.now() + state.remainingMs,
      };
    case "COMPLETE":
      return { phase: "completed", coins: action.coins };
    case "RESET":
      return { phase: "idle" };
    default:
      return state;
  }
}

// ============================================================
// Screen
// ============================================================

export default function TimerScreen() {
  const [state, dispatch] = useReducer(reducer, { phase: "idle" });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: {
      type: SessionType;
      totalMs: number;
      sessionStartedAt: string;
    }) =>
      createSession(CURRENT_STUDENT_ID, {
        type: vars.type,
        durationMs: vars.totalMs,
        timeline: [
          {
            type: "focus",
            durationMs: vars.totalMs,
            startedAt: vars.sessionStartedAt,
          },
        ],
      }),
    onSuccess: (session) => {
      dispatch({ type: "COMPLETE", coins: session.coins });
    },
  });

  // Tick every 250ms while running — smooth enough for a visual countdown
  useEffect(() => {
    if (state.phase === "running") {
      intervalRef.current = setInterval(() => dispatch({ type: "TICK" }), 250);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.phase]);

  // Auto-fire completion once remainingMs actually hits 0
  useEffect(() => {
    if (state.phase === "running" && state.remainingMs === 0) {
      mutation.mutate({
        type: state.type,
        totalMs: state.totalMs,
        sessionStartedAt: state.sessionStartedAt,
      });
    }
  }, [state]);

  // ---------- idle: type + duration picker ----------
  if (state.phase === "idle") {
    return (
      <LinearGradient
        colors={[Colors.background, Colors.primaryLight]}
        style={styles.container}
      >
        <Text style={styles.pickerTitle}>Start a session</Text>
        {(Object.keys(DURATIONS) as SessionType[]).map((type) => (
          <View key={type} style={styles.typeGroup}>
            <View style={styles.typeGroupHeader}>
              <Ionicons
                name={TYPE_ICONS[type]}
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.typeGroupLabel}>{TYPE_LABELS[type]}</Text>
            </View>
            <View style={styles.durationRow}>
              {DURATIONS[type].map((minutes) => (
                <Pressable
                  key={minutes}
                  style={styles.durationChip}
                  onPress={() =>
                    dispatch({
                      type: "START",
                      sessionType: type,
                      totalMs: minutes * MS_PER_UNIT,
                    })
                  }
                >
                  <Text style={styles.durationChipText}>{minutes}m</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <Pressable style={styles.secondaryButton} onPress={safeGoBack}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  // ---------- completed ----------
  if (state.phase === "completed") {
    return (
      <LinearGradient
        colors={[Colors.background, Colors.primaryLight]}
        style={styles.container}
      >
        <Text style={styles.completedTitle}>Session complete 🎉</Text>
        <Text style={styles.coinsText}>+{state.coins} coins</Text>
        <Pressable style={styles.primaryButton} onPress={safeGoBack}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  // ---------- running or paused ----------
  const progress = 1 - state.remainingMs / state.totalMs;
  const minutes = Math.floor(state.remainingMs / 60000);
  const seconds = Math.floor((state.remainingMs % 60000) / 1000);

  return (
    <LinearGradient
      colors={[Colors.background, Colors.primaryLight]}
      style={styles.container}
    >
      <Text style={styles.typeLabel}>{TYPE_LABELS[state.type]}</Text>
      <ProgressRing
        progress={progress}
        isRunning={state.phase === "running"}
        type={state.type}
      />
      <Text style={styles.timeText}>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </Text>
      <View style={styles.controlsRow}>
        {state.phase === "running" ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => dispatch({ type: "PAUSE" })}
          >
            <Text style={styles.primaryButtonText}>Pause</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.primaryButton}
            onPress={() => dispatch({ type: "RESUME" })}
          >
            <Text style={styles.primaryButtonText}>Resume</Text>
          </Pressable>
        )}
        <Pressable style={styles.secondaryButton} onPress={safeGoBack}>
          <Text style={styles.secondaryButtonText}>Abandon</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

// ============================================================
// Progress ring — gradient stroke + breathing glow while running
// ============================================================

function ProgressRing({
  progress,
  isRunning,
  type,
}: {
  progress: number;
  isRunning: boolean;
  type: SessionType;
}) {
  const size = 260;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isRunning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRunning]);

  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.05],
  });

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: Colors.primary,
          transform: [{ scale: glowScale }],
          opacity: glowOpacity,
        }}
      />
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#8B7FF0" />
            <Stop offset="100%" stopColor={Colors.primary} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Ionicons name={TYPE_ICONS[type]} size={28} color={Colors.primary} />
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  pickerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  typeGroup: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    gap: Spacing.sm,
  },
  typeGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  typeGroupLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  durationRow: { flexDirection: "row", gap: Spacing.sm },
  durationChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  durationChipText: { color: Colors.text, fontWeight: "600" },
  typeLabel: { fontSize: 16, color: Colors.textSecondary, fontWeight: "600" },
  timeText: { fontSize: 40, fontWeight: "800", color: Colors.text },
  controlsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
    maxWidth: 400,
    alignSelf: "center",
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Radii.button,
    ...Shadows.cta,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  secondaryButtonText: { color: Colors.textSecondary, fontWeight: "600" },
  completedTitle: { fontSize: 24, fontWeight: "700", color: Colors.text },
  coinsText: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.success,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
});
