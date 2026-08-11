import { Controller, Get, UseGuards } from "@nestjs/common";
import { DemoAdminGuard } from "./demo-admin.guard";

@Controller("admin")
@UseGuards(DemoAdminGuard)
export class AdminController {
  @Get("moderation")
  moderation() {
    return {
      status: "skeleton",
      queue: [],
      note: "Demo header guard only. Production auth is not enabled.",
    };
  }
}
