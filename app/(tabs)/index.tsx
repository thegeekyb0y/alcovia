import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { Colors, Radii, Spacing, Shadows } from "@/constants/Colors";
import { CURRENT_STUDENT_ID } from "@/constants/config";
import { getStudent, getWeeklyStats } from "@/lib/api";
import type { DayStat } from "@/types/api";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DAY_LETTERS: Record<string, string> = {
  mon: "M",
  tue: "T",
  wed: "W",
  thu: "T",
  fri: "F",
  sat: "S",
  sun: "S",
};

function todayIndexMonFirst(): number {
  const jsDay = new Date().getDay();
  return (jsDay + 6) % 7;
}

// ============================================================
// Count-up number — animates from 0 to `value` on mount/change
// ============================================================

function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const anim = new Animated.Value(0);
    const listener = anim.addListener(({ value: v }) =>
      setDisplay(Math.round(v)),
    );
    Animated.timing(anim, {
      toValue: value,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animating a JS number, not a native style prop
    }).start();
    return () => anim.removeListener(listener);
  }, [value]);
  return display;
}

export default function DashboardScreen() {
  const studentQuery = useQuery({
    queryKey: ["student", CURRENT_STUDENT_ID],
    queryFn: () => getStudent(CURRENT_STUDENT_ID),
  });
  const statsQuery = useQuery({
    queryKey: ["stats", CURRENT_STUDENT_ID],
    queryFn: () => getWeeklyStats(CURRENT_STUDENT_ID),
  });

  if (studentQuery.isLoading || statsQuery.isLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.centerFill}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (
    studentQuery.isError ||
    statsQuery.isError ||
    !studentQuery.data ||
    !statsQuery.data
  ) {
    return (
      <SafeAreaView edges={["top"]} style={styles.centerFill}>
        <Text style={styles.errorText}>Couldn't load your dashboard.</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => {
            studentQuery.refetch();
            statsQuery.refetch();
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const student = studentQuery.data;
  const stats = statsQuery.data;
  const firstName = student.name.split(" ")[0];

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{student.initials}</Text>
        </View>
        <View>
          <Text style={styles.greetingTitle}>Hey, {firstName}</Text>
          <Text style={styles.greetingSubtitle}>Let's crush this week</Text>
        </View>
      </View>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        <StatCard
          tint="purple"
          icon="🎯"
          number={stats.totalSessions}
          label="Sessions"
        />
        <StatCard
          tint="green"
          icon="🪙"
          number={student.totalCoins}
          label="Coins"
        />
        <StatCard
          tint="amber"
          icon="🔥"
          number={student.currentStreak}
          label="Day Streak"
        />
      </View>

      {/* Weekly chart */}
      <Text style={styles.sectionHead}>This Week</Text>
      <WeeklyChart data={stats.sessionsPerDay} />

      {/* Today's progress */}
      <Text style={styles.sectionHead}>Today's Progress</Text>
      <ProgressCard completed={stats.todayCompleted} goal={stats.dailyGoal} />

      {/* CTA */}
      <PressScaleButton onPress={() => router.push("/timer")} />
    </SafeAreaView>
  );
}

function StatCard({
  tint,
  icon,
  number,
  label,
}: {
  tint: "purple" | "green" | "amber";
  icon: string;
  number: number;
  label: string;
}) {
  const bg =
    tint === "purple"
      ? Colors.primaryLight
      : tint === "green"
        ? Colors.successLight
        : Colors.amberLight;
  const displayNumber = useCountUp(number);

  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statNumber}>{displayNumber}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function WeeklyChart({ data }: { data: DayStat[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const todayIdx = todayIndexMonFirst();

  return (
    <View style={styles.chart}>
      {data.map((d, i) => {
        const heightPct = (d.count / maxCount) * 100;
        const isToday = i === todayIdx;
        return (
          <View key={d.day} style={styles.chartCol}>
            <View style={styles.chartBarTrack}>
              <View
                style={[
                  styles.chartBar,
                  { height: `${heightPct}%` },
                  isToday && styles.chartBarToday,
                ]}
              />
            </View>
            <Text
              style={[
                styles.chartDayLabel,
                isToday && styles.chartDayLabelToday,
              ]}
            >
              {DAY_LETTERS[d.day]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ProgressCard({
  completed,
  goal,
}: {
  completed: number;
  goal: number;
}) {
  const size = 72;
  const radius = 32;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;
  const ratio = goal > 0 ? Math.min(completed / goal, 1) : 0;
  const targetDashOffset = circumference * (1 - ratio);

  const animatedOffset = useRef(new Animated.Value(circumference)).current; // starts empty
  useEffect(() => {
    Animated.timing(animatedOffset, {
      toValue: targetDashOffset,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // SVG stroke props aren't supported by the native driver
    }).start();
  }, [targetDashOffset]);

  const goalMet = completed >= goal;
  const remaining = Math.max(goal - completed, 0);
  const title = goalMet
    ? "Goal complete!"
    : remaining === 1
      ? "Almost there!"
      : "Keep going!";
  const subtitle = goalMet
    ? "You've hit your goal for today 🎉"
    : `${remaining} more session${remaining === 1 ? "" : "s"} to keep your streak alive`;

  return (
    <View style={styles.progressCard}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        <Circle
          cx={36}
          cy={36}
          r={radius}
          stroke={Colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={36}
          cy={36}
          r={radius}
          stroke={Colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <SvgText
          x={36}
          y={33}
          textAnchor="middle"
          fontSize={16}
          fontWeight="800"
          fill={Colors.text}
        >
          {completed}/{goal}
        </SvgText>
        <SvgText
          x={36}
          y={45}
          textAnchor="middle"
          fontSize={7}
          fill={Colors.textSecondary}
        >
          sessions
        </SvgText>
      </Svg>
      <View style={styles.progressTextWrap}>
        <Text style={styles.progressTitle}>{title}</Text>
        <Text style={styles.progressSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function PressScaleButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={styles.cta}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
        onPress={onPress}
      >
        <Text style={styles.ctaText}>Start Session</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    gap: Spacing.md,
  },
  errorText: { color: Colors.textSecondary, fontSize: 15 },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radii.button,
  },
  retryButtonText: { color: "#fff", fontWeight: "700" },

  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.primary, fontSize: 15, fontWeight: "700" },
  greetingTitle: { fontSize: 22, fontWeight: "700", color: Colors.text },
  greetingSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: Spacing.xxl },
  statCard: { flex: 1, padding: 14, borderRadius: Radii.statCard },
  statIcon: { fontSize: 18, marginBottom: Spacing.sm },
  statNumber: { fontSize: 26, fontWeight: "800", color: Colors.text },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.4,
  },

  sectionHead: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 14,
  },

  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 120,
    paddingBottom: 28,
    marginBottom: Spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chartCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    gap: 6,
  },
  chartBarTrack: {
    flex: 1,
    width: "100%",
    maxWidth: 36,
    justifyContent: "flex-end",
  },
  chartBar: {
    width: "100%",
    backgroundColor: Colors.primaryLight,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 2,
  },
  chartBarToday: { backgroundColor: Colors.primary },
  chartDayLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textTertiary,
    position: "absolute",
    bottom: 6,
  },
  chartDayLabelToday: { color: Colors.primary, fontWeight: "700" },

  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  progressTextWrap: { flex: 1 },
  progressTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 4,
  },
  progressSubtitle: { fontSize: 13, color: Colors.textSecondary },

  cta: {
    width: "100%",
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    alignItems: "center",
    ...Shadows.cta,
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
