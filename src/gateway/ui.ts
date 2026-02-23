/**
 * Gateway UI handoff page.
 *
 * Responsibility:
 * - Redirect users to the separate TypeScript UI app when configured.
 * - Provide a minimal fallback message when UI app is not running.
 */
export function renderGatewayUi(uiUrl: string): string {
  const escapedUrl = uiUrl.replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bahamut Gateway UI</title>
  <meta http-equiv="refresh" content="0;url=${escapedUrl}" />
  <style>
    body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; background: #0a0f17; color: #d7dde8; display: grid; place-items: center; min-height: 100vh; }
    .card { max-width: 720px; border: 1px solid #253041; border-radius: 12px; padding: 24px; background: #101826; }
    a { color: #4fd0ff; }
  </style>
</head>
<body>
  <section class="card">
    <h1>Gateway UI moved to TypeScript app</h1>
    <p>Redirecting to <a href="${escapedUrl}">${escapedUrl}</a>.</p>
    <p>If it does not open, start the UI app with <code>pnpm run ui</code>.</p>
  </section>
</body>
</html>`;
}
