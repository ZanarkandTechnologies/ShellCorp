"use client";

import type { CronJob, CronStatus } from "@/lib/openclaw-types";

export function CronPanel({
  status,
  jobs,
  selectedAgentId,
}: {
  status: CronStatus | null;
  jobs: CronJob[];
  selectedAgentId: string | null;
}): JSX.Element {
  const filtered = selectedAgentId ? jobs.filter((job) => job.agentId === selectedAgentId) : jobs;
  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 text-sm">
        <div>
          <p className="text-muted-foreground">Scheduler Enabled</p>
          <p>{status?.enabled ? "yes" : "no"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total Jobs</p>
          <p>{status?.jobs ?? 0}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Next Wake</p>
          <p>{status?.nextWakeAtMs ? new Date(status.nextWakeAtMs).toLocaleString() : "n/a"}</p>
        </div>
      </div>
      <div className="max-h-[46vh] overflow-auto rounded-md border p-2">
        {filtered.map((job) => (
          <div key={job.id} className="mb-2 rounded border p-2 text-sm">
            <p className="font-medium">{job.name}</p>
            <p className="text-xs text-muted-foreground">{job.description ?? job.id}</p>
            <p className="text-xs mt-1">
              {job.enabled ? "enabled" : "disabled"} · {job.sessionTarget} · {job.wakeMode}
            </p>
          </div>
        ))}
        {filtered.length === 0 ? <p className="text-xs text-muted-foreground">No cron jobs for this agent.</p> : null}
      </div>
    </div>
  );
}
