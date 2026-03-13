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
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  SkillItemModel,
  SkillStatusReport,
  ToolsCatalogResult,
} from "@/lib/openclaw-types";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { useGateway } from "@/providers/gateway-provider";
import type { EmployeeData } from "@/lib/types";
import { UI_Z } from "@/lib/z-index";
import { extractAgentId } from "@/lib/entity-utils";
import { buildTeamAiUsageSummary } from "@/lib/session-usage";
import type { AgentConfigDraft, AgentUsageOverview, TabId } from "./_types";
import { OverviewPanel } from "./OverviewTab";
import { FilesPanel } from "./FilesTab";
import { ToolsPanel } from "./ToolsTab";
import { SkillsPanel } from "./SkillsTab";
import { ChannelsPanel } from "./ChannelsTab";
import { CronPanel } from "./CronTab";

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveAgentConfigDraft(config: Record<string, unknown> | null, agentId: string): AgentConfigDraft {
  const agentsNode = config?.agents && typeof config.agents === "object" ? (config.agents as Record<string, unknown>) : {};
  const list = Array.isArray(agentsNode.list) ? agentsNode.list : [];
  const entry = list.find((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return String(row.id ?? row.agentId ?? "").trim() === agentId;
  }) as Record<string, unknown> | undefined;
  const modelNode = entry?.model;
  let primaryModel = "";
  let fallbackModels = "";
  if (typeof modelNode === "string") {
    primaryModel = modelNode;
  } else if (modelNode && typeof modelNode === "object") {
    const row = modelNode as Record<string, unknown>;
    primaryModel = String(row.primary ?? row.model ?? "");
    if (Array.isArray(row.fallbacks)) {
      fallbackModels = row.fallbacks.filter((item): item is string => typeof item === "string").join(", ");
    }
  }
  const toolsNode = entry?.tools && typeof entry.tools === "object" ? (entry.tools as Record<string, unknown>) : {};
  const toolsAllow = Array.isArray(toolsNode.alsoAllow)
    ? toolsNode.alsoAllow.filter((item): item is string => typeof item === "string")
    : [];
  const toolsDeny = Array.isArray(toolsNode.deny) ? toolsNode.deny.filter((item): item is string => typeof item === "string") : [];
  const skillsArray = Array.isArray(entry?.skills) ? entry.skills.filter((item): item is string => typeof item === "string") : null;
  const skillsMode = skillsArray === null ? "all" : skillsArray.length === 0 ? "none" : "selected";
  return {
    primaryModel,
    fallbackModels,
    toolsProfile: typeof toolsNode.profile === "string" ? toolsNode.profile : "",
    toolsAllow,
    toolsDeny,
    skillsMode,
    selectedSkills: skillsArray ?? [],
  };
}

