import { useMemo, useState } from "react";

type DiscoveredSource = {
  id: string;
  title: string;
  url?: string;
  objectType: string;
  lastEditedTime?: string;
};

type MappingProposal = {
  entityType: "task" | "project" | "goal" | "crmRecord";
  databaseId?: string;
  databaseNameHint?: string;
  matchedSourceTitle?: string;
  confidence: number;
  rationale: string;
};

type OnboardingProposal = {
  connectorId: string;
  platform: string;
  discoveredSources: DiscoveredSource[];
  selectedSourceIds: string[];
  mappingProposals: MappingProposal[];
  unresolved: string[];
  generatedSkillPath: string;
  generatedConfigPath: string;
};

interface OnboardingSectionProps {
  gatewayBase: string;
}

interface RpcEnvelope<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "rpc_request_failed";
}

export function OnboardingSection({ gatewayBase }: OnboardingSectionProps): JSX.Element {
  const [connectorId, setConnectorId] = useState<string>("notion");
  const [gatewayToken, setGatewayToken] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("project-alpha");
  const [groupId, setGroupId] = useState<string>("ops");
  const [sessionKey, setSessionKey] = useState<string>("group:ops:main");
  const [sources, setSources] = useState<DiscoveredSource[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [proposal, setProposal] = useState<OnboardingProposal | null>(null);
  const [mappingDraft, setMappingDraft] = useState<Array<{ entityType: string; databaseId: string }>>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [lastResult, setLastResult] = useState<string>("");

  const selectedSourceSet = useMemo(() => new Set(selectedSourceIds), [selectedSourceIds]);

  async function rpcCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (gatewayToken.trim()) headers.authorization = `Bearer ${gatewayToken.trim()}`;
    const response = await fetch(`${gatewayBase}/rpc`, {
      method: "POST",
      headers,
      body: JSON.stringify({ method, params }),
    });
    const payload = (await response.json()) as RpcEnvelope<T>;
    if (!response.ok || !payload.ok || !payload.result) {
      throw new Error(payload.error || "rpc_failed");
    }
    return payload.result;
  }

  function toggleSource(sourceId: string): void {
    setSelectedSourceIds((prev) => {
      if (prev.includes(sourceId)) return prev.filter((entry) => entry !== sourceId);
      return [...prev, sourceId];
    });
  }

  async function discoverSources(): Promise<void> {
    setBusy(true);
    setStatus("");
    try {
      const result = await rpcCall<{ connectorId: string; platform: string; sources: DiscoveredSource[] }>(
        "connector.onboarding.discover",
        { connectorId },
      );
      setSources(result.sources ?? []);
      setSelectedSourceIds((result.sources ?? []).map((source) => source.id));
      setProposal(null);
      setMappingDraft([]);
      setStatus(`Discovered ${result.sources?.length ?? 0} sources for ${result.platform}.`);
      setLastResult(prettyJson(result));
    } catch (error) {
      setStatus(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function proposeMappings(): Promise<void> {
    setBusy(true);
    setStatus("");
    try {
      const result = await rpcCall<OnboardingProposal>("connector.onboarding.propose", {
        connectorId,
        selectedSourceIds,
      });
      setProposal(result);
      setMappingDraft(
        result.mappingProposals.map((mapping) => ({
          entityType: mapping.entityType,
          databaseId: mapping.databaseId ?? "",
        })),
      );
      setStatus(`Generated mapping proposal for ${result.mappingProposals.length} entity types.`);
      setLastResult(prettyJson(result));
    } catch (error) {
      setStatus(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function commitMappings(): Promise<void> {
    setBusy(true);
    setStatus("");
    try {
      const mappings = mappingDraft
        .map((entry) => ({
          entityType: entry.entityType,
          databaseId: entry.databaseId.trim(),
        }))
        .filter((entry) => entry.entityType && entry.databaseId);
      const result = await rpcCall<{
        connectorId: string;
        appliedMappings: number;
        stateVersion: number;
      }>("connector.onboarding.commit", {
        connectorId,
        mappings,
      });
      setStatus(`Committed ${result.appliedMappings} mapping(s).`);
      setLastResult(prettyJson(result));
    } catch (error) {
      setStatus(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function runProof(): Promise<void> {
    setBusy(true);
    setStatus("");
    try {
      const result = await rpcCall<{
        connectorId: string;
        confidence: number;
        generatedSkillPath: string;
        evidencePath: string;
        fetchedCount: number;
      }>("connector.bootstrap.prove", {
        connectorId,
      });
      setStatus(`Proof completed with confidence ${result.confidence.toFixed(2)}.`);
      setLastResult(prettyJson(result));
    } catch (error) {
      setStatus(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function commitProof(): Promise<void> {
    setBusy(true);
    setStatus("");
    try {
      const result = await rpcCall<{
        connectorId: string;
        committed: number;
        blocked: boolean;
      }>("connector.bootstrap.commit", {
        connectorId,
        projectId,
        groupId,
        sessionKey,
      });
      setStatus(result.blocked ? "Proof commit blocked by confidence/policy gate." : `Committed ${result.committed} memory observation(s).`);
      setLastResult(prettyJson(result));
    } catch (error) {
      setStatus(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="onboardingPanel panel">
      <h2>Connector Onboarding (Hybrid)</h2>
      <p className="eyebrow">Discover sources, propose mappings/skills, then commit approved mappings and proof results.</p>

      <div className="controls">
        <input value={connectorId} onChange={(event) => setConnectorId(event.target.value)} placeholder="connectorId (e.g. notion)" />
        <input
          value={gatewayToken}
          onChange={(event) => setGatewayToken(event.target.value)}
          placeholder="gateway bearer token (optional for reads)"
        />
        <button disabled={busy} onClick={() => void discoverSources()}>{busy ? "Working..." : "1) Discover Sources"}</button>
        <button disabled={busy || sources.length === 0} onClick={() => void proposeMappings()}>2) Propose Mappings</button>
      </div>

      {sources.length > 0 ? (
        <article className="panel">
          <h3>Discovered Sources ({sources.length})</h3>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Use</th>
                  <th>Title</th>
                  <th>ID</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedSourceSet.has(source.id)}
                        onChange={() => toggleSource(source.id)}
                      />
                    </td>
                    <td>{source.title}</td>
                    <td>{source.id}</td>
                    <td>{source.objectType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      {proposal ? (
        <article className="panel">
          <h3>Mapping Proposal</h3>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Database ID</th>
                  <th>Confidence</th>
                  <th>Matched Source</th>
                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                {proposal.mappingProposals.map((mapping, index) => (
                  <tr key={`${mapping.entityType}-${index}`}>
                    <td>{mapping.entityType}</td>
                    <td>
                      <input
                        value={mappingDraft[index]?.databaseId ?? ""}
                        onChange={(event) =>
                          setMappingDraft((prev) => prev.map((entry, i) => (i === index ? { ...entry, databaseId: event.target.value } : entry)))
                        }
                      />
                    </td>
                    <td>{mapping.confidence.toFixed(2)}</td>
                    <td>{mapping.matchedSourceTitle ?? "unresolved"}</td>
                    <td>{mapping.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {proposal.unresolved.length > 0 ? (
            <p className="eyebrow">Unresolved entities: {proposal.unresolved.join(", ")}</p>
          ) : null}
          <div className="controls">
            <button disabled={busy} onClick={() => void commitMappings()}>3) Commit Mappings</button>
            <button disabled={busy} onClick={() => void runProof()}>4) Run Proof</button>
          </div>
        </article>
      ) : null}

      <article className="panel">
        <h3>Proof Commit (Dual-Key Partition)</h3>
        <div className="controls">
          <input value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="projectId" />
          <input value={groupId} onChange={(event) => setGroupId(event.target.value)} placeholder="groupId" />
          <input value={sessionKey} onChange={(event) => setSessionKey(event.target.value)} placeholder="sessionKey" />
          <button disabled={busy} onClick={() => void commitProof()}>5) Commit Proof to Memory</button>
        </div>
      </article>

      {status ? <p className="eyebrow">{status}</p> : null}
      <article className="panel">
        <h3>Last RPC Result</h3>
        <pre className="memoryText">{lastResult || "No result yet."}</pre>
      </article>
    </section>
  );
}
