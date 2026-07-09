import { Router, Request, Response } from "express";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { getDb } from "../db";

dayjs.extend(isoWeek);

const router = Router({ mergeParams: true });

const DAY_LABELS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

router.get("/", (req: Request<{ id: string }>, res: Response) => {
  const { id: studentId } = req.params;
  const db = getDb();

  const student = db
    .prepare(
      "SELECT total_coins, current_streak, daily_goal FROM students WHERE id = ?",
    )
    .get(studentId) as
    | { total_coins: number; current_streak: number; daily_goal: number }
    | undefined;

  if (!student) {
    return res
      .status(404)
      .json({ error: "Student not found", code: "NOT_FOUND" });
  }

  const countCompletedBetween = (startMs: number, endMs: number): number => {
    const { count } = db
      .prepare(
        `SELECT COUNT(*) as count FROM sessions
         WHERE student_id = ? AND status = 'completed' AND started_at >= ? AND started_at < ?`,
      )
      .get(studentId, startMs, endMs) as { count: number };
    return count;
  };

  // Build mon..sun for the current ISO week
  const weekStart = dayjs().startOf("isoWeek"); // Monday 00:00 of this week
  const sessionsPerDay = DAY_LABELS.map((day, i) => {
    const dayStart = weekStart.add(i, "day");
    const dayEnd = dayStart.add(1, "day");
    return {
      day,
      count: countCompletedBetween(dayStart.valueOf(), dayEnd.valueOf()),
    };
  });

  const totalSessions = sessionsPerDay.reduce((sum, d) => sum + d.count, 0);

  const todayStart = dayjs().startOf("day");
  const todayCompleted = countCompletedBetween(
    todayStart.valueOf(),
    todayStart.add(1, "day").valueOf(),
  );

  res.json({
    totalSessions,
    totalCoins: student.total_coins,
    streak: student.current_streak,
    todayCompleted,
    dailyGoal: student.daily_goal,
    sessionsPerDay,
  });
});

export default router;
