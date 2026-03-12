"use client";

/**
 * LEDGER TAB PANEL
 * ================
 * Team account balance and transaction timeline surface.
 *
 * KEY CONCEPTS:
 * - Uses first-class `project.account` + append-only `project.accountEvents`.
 * - Provides simple funding/spend actions for MVP operations.
 *
 * USAGE:
 * - Render in Team Panel `Ledger` tab with `onRecordEvent` mutation callback.
 *
 * MEMORY REFERENCES:
 * - MEM-0131
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectAccountEventModel, ProjectAccountModel } from "@/lib/openclaw-types";
import { BusinessAccountSummaryCard } from "./business-account-summary-card";

interface LedgerTabPanelProps {
  account: ProjectAccountModel;
  events: ProjectAccountEventModel[];
  onRecordEvent: (input: {
    type: "credit" | "debit";
    amountCents: number;
    source: string;
    note?: string;
  }) => Promise<void>;
}

export function LedgerTabPanel({
  account,
  events,
  onRecordEvent,
}: LedgerTabPanelProps): React.JSX.Element {
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const formatter = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: account.currency }),
    [account.currency],
  );
  const sortedEvents = useMemo(
    () =>
      [...events].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp)),
    [events],
  );

  const submit = async (type: "credit" | "debit"): Promise<void> => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;
    const amountCents = Math.round(numericAmount * 100);
    setIsSaving(true);
    try {
      await onRecordEvent({
        type,
        amountCents,
        source: source.trim() || "ui.ledger",
        note: note.trim() || undefined,
      });
      setAmount("");
      setNote("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <BusinessAccountSummaryCard account={account} events={events} />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Funding Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="ledger-amount">Amount ({account.currency})</Label>
            <Input
              id="ledger-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ledger-source">Source</Label>
            <Input
              id="ledger-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="seed_capital"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="ledger-note">Note</Label>
            <Input
              id="ledger-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Initial funding"
            />
          </div>
          <div className="flex items-end gap-2 md:col-span-4">
            <Button type="button" onClick={() => submit("credit")} disabled={isSaving}>
              Fund Account
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => submit("debit")}
              disabled={isSaving}
            >
              Record Spend
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="space-y-2 text-sm">
            {sortedEvents.map((event) => (
              <div key={event.id} className="rounded-md border bg-muted/10 p-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                  <p
                    className={
                      event.type === "credit"
                        ? "font-semibold text-emerald-500"
                        : "font-semibold text-red-500"
                    }
                  >
                    {event.type === "credit" ? "+" : "-"}
                    {formatter.format(event.amountCents / 100)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  source={event.source}
                  {event.note ? ` | note=${event.note}` : ""}
                  {` | balance=${formatter.format(event.balanceAfterCents / 100)}`}
                </p>
              </div>
            ))}
            {sortedEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No account events yet.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
