import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Sync users from Base44 every 5 minutes
crons.interval(
  "sync users from Base44",
  { minutes: 5 },
  api.base44.syncUsersFromBase44
);

// Retry syncing closed trucks every 10 minutes
crons.interval(
  "retry sync closed trucks",
  { minutes: 10 },
  api.base44.retrySyncClosedTrucks
);

export default crons;
