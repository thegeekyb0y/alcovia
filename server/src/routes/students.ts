import { Router } from "express";
import { getDb } from "../db";
import sessionRoutes from "./sessions";
import achievementRoutes from "./achievements";

const router = Router();

router.get("/:id", (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const row = db.prepare("SELECT * FROM students WHERE id = ?").get(id) as
    | {
        id: string;
        name: string;
        initials: string;
        total_coins: number;
        current_streak: number;
        daily_goal: number;
        joined_at: string;
      }
    | undefined;

  if (!row) {
    return res
      .status(404)
      .json({ error: "Student not found", code: "NOT_FOUND" });
  }

  res.json({
    id: row.id,
    name: row.name,
    initials: row.initials,
    totalCoins: row.total_coins,
    currentStreak: row.current_streak,
    dailyGoal: row.daily_goal,
    joinedAt: row.joined_at,
  });
});

router.use("/:id/sessions", sessionRoutes);
router.use("/:id/achievements", achievementRoutes);

export default router;
