# netlify/functions/chat-bridge.ts — deploy notes

## What it does

Scheduled Netlify Function that polls Google Chat every 2 minutes, replies to user messages automatically via the AURO bot identity.

## Required Netlify env vars (set in Netlify dashboard → Site settings → Environment variables)

| Name | Value | Notes |
|------|-------|-------|
| `GCHAT_OAUTH_JSON` | The full contents of `~/AppData/Local/hermes/.chat_oauth.json` (paste the whole JSON object) | OAuth refresh token, client id/secret, space id, bot user id |
| `GCHAT_WEBHOOK_URL` | Incoming webhook URL from Google Chat space `AAQAhsArvjk` | The URL that posts replies. Stored verbatim. Mode 600 recommended for the repo. |
| `OPENAI_API_KEY` | `sk-…` | Optional — when set, replies are persona-tuned via gpt-4o-mini. Without it, a static fallback replaces responses. |

## Trigger

Cron `@every 2m` — set both in `netlify.toml` (`[functions.chat-bridge] schedule`) and in the function export (`config` field) for safety.

## State

`@netlify/blobs` store name: `auro-chat-bridge`, key `state`. Holds:

- `processed_user_names` (last 200 user message names we've replied to)
- `sent_message_names` (last 200 bot-reply message names for self-loop filter)
- `last_seen_create_time`
- `consecutive_errors`

Stored encrypted, persists between cold starts, free tier includes 1GB.

## How to enable after deploy

1. Push the code to main → Netlify builds → scheduled function registers.
2. Open Netlify dashboard → Functions → chat-bridge → Logs. Should see `[chat-bridge] idle …` lines every 2 min within 30-60s of cold-start.
3. Drop a test message in the Google Chat space (`Hi from Netlify`).
4. Within 2 min, expect a reply signed `— auro`.

## Switching from local bridge

Once Netlify is verified live and idle-tick logs confirm no errors, **pause cron `024fcc5ec6ff`** in Hermes (set enabled=false). The local bridge becomes a manual-fallback tool you invoke with `python ~/AppData/Local/hermes/auro_content_engine/chat_bridge_v4.py` whenever you want the dev path (opencode reasoning) to run manually.

## Switching back from App to general path

Netlify function always replies automatically. If you want to skip a tick, post a message to `/api/chat-bridge/skip` (not implemented yet — TODO).

## Pitfalls

- **Free Gmail space?** Doesn't apply — space is Workspace-owned by `pw@auroapp.com`. (Free Gmail `auroapp.com@gmail.com` has no chat→inbox toggle, would block this.)
- **OAuth refresh token rotation?** If Google Workspace revokes the refresh token (e.g. user password change, suspicious activity), bridge logs will show `token mint: 400 invalid_grant`. Need to re-do OAuth Playground flow to refresh.
- **OPENAI_API_KEY missing?** Bridge uses static canned replies (still works, but they're not persona-tuned).
- **Schedule drift?** Netlify Functions have a documented cron drift of ~30-60s. Don't expect 60.0s tick intervals.
- **Webhook quota?** Google Chat incoming webhooks have a per-space quota (~1000/min). Pacing safe, but if you spam-test you'll throttle.
