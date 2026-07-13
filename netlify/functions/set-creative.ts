// set-creative.ts: dashboard calls this when a user manually drops a creative
// image. Confirms the URL is IG-reachable, mirrors it to Supabase, and flips
// the row status to creative_ready so the schedule-post flow becomes sane.
//
// POST /api/v1/set-creative
// body: { date: "YYYY-MM-DD", slot: Slot, creative_url: string,
//         probe_only?: boolean }
// response: { ok: true, head_content_type, content_length,
//              rows_updated, status_set_to }
import { Handler } from "@netlify/functions";
import {
    VALID_SLOTS, Slot, isISODate, getSupabase, respond, HEADERS_CORS,
    setCreativeReady,
} from "./social-calendar-helper";

interface SetReq {
    date?:          string;
    slot?:          string;
    creative_url?:  string;
    probe_only?:    boolean;
}

async function probeImage(
    url: string
): Promise<{ ok: boolean; contentType?: string; length?: number;
              error?: string; status?: number }> {
    try {
        const r = await fetch(url, { method: "HEAD" });
        if (!r.ok) return { ok: false,
                            error: `HEAD HTTP ${r.status}`, status: r.status };
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        const len = Number(r.headers.get("content-length") || 0);
        if (!ct.startsWith("image/")) {
            return { ok: false, error: "URL is not an image: " + ct };
        }
        return { ok: true, contentType: ct, length: len };
    } catch (e: any) {
        return { ok: false, error: e?.message || "HEAD failed" };
    }
}

export const handler: Handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: HEADERS_CORS, body: "" };
    }
    if (event.httpMethod !== "POST") {
        return respond(405, { error: "Method not allowed" });
    }
    let body: SetReq = {};
    try { body = JSON.parse(event.body || "{}"); }
    catch { return respond(400, { error: "invalid JSON body" }); }
    if (!isISODate(body.date)) return respond(400, { error: "date must be YYYY-MM-DD" });
    if (!body.slot || !VALID_SLOTS.includes(body.slot as Slot)) {
        return respond(400, { error: "slot must be one of " + VALID_SLOTS.join(",") });
    }
    if (!body.creative_url || !/^https?:\/\//.test(body.creative_url)) {
        return respond(400, { error: "creative_url must be http(s)" });
    }
    const probe = await probeImage(body.creative_url);
    if (!probe.ok) {
        return respond(412, { error: probe.error, post_http: probe.status });
    }
    if (body.probe_only) {
        return respond(200, { ok: true, probe_only: true,
                              content_type: probe.contentType,
                              length: probe.length });
    }
    const supabase = getSupabase();
    const n = await setCreativeReady(
        supabase, body.date!, body.slot as Slot, body.creative_url!);
    return respond(200, {
        ok: true,
        content_type: probe.contentType,
        length:       probe.length,
        rows_updated: n,
        status_set_to: "creative_ready",
    });
};
