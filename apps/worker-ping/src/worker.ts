import { Worker } from "bullmq";
import { createLogger } from "@fangyu/observability";
import { validatePingTarget } from "./index";

const logger = createLogger("worker-ping");

if (process.env.PING_QUEUE_ENABLED !== "true") {
  logger.info("Ping worker is disabled; validation library remains available.");
} else {
  const worker = new Worker(
    "server-ping",
    async (job) => {
      const result = await validatePingTarget(job.data);
      if (!result.allowed) {
        throw new Error(result.reason);
      }

      return {
        status: "adapter_pending",
        addresses: result.addresses,
        note: "Phase 1 validates and pins the target. Java and Bedrock protocol adapters are intentionally not enabled yet.",
      };
    },
    {
      connection: {
        url: process.env.REDIS_URL ?? "redis://localhost:6379",
      },
      concurrency: 4,
      lockDuration: 5000,
    },
  );

  worker.on("failed", (job, error) => {
    logger.error("Ping job failed", {
      ...(job?.id ? { jobId: job.id } : {}),
      error: error.message,
    });
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void worker.close().then(() => process.exit(0));
    });
  }
}