function buildNextConfig(
  currentConfig: Record<string, unknown>,
  agentId: string,
  draft: AgentConfigDraft,
): Record<string, unknown> {
  const next = cloneConfig(currentConfig);
  const root = next as Record<string, unknown>;
  const agentsNode =
    root.agents && typeof root.agents === "object" ? (root.agents as Record<string, unknown>) : ({} as Record<string, unknown>);
  const list = Array.isArray(agentsNode.list) ? (cloneConfig(agentsNode.list) as unknown[]) : [];
  const idx = list.findIndex((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return String(row.id ?? row.agentId ?? "").trim() === agentId;
  });
  const baseEntry =
    idx >= 0 && list[idx] && typeof list[idx] === "object"
      ? (cloneConfig(list[idx]) as Record<string, unknown>)
      : ({ id: agentId } as Record<string, unknown>);

  const primaryModel = draft.primaryModel.trim();
  const fallbackModels = draft.fallbackModels
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (!primaryModel && fallbackModels.length === 0) {
    delete baseEntry.model;
  } else if (fallbackModels.length > 0) {
    baseEntry.model = { primary: primaryModel, fallbacks: fallbackModels };
  } else {
    baseEntry.model = primaryModel;
  }

  const toolsNode =
    baseEntry.tools && typeof baseEntry.tools === "object"
      ? (cloneConfig(baseEntry.tools) as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const profile = draft.toolsProfile.trim();
  if (profile) toolsNode.profile = profile;
  else delete toolsNode.profile;
  if (draft.toolsAllow.length > 0) toolsNode.alsoAllow = [...draft.toolsAllow];
  else delete toolsNode.alsoAllow;
  if (draft.toolsDeny.length > 0) toolsNode.deny = [...draft.toolsDeny];
  else delete toolsNode.deny;
  if (Object.keys(toolsNode).length > 0) baseEntry.tools = toolsNode;
  else delete baseEntry.tools;

  if (draft.skillsMode === "all") {
    delete baseEntry.skills;
  } else if (draft.skillsMode === "none") {
    baseEntry.skills = [];
  } else {
    baseEntry.skills = [...draft.selectedSkills];
  }

  if (idx >= 0) list[idx] = baseEntry;
  else list.push(baseEntry);
  agentsNode.list = list;
  root.agents = agentsNode;
  return next;
}

const EMPTY_DRAFT: AgentConfigDraft = {
  primaryModel: "",
  fallbackModels: "",
  toolsProfile: "",
  toolsAllow: [],
  toolsDeny: [],
  skillsMode: "all",
  selectedSkills: [],
};

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

export function ManageAgentModal(): JSX.Element {
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
  const [skillsReport, setSkillsReport] = useState<SkillStatusReport | null>(null);
  const [fallbackSkills, setFallbackSkills] = useState<SkillItemModel[]>([]);
  const [channelsSnapshot, setChannelsSnapshot] = useState<ChannelsStatusSnapshot | null>(null);
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<AgentConfigDraft>(EMPTY_DRAFT);
  const [baseDraft, setBaseDraft] = useState<AgentConfigDraft>(EMPTY_DRAFT);
  const [usageOverview, setUsageOverview] = useState<AgentUsageOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [filesState, setFilesState] = useState<FilesState>(EMPTY_FILES_STATE);

  const preferredAgentId = extractAgentId(employee?._id ?? null);
  const isDraftDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseDraft), [draft, baseDraft]);
  const activeFile = filesState.activeName ? filesState.list?.files.find((file) => file.name === filesState.activeName) ?? null : null;
  const activeFileBase = activeFile ? filesState.baseByName[activeFile.name] ?? "" : "";
  const activeFileDraft = activeFile ? filesState.draftByName[activeFile.name] ?? activeFileBase : "";
  const isActiveFileDirty = activeFile ? activeFileDraft !== activeFileBase : false;

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("overview");
    setLoadError("");
    setSaveStatus("");
    setFilesState(EMPTY_FILES_STATE);
  }, [isOpen, preferredAgentId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function loadBootstrap(): Promise<void> {
      setIsLoading(true);
      setLoadError("");
      try {
        const [nextAgentsList, configSnapshot, nextChannels, nextCronStatus, nextCronJobs, skillItems] = await Promise.all([
          adapter.getAgentsList(),
          adapter.getConfigSnapshot(),
          adapter.getChannelsStatus(),
          adapter.getCronStatus(),
          adapter.listCronJobs(),
          adapter.listSkills().catch(() => []),
        ]);
        if (cancelled) return;
        setAgentsList(nextAgentsList);
        const pickedAgentId =
          (preferredAgentId && nextAgentsList.agents.some((agent) => agent.id === preferredAgentId) && preferredAgentId) ||
          nextAgentsList.defaultId ||
          nextAgentsList.agents[0]?.id ||
          null;
        setSelectedAgentId(pickedAgentId);
        setConfig(configSnapshot.config);
        setChannelsSnapshot(nextChannels);
        setCronStatus(nextCronStatus);
        setCronJobs(nextCronJobs);
        setFallbackSkills(skillItems);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "bootstrap_load_failed");
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
      if (!selectedAgentId) return;
      const [nextIdentity, nextToolsCatalog, nextSkillsReport] = await Promise.all([
        adapter.getAgentIdentity(selectedAgentId),
        adapter.getToolsCatalog(selectedAgentId),
        adapter.getSkillsStatus(selectedAgentId),
      ]);
      if (cancelled) return;
      setIdentity(nextIdentity);
      setToolsCatalog(nextToolsCatalog);
      setSkillsReport(nextSkillsReport);
      const source = resolveAgentConfigDraft(config, selectedAgentId);
      setDraft(source);
      setBaseDraft(source);
      setSaveStatus("");
    }
    void loadAgentData().catch((error) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : "failed_to_load_agent_data");
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
      let failedSessions = 0;
      try {
        const sessions = (await adapter.listSessions(selectedAgentId)).sort(
          (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
        );
        const usageRows = await Promise.all(
          sessions.map(async (session) => {
            try {
              const timeline = await adapter.getSessionTimeline(selectedAgentId, session.sessionKey, 120);
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
              agentId: selectedAgentId,
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
          ...(failedSessions > 0 ? { unavailableText: `usage unavailable for ${failedSessions} session(s)` } : {}),
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
      setFilesState((current) => ({ ...current, loading: false, error: "gateway_not_connected:agents.files.list" }));
      return;
    }
    if (filesState.list?.agentId === selectedAgentId) return;
    void (async () => {
      setFilesState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const list = await adapter.listAgentFiles(selectedAgentId);
        setFilesState((current) => ({ ...current, list, activeName: list.files[0]?.name ?? null, loading: false }));
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
      setFilesState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const result = await adapter.getAgentFile(selectedAgentId, filesState.activeName as string);
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
  }, [adapter, activeTab, filesState.activeName, filesState.baseByName, gatewayConnected, isOpen, selectedAgentId]);

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
      setFilesState((current) => ({ ...current, loading: false, error: "gateway_not_connected:agents.files.list" }));
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
            : list.files[0]?.name ?? null,
      }));
    } catch (error) {
      setFilesState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "files_refresh_failed",
      }));
    }
  }

  async function refreshSkills(): Promise<void> {
    if (!selectedAgentId) return;
    try {
      const report = await adapter.getSkillsStatus(selectedAgentId);
      if (report) setSkillsReport(report);
      const all = await adapter.listSkills().catch(() => []);
      setFallbackSkills(all);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "skills_refresh_failed");
    }
  }

  async function handleSaveConfig(): Promise<void> {
    if (!selectedAgentId || !config || !isDraftDirty) return;
    setIsSavingConfig(true);
    setSaveStatus("");
    try {
      const nextConfig = buildNextConfig(config, selectedAgentId, draft);
      const result = await adapter.applyConfig(nextConfig, true);
      if (!result.ok) {
        setSaveStatus(result.error ?? "config_save_failed");
        return;
      }
      setConfig(nextConfig);
      setBaseDraft(cloneConfig(draft));
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
      setFilesState((current) => ({ ...current, saving: false, error: "gateway_not_connected:agents.files.set" }));
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
                  ? current.list.files.map((entry) => (entry.name === result.file.name ? (result.file as AgentFileEntry) : entry))
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

  function openSkillStudio(skillId: string): void {
    setSelectedSkillStudioSkillId(skillId);
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
            Configure OpenClaw-backed workspace, tools, skills, channels, and cron settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
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
              <ToolsPanel draft={draft} setDraft={setDraft} toolsCatalog={toolsCatalog} onReloadConfig={refreshConfigOnly} />
            </TabsContent>
            <TabsContent value="skills" className="space-y-4">
              <SkillsPanel
                draft={draft}
                setDraft={setDraft}
                skillsReport={skillsReport}
                fallbackSkills={fallbackSkills}
                onReloadConfig={refreshConfigOnly}
                onRefreshSkills={refreshSkills}
                onOpenSkillStudio={openSkillStudio}
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
          <Button variant="outline" onClick={() => setManageAgentEmployeeId(null)}>
            Close
          </Button>
          <Button onClick={() => void handleSaveConfig()} disabled={!isDraftDirty || isSavingConfig || !selectedAgentId}>
            {isSavingConfig ? "Saving..." : "Save Changes"}
          </Button>
        </div>
        {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}
        {saveStatus ? <p className="text-xs text-muted-foreground">{saveStatus}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
