import { Router, Request, Response } from "express";
import { z } from "zod";
import dayjs from "dayjs";
import { getDb } from "../db";

const router = Router({ mergeParams: true }); // access parent :id from students.ts

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().optional(),
  filter: z.enum(["today", "week", "month"]).optional(),
});

const cursorPayloadSchema = z.object({
  startedAt: z.number(),
  id: z.string(),
});

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

export default router;
