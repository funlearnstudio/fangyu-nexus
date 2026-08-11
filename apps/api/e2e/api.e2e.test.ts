import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/main";

describe("方域 Nexus API end-to-end", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves health and OpenAPI UI", async () => {
    const health = await app.inject({ method: "GET", url: "/v1/health" });
    const docs = await app.inject({ method: "GET", url: "/docs" });

    expect(health.statusCode).toBe(200);
    expect(health.json().status).toBe("ok");
    expect(docs.statusCode).toBe(200);
  });

  it("keeps Java and Bedrock item results separated", async () => {
    const java = await app.inject({
      method: "GET",
      url: "/v1/catalog/items?edition=java&version=java-demo-1",
    });
    const bedrock = await app.inject({
      method: "GET",
      url: "/v1/catalog/items?edition=bedrock&version=bedrock-demo-1",
    });

    expect(java.statusCode).toBe(200);
    expect(bedrock.statusCode).toBe(200);
    expect(
      java
        .json()
        .data.every((item: { edition: string }) => item.edition === "java"),
    ).toBe(true);
    expect(
      bedrock
        .json()
        .data.every((item: { edition: string }) => item.edition === "bedrock"),
    ).toBe(true);
  });

  it("calculates a recursive crafting request", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/calculators/crafting",
      payload: {
        edition: "java",
        gameVersionId: "java-demo-1",
        outputItemId: "java-demo-wooden-pickaxe",
        targetQuantity: 2,
        inventory: {},
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.targetQuantity).toBe(2);
    expect(response.json().meta.fixture).toBe(true);
  });

  it("rejects malformed and unauthorized input", async () => {
    const malformed = await app.inject({
      method: "POST",
      url: "/v1/calculators/crafting",
      payload: { edition: "java", targetQuantity: -1 },
    });
    const admin = await app.inject({
      method: "GET",
      url: "/v1/admin/moderation",
    });

    expect(malformed.statusCode).toBe(400);
    expect(admin.statusCode).toBe(403);
  });
});
