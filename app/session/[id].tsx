import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { Colors, Radii, Spacing, Shadows } from "@/constants/Colors";
import { CURRENT_STUDENT_ID } from "@/constants/config";
import { getSessionDetail } from "@/lib/api";
import type { SessionType, TimelineEntry } from "@/types/api";

const TYPE_LABELS: Record<SessionType, string> = {
  deep_focus: "Deep Focus",
  quick_sprint: "Quick Sprint",
  pomodoro: "Pomodoro",
};

const TYPE_ICONS: Record<SessionType, string> = {
  deep_focus: "🎯",
  quick_sprint: "⚡",
  pomodoro: "🍅",
};

const TYPE_TINTS: Record<SessionType, string> = {
  deep_focus: Colors.primaryLight,
  quick_sprint: Colors.successLight,
  pomodoro: Colors.amberLight,
};

function safeGoBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["session", CURRENT_STUDENT_ID, id],
    queryFn: () => getSessionDetail(CURRENT_STUDENT_ID, id),
    enabled: !!id,
  });

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={{ width: 32 }} />
        <Text style={styles.topBarTitle}>Session Details</Text>
        <Pressable onPress={safeGoBack} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn't load this session.</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Icon + type */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: TYPE_TINTS[data.type] },
            ]}
          >
            <Text style={{ fontSize: 32 }}>{TYPE_ICONS[data.type]}</Text>
          </View>
          <Text style={styles.typeLabel}>{TYPE_LABELS[data.type]}</Text>

          <View
            style={[
              styles.statusBadge,
              data.status === "completed"
                ? styles.statusBadgeSuccess
                : styles.statusBadgeAbandoned,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                data.status === "completed"
                  ? styles.statusTextSuccess
                  : styles.statusTextAbandoned,
              ]}
            >
              {data.status === "completed" ? "Completed" : "Abandoned"}
            </Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <Stat
              label="Duration"
              value={`${Math.round(data.durationMs / 60000)} min`}
            />
            <Stat
              label="Coins Earned"
              value={`+${data.coins}`}
              valueColor={Colors.success}
            />
            <Stat
              label="Started"
              value={dayjs(data.startedAt).format("h:mm A")}
            />
          </View>

          {/* Timeline */}
          {data.timeline.length > 0 && (
            <View style={styles.timelineSection}>
              <Text style={styles.sectionHead}>Timeline</Text>
              <TimelineBar timeline={data.timeline} />
              <View style={styles.timelineLegend}>
                {data.timeline.map((entry, i) => (
                  <View key={i} style={styles.legendRow}>
                    <View
                      style={[
                        styles.legendDot,
                        {
                          backgroundColor:
                            entry.type === "focus"
                              ? Colors.primary
                              : Colors.amber,
                        },
                      ]}
                    />
                    <Text style={styles.legendText}>
                      {entry.type === "focus" ? "Focus" : "Break"} ·{" "}
                      {Math.round(entry.durationMs / 60000)} min
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Stat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text
        style={[styles.statValue, valueColor ? { color: valueColor } : null]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function TimelineBar({ timeline }: { timeline: TimelineEntry[] }) {
  const total = timeline.reduce((sum, t) => sum + t.durationMs, 0) || 1;
  return (
    <View style={styles.timelineBarTrack}>
      {timeline.map((entry, i) => (
        <View
          key={i}
          style={{
            flex: entry.durationMs / total,
            backgroundColor:
              entry.type === "focus" ? Colors.primary : Colors.amber,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  topBarTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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

  content: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
  },
  typeLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    marginTop: Spacing.sm,
  },

  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.pill,
    marginTop: Spacing.xs,
  },
  statusBadgeSuccess: { backgroundColor: Colors.successLight },
  statusBadgeAbandoned: { backgroundColor: "#FEE2E2" },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  statusTextSuccess: { color: Colors.success },
  statusTextAbandoned: { color: Colors.error },

  statsRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: Colors.text },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textTertiary,
    marginTop: 4,
    letterSpacing: 0.4,
  },

  timelineSection: { width: "100%", marginTop: Spacing.xxl },
  sectionHead: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  timelineBarTrack: {
    flexDirection: "row",
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: Colors.border,
  },
  timelineLegend: { marginTop: Spacing.md, gap: Spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: Colors.textSecondary },
});
