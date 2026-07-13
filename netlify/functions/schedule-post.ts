// schedule-post.ts: submit a calendar row to Zernio as a real Instagram post.
// If `scheduled_at` is empty / "now", Zernio schedules the post for now+10s
// and the watcher cron takes care of confirming later. If you pass a future
// ISO datetime, Zernio will publish at that exact moment.
//
// POST /api/v1/schedule-post
// body: { date: "YYYY-MM-DD", slot: Slot,
//         scheduled_at?: string (ISO),    // null/now/empty → ASAP
//         media_url?: string,             // override creative URL
//         caption?: string,               // override caption text
//         dry_run?: boolean }
// response: { ok, posted, post_id, scheduled_at, source: "zernio" }
import { Handler } from "@netlify/functions";
import {
    VALID_SLOTS, Slot, isISODate, getSupabase, getZernioToken, markPosted,
    stripPromelliMeta, attachPromelliMeta, PomelliMeta, respond, HEADERS_CORS,
} from "./social-calendar-helper";

const ZERNIO_BASE = "https://api.zernio.com/v1";
const ZERNIO_POST_URL = ZERNIO_BASE + "/posts";

interface PlatformItem {
    platform:    string;
    accountId:   string;
    [k: string]: any;
}

interface ZernioPostBody {
    title?:        string;
    content:       string;
    mediaItems:    Array<{ type?: string; url: string; altText?: string }>;
    platforms:     PlatformItem[];
    scheduledFor:  string;
    timezone?:     string;
    status:        string;
}

interface ScheduleRequest {
    date?:         string;
    slot?:         string;
    scheduled_at?: string;
    media_url?:    string;
    caption?:      string;
    dry_run?:      boolean;
}

const TZ_GST = "+04:00";

function buildZernioPost(
    caption: string,
    mediaUrl: string,
    scheduledFor: string
): ZernioPostBody {
    return {
        title:       "Auro App - Dubai Real Estate",
        content:     caption,
        mediaItems:  [{ type: "image", url: mediaUrl }],
        platforms:   [{
            platform: "instagram",
            accountId: process.env.ZERNIO_IG_ACCOUNT_ID || "",
        }],
        scheduledFor,
        timezone:    TZ_GST,
        status:      scheduledFor ? "scheduled" : "publish_now",
    };
}

async function postToZernio(
    token: string, body: ZernioPostBody
): Promise<{ success: boolean; id?: string; status?: string; error?: string;
              http?: number }> {
    try {
        const r = await fetch(ZERNIO_POST_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type":  "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!r.ok) {
            const txt = await r.text();
            return { success: false,
                     error: `Zernio HTTP ${r.status}: ${txt.slice(0, 300)}`,
                     http: r.status };
        }
        const js = await r.json();
        // Zernio wraps responses inconsistently; handle both shapes.
        const wrap = js?.post ?? js?.data ?? js;
        const id  = wrap?._id ?? wrap?.id;
        const st  = wrap?.status ?? "unknown";
        if (!id) return {
            success: false,
            error: "Zernio 2xx but no post id returned: "
                 + JSON.stringify(js).slice(0, 300),
        };
        return { success: true, id: String(id), status: String(st) };
    } catch (e: any) {
        return { success: false, error: e?.message || "Zernio call failed" };
    }
}

export const handler: Handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: HEADERS_CORS, body: "" };
    }
    if (event.httpMethod !== "POST") {
        return respond(405, { error: "Method not allowed" });
    }
    let body: ScheduleRequest = {};
    try { body = JSON.parse(event.body || "{}"); }
    catch { return respond(400, { error: "invalid JSON body" }); }
    if (!isISODate(body.date)) return respond(400, { error: "date must be YYYY-MM-DD" });
    if (!body.slot || !VALID_SLOTS.includes(body.slot as Slot)) {
        return respond(400, { error: "slot must be one of " + VALID_SLOTS.join(",") });
    }
    const date = body.date!;
    const slot = body.slot as Slot;
    // Scheduled time: null / "now" / "" → ASAP. ISO otherwise.
    let scheduledFor: string;
    if (!body.scheduled_at || body.scheduled_at === "now") {
        const t = new Date(Date.now() + 30_000);
        scheduledFor = t.toISOString();
    } else {
        scheduledFor = body.scheduled_at;
    }
    // Pull creative + caption from Supabase (unless overridden).
    const supabase = getSupabase();
    const sel = await supabase.from("social_calendar")
        .select("creative_url,pomelli_prompt,status").eq("date", date).eq("slot", slot)
        .maybeSingle();
    if (!sel.data)      return respond(404, { error: "row not found" });
    const row = sel.data;
    const creativeUrl = body.media_url || row.creative_url;
    if (!creativeUrl)   return respond(412, { error:
                          "no creative_url on row; supply media_url or drop creative first" });
    const { human, meta } = stripPromelliMeta(String(row.pomelli_prompt ?? ""));
    const caption = body.caption || human || meta.title
                 || "(missing caption - generate one first)";
    // Build the payload.
    const zbody = buildZernioPost(caption, creativeUrl, scheduledFor);
    if (body.dry_run) {
        return respond(200, { ok: true, dry_run: true, zernio_payload: zbody });
    }
    let token: string;
    try { token = getZernioToken(); } catch (e: any) {
        return respond(503, { error: e?.message });
    }
    const zr = await postToZernio(token, zbody);
    if (!zr.success) {
        // mark failed if publish was attempted
        await supabase.from("social_calendar")
            .update({ status: "failed",
                      pomelli_prompt: attachPromelliMeta(
                          human, {
                              ...meta,
                              failure_reason: zr.error,
                              failed_at: new Date().toISOString(),
                          }) })
            .eq("date", date).eq("slot", slot);
        return respond(502, { error: zr.error, post_http: zr.http });
    }
    // Persist creative metadata + Zernio post id.
    meta.post_id      = zr.id;
    meta.scheduled_at = scheduledFor;
    meta.zernio_status = zr.status;
    await supabase.from("social_calendar")
        .update({
            status:         "creative_ready",
            creative_url:   creativeUrl,
            scheduled_at:   scheduledFor,
            caption:        caption,
            pomelli_prompt: attachPromelliMeta(caption, meta),
        })
        .eq("date", date).eq("slot", slot);
    return respond(200, {
        ok:           true,
        post_id:      zr.id,
        scheduled_at: scheduledFor,
        zernio_status: zr.status,
    });
};
