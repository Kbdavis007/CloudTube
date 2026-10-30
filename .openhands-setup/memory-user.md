# User Memory

## Sandbox persistence (IMPORTANT)
- `~` (and `/usr/local`, `/tmp`) live on the container overlay and are RESET whenever the
  sandbox is recycled (e.g. after idle timeout, PID 1 restarts). Only `/workspace` persists.
- Durable setup backup + idempotent restore live at `/workspace/project/.openhands-setup/`.
  After a reset run: `bash /workspace/project/.openhands-setup/restore.sh`.

## Preferences
- Lever dials (first set 2026-10-30): autonomy default **L4** (gated self-merge once
  CI + review pass), spend **standard**.
- When interacting with Cloudflare, use the cf CLI unless the project has a Wrangler config.
