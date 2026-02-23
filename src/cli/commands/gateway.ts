import { GatewayServer } from "../../gateway/server.js";

export async function gatewayCommand(configPath?: string): Promise<void> {
  const server = new GatewayServer();
  await server.start(configPath);
  console.log("Gateway is running. Open http://127.0.0.1:8787/ui");
  // Keep process alive.
  process.stdin.resume();
  const stop = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
