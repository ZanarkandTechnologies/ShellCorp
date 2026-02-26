/**
 * GATEWAY CONFIG
 * ==============
 * Centralized OpenClaw gateway URL and auth token wiring for the UI.
 */

export const gatewayBase = import.meta.env.VITE_GATEWAY_URL || "http://127.0.0.1:18789";
export const gatewayToken = import.meta.env.VITE_GATEWAY_TOKEN || "";
export const stateBase =
  import.meta.env.VITE_STATE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5173");

export type GatewayConnectionState = "ok" | "unauthorized" | "unreachable" | "error";

export function buildGatewayHeaders(init: HeadersInit = {}): HeadersInit {
  const headers = new Headers(init);
  if (gatewayToken.trim()) {
    const bearer = `Bearer ${gatewayToken.trim()}`;
    headers.set("authorization", bearer);
    // Compatibility header for gateways that expose token header-based auth.
    headers.set("x-openclaw-token", gatewayToken.trim());
  }
  return headers;
}

export function hasGatewayToken(): boolean {
  return gatewayToken.trim().length > 0;
}
