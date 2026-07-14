# AURO Chat Bridge — Hetzner VPS Setup Guide

What we're setting up: a €4.5/mo Linux VPS that runs our chat-bridge on systemd
timer @every 2 minutes. Real Linux cron, full OpenCode access, no Lambda env-var
cage, no scheduling-silence landmines.

## 1) Create the server in Hetzner Cloud Console

URL: https://console.hetzner.cloud/

Step-by-step:
1. **Pick or create a project** (e.g. "auro-bridge")
2. **Add Server** (top-right "+ NEW SERVER" button)
3. Pick:

| Field | Value | Why |
|-------|-------|-----|
| Region | Falkenstein, Germany (FSN) | ~80-100ms from Dubai, cheapest |
| Arch | x86 | Cheaper than ARM |
| Image | Ubuntu 24.04 | Latest LTS, what most tooling expects |
| Type | CX22 (Intel shared, 2 vCPU, 4GB RAM, 40GB SSD) | €4.5/mo, plenty for our workload |
| Networking | IPv4 + IPv6 (default) | |
| SSH key | Use your existing public key (or upload new) | Don't enable password root login |
| Volume | (none, included) | 40GB disk is fine |
| Backups | Optional, +20% | Skip for now — we can rebuild from scratch in 5 min |
| Firewall | None at creation (we'll configure via ufw) | |

4. Click **Create & Buy** — server boots in <60 seconds
5. Note the **public IPv4 address** — that's what we SSH into

## 2) SSH key (if you don't have one already in Hetzner)

If your SSH key isn't already uploaded to Hetzner:

```bash
# On your local machine
cat ~/.ssh/id_ed25519.pub       # copy the contents
# or generate one:
ssh-keygen -t ed25519 -C "phill@auro-bridge"
cat ~/.ssh/id_ed25519.pub       # paste into Hetzner "SSH key" field
```

Then in console: **Security** → **SSH Keys** → **Add SSH key** → paste.

## 3) First SSH + smoke test (from local machine)

```bash
SERVER_IP="<paste from Hetzner console>"
ssh root@${SERVER_IP} "uname -a && cat /etc/os-release"
```

Expected: `Linux ... Ubuntu 24.04` response.

## 4) Run the bootstrap script

`infra/hetzner-bootstrap.sh` does everything else in one shot:
- Bootstrap the root user
- Create a non-root `auro` user with SSH access
- Install Node 22, Python 3, git, opencode CLI
- Clone the Auro repo
- Set up the chat-bridge service + systemd timer
- Tag-team verify a single tick fires

Run from your local machine:

```bash
SERVER_IP="<paste from Hetzner console>"
HOST="auro@${SERVER_IP}"     # we'll sudo via the script
chmod +x infra/hetzner-bootstrap.sh
bash infra/hetzner-bootstrap.sh ${SERVER_IP}
```

The script is idempotent — you can rerun safely.

## 5) Copy local creds to VPS

The bridge needs two local files: `~/.chat_oauth.json` and
`~/AppData/Local/hermes/auro_chat_webhook.json`. Run from local:

```bash
SERVER_IP="<paste>"
scp ~/.chat_oauth.json auro@${SERVER_IP}:~/
scp ~/AppData/Local/hermes/auro_chat_webhook.json auro@${SERVER_IP}:~/
ssh auro@${SERVER_IP} "chmod 600 ~/*.json && mkdir -p ~/bridge/creds && mv ~/*.json ~/bridge/creds/ && ls -la ~/bridge/creds/"
```

## 6) Verify end-to-end

```bash
# Run the bridge once manually on VPS — should log "[chat-bridge] idle {"fetched":0,...}"
ssh auro@${SERVER_IP} "cd ~/bridge && python3 chat_bridge_v4.py --list"

# Watch the systemd timer logs
ssh auro@${SERVER_IP} "journalctl --user -u chat-bridge -f"
```

Drop a message in the Google Chat space ("ping from VPS"). Within 2 minutes, you
should see a reply signed `— auro` from the bot.

## 7) Tear down / pause

```bash
# Pause: stop the timer (no more ticks)
ssh auro@${SERVER_IP} "systemctl --user stop chat-bridge.timer"

# Resume: enable again
ssh auro@${SERVER_IP} "systemctl --user start chat-bridge.timer"

# Or just delete the VM in Hetzner console — €0/mo going forward
```

## Costs

| Resource | Cost |
|----------|------|
| CX22 VPS (per hour) | €0.0057/hr |
| CX22 VPS (per month, 24/7) | €4.5/mo |
| Traffic (out) | first 20TB/mo free |
| Snapshots | €0.01/GB/mo |

Estimated: **€54/year** for the bridge running 24/7.

## What gets installed

- **Ubuntu 24.04 LTS** (Hetzner default)
- **Node 22.x** (matching your local)
- **Python 3.12** (Ubuntu stdlib)
- **Git 2.x** (Ubuntu)
- **OpenCode CLI** (npm `-g`)
- **UFW firewall**, **chrony**, **fail2ban** (none installed; we keep it minimal)

## What does NOT get installed

- No nginx / apache — we don't serve HTTP, just run a scheduled script
- No Docker
- No database
- No CI runner
