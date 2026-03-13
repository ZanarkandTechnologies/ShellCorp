"use client";

/**
 * MANAGE AGENT MODAL
 * ==================
 * Zanarkand-style modal shell with parity tabs while backend
 * capabilities are being wired for ShellCorp.
 *
 * KEY CONCEPTS:
 * - All tab state lives here and is passed down via props (no context needed at this scale).
 * - Tab panels are co-located in sibling files (OverviewTab, FilesTab, etc.).
 *
 * MEMORY REFERENCES:
 * - MEM-0143: office-modal hot path stays non-blocking
 * - MEM-0144 refactor: Phase 3c folder split
 * - MEM-0188
 */

import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { useAppStore } from "@/lib/app-store";
import type {
  AgentFileEntry,
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  ToolsCatalogResult,
} from "@/lib/openclaw-types";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { useGateway } from "@/providers/gateway-provider";
import { UI_Z } from "@/lib/z-index";
import { extractAgentId } from "@/lib/entity-utils";
import { buildTeamAiUsageSummary } from "@/lib/session-usage";
import type { AgentConfigDraft, AgentUsageOverview, TabId } from "./_types";
import {
  buildNextAgentConfig,
  cloneAgentConfigDraft,
  EMPTY_AGENT_CONFIG_DRAFT,
  resolveAgentConfigDraft,
} from "./config-draft";
import { OverviewPanel } from "./OverviewTab";
import { FilesPanel } from "./FilesTab";
import { ToolsPanel } from "./ToolsTab";
import { ChannelsPanel } from "./ChannelsTab";
import { CronPanel } from "./CronTab";

type FilesState = {
  list: AgentsFilesListResult | null;
  activeName: string | null;
  baseByName: Record<string, string>;
  draftByName: Record<string, string>;
  loading: boolean;
  saving: boolean;
  error: string;
};

const EMPTY_FILES_STATE: FilesState = {
  list: null,
  activeName: null,
  baseByName: {},
  draftByName: {},
  loading: false,
  saving: false,
  error: "",
};

