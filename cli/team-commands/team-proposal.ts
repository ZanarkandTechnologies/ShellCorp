/**
 * TEAM PROPOSAL COMMANDS
 * ======================
 * Purpose
 * - Persist, review, and execute CEO-generated team proposals through the ShellCorp CLI.
 *
 * KEY CONCEPTS:
 * - Proposal state lives in sidecar company data so UI, CLI, and skills share one workflow contract.
 * - Execution reuses existing team/business/bootstrap utilities instead of inventing a second runtime path.
 *
 * USAGE:
 * - shellcorp team proposal create --json-input '{"businessType":"affiliate_marketing","ideaBrief":{"focus":"...","targetCustomer":"...","primaryGoal":"...","constraints":"..."}}'
 * - shellcorp team proposal list --json
 * - shellcorp team proposal execute --proposal-id proposal-123 --json
 *
 * MEMORY REFERENCES:
 * - MEM-0153
 */
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import {
  type CompanyAgentModel,
  type CompanyModel,
  type SidecarStore,
  applyAgentSkillsByMode,
  asRecord,
  buildAutoAgents,
  buildAutoRoleSlots,
  buildBusinessAgents,
  buildBusinessRoleSlots,
  buildTeamBusinessSkillTargets,
  copyBusinessHeartbeatTemplates,
  defaultBusinessConfig,
  defaultProjectResources,
  ensureBusinessHeartbeatProfiles,
  ensureCommandPermission,
  ensureProjectAccount,
  formatOutput,
  parseBusinessType,
  projectIdFromTeamId,
  provisionOpenclawAgents,
  toSlug,
  uniqueSkills,
  upsertBusinessCronJobs,
  upsertTeamCluster,
} from "./_shared.js";
import { postBoardCommand } from "./_convex.js";
import {
  canExecuteProposalRoles,
  createTeamProposal,
  type TeamProposalCreateInput,
} from "../../ui/src/lib/team-proposal.js";
import type {
  TeamProposalApprovalStatus,
  TeamProposalBusinessConfig,
  TeamProposalModel,
} from "../../ui/src/lib/openclaw-types.js";

type CompanyWithProposals = CompanyModel & {
  teamProposals?: TeamProposalModel[];
};

function asCompanyWithProposals(company: CompanyModel): CompanyWithProposals {
  return company as CompanyWithProposals;
}

function readProposalList(company: CompanyModel): TeamProposalModel[] {
  return [...(asCompanyWithProposals(company).teamProposals ?? [])].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
}

async function writeProposalList(
  store: SidecarStore,
  company: CompanyModel,
  proposals: TeamProposalModel[],
): Promise<void> {
  await store.writeCompanyModel({
    ...company,
    teamProposals: proposals,
  } as CompanyModel);
}

async function readCreatePayload(opts: {
  jsonInput?: string;
  jsonFile?: string;
}): Promise<TeamProposalCreateInput> {
  const raw =
    opts.jsonInput?.trim() ||
    (opts.jsonFile?.trim() ? await readFile(opts.jsonFile.trim(), "utf-8") : "");
  if (!raw) {
    throw new Error("missing_proposal_payload:use_--json-input_or_--json-file");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_proposal_json");
  }
  const row = asRecord(parsed);
  const ideaBriefRow = asRecord(row.ideaBrief);
  const proposedConfigRow = asRecord(row.proposedBusinessConfig);
  const skillsRow = asRecord(proposedConfigRow.capabilitySkills);
  const businessType = parseBusinessType(
    String(row.businessType ?? proposedConfigRow.businessType ?? "custom").trim(),
  );
  return {
    businessType,
    requestedBy: typeof row.requestedBy === "string" ? row.requestedBy : undefined,
    sourceAgentId: typeof row.sourceAgentId === "string" ? row.sourceAgentId : undefined,
    title: typeof row.title === "string" ? row.title : undefined,
    researchSummary: typeof row.researchSummary === "string" ? row.researchSummary : undefined,
    proposalSummary: typeof row.proposalSummary === "string" ? row.proposalSummary : undefined,
    proposedTeamName: typeof row.proposedTeamName === "string" ? row.proposedTeamName : undefined,
    proposedDescription:
      typeof row.proposedDescription === "string" ? row.proposedDescription : undefined,
    reviewTaskTitle: typeof row.reviewTaskTitle === "string" ? row.reviewTaskTitle : undefined,
    ideaBrief: {
      focus: typeof ideaBriefRow.focus === "string" ? ideaBriefRow.focus : "",
      targetCustomer:
        typeof ideaBriefRow.targetCustomer === "string" ? ideaBriefRow.targetCustomer : "",
      primaryGoal: typeof ideaBriefRow.primaryGoal === "string" ? ideaBriefRow.primaryGoal : "",
      constraints: typeof ideaBriefRow.constraints === "string" ? ideaBriefRow.constraints : "",
      ...(typeof ideaBriefRow.notes === "string" && ideaBriefRow.notes.trim()
        ? { notes: ideaBriefRow.notes }
        : {}),
    },
    proposedRoles: Array.isArray(row.proposedRoles)
      ? (row.proposedRoles as TeamProposalModel["proposedRoles"])
      : undefined,
    proposedInitialBoardItems: Array.isArray(row.proposedInitialBoardItems)
      ? (row.proposedInitialBoardItems as TeamProposalModel["proposedInitialBoardItems"])
      : undefined,
    proposedBusinessConfig: {
      businessType,
      capabilitySkills: {
        measure: typeof skillsRow.measure === "string" ? skillsRow.measure : undefined,
        execute: typeof skillsRow.execute === "string" ? skillsRow.execute : undefined,
        distribute: typeof skillsRow.distribute === "string" ? skillsRow.distribute : undefined,
      },
    } as Partial<TeamProposalBusinessConfig>,
  };
}

