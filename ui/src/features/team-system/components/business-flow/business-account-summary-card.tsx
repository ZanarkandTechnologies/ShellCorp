"use client";

/**
 * BUSINESS ACCOUNT SUMMARY CARD
 * =============================
 * Compact account balance and short-window delta overview.
 *
 * KEY CONCEPTS:
 * - Balance is canonical from `project.account`.
 * - Deltas are derived from append-only `accountEvents`.
 *
 * USAGE:
 * - Render at top of Ledger tab for quick financial pulse checks.
 *
 * MEMORY REFERENCES:
 * - MEM-0131
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectAccountModel, ProjectAccountEventModel } from "@/lib/openclaw-types";

interface BusinessAccountSummaryCardProps {
  account: ProjectAccountModel;
  events: ProjectAccountEventModel[];
}

export function BusinessAccountSummaryCard({
  account,
  events,
}: BusinessAccountSummaryCardProps): React.JSX.Element {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const delta24h = events
    .filter((event) => Date.parse(event.timestamp) >= dayAgo)
    .reduce(
      (sum, event) => sum + (event.type === "credit" ? event.amountCents : -event.amountCents),
      0,
    );
  const delta7d = events
    .filter((event) => Date.parse(event.timestamp) >= weekAgo)
    .reduce(
      (sum, event) => sum + (event.type === "credit" ? event.amountCents : -event.amountCents),
      0,
    );

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: account.currency,
  });
  const fmt = (value: number): string => formatter.format(value / 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Team Account</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Balance</p>
          <p className="text-2xl font-semibold">{fmt(account.balanceCents)}</p>
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">24h Delta</p>
          <p
            className={
              delta24h >= 0 ? "font-semibold text-emerald-500" : "font-semibold text-red-500"
            }
          >
            {delta24h >= 0 ? "+" : ""}
            {fmt(delta24h)}
          </p>
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">7d Delta</p>
          <p
            className={
              delta7d >= 0 ? "font-semibold text-emerald-500" : "font-semibold text-red-500"
            }
          >
            {delta7d >= 0 ? "+" : ""}
            {fmt(delta7d)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
