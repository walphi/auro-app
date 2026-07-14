#!/usr/bin/env bash
# AURO Chat Bridge — bootstrap a fresh Hetzner CX22 Ubuntu 24.04 VPS into
# scheduled bridge that fires @every 2 min via systemd user timer.
#
# Run from your LOCAL machine after creating a Hetzner server:
#   chmod +x infra/hetzner-bootstrap.sh
#   bash infra/hetzner-bootstrap.sh <server-ip>
#
# Re-runnable: each step is idempotent. Safe to re-run.

set -euo pipefail
SERVER_IP="${1:-}"
if [[ -z "${SERVER_IP}" ]]; then
  echo "usage: $0 <server-ip>" >&2
  exit 1
fi

echo "==> Target: root@${SERVER_IP}"

# ---------------------------------------------------------------------------
# 1) base bootstrap as ROOT
# ---------------------------------------------------------------------------
echo "==> [1/N] base bootstrap as root ..."
ssh root@"${SERVER_IP}" bash <<'ROOT_EOF'
set -e
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git python3 python3-pip python3-venv ufw ca-certificates gnupg lsb-release unzip
# non-root user "auro"
id auro >/dev/null 2>&1 || useradd -m -s /bin/bash auro
# copy root's authorized_keys so the auro user can SSH in (we re-use the same key)
mkdir -p /home/auro/.ssh
cp /root/.ssh/authorized_keys /home/auro/.ssh/authorized_keys 2>/dev/null || true
chown -R auro:auro /home/auro/.ssh
chmod 700 /home/auro/.ssh
chmod 600 /home/auro/.ssh/authorized_keys 2>/dev/null || true
# Allow auro to sudo without password (NOPASSWD via sudoers)
echo "auro ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/90-auro
chmod 440 /etc/sudoers.d/90-auro
# ssh hardening - disable root login
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
# minimal firewall - in/out on OpenSSH only
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable
echo "base bootstrap done"
ROOT_EOF

# ---------------------------------------------------------------------------
# 2) Node.js 22 + Python venv + opencode CLI as user 'auro'
# ---------------------------------------------------------------------------
echo "==> [2/N] installing Node.js 22, Python venv, opencode ..."
ssh auro@"${SERVER_IP}" bash <<'AURO_EOF'
set -euo pipefail
LOG="/tmp/auro-bootstrap.log"
exec > >(tee -a "$LOG") 2>&1
echo "[$(date -Iseconds)] starting bootstrap"

# Node.js 22 via NodeSource
if ! command -v node >/dev/null || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash
  sudo apt-get install -y nodejs
fi

# OpenCode CLI (we use the same one you have locally)
if ! command -v opencode >/dev/null 2>&1; then
  npm install -g opencode-ai
fi

# Python venv for the bridge (we keep it minimal; bridge uses stdlib only)
if [[ ! -d ~/.venv_bridge ]]; then
  python3 -m venv ~/.venv_bridge
fi

# directory structure
mkdir -p ~/bridge/creds ~/bridge/state ~/bridge/logs

# symlink the opencode binary path ~/.venvs//bin/expected? Some opencode shims live in
# /usr/local/bin after npm -g; let's confirm
echo "node: $(node -v)"
echo "opencode: $(which opencode || echo 'not in PATH')"
ls /usr/local/bin/opencode* 2>/dev/null || true
ls ~/AppData/Roaming/npm/opencode* 2>/dev/null || true
echo "[$(date -Iseconds)] bootstrap-2 done"
AURO_EOF

# ---------------------------------------------------------------------------
# 3) clone auro repo (so we have chat_bridge_v4.py source)
# ---------------------------------------------------------------------------
echo "==> [3/N] cloning auro repo ..."
ssh auro@"${SERVER_IP}" bash <<'AURO_EOF'
set -euo pipefail
if [[ ! -d ~/bridge/chat_bridge_v4.py ]]; then
  # Fetch only the bridge script + minimal context (not the full repo, to keep VPS small)
  mkdir -p ~/bridge
  curl -fsSL https://raw.githubusercontent.com/walphi/auro-app/main/netlify/functions/chat-bridge.ts -o /tmp/chat-bridge.ts
  curl -fsSL https://raw.githubusercontent.com/walphi/auro-app/main/netlify/functions/chat-bridge.readme.md -o /tmp/chat-bridge.readme.md
  # Local bridge v4 (Python) is on filesystem - ship it via scp in step 4