function patchProposalDecision(
  proposal: TeamProposalModel,
  approvalStatus: TeamProposalApprovalStatus,
  note?: string,
): TeamProposalModel {
  return {
    ...proposal,
    approvalStatus,
    ...(note?.trim() ? { approvalNote: note.trim() } : {}),
    updatedAt: Date.now(),
  };
}

async function syncBusinessSkillsForProject(
  store: SidecarStore,
  company: CompanyModel,
  projectId: string,
): Promise<void> {
  const project = company.projects.find((entry) => entry.id === projectId);
  if (!project?.businessConfig) return;
  const pmAgent = company.agents.find(
    (entry) => entry.projectId === projectId && entry.role === "biz_pm",
  );
  const executorAgent = company.agents.find(
    (entry) => entry.projectId === projectId && entry.role === "biz_executor",
  );
  if (!pmAgent || !executorAgent) return;

  const targets = buildTeamBusinessSkillTargets(project);
  const targetByAgentId = new Map<string, string[]>([
    [pmAgent.agentId, targets.pmSkills],
    [executorAgent.agentId, targets.executorSkills],
  ]);
  const openclawConfig = await store.readOpenclawConfig();
  const agentsNode = asRecord(openclawConfig.agents);
  const currentList = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
  const nextList = currentList.map((entry) => {
    const row = asRecord(entry);
    const agentId = typeof row.id === "string" ? row.id.trim() : "";
    if (!agentId || !targetByAgentId.has(agentId)) return row;
    const existingSkills = Array.isArray(row.skills)
      ? row.skills.filter((item): item is string => typeof item === "string")
      : [];
    return {
      ...row,
      skills: applyAgentSkillsByMode(
        existingSkills,
        targetByAgentId.get(agentId) ?? [],
        "replace_minimum",
      ),
    };
  });
  await store.writeOpenclawConfig({
    ...openclawConfig,
    agents: {
      ...agentsNode,
      list: nextList,
    },
  });
}

