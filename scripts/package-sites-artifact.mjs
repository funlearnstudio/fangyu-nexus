import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot } from "./process-utils.mjs";

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function packageSitesArtifact() {
  const source = path.join(repositoryRoot, "apps", "web", "dist");
  const destination = path.join(repositoryRoot, "dist");
  const workerEntry = path.join(source, "server", "index.js");

  if (!(await exists(workerEntry))) {
    throw new Error("Web build did not create apps/web/dist/server/index.js");
  }

  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });

  const destinationManifest = path.join(destination, ".openai", "hosting.json");
  if (!(await exists(destinationManifest))) {
    await mkdir(path.dirname(destinationManifest), { recursive: true });
    const manifest = await readFile(
      path.join(repositoryRoot, ".openai", "hosting.json"),
      "utf8",
    );
    await writeFile(destinationManifest, manifest, "utf8");
  }

  JSON.parse(await readFile(destinationManifest, "utf8"));
  const workerUrl = pathToFileURL(path.join(destination, "server", "index.js"));
  workerUrl.searchParams.set("validation", String(Date.now()));
  const worker = await import(workerUrl.href);

  if (!worker.default || typeof worker.default.fetch !== "function") {
    throw new Error("Sites artifact must export default.fetch");
  }

  console.log("Validated root Sites artifact.");
}
