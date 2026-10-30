# .openhands-setup

Durable backup of the Agent Canvas sandbox setup that lives on the container overlay
(`~`, `/tmp`, `/usr/local`) and is **wiped whenever the sandbox is recycled** (idle
timeout or a PID 1 restart). Only `/workspace` survives, so this kit is stored in the
repo tree.

Nothing here is secret: it is a lever dials file and agent memory notes.

## Restore after a sandbox reset

```bash
bash .openhands-setup/restore.sh
```

The script is idempotent — it only writes files that are missing. Flags:

| Flag | Effect |
|---|---|
| *(none)* | restore anything missing; never overwrite |
| `--force` | overwrite existing files too |
| `--save` | copy the live `~/.copilot/lever.yml` back into this directory |

## What it restores

| Template | Destination |
|---|---|
| `lever.yml` | `~/.copilot/lever.yml` (lever dials) |
| `memory-project.md` | `<repo>/.openhands/memory/MEMORY.md` |
| `memory-user.md` | `~/.openhands/memory/MEMORY.md` |

Current dials: autonomy default **L4**, spend **standard**.

## Keeping it current

Change dials live with `/lever autonomy` and `/lever spend`, then run
`bash .openhands-setup/restore.sh --save` to fold them back into `lever.yml` here.
