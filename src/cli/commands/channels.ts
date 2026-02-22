import path from "node:path";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { loadConfig } from "../../config/loader.js";

const N8N_UNIFIED_WORKFLOW = {
  name: "Fahrenheit Unified Gateway Ingest",
  nodes: [
    {
      id: "webhook",
      name: "Ingress",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [200, 260],
      parameters: {
        path: "fahrenheit-ingest",
        httpMethod: "POST",
        responseMode: "responseNode",
      },
    },
    {
      id: "normalize",
      name: "Normalize",
      type: "n8n-nodes-base.set",
      typeVersion: 3,
      position: [460, 260],
      parameters: {
        keepOnlySet: true,
        values: {
          string: [
            { name: "channelId", value: "={{$json.channelId || $json.provider || 'unknown'}}" },
            { name: "sourceId", value: "={{$json.sourceId || $json.chatId || $json.channel || 'unknown'}}" },
            { name: "senderId", value: "={{$json.senderId || $json.user || 'unknown'}}" },
            { name: "senderName", value: "={{$json.senderName || $json.userName || 'unknown'}}" },
            { name: "content", value: "={{$json.content || $json.text || ''}}" },
            { name: "direction", value: "inbound" },
            { name: "mode", value: "={{$json.mode || 'observational'}}" },
          ],
          number: [{ name: "timestamp", value: "={{$json.timestamp || Date.now()}}" }],
        },
      },
    },
    {
      id: "forward",
      name: "Forward to Fahrenheit",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4,
      position: [720, 260],
      parameters: {
        method: "POST",
        url: "={{$env.FAHRENHEIT_GATEWAY_INGEST_URL || 'http://127.0.0.1:8787/ingest'}}",
        sendBody: true,
        contentType: "json",
        jsonBody: "={{$json}}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "Authorization",
              value: "={{'Bearer ' + ($env.FAHRENHEIT_INGEST_TOKEN || '')}}",
            },
          ],
        },
      },
    },
    {
      id: "respond",
      name: "Respond",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1,
      position: [980, 260],
      parameters: {
        respondWith: "json",
        responseBody: "={{$json}}",
      },
    },
  ],
  connections: {
    Ingress: { main: [[{ node: "Normalize", type: "main", index: 0 }]] },
    Normalize: { main: [[{ node: "Forward to Fahrenheit", type: "main", index: 0 }]] },
    "Forward to Fahrenheit": { main: [[{ node: "Respond", type: "main", index: 0 }]] },
  },
  settings: {},
};

function providerReadme(gatewayUrl: string): string {
  return `# Provider Setup (Fahrenheit-first)

This folder contains generated assets to wire providers into Fahrenheit's gateway.

## Recommended path (no node builder required)

1. Run native providers with config/tokens (Telegram/Discord/Slack)
2. Use bridge mode providers by POSTing to \`${gatewayUrl}/ingest\` (Notion comments/WhatsApp/custom)
3. Start gateway and verify:
   - \`GET ${gatewayUrl}/status\`
   - \`GET ${gatewayUrl}/providers\`
   - \`GET ${gatewayUrl}/messages?limit=50\`
4. Send a provider test event:
   - \`POST ${gatewayUrl}/providers/<providerId>/test\`

## Native channels today

- Telegram: implemented
- Discord: implemented
- Slack: implemented
- WhatsApp: native Baileys QR pairing implemented
- Notion comments: bridge/poller mode via provider webhook push

## Optional n8n path

If you like visual workflows, import \`n8n/unified-ingest-workflow.json\`.
`;
}

const ENV_CHECK_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail

required=(
  "CONVEX_URL"
  "FAHRENHEIT_INGEST_TOKEN"
)

optional=(
  "TELEGRAM_BOT_TOKEN"
  "DISCORD_BOT_TOKEN"
  "SLACK_BOT_TOKEN"
  "SLACK_APP_TOKEN"
  "NOTION_API_KEY"
)

echo "Checking required env vars..."
for key in "\${required[@]}"; do
  if [[ -z "\${!key:-}" ]]; then
    echo "MISSING: $key"
    exit 1
  fi
done

echo "Required vars are set."
echo "Checking optional provider vars..."
for key in "\${optional[@]}"; do
  if [[ -z "\${!key:-}" ]]; then
    echo "Optional missing: $key"
  else
    echo "Found: $key"
  fi
done
`;

const SEND_TEST_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail

provider="\${1:-notion-comments}"
gateway_url="\${FAHRENHEIT_GATEWAY_URL:-http://127.0.0.1:8787}"
token="\${FAHRENHEIT_INGEST_TOKEN:-}"

auth_header=()
if [[ -n "$token" ]]; then
  auth_header=(-H "Authorization: Bearer $token")
fi

curl -sS -X POST "$gateway_url/providers/$provider/test" \
  "\${auth_header[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"test from script\",\"mode\":\"observational\"}"
`;

export async function channelsLoginCommand(configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const gatewayUrl = `http://${config.gateway.host}:${config.gateway.port}`;
  const providersDir = path.join(config.workspaceDir, "providers");
  const n8nDir = path.join(providersDir, "n8n");
  const scriptsDir = path.join(providersDir, "scripts");

  await mkdir(n8nDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });

  await writeFile(path.join(providersDir, "README.md"), providerReadme(gatewayUrl), "utf8");
  await writeFile(path.join(n8nDir, "unified-ingest-workflow.json"), JSON.stringify(N8N_UNIFIED_WORKFLOW, null, 2), "utf8");
  const envScriptPath = path.join(scriptsDir, "check-provider-env.sh");
  const sendTestScriptPath = path.join(scriptsDir, "send-provider-test.sh");
  await writeFile(envScriptPath, ENV_CHECK_SCRIPT, "utf8");
  await writeFile(sendTestScriptPath, SEND_TEST_SCRIPT, "utf8");
  await chmod(envScriptPath, 0o755);
  await chmod(sendTestScriptPath, 0o755);

  console.log("Provider scaffold generated:");
  console.log(`- ${path.join(providersDir, "README.md")}`);
  console.log(`- ${path.join(n8nDir, "unified-ingest-workflow.json")}`);
  console.log(`- ${envScriptPath}`);
  console.log(`- ${sendTestScriptPath}`);
  console.log("");
  console.log("Native adapters:");
  console.log(`- Telegram enabled: ${Boolean(config.channels.telegram.enabled && config.channels.telegram.botToken)}`);
  console.log(`- Discord enabled: ${Boolean(config.channels.discord.enabled && config.channels.discord.token)}`);
  console.log(
    `- Slack enabled: ${Boolean(config.channels.slack.enabled && config.channels.slack.botToken && config.channels.slack.appToken)}`,
  );
  console.log(`- WhatsApp enabled: ${Boolean(config.channels.whatsapp.enabled)} (native QR pairing)`);
}
