import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  app.setGlobalPrefix("v1");
  app.enableCors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  });
  const openApi = new DocumentBuilder()
    .setTitle("方域 Nexus API")
    .setDescription(
      "Version-scoped catalog, calculators, quarantine, and worker APIs.",
    )
    .setVersion("0.1.0")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, openApi));

  await app.init();
  return app;
}

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.API_PORT ?? 4000);
  const host = process.env.API_HOST ?? "127.0.0.1";
  await app.listen(port, host);
  console.log("方域 Nexus API listening on port " + port);
}

if (require.main === module) {
  void bootstrap();
}
