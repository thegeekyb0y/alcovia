import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { router } from "expo-router";
import { Colors, Radii, Spacing, Shadows } from "@/constants/Colors";
import { CURRENT_STUDENT_ID } from "@/constants/config";
import { getSessions } from "@/lib/api";
import type { Session, SessionType } from "@/types/api";

type FilterValue = "today" | "week" | "month" | undefined;

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "All", value: undefined },
];

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

function formatSessionMeta(
  durationMs: number,
  startedAtEpochMs: number,
): string {
  const minutes = Math.round(durationMs / 60000);
  const date = dayjs(startedAtEpochMs);
  const now = dayjs();

  let dateLabel: string;
  if (date.isSame(now, "day")) {
    dateLabel = "Today";
  } else if (date.isSame(now.subtract(1, "day"), "day")) {
    dateLabel = "Yesterday";
  } else if (now.diff(date, "day") < 7) {
    dateLabel = date.format("ddd");
  } else {
    dateLabel = date.format("MMM D");
  }

  return `${minutes} min · ${dateLabel}, ${date.format("h:mm A")}`;
}

export default function HistoryScreen() {
  const [filter, setFilter] = useState<FilterValue>("week");
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["sessions", CURRENT_STUDENT_ID, filter],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      getSessions(CURRENT_STUDENT_ID, { cursor: pageParam, filter }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.cursor ?? undefined) : undefined,
  });

  const sessions = data?.pages.flatMap((page) => page.data) ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>History</Text>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <Pressable
              key={f.label}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  active && styles.filterPillTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <FlashList
          data={sessions}
          keyExtractor={(item) => item.id}
          estimatedItemSize={70}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                queryClient.resetQueries({
                  queryKey: ["sessions", CURRENT_STUDENT_ID, filter],
                });
              }}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }: { item: Session }) => (
            <SessionCard
              session={item}
              onPress={() => router.push(`/session/${item.id}`)}
            />
          )}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function SessionCard({
  session,
  onPress,
}: {
  session: Session;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.sessionCard} onPress={onPress}>
      <View
        style={[
          styles.sessionIcon,
          { backgroundColor: TYPE_TINTS[session.type] },
        ]}
      >
        <Text style={{ fontSize: 18 }}>{TYPE_ICONS[session.type]}</Text>
      </View>
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionTitle}>{TYPE_LABELS[session.type]}</Text>
        <Text style={styles.sessionMeta}>
          {formatSessionMeta(session.durationMs, session.startedAt)}
        </Text>
      </View>
      <Text style={styles.sessionCoins}>+{session.coins}</Text>
    </Pressable>
  );
}

function LoadingSkeleton() {
  return (
    <View>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonIcon} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, { width: "50%" }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.centerFill}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No sessions yet</Text>
      <Text style={styles.emptySubtitle}>
        Start a focus session to see it here
      </Text>
      <Pressable style={styles.emptyCta} onPress={() => router.push("/timer")}>
        <Text style={styles.emptyCtaText}>Start Session</Text>
      </Pressable>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centerFill}>
      <Text style={styles.errorText}>Couldn't load your sessions.</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.lg,
  },

  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterPillTextActive: { color: "#fff" },

  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.statCard,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    marginBottom: 10,
    ...Shadows.card,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.button,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: 15, fontWeight: "600", color: Colors.text },
  sessionMeta: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  sessionCoins: { fontSize: 14, fontWeight: "700", color: Colors.success },

  footerLoader: { paddingVertical: Spacing.lg, alignItems: "center" },

  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.statCard,
    padding: Spacing.lg,
    marginBottom: 10,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.button,
    backgroundColor: Colors.border,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 4,
    backgroundColor: Colors.border,
    width: "80%",
  },

  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingTop: 60,
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  emptyCta: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Radii.button,
    ...Shadows.cta,
  },
  emptyCtaText: { color: "#fff", fontWeight: "700" },

  errorText: { color: Colors.textSecondary, fontSize: 15 },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radii.button,
  },
  retryButtonText: { color: "#fff", fontWeight: "700" },
});
