import { useReducer, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
// Config
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

const TYPE_DESCRIPTIONS: Record<SessionType, string> = {
  deep_focus: "Long, uninterrupted focus time",
  quick_sprint: "Short bursts for quick tasks",
  pomodoro: "Classic focus + break cycles",
};

const TYPE_ICONS: Record<SessionType, keyof typeof Ionicons.glyphMap> = {
  deep_focus: "moon",
  quick_sprint: "flash",
  pomodoro: "timer",
};

const TYPE_TINTS: Record<SessionType, string> = {
  deep_focus: Colors.primaryLight,
  quick_sprint: Colors.successLight,
  pomodoro: Colors.amberLight,
};

const TYPE_SOLID: Record<SessionType, string> = {
  deep_focus: Colors.primary,
  quick_sprint: Colors.success,
  pomodoro: Colors.amber,
};

const DEV_FAST_MODE = false; // true = "minutes" behave as seconds, for quick testing only
const MS_PER_UNIT = DEV_FAST_MODE ? 1000 : 60 * 1000;

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
  const [pickedType, setPickedType] = useState<SessionType | null>(null); // idle-phase step tracker
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
    onSuccess: (session) =>
      dispatch({ type: "COMPLETE", coins: session.coins }),
  });

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

  useEffect(() => {
    if (state.phase === "running" && state.remainingMs === 0) {
      mutation.mutate({
        type: state.type,
        totalMs: state.totalMs,
        sessionStartedAt: state.sessionStartedAt,
      });
    }
  }, [state]);

  // ---------- idle: two-step picker ----------
  if (state.phase === "idle") {
    if (!pickedType) {
      return <TypeSelectStep onSelect={setPickedType} onCancel={safeGoBack} />;
    }
    return (
      <DurationSelectStep
        type={pickedType}
        onBack={() => setPickedType(null)}
        onStart={(minutes) =>
          dispatch({
            type: "START",
            sessionType: pickedType,
            totalMs: minutes * MS_PER_UNIT,
          })
        }
      />
    );
  }

  // ---------- completed ----------
  if (state.phase === "completed") {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <LinearGradient
          colors={[Colors.background, Colors.primaryLight]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.completedTitle}>Session complete 🎉</Text>
        <Text style={styles.coinsText}>+{state.coins} coins</Text>
        <Pressable style={styles.primaryButton} onPress={safeGoBack}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ---------- running or paused ----------
  const progress = 1 - state.remainingMs / state.totalMs;
  const minutes = Math.floor(state.remainingMs / 60000);
  const seconds = Math.floor((state.remainingMs % 60000) / 1000);

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <LinearGradient
        colors={[Colors.background, Colors.primaryLight]}
        style={StyleSheet.absoluteFill}
      />
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
    </SafeAreaView>
  );
}

// ============================================================
// Step 1: pick a session type — large tappable cards
// ============================================================

function TypeSelectStep({
  onSelect,
  onCancel,
}: {
  onSelect: (type: SessionType) => void;
  onCancel: () => void;
}) {
  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <LinearGradient
        colors={[Colors.background, Colors.primaryLight]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.pickerTitle}>What are you focusing on?</Text>
      <View style={styles.cardList}>
        {(Object.keys(DURATIONS) as SessionType[]).map((type) => (
          <TypeCard key={type} type={type} onPress={() => onSelect(type)} />
        ))}
      </View>
      <Pressable style={styles.secondaryButton} onPress={onCancel}>
        <Text style={styles.secondaryButtonText}>Cancel</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function TypeCard({
  type,
  onPress,
}: {
  type: SessionType;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.typeCard, { borderLeftColor: TYPE_SOLID[type] }]}
        onPressIn={() => animateTo(0.98)}
        onPressOut={() => animateTo(1)}
        onPress={onPress}
      >
        <View
          style={[styles.typeCardIcon, { backgroundColor: TYPE_TINTS[type] }]}
        >
          <Ionicons
            name={TYPE_ICONS[type]}
            size={22}
            color={TYPE_SOLID[type]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.typeCardTitle}>{TYPE_LABELS[type]}</Text>
          <Text style={styles.typeCardDesc}>{TYPE_DESCRIPTIONS[type]}</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={Colors.textTertiary}
        />
      </Pressable>
    </Animated.View>
  );
}

// ============================================================
// Step 2: pick a duration for the chosen type
// ============================================================

function DurationSelectStep({
  type,
  onBack,
  onStart,
}: {
  type: SessionType;
  onBack: () => void;
  onStart: (minutes: number) => void;
}) {
  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <LinearGradient
        colors={[Colors.background, Colors.primaryLight]}
        style={StyleSheet.absoluteFill}
      />
      <Pressable style={styles.backRow} onPress={onBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
        <Text style={styles.backRowText}>Back</Text>
      </Pressable>

      <View
        style={[styles.bigIconCircle, { backgroundColor: TYPE_TINTS[type] }]}
      >
        <Ionicons name={TYPE_ICONS[type]} size={36} color={TYPE_SOLID[type]} />
      </View>
      <Text style={styles.pickerTitle}>{TYPE_LABELS[type]}</Text>
      <Text style={styles.durationPrompt}>Choose a duration</Text>

      <View style={styles.durationRow}>
        {DURATIONS[type].map((minutes) => (
          <Pressable
            key={minutes}
            style={styles.durationChip}
            onPress={() => onStart(minutes)}
          >
            <Text style={styles.durationChipText}>{minutes}</Text>
            <Text style={styles.durationChipUnit}>min</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
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
          backgroundColor: TYPE_SOLID[type],
          transform: [{ scale: glowScale }],
          opacity: glowOpacity,
        }}
      />
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#8B7FF0" />
            <Stop offset="100%" stopColor={TYPE_SOLID[type]} />
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
        <Ionicons name={TYPE_ICONS[type]} size={28} color={TYPE_SOLID[type]} />
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
    textAlign: "center",
  },
  cardList: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },

  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderLeftWidth: 4,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  typeCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  typeCardTitle: { fontSize: 15, fontWeight: "700", color: Colors.text },
  typeCardDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 2,
    position: "absolute",
    top: Spacing.xl,
    left: Spacing.xl,
  },
  backRowText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },

  bigIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xxl,
  },
  durationPrompt: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: -Spacing.sm,
  },

  durationRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  durationChip: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radii.card,
    backgroundColor: Colors.surface,
    minWidth: 84,
    ...Shadows.card,
  },
  durationChipText: { fontSize: 22, fontWeight: "800", color: Colors.text },
  durationChipUnit: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

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