async function createTeamFromProposal(
  store: SidecarStore,
  proposal: TeamProposalModel,
): Promise<{ teamId: string; projectId: string }> {
  const businessType = proposal.proposedBusinessConfig.businessType;
  const slug = toSlug(proposal.proposedTeamName) || `${Date.now()}`;
  const teamId = `team-proj-${slug}`;
  const projectId = projectIdFromTeamId(teamId);

  let company = await store.readCompanyModel();
  if (company.projects.some((entry) => entry.id === projectId)) {
    throw new Error(`team_exists:${teamId}`);
  }
  if (businessType !== "custom") {
    company = ensureBusinessHeartbeatProfiles(company);
  }

  const project = {
    id: projectId,
    departmentId: company.departments[1]?.id ?? company.departments[0]?.id ?? "dept-products",
    name: proposal.proposedTeamName,
    githubUrl: "",
    status: "active" as const,
    goal: proposal.ideaBrief.primaryGoal.trim(),
    kpis: uniqueSkills(["proposal_approved", "heartbeat_progress"]),
    ...(businessType !== "custom"
      ? {
          businessConfig: {
            ...defaultBusinessConfig(businessType),
            type: businessType,
            slots: {
              measure: {
                category: "measure" as const,
                skillId: proposal.proposedBusinessConfig.capabilitySkills.measure.trim(),
                config: {},
              },
              execute: {
                category: "execute" as const,
                skillId: proposal.proposedBusinessConfig.capabilitySkills.execute.trim(),
                config: {},
              },
              distribute: {
                category: "distribute" as const,
                skillId: proposal.proposedBusinessConfig.capabilitySkills.distribute.trim(),
                config: {},
              },
            },
          },
        }
      : {}),
    account: {
      id: `${projectId}:account`,
      projectId,
      currency: "USD",
      balanceCents: 0,
      updatedAt: new Date().toISOString(),
    },
    accountEvents: [],
    ledger: [],
    experiments: [],
    metricEvents: [],
    resources: businessType !== "custom" ? defaultProjectResources(projectId) : [],
    resourceEvents: [],
  };

  let createdAgents: CompanyAgentModel[] = [];
  let nextCompany: CompanyModel = {
    ...company,
    projects: [...company.projects, project],
  };

  if (businessType !== "custom") {
    createdAgents = buildBusinessAgents(projectId, slug);
    nextCompany = {
      ...nextCompany,
      roleSlots: [...nextCompany.roleSlots, ...buildBusinessRoleSlots(projectId)],
      agents: [...nextCompany.agents, ...createdAgents],
    };
    await copyBusinessHeartbeatTemplates(createdAgents.map((agent) => agent.agentId));
    await upsertBusinessCronJobs(
      projectId,
      createdAgents.map((agent) => agent.agentId),
    );
  } else {
    const autoRoles = proposal.proposedRoles
      .map((role) => role.mappedRuntimeRole)
      .filter(
        (role): role is "builder" | "growth_marketer" | "pm" =>
          role === "builder" || role === "growth_marketer" || role === "pm",
      );
    createdAgents = buildAutoAgents(projectId, slug, autoRoles);
    nextCompany = {
      ...nextCompany,
      roleSlots: [...nextCompany.roleSlots, ...buildAutoRoleSlots(projectId, autoRoles)],
      agents: [...nextCompany.agents, ...createdAgents],
    };
  }

  await store.writeCompanyModel(nextCompany);
  await provisionOpenclawAgents({ store, agents: createdAgents, projectName: project.name });

  const officeObjects = await store.readOfficeObjects();
  await store.writeOfficeObjects(
    upsertTeamCluster(officeObjects, {
      teamId,
      name: project.name,
      description:
        proposal.proposedDescription.trim() || `CEO-proposed team for ${proposal.ideaBrief.focus}.`,
    }),
  );

  if (businessType !== "custom") {
    const refreshedCompany = await store.readCompanyModel();
    await syncBusinessSkillsForProject(store, refreshedCompany, projectId);
  }

  return { teamId, projectId };
}