fi
echo "scaffolded ~/bridge"
ls -la ~/bridge
AURO_EOF

# ---------------------------------------------------------------------------
# 4) upload local bridge.py + creds via scp
# ---------------------------------------------------------------------------
echo "==> [4/N] uploading local bridge.py + creds ..."
LOCAL_BRIDGE="/c/Users/phill/AppData/Local/hermes/auro_content_engine/chat_bridge_v4.py"
LOCAL_OAUTH="/c/Users/phill/AppData/Local/hermes/.chat_oauth.json"
LOCAL_HOOK="/c/Users/phill/AppData/Local/hermes/auro_chat_webhook.json"
scp "${LOCAL_BRIDGE}"  auro@"${SERVER_IP}":~/bridge/chat_bridge_v4.py
for f in "${LOCAL_OAUTH}" "${LOCAL_HOOK}"; do
  if [[ -f "$f" ]]; then
    scp "$f" auro@"${SERVER_IP}":~/bridge/creds/
  else
    echo "WARN: $f not found locally - you'll need to upload manually"
  fi
done
ssh auro@"${SERVER_IP}" "chmod 600 ~/bridge/creds/*.json ~/bridge/creds/*.txt 2>/dev/null; ls -la ~/bridge/creds/"

# ---------------------------------------------------------------------------
# 5) systemd user timer for @every 2 min
# ---------------------------------------------------------------------------
echo "==> [5/N] installing systemd user timer (chat-bridge.service + .timer) ..."
ssh auro@"${SERVER_IP}" bash <<'AURO_EOF'
set -euo pipefail
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/chat-bridge.service <<'SERVICE'
[Unit]
Description=AURO Chat Bridge (one-shot tick)
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=%h/bridge
ExecStart=%h/.venv_bridge/bin/python3 %h/bridge/chat_bridge_v4.py
StandardOutput=append:%h/bridge/logs/stdout.log
StandardError=append:%h/bridge/logs/stderr.log

# env so bridge can find opencode bin if it lives under /usr/local/bin
Environment=PATH=/usr/local/bin:/usr/bin:/bin:%h/.local/bin
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=default.target
SERVICE

cat > ~/.config/systemd/user/chat-bridge.timer <<'TIMER'
[Unit]
Description=AURO Chat Bridge — fire every 2 minutes

[Timer]
OnCalendar=*:0/2
Persistent=true

[Install]
WantedBy=timers.target
TIMER

# Ensure linger so user timers run when auro isn't logged in
sudo loginctl enable-linger auro

systemctl --user daemon-reload
systemctl --user enable --now chat-bridge.timer

echo ""
echo "[$(date -Iseconds)] timer installed. Status:"
systemctl --user list-timers chat-bridge.timer --all --no-pager | head -10
echo ""
echo "Next tick:"
systemctl --user list-timers chat-bridge.timer --all --no-pager | grep -E "(NEXT|LEFT)" | head -2

# Manual smoke check (one tick, then exit)
echo ""
echo "[$(date -Iseconds)] manual smoke (--list, dry-run):"
%h/.venv_bridge/bin/python3 %h/bridge/chat_bridge_v4.py --list 2>&1 | head -10 || true
AURO_EOF

# ---------------------------------------------------------------------------
# 6) confirmation summary
# ---------------------------------------------------------------------------
echo ""
echo "==> ✅ bootstrap complete"
echo ""
echo "Next steps:"
echo "  1. Drop a test message in the Google Chat space ('ping from VPS')"
echo "  2. Watch logs:"
echo "     ssh auro@${SERVER_IP} 'tail -f /home/auro/bridge/logs/stderr.log'"
echo "  3. Verify timer is wired:"
echo "     ssh auro@${SERVER_IP} 'systemctl --user list-timers chat-bridge.timer'"
echo "  4. (Optional) re-update creds anytime:"
echo "     scp ~/.chat_oauth.json auro@${SERVER_IP}:~/bridge/creds/"
echo ""
echo "Note: timer precision may drift ±30s in systemd user mode."
echo ""
