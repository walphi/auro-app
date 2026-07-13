// flip-status.ts: dashboard-side manual status transitions.
// Permitted source → target pairs (enforced server-side):
//
//   pending        -> prompt_ready | failed
//   prompt_ready   -> prompt_ready | failed | pending
//   creative_ready -> failed | prompt_ready
//   posted         -> failed      (admin override; mark-failed)
//   failed         -> pending     (give it another go)
//
// POST /api/v1/flip-status
// body: { date: "YYYY-MM-DD", slot: Slot, status: RowStatus,
//         reason?: string }
import { Handler } from "@netlify/functions";
import {
    VALID_SLOTS, VALID_STATUSES, RowStatus, Slot,
    isISODate, getSupabase, respond, HEADERS_CORS,
    setStatus,
} from "./social-calendar-helper";

const TRANSITIONS: Partial<Record<RowStatus, RowStatus[]>> = {
    pending:        ["prompt_ready", "failed"],
    prompt_ready:   ["prompt_ready", "failed", "pending"],
    creative_ready: ["failed", "prompt_ready"],
    posted:         ["failed"],
    failed:         ["pending"],
};

interface FlipReq {
    date?:   string;
    slot?:   string;
    status?: string;
    reason?: string;
}

export const handler: Handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: HEADERS_CORS, body: "" };
    }
    if (event.httpMethod !== "POST") {
        return respond(405, { error: "Method not allowed" });
    }
    let body: FlipReq = {};
    try { body = JSON.parse(event.body || "{}"); }
    catch { return respond(400, { error: "invalid JSON body" }); }
    if (!isISODate(body.date)) return respond(400, { error: "date must be YYYY-MM-DD" });
    if (!body.slot || !VALID_SLOTS.includes(body.slot as Slot)) {
        return respond(400, { error: "slot must be one of " + VALID_SLOTS.join(",") });
    }
    if (!body.status || !VALID_STATUSES.includes(body.status as RowStatus)) {
        return respond(400, { error: "status must be one of " + VALID_STATUSES.join(",") });
    }
    const slot   = body.slot as Slot;
    const target = body.status as RowStatus;
    const supabase = getSupabase();
    const sel = await supabase.from("social_calendar")
        .select("status").eq("date", body.date!).eq("slot", slot)
        .maybeSingle();
    if (!sel.data)      return respond(404, { error: "row not found" });
    const cur = sel.data.status as RowStatus;
    const allowed = TRANSITIONS[cur] ?? [];
    if (!allowed.includes(target) && cur !== target) {
        return respond(409, {
            error:  `cannot transition ${cur} -> ${target}`,
            allowed_from: cur,
        });
    }
    const extras: Record<string, unknown> = {};
    if (target === "failed") {
        extras.failure_reason = body.reason || "manual flip via dashboard";
    }
    const n = await setStatus(supabase, body.date!, slot, target, extras);
    return respond(200, {
        ok: true, from: cur, to: target, rows_updated: n,
    });
};
