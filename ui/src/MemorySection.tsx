/**
 * MEMORY SECTION UI
 * =================
 * Read-only CEO view for observational memory signals and audit context.
 *
 * KEY CONCEPTS:
 * - Shows operational deltas (not full source clones).
 * - Emphasizes blocker/risk/upsell/improvement signals.
 * - Preserves project/trust filters to avoid context pollution.
 *
 * USAGE:
 * - Mounted inside Gateway UI Memory tab.
 *
 * MEMORY REFERENCES:
 * - MEM-0010
 * - MEM-0013
 */
import { useEffect, useMemo, useState } from "react";

type ObservationSignalType = "blocker" | "risk" | "upsell" | "improvement";
type ObservationTrustClass = "trusted" | "untrusted" | "system";

type ObservationSignal = {
  type: ObservationSignalType;
  label: string;
  confidence: number;
  details?: string;
};

type ObservationEvent = {
  id: string;
  projectId: string;
  groupId: string;
  sessionKey: string;
  eventType: string;
  source: string;
  sourceRef: string;
  occurredAt: string;
  projectTags: string[];
  roleTags: string[];
  summary: string;
  confidence: number;
  trustClass: ObservationTrustClass;
  status: "accepted" | "pending_review";
  signals: ObservationSignal[];
};

type MemoryStats = {
  totalObservations: number;
  pendingReview: number;
  byTrustClass: Record<ObservationTrustClass, number>;
  bySignalType: Record<ObservationSignalType, number>;
  recentActivity: {
    last24h: number;
    last7d: number;
  };
};

interface MemorySectionProps {
  gatewayBase: string;
}

function fmtDate(value: string): string {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return value;
  return new Date(ts).toLocaleString();
}

