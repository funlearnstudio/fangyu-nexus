import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "fangyu-nexus-api",
      version: "0.1.0",
      infrastructure: {
        database: Boolean(process.env.DATABASE_URL),
        redis: Boolean(process.env.REDIS_URL),
        objectStorage: Boolean(process.env.S3_ENDPOINT),
      },
    };
  }
}
