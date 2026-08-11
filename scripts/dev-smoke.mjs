import { spawn } from "node:child_process";
import path from "node:path";
import { repositoryRoot } from "./process-utils.mjs";

const child = spawn(
  process.execPath,
  [path.join(repositoryRoot, "scripts", "dev.mjs")],
  {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      WEB_HOST: "127.0.0.1",
      API_HOST: "127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  },
);

let output = "";
for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    output = (output + chunk).slice(-24000);
  });
}

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchReady(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    const body = await response.text();
    return response.ok ? { url, status: response.status, body } : null;
  } catch {
    return null;
  }
}

async function waitForServices() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(
        "Development process exited before readiness.\n" + output,
      );
    }
    const [web, play, world, api] = await Promise.all([
      fetchReady("http://127.0.0.1:3000/"),
      fetchReady("http://127.0.0.1:3000/play"),
      fetchReady("http://127.0.0.1:3000/play/world"),
      fetchReady("http://127.0.0.1:4000/v1/health"),
    ]);
    if (web && play && world && api) return { web, play, world, api };
    await wait(500);
  }
  throw new Error("Timed out waiting for Web and API.\n" + output);
}

async function stop() {
  if (child.exitCode !== null) return;
  if (process.platform === "win32") {
    child.kill();
  } else if (child.pid) {
    process.kill(-child.pid, "SIGTERM");
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    wait(10000).then(() => {
      if (process.platform === "win32") {
        child.kill("SIGKILL");
      } else if (child.pid) {
        process.kill(-child.pid, "SIGKILL");
      }
    }),
  ]);
  child.stdout.destroy();
  child.stderr.destroy();
}

try {
  const { web, play, world, api } = await waitForServices();
  const result = {
    web: { status: web.status, hasBrand: web.body.includes("方域 Nexus") },
    play: {
      status: play.status,
      hasWorldCreator: play.body.includes("建立世界"),
    },
    world: {
      status: world.status,
      hasWorldRoute: world.body.includes("缺少世界 ID"),
    },
    api: { status: api.status, payload: JSON.parse(api.body) },
  };
  console.log(JSON.stringify(result, null, 2));
  if (
    !result.web.hasBrand ||
    !result.play.hasWorldCreator ||
    !result.world.hasWorldRoute ||
    result.api.payload.status !== "ok"
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await stop();
}
