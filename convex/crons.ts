import { cronJobs } from "convex/server";

const crons = cronJobs();

// Intentionally no scheduled pruning for agent events.
// Timeline/audit history must remain durable for operator drill-down views.

export default crons;
