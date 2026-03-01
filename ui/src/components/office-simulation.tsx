import OfficeScene from './office-scene';
// import ChatDialog from './dialogs/chat-dialog';
import { TeamOptionsDialog } from './dialogs/team-options-dialog';
import { useOfficeDataContext } from '@/providers/office-data-provider';
import { useAppStore } from '@/lib/app-store';

// Main Office Simulation Component
export default function OfficeSimulation() {
    // Fetch office data from database (reactive!)
    const { company, teams, employees, desks, officeObjects, isLoading } = useOfficeDataContext();

    // Get team options dialog state from app store with selectors
    const isTeamOptionsDialogOpen = useAppStore(state => state.isTeamOptionsDialogOpen);
    const setIsTeamOptionsDialogOpen = useAppStore(state => state.setIsTeamOptionsDialogOpen);
    const activeTeamForOptions = useAppStore(state => state.activeTeamForOptions);

    // Get company ID from the first team (all teams should have same companyId)
    const companyId = company?._id;

    if (isLoading) {
        return (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>Loading office data...</div>
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

            {/* <ChatDialog /> */}

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
