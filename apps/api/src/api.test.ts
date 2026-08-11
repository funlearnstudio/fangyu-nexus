import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createApp } from "./main";

describe("API", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns health", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ok");
  });

  it("validates catalog scope", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/catalog/items?edition=invalid&version=java-demo-1",
    });
    expect(response.statusCode).toBe(400);
  });

  it("separates Java and Bedrock catalog results", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/catalog/items?edition=bedrock&version=bedrock-demo-1",
    });
    expect(response.statusCode).toBe(200);
    expect(
      response
        .json()
        .data.every((item: { edition: string }) => item.edition === "bedrock"),
    ).toBe(true);
  });

  it("protects moderation endpoints", async () => {
    const denied = await app.inject({
      method: "GET",
      url: "/v1/admin/moderation",
    });
    expect(denied.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "GET",
      url: "/v1/admin/moderation",
      headers: { "x-demo-role": "admin" },
    });
    expect(allowed.statusCode).toBe(200);
  });
});
