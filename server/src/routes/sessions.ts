import { Router, Request, Response } from "express";
import { z } from "zod";
import dayjs from "dayjs";
import { randomUUID } from "crypto";
import { getDb } from "../db";

const router = Router({ mergeParams: true });

// Schemas

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().optional(),
  filter: z.enum(["today", "week", "month"]).optional(),
});

const cursorPayloadSchema = z.object({
  startedAt: z.number(),
  id: z.string(),
});

const detailParamsSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
});

const timelineEntrySchema = z.object({
  type: z.enum(["focus", "break"]),
  durationMs: z.number().int().positive(),
  startedAt: z.string().datetime(),
});

const createSessionSchema = z.object({
  type: z.enum(["deep_focus", "quick_sprint", "pomodoro"]),
  durationMs: z.number().int().positive(),
  timeline: z.array(timelineEntrySchema).min(1),
});

// Row interfaces (match server/src/db.ts exactly)

interface SessionRow {
  id: string;
  student_id: string;
  type: string;
  duration_ms: number;
  coins: number;
  status: string;
  started_at: number;
  completed_at: number | null;
}

interface TimelineRow {
  type: string;
  duration_ms: number;
  started_at: string; // already ISO in this table
}

// Helpers

function encodeCursor(startedAt: number, id: string): string {
  return Buffer.from(JSON.stringify({ startedAt, id })).toString("base64");
}

function safeDecodeCursor(cursor: string) {
  try {
    const json = Buffer.from(cursor, "base64").toString("utf-8");
    return cursorPayloadSchema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}

const MS_PER_COIN = 30_000; // derived from seed data: durationMs / 30000 = coins, exactly, every time

function checkAndNotifyStreak(studentId: string, studentName: string) {
  const db = getDb();
  const today = dayjs().format("YYYY-MM-DD");
  const startOfDay = dayjs().startOf("day").valueOf();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  const { count } = db
    .prepare(
      `SELECT COUNT(*) as count FROM sessions
       WHERE student_id = ? AND status = 'completed' AND started_at >= ? AND started_at < ?`,
    )
    .get(studentId, startOfDay, endOfDay) as { count: number };

  const student = db
    .prepare("SELECT daily_goal, current_streak FROM students WHERE id = ?")
    .get(studentId) as
    | { daily_goal: number; current_streak: number }
    | undefined;

  if (!student || count < student.daily_goal) return; // goal not yet met today

  // Idempotency relies on the UNIQUE(student_id, day) constraint in db.ts, not a check-then-insert
  try {
    db.prepare(
      "INSERT INTO streak_notifications (student_id, day, notified_at) VALUES (?, ?, ?)",
    ).run(studentId, today, new Date().toISOString());
  } catch {
    return; // already notified today
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) return;

  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId,
      studentName,
      sessionsToday: count,
      streak: student.current_streak,
      date: today,
    }),
  }).catch((err) => console.error("Webhook failed:", err));
}

// GET /students/:id/sessions  (list, cursor-paginated)

router.get("/", (req: Request<{ id: string }>, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid query parameters", code: "BAD_REQUEST" });
  }
  const { limit, cursor, filter } = parsed.data;
  const { id: studentId } = req.params;
  const db = getDb();

  const conditions: string[] = ["student_id = ?"];
  const params: (string | number)[] = [studentId];

  if (filter) {
    const now = dayjs();
    const boundary =
      filter === "today"
        ? now.startOf("day")
        : filter === "week"
          ? now.startOf("week")
          : now.startOf("month");
    conditions.push("started_at >= ?");
    params.push(boundary.valueOf());
  }

  if (cursor) {
    const decoded = safeDecodeCursor(cursor);
    if (!decoded) {
      return res
        .status(400)
        .json({ error: "Malformed cursor", code: "BAD_REQUEST" });
    }
    conditions.push("(started_at < ? OR (started_at = ? AND id < ?))");
    params.push(decoded.startedAt, decoded.startedAt, decoded.id);
  }

  const whereClause = conditions.join(" AND ");
  const rows = db
    .prepare(
      `SELECT * FROM sessions WHERE ${whereClause} ORDER BY started_at DESC, id DESC LIMIT ?`,
    )
    .all(...params, limit + 1) as SessionRow[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const data = page.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    type: r.type,
    durationMs: r.duration_ms,
    coins: r.coins,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  }));

  const nextCursor = hasMore
    ? encodeCursor(page[page.length - 1].started_at, page[page.length - 1].id)
    : null;

  res.json({ data, cursor: nextCursor, hasMore });
});

// GET /students/:id/sessions/:sessionId  (detail, ISO dates + timeline)

router.get(
  "/:sessionId",
  (req: Request<{ id: string; sessionId: string }>, res: Response) => {
    const parsed = detailParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid parameters", code: "BAD_REQUEST" });
    }
    const { id: studentId, sessionId } = parsed.data;
    const db = getDb();

    const session = db
      .prepare("SELECT * FROM sessions WHERE id = ? AND student_id = ?")
      .get(sessionId, studentId) as SessionRow | undefined;

    if (!session) {
      return res
        .status(404)
        .json({ error: "Session not found", code: "NOT_FOUND" });
    }

    const timeline = db
      .prepare(
        "SELECT type, duration_ms, started_at FROM session_timeline WHERE session_id = ? ORDER BY started_at ASC",
      )
      .all(sessionId) as TimelineRow[];

    res.json({
      id: session.id,
      studentId: session.student_id,
      type: session.type,
      durationMs: session.duration_ms,
      coins: session.coins,
      status: session.status,
      startedAt: new Date(session.started_at).toISOString(),
      completedAt: session.completed_at
        ? new Date(session.completed_at).toISOString()
        : null,
      timeline: timeline.map((t) => ({
        type: t.type,
        durationMs: t.duration_ms,
        startedAt: t.started_at,
      })),
    });
  },
);

// POST /students/:id/sessions  (create a completed session)

router.post("/", (req: Request<{ id: string }>, res: Response) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid session data", code: "BAD_REQUEST" });
  }
  const { type, durationMs, timeline } = parsed.data;
  const { id: studentId } = req.params;
  const db = getDb();

  const student = db
    .prepare("SELECT * FROM students WHERE id = ?")
    .get(studentId) as
    | { id: string; name: string; daily_goal: number; current_streak: number }
    | undefined;
  if (!student) {
    return res
      .status(404)
      .json({ error: "Student not found", code: "NOT_FOUND" });
  }

  const sessionId = `ses_${randomUUID()}`;
  const coins = Math.round(durationMs / MS_PER_COIN);
  const startedAt = new Date(timeline[0].startedAt).getTime();
  const completedAt = Date.now();

  const createSession = db.transaction(() => {
    db.prepare(
      `INSERT INTO sessions (id, student_id, type, duration_ms, coins, status, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)`,
    ).run(
      sessionId,
      studentId,
      type,
      durationMs,
      coins,
      startedAt,
      completedAt,
    );

    for (const t of timeline) {
      db.prepare(
        `INSERT INTO session_timeline (session_id, type, duration_ms, started_at)
         VALUES (?, ?, ?, ?)`,
      ).run(sessionId, t.type, t.durationMs, t.startedAt);
    }

    db.prepare(
      "UPDATE students SET total_coins = total_coins + ? WHERE id = ?",
    ).run(coins, studentId);
  });
  createSession();

  checkAndNotifyStreak(studentId, student.name);

  res.status(201).json({
    id: sessionId,
    studentId,
    type,
    durationMs,
    coins,
    status: "completed",
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
    timeline,
  });
});

export default router;
