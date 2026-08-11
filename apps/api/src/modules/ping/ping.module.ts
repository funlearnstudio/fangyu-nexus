import { Module } from "@nestjs/common";
import { PingController } from "./ping.controller";
import { PingQueueService } from "./ping-queue.service";

@Module({
  controllers: [PingController],
  providers: [PingQueueService],
})
export class PingModule {}
