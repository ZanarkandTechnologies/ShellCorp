/**
 * TEAM RESOURCES COMMANDS
 * ========================
 * Purpose
 * - Advisory resource management: list, events, set, refresh, remove.
 * - Resource reservation and release.
 * - Resource demo seeding.
 */
import { Command } from "commander";
import {
  type SidecarStore,
  type ResourceEventModel,
  ensureCommandPermission,
  resolveProjectOrFail,
  parseResourceKind,
  parseResourceEventKind,
  defaultProjectResources,
  defaultResourceId,
  ensureProjectResources,
  ensureProjectAccount,
  formatOutput,
  fail,
} from "./_shared.js";
import { tryLogCliActivity } from "./_convex.js";

export function registerTeamResources(team: Command, store: SidecarStore): void {
  const resources = team.command("resources").description("Manage advisory resources for a team");

  resources
    .command("list")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const rows = project.resources ?? [];
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, resources: rows },
        rows.length === 0
          ? `${opts.teamId} has no resources`
          : rows
              .map(
                (entry) =>
                  `${entry.id} | ${entry.type} | ${entry.remaining}/${entry.limit} ${entry.unit}`,
              )
              .join("\n"),
      );
    });

  resources
    .command("events")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option(
      "--limit <limit>",
      "Max events to show",
      (value) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_limit:${value}`);
        return parsed;
      },
      20,
    )
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; limit: number; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const rows = (project.resourceEvents ?? []).slice().reverse().slice(0, opts.limit);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, events: rows },
        rows.length === 0
          ? `${opts.teamId} has no resource events`
          : rows
              .map(
                (entry) =>
                  `${entry.ts} | ${entry.kind} | ${entry.resourceId} | delta=${entry.delta} | after=${entry.remainingAfter}`,
              )
              .join("\n"),
      );
    });

  resources
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--type <type>", "cash_budget|api_quota|distribution_slots|custom")
    .option("--resource-id <resourceId>", "Resource id override")
    .option("--name <name>", "Display name")
    .option("--unit <unit>", "Unit label")
    .requiredOption("--remaining <value>", "Remaining amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_remaining:${value}`);
      return parsed;
    })
    .requiredOption("--limit <value>", "Limit amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_limit:${value}`);
      return parsed;
    })
    .option("--reserved <value>", "Reserved amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_reserved:${value}`);
      return parsed;
    })
    .option("--tracker-skill-id <skillId>", "Resource tracker skill id")
    .option("--refresh-cadence-minutes <minutes>", "Refresh cadence in minutes", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_refresh_cadence:${value}`);
      return parsed;
    })
    .option("--soft-limit <value>", "Soft limit", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_soft_limit:${value}`);
      return parsed;
    })
    .option("--hard-limit <value>", "Hard limit", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_hard_limit:${value}`);
      return parsed;
    })
    .option("--when-low <mode>", "warn|deprioritize_expensive_tasks|ask_pm_review", "warn")
    .option("--event-kind <kind>", "refresh|consumption|adjustment", "adjustment")
    .option("--source <source>", "Event source", "team.resources.set")
    .option("--note <note>", "Event note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        type: string;
        resourceId?: string;
        name?: string;
        unit?: string;
        remaining: number;
        limit: number;
        reserved?: number;
        trackerSkillId?: string;
        refreshCadenceMinutes?: number;
        softLimit?: number;
        hardLimit?: number;
        whenLow: string;
        eventKind: string;
        source: string;
        note?: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.resources.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const type = parseResourceKind(opts.type);
        const resourceId = opts.resourceId?.trim() || defaultResourceId(projectId, type);
        const existingResources = project.resources ?? defaultProjectResources(projectId);
        const existing = existingResources.find((entry) => entry.id === resourceId);
        const trackerSkillId =
          opts.trackerSkillId?.trim() ||
          existing?.trackerSkillId ||
          (type === "cash_budget"
            ? "resource-cash-tracker"
            : type === "api_quota"
              ? "resource-api-quota-tracker"
              : type === "distribution_slots"
                ? "resource-distribution-tracker"
                : "resource-custom-tracker");
        const nextResource = {
          id: resourceId,
          projectId,
          type,
          name: opts.name?.trim() || existing?.name || type,
          unit:
            opts.unit?.trim() || existing?.unit || (type === "cash_budget" ? "usd_cents" : "units"),
          remaining: opts.remaining,
          limit: opts.limit,
          ...(typeof opts.reserved === "number"
            ? { reserved: opts.reserved }
            : existing?.reserved !== undefined
              ? { reserved: existing.reserved }
              : {}),
          trackerSkillId,
          ...(typeof opts.refreshCadenceMinutes === "number"
            ? { refreshCadenceMinutes: opts.refreshCadenceMinutes }
            : existing?.refreshCadenceMinutes !== undefined
              ? { refreshCadenceMinutes: existing.refreshCadenceMinutes }
              : {}),
          policy: {
            advisoryOnly: true as const,
            ...(typeof opts.softLimit === "number"
              ? { softLimit: opts.softLimit }
              : existing?.policy.softLimit !== undefined
                ? { softLimit: existing.policy.softLimit }
                : {}),
            ...(typeof opts.hardLimit === "number"
              ? { hardLimit: opts.hardLimit }
              : existing?.policy.hardLimit !== undefined
                ? { hardLimit: existing.policy.hardLimit }
                : {}),
            whenLow: (opts.whenLow === "deprioritize_expensive_tasks" ||
            opts.whenLow === "ask_pm_review"
              ? opts.whenLow
              : "warn") as "warn" | "deprioritize_expensive_tasks" | "ask_pm_review",
          },
          ...(existing?.metadata ? { metadata: existing.metadata } : {}),
        };
        const nextResources = existingResources.filter((entry) => entry.id !== resourceId);
        nextResources.push(nextResource);
        const prevRemaining = existing?.remaining ?? 0;
        const event: ResourceEventModel = {
          id: `resource-event-${projectId}-${Date.now()}`,
          projectId,
          resourceId,
          ts: new Date().toISOString(),
          kind: parseResourceEventKind(opts.eventKind),
          delta: nextResource.remaining - prevRemaining,
          remainingAfter: nextResource.remaining,
          source: opts.source,
          ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        };
        const nextProject = {
          ...project,
          account: project.account ?? ensureProjectAccount(projectId, project),
          accountEvents: project.accountEvents ?? [],
          resources: nextResources,
          resourceEvents: [...(project.resourceEvents ?? []), event],
          ledger: project.ledger ?? [],
          experiments: project.experiments ?? [],
          metricEvents: project.metricEvents ?? [],
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        });
        await tryLogCliActivity({
          projectId,
          teamId: opts.teamId.trim(),
          activityType: "status",
          label: `resource_set:${resourceId}`,
          detail: `remaining=${nextResource.remaining} limit=${nextResource.limit}`,
          source: opts.source,
          beatId: opts.beatId,
        });
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            teamId: opts.teamId,
            resourceId,
            remaining: nextResource.remaining,
            limit: nextResource.limit,
          },
          `Updated resource '${resourceId}' for ${opts.teamId}`,
        );
      },
    );

  resources
    .command("refresh")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .requiredOption("--remaining <value>", "Remaining amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_remaining:${value}`);
      return parsed;
    })
    .option("--source <source>", "Event source", "resource_tracker")
    .option("--note <note>", "Event note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        resourceId: string;
        remaining: number;
        source: string;
        note?: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.resources.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const existingResources = project.resources ?? defaultProjectResources(projectId);
        const current = existingResources.find((entry) => entry.id === opts.resourceId.trim());
        if (!current) fail(`resource_not_found:${opts.resourceId}`);
        const nextResources = existingResources.map((entry) =>
          entry.id === current.id ? { ...entry, remaining: opts.remaining } : entry,
        );
        const event: ResourceEventModel = {
          id: `resource-event-${projectId}-${Date.now()}`,
          projectId,
          resourceId: current.id,
          ts: new Date().toISOString(),
          kind: "refresh",
          delta: opts.remaining - current.remaining,
          remainingAfter: opts.remaining,
          source: opts.source,
          ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) =>
            entry.id === projectId
              ? {
                  ...entry,
                  resources: nextResources,
                  resourceEvents: [...(entry.resourceEvents ?? []), event],
                }
              : entry,
          ),
        });
        await tryLogCliActivity({
          projectId,
          teamId: opts.teamId.trim(),
          activityType: "status",
          label: `resource_refresh:${current.id}`,
          detail: `remaining=${opts.remaining}`,
          source: opts.source,
          beatId: opts.beatId,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, resourceId: current.id, remaining: opts.remaining },
          `Refreshed resource '${current.id}' for ${opts.teamId}`,
        );
      },
    );

  resources
    .command("remove")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .option("--source <source>", "Event source", "team.resources.remove")
    .option("--note <note>", "Event note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        resourceId: string;
        source: string;
        note?: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.resources.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const resourceId = opts.resourceId.trim();
        const existing = (project.resources ?? []).find((entry) => entry.id === resourceId);
        if (!existing) fail(`resource_not_found:${opts.resourceId}`);
        const event: ResourceEventModel = {
          id: `resource-event-${projectId}-${Date.now()}`,
          projectId,
          resourceId,
          ts: new Date().toISOString(),
          kind: "adjustment",
          delta: -existing.remaining,
          remainingAfter: 0,
          source: opts.source,
          ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) =>
            entry.id === projectId
              ? {
                  ...entry,
                  resources: (entry.resources ?? []).filter((row) => row.id !== resourceId),
                  resourceEvents: [...(entry.resourceEvents ?? []), event],
                }
              : entry,
          ),
        });
        await tryLogCliActivity({
          projectId,
          teamId: opts.teamId.trim(),
          activityType: "status",
          label: `resource_remove:${resourceId}`,
          detail: `removed_remaining=${existing.remaining}`,
          source: opts.source,
          beatId: opts.beatId,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, resourceId },
          `Removed resource '${resourceId}'`,
        );
      },
    );

  resources
    .command("reserve")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .requiredOption("--amount <amount>", "Reserve amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_amount:${value}`);
      return parsed;
    })
    .option("--source <source>", "Event source", "team.resources.reserve")
    .option("--note <note>", "Event note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        resourceId: string;
        amount: number;
        source: string;
        note?: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.resources.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const resourcesList = project.resources ?? [];
        const current = resourcesList.find((entry) => entry.id === opts.resourceId.trim());
        if (!current) fail(`resource_not_found:${opts.resourceId}`);
        const currentReserved = current.reserved ?? 0;
        const nextReserved = currentReserved + opts.amount;
        const nextResources = resourcesList.map((entry) =>
          entry.id === current.id ? { ...entry, reserved: nextReserved } : entry,
        );
        const event: ResourceEventModel = {
          id: `resource-event-${projectId}-${Date.now()}`,
          projectId,
          resourceId: current.id,
          ts: new Date().toISOString(),
          kind: "adjustment",
          delta: -opts.amount,
          remainingAfter: current.remaining,
          source: opts.source,
          ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) =>
            entry.id === projectId
              ? {
                  ...entry,
                  resources: nextResources,
                  resourceEvents: [...(entry.resourceEvents ?? []), event],
                }
              : entry,
          ),
        });
        await tryLogCliActivity({
          projectId,
          teamId: opts.teamId.trim(),
          activityType: "executing",
          label: `resource_reserve:${current.id}`,
          detail: `amount=${opts.amount} reserved=${nextReserved}`,
          source: opts.source,
          beatId: opts.beatId,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, resourceId: current.id, reserved: nextReserved },
          `Reserved ${opts.amount} on '${current.id}' (reserved=${nextReserved})`,
        );
      },
    );

  resources
    .command("release")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .requiredOption("--amount <amount>", "Release amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_amount:${value}`);
      return parsed;
    })
    .option("--source <source>", "Event source", "team.resources.release")
    .option("--note <note>", "Event note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        resourceId: string;
        amount: number;
        source: string;
        note?: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.resources.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const resourcesList = project.resources ?? [];
        const current = resourcesList.find((entry) => entry.id === opts.resourceId.trim());
        if (!current) fail(`resource_not_found:${opts.resourceId}`);
        const currentReserved = current.reserved ?? 0;
        const nextReserved = Math.max(0, currentReserved - opts.amount);
        const nextResources = resourcesList.map((entry) =>
          entry.id === current.id ? { ...entry, reserved: nextReserved } : entry,
        );
        const event: ResourceEventModel = {
          id: `resource-event-${projectId}-${Date.now()}`,
          projectId,
          resourceId: current.id,
          ts: new Date().toISOString(),
          kind: "adjustment",
          delta: opts.amount,
          remainingAfter: current.remaining,
          source: opts.source,
          ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) =>
            entry.id === projectId
              ? {
                  ...entry,
                  resources: nextResources,
                  resourceEvents: [...(entry.resourceEvents ?? []), event],
                }
              : entry,
          ),
        });
        await tryLogCliActivity({
          projectId,
          teamId: opts.teamId.trim(),
          activityType: "executing",
          label: `resource_release:${current.id}`,
          detail: `amount=${opts.amount} reserved=${nextReserved}`,
          source: opts.source,
          beatId: opts.beatId,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, resourceId: current.id, reserved: nextReserved },
          `Released ${opts.amount} on '${current.id}' (reserved=${nextReserved})`,
        );
      },
    );

  resources
    .command("seed-demo")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.resources.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const resourcesList =
        project.resources && project.resources.length > 0
          ? project.resources
          : defaultProjectResources(projectId);
      const now = new Date().toISOString();
      const events: ResourceEventModel[] = resourcesList.map((resource) => ({
        id: `resource-event-${resource.id}-${Date.now()}`,
        projectId,
        resourceId: resource.id,
        ts: now,
        kind: "refresh",
        delta: 0,
        remainingAfter: resource.remaining,
        source: "team.resources.seed-demo",
        note: "Seed snapshot",
      }));
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...ensureProjectResources(entry),
                resourceEvents: [...(entry.resourceEvents ?? []), ...events],
              }
            : entry,
        ),
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId },
        `Seeded resource demo data for ${opts.teamId}`,
      );
    });
}
