# Provider Setup (Fahrenheit-first)

This folder contains generated assets to wire providers into Fahrenheit's gateway.

## Recommended path (no node builder required)

1. Run native providers with config/tokens (Telegram/Discord/Slack)
2. Use bridge mode providers by POSTing to `http://127.0.0.1:8787/ingest` (Notion comments/WhatsApp/custom)
3. Start gateway and verify:
   - `GET http://127.0.0.1:8787/status`
   - `GET http://127.0.0.1:8787/providers`
   - `GET http://127.0.0.1:8787/messages?limit=50`
4. Send a provider test event:
   - `POST http://127.0.0.1:8787/providers/<providerId>/test`

## Native channels today

- Telegram: implemented
- Discord: implemented
- Slack: implemented
- WhatsApp: bridge mode now, native Baileys pairing planned
- Notion comments: bridge/poller mode via provider webhook push

## Optional n8n path

If you like visual workflows, import `n8n/unified-ingest-workflow.json`.
