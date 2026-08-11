import { Injectable } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

@Injectable()
export class PingQueueService implements OnModuleDestroy {
  private queue?: Queue;

  async enqueue(data: {
    host: string;
    port: number;
    edition: "java" | "bedrock";
    resolvedAddresses: string[];
  }) {
    if (process.env.PING_QUEUE_ENABLED !== "true") {
      return {
        status: "validation_only",
        message: "Target passed security validation; worker queue is disabled.",
      };
    }

    this.queue ??= new Queue("server-ping", {
      connection: {
        url: process.env.REDIS_URL ?? "redis://localhost:6379",
      },
    });
    const job = await this.queue.add("ping", data, {
      attempts: 2,
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return { status: "queued", jobId: job.id };
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
