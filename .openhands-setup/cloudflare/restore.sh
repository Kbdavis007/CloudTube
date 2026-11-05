#!/usr/bin/env bash
# Idempotent restore of the Cloudflare agent setup, which lives on the container
# overlay (~, /tmp, /usr/local) and is wiped whenever the sandbox is recycled.
#
#   bash .openhands-setup/cloudflare/restore.sh            # restore anything missing
#   bash .openhands-setup/cloudflare/restore.sh --force    # overwrite files too
#   bash .openhands-setup/cloudflare/restore.sh --force --refresh-skills  # re-download skills
#
# Source of truth for the setup: https://developers.cloudflare.com/agent-setup/prompt.md
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORCE=0
REFRESH_SKILLS=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --refresh-skills) REFRESH_SKILLS=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '  %s\n' "$*"; }

# --- Skills: npx skills add -> ~/.agents/skills (symlinked into OpenHands) ----
# `npx skills add` is itself idempotent, so it is only skipped when the expected
# count is already present and --refresh-skills was not passed.
if [ "$REFRESH_SKILLS" = "1" ] || [ "$(ls -1 "$HOME/.agents/skills" 2>/dev/null | wc -l)" -lt 19 ]; then
  say "installing Cloudflare skills..."
  npx -y skills add cloudflare/skills --skill '*' --yes --global
else
  say "~/.agents/skills already has $(ls -1 "$HOME/.agents/skills" | wc -l) skills (use --refresh-skills to re-download)"
fi

# --- MCP plugin: manifest templates -> ~/.agents/plugins/cloudflare -----------
PLUGIN_DST="$HOME/.agents/plugins/cloudflare"
mkdir -p "$PLUGIN_DST"
for f in plugin.json mcp.json; do
  if [ ! -f "$PLUGIN_DST/$f" ] || [ "$FORCE" = "1" ]; then
    cp "$HERE/$f" "$PLUGIN_DST/$f"
    say "restored $PLUGIN_DST/$f"
  else
    say "$PLUGIN_DST/$f already present (use --force to overwrite)"
  fi
done

# --- cf CLI (beta) -----------------------------------------------------------
if command -v cf >/dev/null 2>&1; then
  say "cf CLI already installed ($(cf --version 2>/dev/null | head -1))"
else
  say "installing cf CLI..."
  sudo npm install -g cf
fi

# --- Agent instruction line (user-level AGENTS.md) ---------------------------
# Appended only if the line is absent, so any other user-level instructions survive.
LINE='When interacting with Cloudflare, use the cf CLI unless the project has a Wrangler configuration file.'
for dst in "$HOME/.openhands/AGENTS.md" "$HOME/.agents/AGENTS.md"; do
  mkdir -p "$(dirname "$dst")"
  touch "$dst"
  if grep -qF "$LINE" "$dst"; then
    say "$dst already has the cf instruction"
  else
    printf '%s\n' "$LINE" >> "$dst"
    say "added the cf instruction to $dst"
  fi
done

echo
say "Cloudflare setup restored."
say "NOTE: Cloudflare MCP OAuth and 'cf auth login' cannot be completed headless —"
say "      the owner must approve them in a browser. Run 'cf auth login' to get a code."
echo "done."
