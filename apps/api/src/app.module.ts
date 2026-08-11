import { Module } from "@nestjs/common";
import { AdminModule } from "./modules/admin/admin.module";
import { CalculatorsModule } from "./modules/calculators/calculators.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { HealthModule } from "./modules/health/health.module";
import { PingModule } from "./modules/ping/ping.module";
import { UploadsModule } from "./modules/uploads/uploads.module";

@Module({
  imports: [
    HealthModule,
    CatalogModule,
    CalculatorsModule,
    PingModule,
    UploadsModule,
    AdminModule,
  ],
})
export class AppModule {}
