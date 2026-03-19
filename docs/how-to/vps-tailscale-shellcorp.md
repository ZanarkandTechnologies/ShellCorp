# ShellCorp On A VPS With Tailscale Serve

This runbook covers the deployment shape where:

- OpenClaw gateway stays on the VPS
- ShellCorp UI stays on the VPS
- both services bind to loopback
- Tailscale Serve exposes them to the private tailnet
- ShellCorp is mounted under `/shellcorp` instead of `/`

## Runtime Model

ShellCorp uses two separate browser-facing surfaces:

- `Gateway URL`: the OpenClaw gateway HTTP/WebSocket endpoint
- `State Bridge URL`: the ShellCorp Vite app origin/path that serves `/openclaw/...` bridge routes for the UI

When ShellCorp is mounted under `/shellcorp`, the browser-facing values are different:

- `Gateway URL` should point at the OpenClaw gateway endpoint
- `State Bridge URL` should point at the ShellCorp path

Example:

- `Gateway URL` = `https://lester.bicorn-ghoul.ts.net`
- `State Bridge URL` = `https://lester.bicorn-ghoul.ts.net/shellcorp`

Do not enter `http://127.0.0.1:18789` in the UI unless the browser is running on the VPS itself. From another machine, `127.0.0.1` means that other machine, not the VPS.

## Prerequisites

- OpenClaw onboarding already completed on the VPS
- `openclaw gateway` works locally on the VPS
- ShellCorp repo checked out on the VPS
- Tailscale installed and logged into the same tailnet

Recommended local bind shape on the VPS:

- OpenClaw gateway: `127.0.0.1:18789`
- ShellCorp UI/state bridge: `127.0.0.1:5173`

## Start The Services

From the ShellCorp repo on the VPS:

```bash
npm install
npm run shell -- onboarding
npm run shell -- ui
```

From the OpenClaw environment on the VPS:

```bash
openclaw gateway
```

Keep both processes running before testing the Tailscale ingress.

## Tailscale Serve Layout

If `/` is reserved for the OpenClaw gateway and ShellCorp must live under `/shellcorp`, use a serve config with both of these rules:

- `/shellcorp` -> ShellCorp Vite app
- `/shellcorp/openclaw` -> ShellCorp Vite bridge `/openclaw`

That second rule is required because ShellCorp's bridge only handles upstream paths beginning with `/openclaw/...`.

Example serve config:

```json
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "lester.bicorn-ghoul.ts.net:443": {
      "Handlers": {
        "/shellcorp/openclaw": {
          "Proxy": "http://127.0.0.1:5173/openclaw"
        },
        "/shellcorp": {
          "Proxy": "http://127.0.0.1:5173/shellcorp"
        },
        "/n8n": {
          "Proxy": "http://127.0.0.1:5678"
        },
        "/": {
          "Proxy": "http://127.0.0.1:18789"
        }
      }
    }
  }
}
```

Important:

- `/shellcorp/openclaw` must be more specific than `/shellcorp`
- the `/shellcorp/openclaw` proxy target must strip the `/shellcorp` prefix and forward to `http://127.0.0.1:5173/openclaw`
- if `/shellcorp/openclaw/...` goes upstream as `/shellcorp/openclaw/...`, the ShellCorp bridge will miss and return the SPA HTML instead of JSON

## ShellCorp UI Settings

From another computer on the tailnet:

1. Open `https://lester.bicorn-ghoul.ts.net/shellcorp`
2. Open ShellCorp Settings
3. Enter:

```text
Gateway URL: https://lester.bicorn-ghoul.ts.net
Gateway Token: <your-openclaw-token>
State Bridge URL: https://lester.bicorn-ghoul.ts.net/shellcorp
```

Why:

- `Gateway URL` should target the OpenClaw gateway at `/`
- `State Bridge URL` should target the ShellCorp app path because the UI reads `stateBase + /openclaw/...`

## Verification

Run these checks from another machine on the same tailnet.

ShellCorp bridge check:

```bash
curl -i https://lester.bicorn-ghoul.ts.net/shellcorp/openclaw/agents
```

Expected:

- `content-type: application/json`
- JSON payload describing agents

Not expected:

- `content-type: text/html`
- the ShellCorp `index.html` page

Gateway check:

```bash
curl -i https://lester.bicorn-ghoul.ts.net/
```

Expected:

- response from the OpenClaw gateway or Control UI

## Common Failure Modes

### `/shellcorp/openclaw/agents` returns HTML

Cause:

- Tailscale Serve is forwarding `/shellcorp/openclaw/...` to Vite without stripping `/shellcorp`

Fix:

- add a dedicated `/shellcorp/openclaw` rule that proxies to `http://127.0.0.1:5173/openclaw`

### Gateway shows disconnected

Cause:

- `Gateway URL` points at `127.0.0.1`
- wrong token
- OpenClaw gateway is not reachable behind `/`

Fix:

- use the tailnet URL, not loopback
- confirm the token matches the OpenClaw gateway token
- confirm `openclaw gateway` is running on the VPS

### Bridge reads fail but the page loads

Cause:

- `State Bridge URL` is wrong
- `/shellcorp/openclaw` path is not proxied correctly

Fix:

- set `State Bridge URL` to the public ShellCorp path, for example `https://lester.bicorn-ghoul.ts.net/shellcorp`
- verify `curl -i https://<magicdns>/shellcorp/openclaw/agents` returns JSON

## Notes

- ShellCorp under `/shellcorp` requires both the frontend path handling and the bridge path handling to agree.
- OpenClaw `gateway.controlUi.basePath` applies to OpenClaw's built-in Control UI, not to ShellCorp's Vite state bridge.
- If you do not need `/shellcorp`, the simplest setup is to serve ShellCorp at `/` and move the OpenClaw gateway to a separate hostname or port.
