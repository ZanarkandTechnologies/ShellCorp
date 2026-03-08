"use client";

import type { ChannelAccountSnapshot, ChannelsStatusSnapshot } from "@/lib/openclaw-types";

function summarizeAccounts(accounts: ChannelAccountSnapshot[]): string {
  const connected = accounts.filter((entry) => entry.connected === true || entry.running === true).length;
  return `${connected}/${accounts.length} connected`;
}

export function ChannelsPanel({ snapshot }: { snapshot: ChannelsStatusSnapshot | null }): JSX.Element {
  const ordered = snapshot?.channelOrder ?? Object.keys(snapshot?.channelAccounts ?? {});
  return (
    <div className="rounded-md border p-4 space-y-2">
      <p className="text-sm text-muted-foreground">Gateway-wide channel status snapshot.</p>
      <div className="max-h-[50vh] overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-2">Channel</th>
              <th className="p-2">Accounts</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((channelId) => {
              const accounts = snapshot?.channelAccounts[channelId] ?? [];
              return (
                <tr key={channelId} className="border-b">
                  <td className="p-2">{snapshot?.channelLabels[channelId] ?? channelId}</td>
                  <td className="p-2">{accounts.length}</td>
                  <td className="p-2">{summarizeAccounts(accounts)}</td>
                </tr>
              );
            })}
            {ordered.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-2 text-muted-foreground">
                  No channel data available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
