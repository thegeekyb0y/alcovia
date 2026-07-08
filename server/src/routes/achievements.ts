import { Router, Request, Response } from "express";
import { getDb } from "../db";

const router = Router({ mergeParams: true });

interface AchievementRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  student_id: string;
  unlocked_at: string | null;
  progress: number;
  target: number;
  current: number;
}

router.get("/", (req: Request<{ id: string }>, res: Response) => {
  const { id: studentId } = req.params;
  const db = getDb();

  const rows = db
    .prepare("SELECT * FROM achievements WHERE student_id = ?")
    .all(studentId) as AchievementRow[];

  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    unlockedAt: r.unlocked_at, // already null or ISO string — no conversion needed
    progress: r.progress,
    target: r.target,
    current: r.current,
  }));

  res.json(data);
});

export default router;
