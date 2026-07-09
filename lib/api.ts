import { API_BASE_URL } from "@/constants/config";
import type { SessionType, TimelineEntry, SessionDetail } from "@/types/api";

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
