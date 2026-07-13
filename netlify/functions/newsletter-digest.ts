import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = "https://auroapp.com";

interface Article {
    title: string;
    link: string;
    pubDate: string;
    description: string;
}

// Rule (locked-in): ship the latest N articles from the insights array, ranked
// strictly by publication date (descending). Tunable via the constant below.
const DIGEST_ARTICLE_COUNT = 8;

function parseRssItems(xml: string): Article[] {
    const items: Article[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || itemXml.match(/<title>(.*?)<\/title>/);
        const link = itemXml.match(/<link>(.*?)<\/link>/);
        const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        const desc = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || itemXml.match(/<description>(.*?)<\/description>/);
        if (title && link && pubDate) {
            items.push({
                title: title[1].trim(),
                link: link[1].trim(),
                pubDate: pubDate[1].trim(),
                description: desc ? desc[1].replace(/<[^>]+>/g, "").slice(0, 200) : "",
            });
        }
    }
    // Sort by publication date descending so the digest always carries the
    // most-recent insights regardless of array order in insights.ts.
    items.sort((a, b) => {
        const da = new Date(a.pubDate).getTime();
        const db = new Date(b.pubDate).getTime();
        return db - da;
    });
    return items.slice(0, DIGEST_ARTICLE_COUNT);
}

function buildDigestEmail(articles: Article[]): string {
    const articleList = articles.map(a => `
        <tr>
            <td style="padding:16px 0;border-bottom:1px solid #222;">
                <a href="${a.link}" style="color:#D4FF00;font-size:14px;font-weight:bold;text-decoration:none;">${a.title}</a>
                <p style="color:#999;font-size:12px;margin:4px 0 0;line-height:1.5;">${a.description}</p>
                <p style="color:#666;font-size:11px;margin:4px 0 0;">${new Date(a.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </td>
        </tr>
    `).join("");

    return `
        <div style="background:#0a0a0a;padding:40px 20px;font-family:sans-serif;">
            <div style="max-width:560px;margin:0 auto;background:#111;border:1px solid #333;padding:40px;">
                <h1 style="color:#D4FF00;font-size:24px;margin:0 0 4px;">AURO</h1>
                <p style="color:#666;font-size:12px;margin:0 0 24px;">Insights Digest</p>
                <p style="color:#ccc;font-size:14px;line-height:1.6;">Here's what we've been publishing on AURO Insights:</p>
                <table style="width:100%;border-collapse:collapse;margin:24px 0;">
                    ${articleList}
                </table>
                <p style="color:#ccc;font-size:14px;line-height:1.6;margin-top:24px;">
                    <a href="${SITE_URL}/insights" style="color:#D4FF00;text-decoration:underline;">Read more on AURO Insights →</a>
                </p>
                <p style="color:#666;font-size:12px;margin-top:24px;border-top:1px solid #333;padding-top:16px;line-height:1.5;">
                    You're receiving this because you subscribed to AURO Insights. 
                    <a href="${SITE_URL}/unsubscribe" style="color:#666;text-decoration:underline;">Unsubscribe</a>
                </p>
            </div>
        </div>
    `;
}

export const handler = schedule("0 9 * * 1,4", async () => {
    console.log("[Digest] Starting bi-weekly newsletter digest...");

    if (!RESEND_API_KEY) {
        console.log("[Digest] Skipped - RESEND_API_KEY not configured");
        return { statusCode: 200 };
    }

    // Fetch latest articles from RSS feed
    let articles: Article[] = [];
    try {
        const rssResp = await axios.get(`${SITE_URL}/rss.xml`, { timeout: 10000 });
        articles = parseRssItems(rssResp.data);
        console.log(`[Digest] Fetched ${articles.length} articles from RSS`);
    } catch (err: any) {
        console.error("[Digest] Failed to fetch RSS:", err.message);
    }

    if (articles.length === 0) {
        console.log("[Digest] No articles found, skipping");
        return { statusCode: 200 };
    }

    // Query active subscribers
    const { data: subscribers, error } = await supabase
        .from("subscribers")
        .select("email, name")
        .eq("status", "active");

    if (error || !subscribers?.length) {
        console.log("[Digest] No active subscribers or error:", error?.message);
        return { statusCode: 200 };
    }

    console.log(`[Digest] Sending to ${subscribers.length} subscribers`);

    // Send via Resend batch
    const emailHtml = buildDigestEmail(articles);
    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
        try {
            const personalizedHtml = emailHtml.replace(
                "<p style=\"color:#ccc;font-size:14px;line-height:1.6;\">Here's what we've been publishing on AURO Insights:</p>",
                `<p style="color:#ccc;font-size:14px;line-height:1.6;">Hi ${sub.name}, here's what we've been publishing on AURO Insights:</p>`
            );

            await axios.post("https://api.resend.com/emails", {
                from: "AURO Insights <insights@auroapp.com>",
                to: [sub.email],
                subject: `AURO Insights Digest — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`,
                html: personalizedHtml,
            }, {
                headers: {
                    "Authorization": `Bearer ${RESEND_API_KEY}`,
                    "Content-Type": "application/json",
                },
                timeout: 10000,
            });
            sent++;
        } catch (err: any) {
            console.error(`[Digest] Failed to send to ${sub.email}:`, err.response?.data || err.message);
            failed++;
        }
    }

    console.log(`[Digest] Complete: ${sent} sent, ${failed} failed`);
    return { statusCode: 200 };
});
