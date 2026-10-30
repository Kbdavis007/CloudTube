#!/usr/bin/env bash
# Idempotent restore of the Agent Canvas sandbox setup that does not survive a recycle.
# Nothing here clobbers an existing file unless you pass --force (or --save for dials).
#
#   bash .openhands-setup/restore.sh            # restore anything missing
#   bash .openhands-setup/restore.sh --force    # overwrite existing files too
#   bash .openhands-setup/restore.sh --save     # fold live lever dials back into the templates
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --save)  SAVE=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '  %s\n' "$*"; }

# --- lever dials: templates/lever.yml -> ~/.copilot/lever.yml -----------------
DIALS_SRC="$HERE/lever.yml"
DIALS_DST="$HOME/.copilot/lever.yml"

if [ "${SAVE:-0}" = "1" ]; then
  if [ -f "$DIALS_DST" ]; then
    # strip the "wrote this" header line's future tense? keep body verbatim.
    cp "$DIALS_DST" "$DIALS_SRC"
    say "saved live dials -> .openhands-setup/lever.yml"
  else
    say "no ~/.copilot/lever.yml to save; leaving template as-is"
  fi
else
  mkdir -p "$HOME/.copilot"
  if [ ! -f "$DIALS_DST" ] || [ "$FORCE" = "1" ]; then
    cp "$DIALS_SRC" "$DIALS_DST"
    say "restored ~/.copilot/lever.yml"
  else
    say "~/.copilot/lever.yml already present (use --force to overwrite)"
  fi
fi

# --- memory files (gitignored locations, but /workspace persists them) --------
restore_mem() {
  src="$1"; dst="$2"
  mkdir -p "$(dirname "$dst")"
  if [ ! -f "$dst" ] || [ "$FORCE" = "1" ]; then
    cp "$src" "$dst"; say "restored $dst"
  else
    say "$dst already present (use --force to overwrite)"
  fi
}
restore_mem "$HERE/memory-project.md" "$REPO/.openhands/memory/MEMORY.md"
restore_mem "$HERE/memory-user.md"    "$HOME/.openhands/memory/MEMORY.md"

echo "done."
