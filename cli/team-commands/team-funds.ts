/**
 * TEAM FUNDS COMMANDS
 * ====================
 * Purpose
 * - Account funding: balance check, deposit, spend.
 * - Account event ledger view.
 */
import { Command } from "commander";
import {
  type SidecarStore,
  ensureCommandPermission,
  resolveProjectOrFail,
  ensureProjectAccount,
  formatOutput,
  fail,
} from "./_shared.js";
import { tryLogCliActivity } from "./_convex.js";

export function registerTeamFunds(team: Command, store: SidecarStore): void {
  const funds = team.command("funds").description("Manage team account funding and spend ledger");

  funds
    .command("balance")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const account = ensureProjectAccount(projectId, project);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, account },
        `${opts.teamId} | balance=${account.balanceCents} ${account.currency.toLowerCase()}_cents`,
      );
    });

  funds
    .command("deposit")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--amount <amount>", "Amount in cents")
    .requiredOption("--source <source>", "Funding source")
    .option("--note <note>", "Optional note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; amount: string; source: string; note?: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const amount = Number(opts.amount);
      if (!Number.isFinite(amount) || amount <= 0) fail("invalid_amount_cents");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const account = ensureProjectAccount(projectId, project);
      const nextBalance = account.balanceCents + Math.round(amount);
      const nowIso = new Date().toISOString();
      const accountEvent = {
        id: `acct-event-${projectId}-${Date.now()}`,
        projectId,
        accountId: account.id,
        timestamp: nowIso,
        type: "credit" as const,
        amountCents: Math.round(amount),
        source: opts.source.trim(),
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        balanceAfterCents: nextBalance,
      };
      const ledgerEntry = {
        id: `ledger-revenue-${projectId}-${Date.now()}`,
        projectId,
        timestamp: nowIso,
        type: "revenue" as const,
        amount: Math.round(amount),
        currency: account.currency,
        source: opts.source.trim(),
        description: opts.note?.trim() || "Funds deposit",
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                account: { ...account, balanceCents: nextBalance, updatedAt: nowIso },
                accountEvents: [...(entry.accountEvents ?? []), accountEvent],
                ledger: [...(entry.ledger ?? []), ledgerEntry],
              }
            : entry,
        ),
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        activityType: "status",
        label: `funds_deposit:${Math.round(amount)}`,
        detail: `source=${opts.source.trim()} balance=${nextBalance}`,
        source: "team.funds.deposit",
        beatId: opts.beatId,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, balanceCents: nextBalance, event: accountEvent },
        `Deposited ${Math.round(amount)} cents for ${opts.teamId}`,
      );
    });

  funds
    .command("spend")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--amount <amount>", "Amount in cents")
    .requiredOption("--source <source>", "Spend source")
    .option("--note <note>", "Optional note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; amount: string; source: string; note?: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const amount = Number(opts.amount);
      if (!Number.isFinite(amount) || amount <= 0) fail("invalid_amount_cents");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const account = ensureProjectAccount(projectId, project);
      const roundedAmount = Math.round(amount);
      if (account.balanceCents < roundedAmount) fail("insufficient_funds");
      const nextBalance = account.balanceCents - roundedAmount;
      const nowIso = new Date().toISOString();
      const accountEvent = {
        id: `acct-event-${projectId}-${Date.now()}`,
        projectId,
        accountId: account.id,
        timestamp: nowIso,
        type: "debit" as const,
        amountCents: roundedAmount,
        source: opts.source.trim(),
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        balanceAfterCents: nextBalance,
      };
      const ledgerEntry = {
        id: `ledger-cost-${projectId}-${Date.now()}`,
        projectId,
        timestamp: nowIso,
        type: "cost" as const,
        amount: roundedAmount,
        currency: account.currency,
        source: opts.source.trim(),
        description: opts.note?.trim() || "Team spend",
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                account: { ...account, balanceCents: nextBalance, updatedAt: nowIso },
                accountEvents: [...(entry.accountEvents ?? []), accountEvent],
                ledger: [...(entry.ledger ?? []), ledgerEntry],
              }
            : entry,
        ),
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        activityType: "executing",
        label: `funds_spend:${roundedAmount}`,
        detail: `source=${opts.source.trim()} balance=${nextBalance}`,
        source: "team.funds.spend",
        beatId: opts.beatId,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, balanceCents: nextBalance, event: accountEvent },
        `Recorded spend ${roundedAmount} cents for ${opts.teamId}`,
      );
    });

  funds
    .command("ledger")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--limit <limit>", "Limit entries", "20")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; limit: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const limit = Number.isFinite(Number(opts.limit)) ? Math.max(1, Math.min(200, Math.floor(Number(opts.limit)))) : 20;
      const rows = [...(project.accountEvents ?? [])]
        .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
        .slice(0, limit);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, count: rows.length, rows },
        rows
          .map((row) => `${row.timestamp} | ${row.type.toUpperCase()} | ${row.amountCents} usd_cents | source=${row.source}`)
          .join("\n") || `${opts.teamId} has no account events`,
      );
    });
}