export function MemorySection({ gatewayBase }: MemorySectionProps): JSX.Element {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [observations, setObservations] = useState<ObservationEvent[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [history, setHistory] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [trustFilter, setTrustFilter] = useState<string>("all");
  const [signalFilter, setSignalFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rollups, setRollups] = useState<Array<{ jobId: string; ts: number; status: string; detail: string }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const sources = useMemo(
    () => [...new Set(observations.map((item) => item.source))].sort((a, b) => a.localeCompare(b)),
    [observations],
  );
  const groups = useMemo(
    () => [...new Set(observations.map((item) => item.groupId))].sort((a, b) => a.localeCompare(b)),
    [observations],
  );
  const projects = useMemo(
    () => [...new Set(observations.flatMap((item) => item.projectTags))].sort((a, b) => a.localeCompare(b)),
    [observations],
  );

  async function refresh(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "250");
      params.set("allowPartitionOverride", "1");
      if (projectFilter !== "all") params.set("projectId", projectFilter);
      if (groupFilter !== "all") params.set("groupId", groupFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (projectFilter !== "all") params.set("projectTag", projectFilter);
      if (trustFilter !== "all") params.set("trustClass", trustFilter);
      if (signalFilter !== "all") params.set("signalType", signalFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const statsParams = new URLSearchParams();
      statsParams.set("allowPartitionOverride", "1");
      if (projectFilter !== "all") statsParams.set("projectId", projectFilter);
      if (groupFilter !== "all") statsParams.set("groupId", groupFilter);
      const [statsRes, observationsRes, summaryRes, historyRes, rollupsRes] = await Promise.all([
        fetch(`${gatewayBase}/memory/stats?${statsParams.toString()}`),
        fetch(`${gatewayBase}/memory/observations?${params.toString()}`),
        fetch(`${gatewayBase}/memory/summary?${statsParams.toString()}`),
        fetch(`${gatewayBase}/memory/history?limit=200&${statsParams.toString()}`),
        fetch(`${gatewayBase}/memory/rollups`),
      ]);
      if (!statsRes.ok || !observationsRes.ok || !summaryRes.ok || !historyRes.ok || !rollupsRes.ok) {
        throw new Error("memory_fetch_failed");
      }
      const statsData = (await statsRes.json()) as { stats: MemoryStats };
      const observationsData = (await observationsRes.json()) as { observations: ObservationEvent[] };
      const summaryData = (await summaryRes.json()) as { content: string };
      const historyData = (await historyRes.json()) as { content: string };
      const rollupsData = (await rollupsRes.json()) as { runs: Array<{ jobId: string; ts: number; status: string; detail: string }> };
      setStats(statsData.stats);
      setObservations(observationsData.observations ?? []);
      setSummary(summaryData.content ?? "");
      setHistory(historyData.content ?? "");
      setRollups(rollupsData.runs ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "memory_fetch_failed");
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    const params = new URLSearchParams();
    params.set("query", trimmed);
    params.set("limit", "100");
    params.set("allowPartitionOverride", "1");
    if (projectFilter !== "all") params.set("projectId", projectFilter);
    if (groupFilter !== "all") params.set("groupId", groupFilter);
    const response = await fetch(`${gatewayBase}/memory/search?${params.toString()}`);
    if (!response.ok) {
      setSearchResults([]);
      return;
    }
    const data = (await response.json()) as { results: string[] };
    setSearchResults(data.results ?? []);
  }

  useEffect(() => {
    void refresh();
  }, [groupFilter, sourceFilter, projectFilter, trustFilter, signalFilter, statusFilter]);

  return (
    <section className="memoryPanel">
      <div className="memoryActions">
        <div className="controls">
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
            <option value="all">all groups</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
            <option value="all">all sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">all projects</option>
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
          <select value={trustFilter} onChange={(event) => setTrustFilter(event.target.value)}>
            <option value="all">all trust</option>
            <option value="trusted">trusted</option>
            <option value="untrusted">untrusted</option>
            <option value="system">system</option>
          </select>
          <select value={signalFilter} onChange={(event) => setSignalFilter(event.target.value)}>
            <option value="all">all signals</option>
            <option value="blocker">blocker</option>
            <option value="risk">risk</option>
            <option value="upsell">upsell</option>
            <option value="improvement">improvement</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">all status</option>
            <option value="accepted">accepted</option>
            <option value="pending_review">pending review</option>
          </select>
          <button onClick={() => void refresh()}>{loading ? "Refreshing..." : "Refresh"}</button>
        </div>
        <div className="controls">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search history + memory..."
          />
          <button onClick={() => void runSearch()}>Search</button>
        </div>
      </div>

      {stats ? (
        <div className="memoryStatsGrid">
          <article className="panel statCard"><p>Total</p><h3>{stats.totalObservations}</h3></article>
          <article className="panel statCard"><p>Pending Review</p><h3>{stats.pendingReview}</h3></article>
          <article className="panel statCard"><p>Blockers</p><h3>{stats.bySignalType.blocker}</h3></article>
          <article className="panel statCard"><p>Risks</p><h3>{stats.bySignalType.risk}</h3></article>
          <article className="panel statCard"><p>Upsell</p><h3>{stats.bySignalType.upsell}</h3></article>
          <article className="panel statCard"><p>Improve</p><h3>{stats.bySignalType.improvement}</h3></article>
        </div>
      ) : null}

      {error ? <p className="eyebrow">{error}</p> : null}

      <div className="tableWrap panel">
        <h2>Observations ({observations.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Source</th>
              <th>Group</th>
              <th>Project</th>
              <th>Trust</th>
              <th>Status</th>
              <th>Confidence</th>
              <th>Signals</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((event) => (
              <tr key={event.id}>
                <td>{fmtDate(event.occurredAt)}</td>
                <td>{event.source}</td>
                <td>{event.groupId}</td>
                <td>{event.projectTags.join(", ") || "unscoped"}</td>
                <td>{event.trustClass}</td>
                <td>{event.status}</td>
                <td>{event.confidence.toFixed(2)}</td>
                <td>{event.signals.map((signal) => signal.type).join(", ") || "none"}</td>
                <td className="content">{event.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <article className="panel">
        <h2>Nightly Group Rollups ({rollups.length})</h2>
        <ul className="memorySearchResults">
          {rollups.map((run) => (
            <li key={`${run.jobId}-${run.ts}`}>
              {fmtDate(new Date(run.ts).toISOString())} | {run.jobId} | {run.status} | {run.detail}
            </li>
          ))}
        </ul>
      </article>

      <div className="memoryTextGrid">
        <article className="panel">
          <h2>Durable Memory</h2>
          <pre className="memoryText">{summary || "No durable memory entries yet."}</pre>
        </article>
        <article className="panel">
          <h2>History</h2>
          <pre className="memoryText">{history || "No history entries yet."}</pre>
        </article>
      </div>

      <article className="panel">
        <h2>Search Results</h2>
        <ul className="memorySearchResults">
          {searchResults.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
