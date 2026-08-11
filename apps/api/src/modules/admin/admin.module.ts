import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { DemoAdminGuard } from "./demo-admin.guard";

@Module({
  controllers: [AdminController],
  providers: [DemoAdminGuard],
})
export class AdminModule {}
