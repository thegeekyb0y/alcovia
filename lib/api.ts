import { API_BASE_URL } from "@/constants/config";
import type { SessionType, TimelineEntry, SessionDetail } from "@/types/api";

import type { Student, WeeklyStats } from "@/types/api";

import type { Session, PaginatedResponse } from "@/types/api";

export async function getSessionDetail(
  studentId: string,
  sessionId: string,
): Promise<SessionDetail> {
  const res = await fetch(
    `${API_BASE_URL}/students/${studentId}/sessions/${sessionId}`,
  );
  if (!res.ok) throw new Error("Failed to load session");
  return res.json();
}

export async function getSessions(
  studentId: string,
  params: { cursor?: string; filter?: "today" | "week" | "month" },
): Promise<PaginatedResponse<Session>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.filter) query.set("filter", params.filter);
  const res = await fetch(
    `${API_BASE_URL}/students/${studentId}/sessions?${query.toString()}`,
  );
  if (!res.ok) throw new Error("Failed to load sessions");
  return res.json();
}

export async function getStudent(studentId: string): Promise<Student> {
  const res = await fetch(`${API_BASE_URL}/students/${studentId}`);
  if (!res.ok) throw new Error("Failed to load student");
  return res.json();
}

export async function getWeeklyStats(studentId: string): Promise<WeeklyStats> {
  const res = await fetch(`${API_BASE_URL}/students/${studentId}/stats`);
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export async function createSession(
  studentId: string,
  payload: { type: SessionType; durationMs: number; timeline: TimelineEntry[] },
): Promise<SessionDetail> {
  const res = await fetch(`${API_BASE_URL}/students/${studentId}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  return res.json();
}