async function bootstrapProposalBoardItems(
  proposal: TeamProposalModel,
  projectId: string,
  teamId: string,
): Promise<string | undefined> {
  if (proposal.proposedInitialBoardItems.length === 0) return undefined;
  if (!process.env.SHELLCORP_CONVEX_SITE_URL?.trim() && !process.env.CONVEX_SITE_URL?.trim()) {
    return undefined;
  }
  try {
    for (const item of proposal.proposedInitialBoardItems) {
      await postBoardCommand({
        projectId,
        teamId,
        command: "task_add",
        taskId: item.id,
        title: item.title,
        detail: item.detail,
        actorType: "agent",
        actorAgentId: proposal.sourceAgentId,
      });
    }
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function registerTeamProposal(team: Command, store: SidecarStore): void {
  const proposal = team.command("proposal").description("Manage CEO-generated team proposals");

  proposal
    .command("list")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const proposals = readProposalList(company);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, proposals },
        proposals.length === 0
          ? "No team proposals found."
          : proposals
              .map(
                (entry) =>
                  `${entry.id} | ${entry.proposedTeamName} | ${entry.approvalStatus} | ${entry.executionStatus}`,
              )
              .join("\n"),
      );
    });

  proposal
    .command("show")
    .requiredOption("--proposal-id <proposalId>", "Proposal id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { proposalId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const entry = readProposalList(company).find(
        (proposalEntry) => proposalEntry.id === opts.proposalId.trim(),
      );
      if (!entry) {
        throw new Error(`proposal_not_found:${opts.proposalId}`);
      }
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, proposal: entry },
        `${entry.id} | ${entry.proposedTeamName} | ${entry.approvalStatus} | ${entry.executionStatus}`,
      );
    });

  proposal
    .command("create")
    .option("--json-input <json>", "Inline proposal JSON payload")
    .option("--json-file <path>", "Path to proposal JSON payload")
    .option("--json", "Output JSON", false)
    .action(async (opts: { jsonInput?: string; jsonFile?: string; json?: boolean }) => {
      ensureCommandPermission("team.meta.write");
      const payload = await readCreatePayload(opts);
      const proposalEntry = createTeamProposal(payload);
      const company = await store.readCompanyModel();
      await writeProposalList(store, company, [proposalEntry, ...readProposalList(company)]);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, proposal: proposalEntry },
        `Created proposal ${proposalEntry.id} for ${proposalEntry.proposedTeamName}`,
      );
    });

  for (const action of [
    { name: "approve", status: "approved" },
    { name: "reject", status: "rejected" },
    { name: "request-changes", status: "changes_requested" },
  ] as const) {
    proposal
      .command(action.name)
      .requiredOption("--proposal-id <proposalId>", "Proposal id")
      .option("--note <note>", "Founder decision note")
      .option("--json", "Output JSON", false)
      .action(async (opts: { proposalId: string; note?: string; json?: boolean }) => {
        ensureCommandPermission("team.meta.write");
        const company = await store.readCompanyModel();
        const proposals = readProposalList(company);
        const existing = proposals.find((entry) => entry.id === opts.proposalId.trim());
        if (!existing) {
          throw new Error(`proposal_not_found:${opts.proposalId}`);
        }
        const updated = patchProposalDecision(existing, action.status, opts.note);
        await writeProposalList(
          store,
          company,
          proposals.map((entry) => (entry.id === updated.id ? updated : entry)),
        );
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, proposal: updated },
          `${action.name} -> ${updated.id}`,
        );
      });
  }

  proposal
    .command("execute")
    .requiredOption("--proposal-id <proposalId>", "Proposal id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { proposalId: string; json?: boolean }) => {
      ensureCommandPermission("team.meta.write");
      ensureCommandPermission("team.business.write");
      ensureCommandPermission("team.board.write");
      const company = await store.readCompanyModel();
      const proposals = readProposalList(company);
      const existing = proposals.find((entry) => entry.id === opts.proposalId.trim());
      if (!existing) throw new Error(`proposal_not_found:${opts.proposalId}`);
      if (existing.ideaGateStatus !== "passed") throw new Error("proposal_not_ready");
      if (existing.approvalStatus !== "approved") throw new Error("proposal_not_approved");
      if (
        !canExecuteProposalRoles(
          existing.proposedRoles,
          existing.proposedBusinessConfig.businessType,
        )
      ) {
        throw new Error("proposal_contains_unsupported_roles");
      }

      const creatingProposal: TeamProposalModel = {
        ...existing,
        executionStatus: "creating",
        executionError: undefined,
        updatedAt: Date.now(),
      };
      await writeProposalList(
        store,
        company,
        proposals.map((entry) => (entry.id === existing.id ? creatingProposal : entry)),
      );

      let finalProposal: TeamProposalModel;
      try {
        const { teamId, projectId } = await createTeamFromProposal(store, creatingProposal);
        const boardBootstrapError = await bootstrapProposalBoardItems(
          creatingProposal,
          projectId,
          teamId,
        );
        finalProposal = {
          ...creatingProposal,
          approvalStatus: "approved",
          executionStatus: boardBootstrapError ? "failed" : "created",
          ...(boardBootstrapError ? { executionError: boardBootstrapError } : {}),
          createdTeamId: teamId,
          createdProjectId: projectId,
          updatedAt: Date.now(),
        };
      } catch (error) {
        finalProposal = {
          ...creatingProposal,
          executionStatus: "failed",
          executionError: error instanceof Error ? error.message : String(error),
          updatedAt: Date.now(),
        };
      }

      const refreshedCompany = await store.readCompanyModel();
      const refreshedProposals = readProposalList(refreshedCompany).map((entry) =>
        entry.id === finalProposal.id ? finalProposal : entry,
      );
      await writeProposalList(store, refreshedCompany, refreshedProposals);

      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: finalProposal.executionStatus === "created",
          proposal: finalProposal,
          teamId: finalProposal.createdTeamId,
          projectId: finalProposal.createdProjectId,
          error: finalProposal.executionError,
        },
        finalProposal.executionStatus === "created"
          ? `Executed proposal ${finalProposal.id} -> ${finalProposal.createdTeamId}`
          : `Proposal execution failed: ${finalProposal.executionError ?? "unknown_error"}`,
      );
    });
}
