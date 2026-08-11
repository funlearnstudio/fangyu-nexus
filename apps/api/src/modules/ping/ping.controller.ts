import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
} from "@nestjs/common";
import { pingTargetSchema } from "@fangyu/contracts";
import { validatePingTarget } from "@fangyu/worker-ping";
import { PingQueueService } from "./ping-queue.service";

@Controller("servers")
export class PingController {
  constructor(
    @Inject(PingQueueService) private readonly queue: PingQueueService,
  ) {}

  @Post("ping")
  async ping(@Body() body: unknown) {
    const parsed = pingTargetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const validation = await validatePingTarget(parsed.data);
    if (!validation.allowed) {
      throw new BadRequestException(validation.reason);
    }

    return {
      data: await this.queue.enqueue({
        ...parsed.data,
        resolvedAddresses: validation.addresses,
      }),
      security: {
        validatedServerSide: true,
        addresses: validation.addresses,
        rconEnabled: false,
      },
    };
  }
}
