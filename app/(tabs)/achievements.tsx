import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { Colors, Radii, Spacing, Shadows } from "@/constants/Colors";
import { CURRENT_STUDENT_ID } from "@/constants/config";
import { getAchievements } from "@/lib/api";
import type { Achievement } from "@/types/api";

const SCREEN_HEIGHT = Dimensions.get("window").height;

function useCountUp(value: number, durationMs = 900): number {
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
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(listener);
  }, [value]);
  return display;
}

export default function AchievementsScreen() {
  const [selected, setSelected] = useState<Achievement | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["achievements", CURRENT_STUDENT_ID],
    queryFn: () => getAchievements(CURRENT_STUDENT_ID),
  });

  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.centerFill}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView edges={["top"]} style={styles.centerFill}>
        <Text style={styles.errorText}>Couldn't load achievements.</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const unlocked = data.filter((a) => a.unlockedAt);
  const locked = data.filter((a) => !a.unlockedAt);
  const total = data.length;
  const ratio = total > 0 ? unlocked.length / total : 0;
  const percent = Math.round(ratio * 100);

  const recentlyUnlocked = [...unlocked].sort(
    (a, b) => dayjs(b.unlockedAt).valueOf() - dayjs(a.unlockedAt).valueOf(),
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Achievements</Text>

        <HeroCard
          percent={percent}
          unlockedCount={unlocked.length}
          total={total}
        />

        {recentlyUnlocked.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHead}>Recently Unlocked</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: Spacing.md,
                paddingRight: Spacing.xl,
              }}
            >
              {recentlyUnlocked.map((a) => (
                <RailCard
                  key={a.id}
                  achievement={a}
                  onPress={() => setSelected(a)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {unlocked.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHead}>Unlocked ({unlocked.length})</Text>
            <View style={styles.grid}>
              {unlocked.map((a) => (
                <BadgeCard
                  key={a.id}
                  achievement={a}
                  onPress={() => setSelected(a)}
                />
              ))}
            </View>
          </View>
        )}

        {locked.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHead}>Locked ({locked.length})</Text>
            <View style={styles.grid}>
              {locked.map((a) => (
                <BadgeCard
                  key={a.id}
                  achievement={a}
                  onPress={() => setSelected(a)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <BottomSheet achievement={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

// ============================================================
// Hero card — CRED-style gradient card with animated stat + ring
// ============================================================

function HeroCard({
  percent,
  unlockedCount,
  total,
}: {
  percent: number;
  unlockedCount: number;
  total: number;
}) {
  const displayPercent = useCountUp(percent);
  const size = 68;
  const radius = 28;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;

  const animatedOffset = useRef(new Animated.Value(circumference)).current;
  useEffect(() => {
    Animated.timing(animatedOffset, {
      toValue: circumference * (1 - percent / 100),
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent]);
  const AnimatedCircle = Animated.createAnimatedComponent(Circle);

  return (
    <LinearGradient
      colors={["#6C5CE7", "#4834D4"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.heroLabel}>YOUR PROGRESS</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
          <Text style={styles.heroPercent}>{displayPercent}</Text>
          <Text style={styles.heroPercentSign}>%</Text>
        </View>
        <Text style={styles.heroSubtitle}>
          {unlockedCount} of {total} unlocked
        </Text>
      </View>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#fff"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </LinearGradient>
  );
}

// ============================================================
// Recently Unlocked rail — glowing badge cards, Spotify-style row
// ============================================================

function RailCard({
  achievement,
  onPress,
}: {
  achievement: Achievement;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.4],
  });

  return (
    <Pressable style={styles.railCard} onPress={onPress}>
      <View style={styles.railIconWrap}>
        <Animated.View style={[styles.railGlow, { opacity: glowOpacity }]} />
        <View style={styles.railIconCircle}>
          <Ionicons
            name={
              (achievement.icon as keyof typeof Ionicons.glyphMap) ?? "trophy"
            }
            size={26}
            color={Colors.primary}
          />
        </View>
      </View>
      <Text style={styles.railName} numberOfLines={2}>
        {achievement.name}
      </Text>
    </Pressable>
  );
}

// ============================================================
// Grid badge card (used in both Unlocked and Locked sections)
// ============================================================

function BadgeCard({
  achievement,
  onPress,
}: {
  achievement: Achievement;
  onPress: () => void;
}) {
  const unlocked = !!achievement.unlockedAt;
  const ratio =
    achievement.target > 0
      ? Math.min(achievement.current / achievement.target, 1)
      : 0;

  return (
    <Pressable
      style={[styles.badgeCard, !unlocked && styles.badgeCardLocked]}
      onPress={onPress}
    >
      <View
        style={[
          styles.badgeIconCircle,
          { backgroundColor: unlocked ? Colors.primaryLight : "#EEF0F3" },
        ]}
      >
        <Ionicons
          name={
            (achievement.icon as keyof typeof Ionicons.glyphMap) ??
            "trophy-outline"
          }
          size={22}
          color={unlocked ? Colors.primary : "#C4C9D2"}
        />
        {!unlocked && (
          <View style={styles.lockOverlay}>
            <Ionicons
              name="lock-closed"
              size={12}
              color={Colors.textTertiary}
            />
          </View>
        )}
      </View>
      <Text
        style={[styles.badgeName, !unlocked && styles.badgeNameLocked]}
        numberOfLines={2}
      >
        {achievement.name}
      </Text>
      {!unlocked && (
        <>
          <View style={styles.badgeMiniTrack}>
            <View
              style={[styles.badgeMiniFill, { width: `${ratio * 100}%` }]}
            />
          </View>
          <Text style={styles.badgeProgressLabel}>
            {achievement.current}/{achievement.target}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ============================================================
// Bottom sheet — slides up from bottom, Spotify-style detail card
// ============================================================

function BottomSheet({
  achievement,
  onClose,
}: {
  achievement: Achievement | null;
  onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: achievement ? 0 : SCREEN_HEIGHT,
      useNativeDriver: true,
      speed: 16,
      bounciness: 4,
    }).start();
  }, [achievement]);

  const unlocked = achievement ? !!achievement.unlockedAt : false;
  const ratio =
    achievement && achievement.target > 0
      ? Math.min(achievement.current / achievement.target, 1)
      : 0;

  return (
    <Modal
      visible={!!achievement}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <Pressable
            style={styles.sheetContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            {achievement && (
              <>
                <View
                  style={[
                    styles.sheetIconCircle,
                    {
                      backgroundColor: unlocked
                        ? Colors.primaryLight
                        : "#EEF0F3",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      (achievement.icon as keyof typeof Ionicons.glyphMap) ??
                      "trophy-outline"
                    }
                    size={34}
                    color={unlocked ? Colors.primary : Colors.textTertiary}
                  />
                </View>
                <Text style={styles.sheetTitle}>{achievement.name}</Text>
                <Text style={styles.sheetDesc}>{achievement.description}</Text>

                {unlocked ? (
                  <View style={styles.sheetUnlockedPill}>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={Colors.success}
                    />
                    <Text style={styles.sheetUnlockedText}>
                      Unlocked{" "}
                      {dayjs(achievement.unlockedAt).format("MMM D, YYYY")}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.sheetProgressWrap}>
                    <View style={styles.sheetProgressTrack}>
                      <View
                        style={[
                          styles.sheetProgressFill,
                          { width: `${ratio * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.sheetProgressText}>
                      {achievement.current} / {achievement.target}
                    </Text>
                  </View>
                )}
              </>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
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

  header: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.lg,
  },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radii.card,
    padding: Spacing.xl,
    marginBottom: Spacing.xxl,
    ...Shadows.cta,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroPercent: {
    fontSize: 40,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 42,
  },
  heroPercentSign: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    marginBottom: 6,
  },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 },

  section: { marginBottom: Spacing.xxl },
  sectionHead: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.md,
  },

  railCard: { width: 88, alignItems: "center" },
  railIconWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  railGlow: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
  },
  railIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
  },
  railName: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeCard: {
    width: "31%",
    backgroundColor: Colors.surface,
    borderRadius: Radii.statCard,
    padding: Spacing.md,
    alignItems: "center",
    ...Shadows.card,
  },
  badgeCardLocked: { opacity: 0.85 },
  badgeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
    position: "relative",
  },
  lockOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
  },
  badgeName: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
    minHeight: 28,
  },
  badgeNameLocked: { color: Colors.textSecondary },
  badgeMiniTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginTop: 6,
  },
  badgeMiniFill: {
    height: "100%",
    backgroundColor: Colors.textTertiary,
    borderRadius: 2,
  },
  badgeProgressLabel: { fontSize: 9, color: Colors.textTertiary, marginTop: 3 },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xxl,
    alignItems: "center",
    paddingBottom: Spacing.xxl + 16,
  },
  sheetContent: { width: "100%", alignItems: "center" },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  sheetIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 6,
    textAlign: "center",
  },
  sheetDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  sheetUnlockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.successLight,
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.pill,
  },
  sheetUnlockedText: { fontSize: 12, fontWeight: "700", color: Colors.success },
  sheetProgressWrap: { width: "100%" },
  sheetProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginBottom: 6,
  },
  sheetProgressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  sheetProgressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
