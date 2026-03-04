---
name: shellcorp-status
description: "Optional diagnostics hook that infers status from message events."
metadata: { "openclaw": { "emoji": "📡", "events": ["message:received", "message:sent"] } }
---

# ShellCorp Status Hook

Optional diagnostics-only hook. This path is currently a best-effort fallback and is not reliable for heartbeat visibility, so it should remain disabled by default.
Primary status tracking should use explicit self-report writes to `/status/report`.
