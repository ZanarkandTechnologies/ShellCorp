import OfficeScene from './office-scene';
import { useEffect, useMemo, useState } from 'react';
import { TeamOptionsDialog } from './dialogs/team-options-dialog';
import SettingsDialog from './dialogs/settings-dialog';
import { LogsDrawer } from './hud/logs-drawer';
import { LogsToggleButton } from './hud/logs-toggle-button';
import { OfficeMenu } from './hud/office-menu';
import { useOfficeDataContext } from '@/providers/office-data-provider';
import { useAppStore } from '@/lib/app-store';
import { gatewayBase } from '@/lib/gateway-config';
import ChatDialog from '@/features/chat-system/components/chat-dialog';
import { AgentMemoryPanel } from '@/features/office-system/components/agent-memory-panel';
import { AgentSessionPanel } from '@/features/office-system/components/agent-session-panel';
import { ManageAgentModal } from '@/features/office-system/components/manage-agent-modal';
import { SkillsPanel } from '@/features/office-system/components/skills-panel';
import { TrainingModal } from '@/features/self-improvement-system/components/training-modal';
import { TeamPanel } from '@/features/team-system/components/team-panel';
import { preloadMeshes } from '@/features/office-system/systems/mesh-cache';

// Main Office Simulation Component
export default function OfficeSimulation() {
    // Fetch office data from database (reactive!)
    const { company, teams, employees, desks, officeObjects, isLoading } = useOfficeDataContext();

    // Get team options dialog state from app store with selectors
    const isTeamOptionsDialogOpen = useAppStore(state => state.isTeamOptionsDialogOpen);
    const setIsTeamOptionsDialogOpen = useAppStore(state => state.setIsTeamOptionsDialogOpen);
    const activeTeamForOptions = useAppStore(state => state.activeTeamForOptions);
    const trainingEmployeeId = useAppStore(state => state.trainingEmployeeId);
    const setTrainingEmployeeId = useAppStore(state => state.setTrainingEmployeeId);
    const isTeamPanelOpen = useAppStore(state => state.isTeamPanelOpen);
    const setIsTeamPanelOpen = useAppStore(state => state.setIsTeamPanelOpen);
    const activeTeamId = useAppStore(state => state.activeTeamId);
    const kanbanFocusAgentId = useAppStore(state => state.kanbanFocusAgentId);
    const isGlobalTeamPanelOpen = useAppStore(state => state.isGlobalTeamPanelOpen);
    const setIsGlobalTeamPanelOpen = useAppStore(state => state.setIsGlobalTeamPanelOpen);
    const setKanbanFocusAgentId = useAppStore(state => state.setKanbanFocusAgentId);
    const isSettingsModalOpen = useAppStore(state => state.isSettingsModalOpen);
    const setIsSettingsModalOpen = useAppStore(state => state.setIsSettingsModalOpen);
    const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState(false);

    // Get company ID from the first team (all teams should have same companyId)
    const companyId = company?._id;

    const customMeshUrls = useMemo(() => {
        return officeObjects
            .filter((obj) => obj.meshType === "custom-mesh")
            .map((obj) => typeof obj.metadata?.meshPublicPath === "string" ? obj.metadata.meshPublicPath : "")
            .filter(Boolean);
    }, [officeObjects]);

    const [meshesReady, setMeshesReady] = useState(customMeshUrls.length === 0);

    useEffect(() => {
        if (customMeshUrls.length === 0) {
            setMeshesReady(true);
            return;
        }
        setMeshesReady(false);
        preloadMeshes(customMeshUrls).then(() => setMeshesReady(true));
    }, [customMeshUrls]);

    if (isLoading || !meshesReady) {
        return (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>{isLoading ? "Loading office data..." : "Loading custom meshes..."}</div>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <OfficeScene
                teams={teams}
                employees={employees}
                desks={desks}
                officeObjects={officeObjects}
                companyId={companyId}
            />

            <ChatDialog />
            <AgentMemoryPanel />
            <ManageAgentModal />
            <TrainingModal
                isOpen={!!trainingEmployeeId}
                onOpenChange={(open) => {
                    if (!open) {
                        setTrainingEmployeeId(null);
                    }
                }}
                employeeName={employees.find((employee) => employee._id === trainingEmployeeId)?.name ?? "Agent"}
            />
            <TeamPanel
                teamId={activeTeamId}
                isOpen={isTeamPanelOpen}
                onOpenChange={(open) => setIsTeamPanelOpen(open)}
                initialTab={kanbanFocusAgentId ? "kanban" : "overview"}
                focusAgentId={kanbanFocusAgentId}
            />
            <TeamPanel
                teamId={null}
                isOpen={isGlobalTeamPanelOpen}
                onOpenChange={(open) => {
                    setIsGlobalTeamPanelOpen(open);
                    if (!open) setKanbanFocusAgentId(null);
                }}
                globalMode
            />
            <AgentSessionPanel />
            <SkillsPanel />
            <SettingsDialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen} />

            <div className="pointer-events-none absolute top-4 left-4 z-[70]">
                <div className="pointer-events-auto">
                    <OfficeMenu />
                </div>
            </div>

            <div className="pointer-events-none absolute bottom-4 right-4 z-[65]">
                <LogsToggleButton isOpen={isLogsDrawerOpen} onToggle={() => setIsLogsDrawerOpen((prev) => !prev)} />
            </div>

            <LogsDrawer open={isLogsDrawerOpen} onOpenChange={setIsLogsDrawerOpen} gatewayBase={gatewayBase} />

            {/* Team Options Dialog - rendered outside Canvas to access ConvexProvider */}
            {activeTeamForOptions && (
                <TeamOptionsDialog
                    team={activeTeamForOptions}
                    isOpen={isTeamOptionsDialogOpen}
                    onOpenChange={setIsTeamOptionsDialogOpen}
                />
            )}
        </div>
    );
}
