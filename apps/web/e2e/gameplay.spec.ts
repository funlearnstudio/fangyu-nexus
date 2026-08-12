import { expect, test } from "@playwright/test";

test("real WebGL loop mines, picks up and reloads both Nexus crystals", async ({
  page,
}) => {
  await page.goto("/play");
  await page.getByLabel("世界名稱").fill("E2E Crystal World");
  await page.getByLabel(/Seed/).fill("playwright-crystal-persistence");
  await page.getByRole("button", { name: /建立並進入/ }).click();
  await page.waitForURL(/\/play\/world\?id=/);
  const worldUrl = new URL(page.url());
  worldUrl.searchParams.set("e2e", "1");
  await page.goto(worldUrl.toString());

  await expect(page.getByText("Welcome to 方域 Nexus")).toBeVisible();
  await page.getByRole("button", { name: "SKIP TUTORIAL" }).click();
  await expect(page.getByText("LEVEL 1 / 50")).toBeVisible();
  await expect(page.locator(".voxel-game canvas")).toBeVisible();
  const webgl = await page.evaluate(() =>
    Boolean(document.createElement("canvas").getContext("webgl2")),
  );
  expect(webgl).toBe(true);

  await page.waitForTimeout(2_000);
  for (const crystal of ["sun", "dusk"] as const) {
    await page.evaluate((value) => {
      window.dispatchEvent(
        new CustomEvent("fangyu-e2e-mine", {
          detail: { crystal: value },
        }),
      );
    }, crystal);
    await page.waitForTimeout(700);
  }

  await page.keyboard.press("e");
  await expect(page.getByLabel("日耀晶 × 1")).toBeVisible();
  await expect(page.getByLabel("暮影晶 × 1")).toBeVisible();
  await page.waitForTimeout(13_000);
  await page.reload();
  await page.waitForTimeout(2_000);
  await page.keyboard.press("e");
  await expect(page.getByLabel("日耀晶 × 1")).toBeVisible();
  await expect(page.getByLabel("暮影晶 × 1")).toBeVisible();
  await expect(page.getByText("NEXUS JOURNEY").first()).toBeVisible();
});