export function ManageAgentModal(): ReactElement {
  const manageAgentEmployeeId = useAppStore((state) => state.manageAgentEmployeeId);
  const setManageAgentEmployeeId = useAppStore((state) => state.setManageAgentEmployeeId);
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const { employees } = useOfficeDataContext();
  const employee = employees.find((row) => row._id === manageAgentEmployeeId) ?? null;
  const isOpen = !!manageAgentEmployeeId;
  const { connected: gatewayConnected } = useGateway();
  const adapter = useOpenClawAdapter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [agentsList, setAgentsList] = useState<AgentsListResult | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<AgentIdentityResult | null>(null);
  const [toolsCatalog, setToolsCatalog] = useState<ToolsCatalogResult | null>(null);
  const [channelsSnapshot, setChannelsSnapshot] = useState<ChannelsStatusSnapshot | null>(null);
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<AgentConfigDraft>(EMPTY_AGENT_CONFIG_DRAFT);
  const [baseDraft, setBaseDraft] = useState<AgentConfigDraft>(EMPTY_AGENT_CONFIG_DRAFT);
  const [usageOverview, setUsageOverview] = useState<AgentUsageOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [filesState, setFilesState] = useState<FilesState>(EMPTY_FILES_STATE);

  const preferredAgentId = extractAgentId(employee?._id ?? null);
  const isDraftDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseDraft),
    [draft, baseDraft],
  );
  const activeFile = filesState.activeName
    ? (filesState.list?.files.find((file) => file.name === filesState.activeName) ?? null)
    : null;
  const activeFileBase = activeFile ? (filesState.baseByName[activeFile.name] ?? "") : "";
  const activeFileDraft = activeFile
    ? (filesState.draftByName[activeFile.name] ?? activeFileBase)
    : "";
  const isActiveFileDirty = activeFile ? activeFileDraft !== activeFileBase : false;

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("overview");
    setLoadError("");
    setSaveStatus("");
    setFilesState(EMPTY_FILES_STATE);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function loadBootstrap(): Promise<void> {
      setIsLoading(true);
      setLoadError("");
      try {
        const [
          nextAgentsList,
          configSnapshot,
          nextChannels,
          nextCronStatus,
          nextCronJobs,
        ] = await Promise.all([
          adapter.getAgentsList(),
          adapter.getConfigSnapshot(),
          adapter.getChannelsStatus(),
          adapter.getCronStatus(),
          adapter.listCronJobs(),
        ]);
        if (cancelled) return;
        setAgentsList(nextAgentsList);
        const pickedAgentId =
          (preferredAgentId &&
            nextAgentsList.agents.some((agent) => agent.id === preferredAgentId) &&
            preferredAgentId) ||
          nextAgentsList.defaultId ||
          nextAgentsList.agents[0]?.id ||
          null;
        setSelectedAgentId(pickedAgentId);
        setConfig(configSnapshot.config);
        setChannelsSnapshot(nextChannels);
        setCronStatus(nextCronStatus);
        setCronJobs(nextCronJobs);
      } catch (error) {
        if (!cancelled)
          setLoadError(error instanceof Error ? error.message : "bootstrap_load_failed");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadBootstrap();
    return () => {
      cancelled = true;
    };
  }, [adapter, isOpen, preferredAgentId]);

  useEffect(() => {
    if (!isOpen || !selectedAgentId || !config) return;
    let cancelled = false;
    async function loadAgentData(): Promise<void> {
      const agentId = selectedAgentId;
      if (!agentId) return;
      const [nextIdentity, nextToolsCatalog] = await Promise.all([
        adapter.getAgentIdentity(agentId),
        adapter.getToolsCatalog(agentId),
      ]);
      if (cancelled) return;
      setIdentity(nextIdentity);
      setToolsCatalog(nextToolsCatalog);
      const source = resolveAgentConfigDraft(config, agentId);
      setDraft(source);
      setBaseDraft(source);
      setSaveStatus("");
    }
    void loadAgentData().catch((error) => {
      if (!cancelled)
        setLoadError(error instanceof Error ? error.message : "failed_to_load_agent_data");
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, isOpen, selectedAgentId, config]);

  useEffect(() => {
    if (!isOpen || !selectedAgentId) {
      setUsageOverview(null);
      return;
    }
    let cancelled = false;
    async function loadUsageOverview(): Promise<void> {
      const agentId = selectedAgentId;
      if (!agentId) return;
      let failedSessions = 0;
      try {
        const sessions = (await adapter.listSessions(agentId)).sort(
          (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
        );
        const usageRows = await Promise.all(
          sessions.map(async (session) => {
            try {
              const timeline = await adapter.getSessionTimeline(agentId, session.sessionKey, 120);
              return {
                sessionKey: session.sessionKey,
                updatedAt: session.updatedAt,
                usageSummary: timeline.usageSummary,
              };
            } catch {
              failedSessions += 1;
              return {
                sessionKey: session.sessionKey,
                updatedAt: session.updatedAt,
                usageSummary: undefined,
              };
            }
          }),
        );
        if (cancelled) return;
        const latestSessionWithUsage =
          usageRows.find((row) => row.usageSummary)?.usageSummary ?? undefined;
        const summary = buildTeamAiUsageSummary(
          usageRows
            .filter((row) => row.usageSummary)
            .map((row) => ({
              agentId,
              occurredAt: row.updatedAt,
              usageSummary: row.usageSummary,
            })),
        );
        setUsageOverview({
          latestSession: latestSessionWithUsage,
          cost24hUsd: summary.cost24hUsd,
          cost7dUsd: summary.cost7dUsd,
          totalTrackedCostUsd: summary.totalTrackedCostUsd,
          totalTokens: summary.totalTokens,
          trackedSessions: summary.trackedSessions,
          ...(failedSessions > 0
            ? { unavailableText: `usage unavailable for ${failedSessions} session(s)` }
            : {}),
        });
      } catch (error) {
        if (!cancelled) {
          setUsageOverview({
            cost24hUsd: 0,
            cost7dUsd: 0,
            totalTrackedCostUsd: 0,
            totalTokens: 0,
            trackedSessions: 0,
            unavailableText: error instanceof Error ? error.message : "usage_load_failed",
          });
        }
      }
    }
    void loadUsageOverview();
    return () => {
      cancelled = true;
    };
  }, [adapter, isOpen, selectedAgentId]);

  useEffect(() => {
    if (!isOpen || !selectedAgentId || activeTab !== "files") return;
    if (!gatewayConnected) {
      setFilesState((current) => ({
        ...current,
        loading: false,
        error: "gateway_not_connected:agents.files.list",
      }));
      return;
    }
    if (filesState.list?.agentId === selectedAgentId) return;
    void (async () => {
      const agentId = selectedAgentId;
      if (!agentId) return;
      setFilesState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const list = await adapter.listAgentFiles(agentId);
        setFilesState((current) => ({
          ...current,
          list,
          activeName: list.files[0]?.name ?? null,
          loading: false,
        }));
      } catch (error) {
        setFilesState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "files_load_failed",
        }));
      }
    })();
  }, [adapter, activeTab, filesState.list?.agentId, gatewayConnected, isOpen, selectedAgentId]);

  useEffect(() => {
    if (!isOpen || activeTab !== "files" || !selectedAgentId || !filesState.activeName) return;
    if (!gatewayConnected) return;
    if (Object.hasOwn(filesState.baseByName, filesState.activeName)) return;
    void (async () => {
      const agentId = selectedAgentId;
      const activeName = filesState.activeName;
      if (!agentId || !activeName) return;
      setFilesState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const result = await adapter.getAgentFile(agentId, activeName);
        const content = result.file.content ?? "";
        setFilesState((current) => ({
          ...current,
          loading: false,
          baseByName: { ...current.baseByName, [result.file.name]: content },
          draftByName: { ...current.draftByName, [result.file.name]: content },
        }));
      } catch (error) {
        setFilesState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "file_load_failed",
        }));
      }
    })();
  }, [
    adapter,
    activeTab,
    filesState.activeName,
    filesState.baseByName,
    gatewayConnected,
    isOpen,
    selectedAgentId,
  ]);

  async function refreshConfigOnly(): Promise<void> {
    if (!selectedAgentId) return;
    try {
      const snapshot = await adapter.getConfigSnapshot();
      setConfig(snapshot.config);
      const nextDraft = resolveAgentConfigDraft(snapshot.config, selectedAgentId);
      setDraft(nextDraft);
      setBaseDraft(nextDraft);
      setSaveStatus("Config reloaded.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "config_reload_failed");
    }
  }

  async function refreshFilesList(): Promise<void> {
    if (!selectedAgentId) return;
    if (!gatewayConnected) {
      setFilesState((current) => ({
        ...current,
        loading: false,
        error: "gateway_not_connected:agents.files.list",
      }));
      return;
    }
    setFilesState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const list = await adapter.listAgentFiles(selectedAgentId);
      setFilesState((current) => ({
        ...current,
        list,
        loading: false,
        activeName:
          current.activeName && list.files.some((file) => file.name === current.activeName)
            ? current.activeName
            : (list.files[0]?.name ?? null),
      }));
    } catch (error) {
      setFilesState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "files_refresh_failed",
      }));
    }
  }

  async function handleSaveConfig(): Promise<void> {
    if (!selectedAgentId || !config || !isDraftDirty) return;
    setIsSavingConfig(true);
    setSaveStatus("");
    try {
      const nextConfig = buildNextAgentConfig(config, selectedAgentId, draft);
      const result = await adapter.applyConfig(nextConfig, true);
      if (!result.ok) {
        setSaveStatus(result.error ?? "config_save_failed");
        return;
      }
      setConfig(nextConfig);
      setBaseDraft(cloneAgentConfigDraft(draft));
      setSaveStatus("Config saved.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "config_save_failed");
    } finally {
      setIsSavingConfig(false);
    }
  }

  async function handleSaveFile(): Promise<void> {
    if (!selectedAgentId || !activeFile) return;
    if (!gatewayConnected) {
      setFilesState((current) => ({
        ...current,
        saving: false,
        error: "gateway_not_connected:agents.files.set",
      }));
      return;
    }
    const content = activeFileDraft;
    setFilesState((current) => ({ ...current, saving: true, error: "" }));
    try {
      const result = await adapter.saveAgentFile(selectedAgentId, activeFile.name, content);
      setFilesState((current) => ({
        ...current,
        saving: false,
        baseByName: { ...current.baseByName, [result.file.name]: content },
        draftByName: { ...current.draftByName, [result.file.name]: content },
        list:
          current.list && current.list.agentId === result.agentId
            ? {
                ...current.list,
                files: current.list.files.some((entry) => entry.name === result.file.name)
                  ? current.list.files.map((entry) =>
                      entry.name === result.file.name ? (result.file as AgentFileEntry) : entry,
                    )
                  : [...current.list.files, result.file as AgentFileEntry],
              }
            : current.list,
      }));
    } catch (error) {
      setFilesState((current) => ({
        ...current,
        saving: false,
        error: error instanceof Error ? error.message : "file_save_failed",
      }));
    }
  }

  function openSkillStudio(): void {
    if (!selectedAgentId) return;
    setSelectedSkillStudioSkillId(null);
    setSkillStudioFocusAgentId(selectedAgentId);
    setIsSkillsPanelOpen(true);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setManageAgentEmployeeId(null)}>
      <DialogContent className="sm:max-w-4xl min-h-[90vh]" style={{ zIndex: UI_Z.panelElevated }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Manage Agent: {employee?.name ?? "Agent"}
          </DialogTitle>
          <DialogDescription>
            Configure OpenClaw-backed workspace, tools, channels, and cron settings. Per-agent
            skill allowlists now live in Skill Studio.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabId)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
          </TabsList>
          <ScrollArea className="h-full min-h-[65vh] max-h-[65vh] mt-4 pr-3">
            <TabsContent value="overview" className="space-y-4">
              <OverviewPanel
                employee={employee}
                agentsList={agentsList}
                selectedAgentId={selectedAgentId}
                setSelectedAgentId={setSelectedAgentId}
                identity={identity}
                draft={draft}
                setDraft={setDraft}
                isLoading={isLoading}
                usageOverview={usageOverview}
              />
            </TabsContent>
            <TabsContent value="files" className="space-y-4">
              <FilesPanel
                state={filesState}
                setState={setFilesState}
                activeFile={activeFile}
                activeFileDraft={activeFileDraft}
                isActiveFileDirty={isActiveFileDirty}
                onSaveFile={handleSaveFile}
                onRefreshFiles={refreshFilesList}
              />
            </TabsContent>
            <TabsContent value="tools" className="space-y-4">
              <ToolsPanel
                draft={draft}
                setDraft={setDraft}
                toolsCatalog={toolsCatalog}
                onReloadConfig={refreshConfigOnly}
              />
            </TabsContent>
            <TabsContent value="channels" className="space-y-4">
              <ChannelsPanel snapshot={channelsSnapshot} />
            </TabsContent>
            <TabsContent value="cron" className="space-y-4">
              <CronPanel status={cronStatus} jobs={cronJobs} selectedAgentId={selectedAgentId} />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={openSkillStudio} disabled={!selectedAgentId}>
            Open Skill Studio
          </Button>
          <Button variant="outline" onClick={() => setManageAgentEmployeeId(null)}>
            Close
          </Button>
          <Button
            onClick={() => void handleSaveConfig()}
            disabled={!isDraftDirty || isSavingConfig || !selectedAgentId}
          >
            {isSavingConfig ? "Saving..." : "Save Changes"}
          </Button>
        </div>
        {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}
        {saveStatus ? <p className="text-xs text-muted-foreground">{saveStatus}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
