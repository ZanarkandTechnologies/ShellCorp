import { useEffect, useMemo, useState } from "react";

type GatewayMessage = {
  channelId: string;
  sourceId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  direction: "inbound" | "outbound";
  mode: "conversational" | "observational";
  metadata?: Record<string, unknown>;
};

type ProviderStatus = {
  providerId: string;
  enabled: boolean;
  connected: boolean;
  mode: "native" | "bridge";
  lastError?: string;
};

type ProviderEntry = {
  setup: { title: string; summary: string };
  status: ProviderStatus;
};

type ConfigChannelsResponse = { channels: Record<string, unknown> };
type ConfigGroupsResponse = { groups: Record<string, unknown> };

const gatewayBase = import.meta.env.VITE_GATEWAY_URL || "http://127.0.0.1:8787";

function fmt(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function App(): JSX.Element {
  const [messages, setMessages] = useState<GatewayMessage[]>([]);
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [limit, setLimit] = useState<number>(100);
  const [channelsDraft, setChannelsDraft] = useState<string>("{}");
  const [groupsDraft, setGroupsDraft] = useState<string>("{}");
  const [applyStatus, setApplyStatus] = useState<string>("");
  const [isApplying, setIsApplying] = useState<boolean>(false);

  const groups = useMemo(
    () =>
      [...new Set(messages.map((message) => String(message.metadata?.groupId ?? "ungrouped")))]
        .sort((a, b) => a.localeCompare(b)),
    [messages],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((message) => {
      const groupId = String(message.metadata?.groupId ?? "ungrouped");
      if (selectedProvider !== "all" && message.channelId !== selectedProvider) return false;
      if (selectedGroup !== "all" && groupId !== selectedGroup) return false;
      if (!q) return true;
      const hay = [
        message.content,
        message.senderName,
        message.senderId,
        message.sourceId,
        message.channelId,
        groupId,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [messages, search, selectedProvider, selectedGroup]);

  async function refresh(): Promise<void> {
    const [providersRes, messagesRes, channelsRes, groupsRes] = await Promise.all([
      fetch(`${gatewayBase}/providers`),
      fetch(`${gatewayBase}/messages?limit=${limit}`),
      fetch(`${gatewayBase}/config/channels`),
      fetch(`${gatewayBase}/config/groups`),
    ]);
    if (!providersRes.ok || !messagesRes.ok || !channelsRes.ok || !groupsRes.ok) {
      throw new Error("ui_fetch_failed");
    }
    const providersData = (await providersRes.json()) as { providers: ProviderEntry[] };
    const messagesData = (await messagesRes.json()) as { messages: GatewayMessage[] };
    const channelsData = (await channelsRes.json()) as ConfigChannelsResponse;
    const groupsData = (await groupsRes.json()) as ConfigGroupsResponse;
    setProviders(providersData.providers ?? []);
    setMessages(messagesData.messages ?? []);
    setChannelsDraft(JSON.stringify(channelsData.channels ?? {}, null, 2));
    setGroupsDraft(JSON.stringify(groupsData.groups ?? {}, null, 2));
  }

  async function applyChanges(): Promise<void> {
    setIsApplying(true);
    setApplyStatus("");
    try {
      const channels = JSON.parse(channelsDraft) as Record<string, unknown>;
      const groups = JSON.parse(groupsDraft) as Record<string, unknown>;
      const response = await fetch(`${gatewayBase}/config/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channels, groups }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "config_apply_failed");
      }
      setApplyStatus("Applied and reloaded successfully.");
      await refresh();
    } catch (error) {
      setApplyStatus(error instanceof Error ? error.message : "config_apply_failed");
    } finally {
      setIsApplying(false);
    }
  }

  async function reloadConfig(): Promise<void> {
    setIsApplying(true);
    setApplyStatus("");
    try {
      const response = await fetch(`${gatewayBase}/config/reload`, { method: "POST" });
      if (!response.ok) throw new Error("config_reload_failed");
      setApplyStatus("Reloaded runtime config.");
      await refresh();
    } catch (error) {
      setApplyStatus(error instanceof Error ? error.message : "config_reload_failed");
    } finally {
      setIsApplying(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [limit]);

  return (
    <main className="app">
      <header className="panel topbar">
        <div>
          <p className="eyebrow">Bahamut Gateway</p>
          <h1>Provider Surface Monitor</h1>
        </div>
        <div className="controls">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search content / sender / source..."
          />
          <select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>
            <option value="all">all groups</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
          <button onClick={() => void refresh()}>Refresh</button>
        </div>
      </header>

      <section className="panel">
        <h2>Providers</h2>
        <div className="providers">
          <button className={selectedProvider === "all" ? "active" : ""} onClick={() => setSelectedProvider("all")}>
            all
          </button>
          {providers.map((provider) => (
            <button
              key={provider.status.providerId}
              className={selectedProvider === provider.status.providerId ? "active" : ""}
              onClick={() => setSelectedProvider(provider.status.providerId)}
            >
              {provider.setup.title} · {provider.status.connected ? "connected" : "offline"}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Events ({rows.length})</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Provider</th>
                <th>Group</th>
                <th>Source</th>
                <th>Sender</th>
                <th>Mode</th>
                <th>Direction</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((message, index) => {
                const groupId = String(message.metadata?.groupId ?? "ungrouped");
                return (
                  <tr key={`${message.timestamp}-${message.channelId}-${index}`}>
                    <td>{fmt(message.timestamp)}</td>
                    <td>{message.channelId}</td>
                    <td>{groupId}</td>
                    <td>{message.sourceId}</td>
                    <td>{message.senderName || message.senderId}</td>
                    <td>{message.mode}</td>
                    <td>{message.direction}</td>
                    <td className="content">{message.content}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Channels/Groups Config</h2>
        <p className="eyebrow">Edit JSON and apply live without restarting gateway.</p>
        <div className="configGrid">
          <label>
            Channels JSON
            <textarea value={channelsDraft} onChange={(event) => setChannelsDraft(event.target.value)} rows={14} />
          </label>
          <label>
            Groups JSON
            <textarea value={groupsDraft} onChange={(event) => setGroupsDraft(event.target.value)} rows={14} />
          </label>
        </div>
        <div className="controls">
          <button disabled={isApplying} onClick={() => void applyChanges()}>
            {isApplying ? "Applying..." : "Apply Changes"}
          </button>
          <button disabled={isApplying} onClick={() => void reloadConfig()}>
            Reload Runtime
          </button>
          <button disabled={isApplying} onClick={() => void refresh()}>
            Reset From Live
          </button>
        </div>
        {applyStatus ? <p className="eyebrow">{applyStatus}</p> : null}
      </section>
    </main>
  );
}
