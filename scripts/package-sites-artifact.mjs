import {
  access,
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
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

  // Vinext currently emits a default request handler function, while the Sites
  // runtime consumes the standard module-worker shape: `default.fetch`. Keep the
  // generated application bundle untouched and add the adapter only to the root
  // deployable artifact so Vercel's native Next.js output is unaffected.
  const destinationWorker = path.join(destination, "server", "index.js");
  const applicationWorker = path.join(destination, "server", "application.js");
  await rename(destinationWorker, applicationWorker);
  await writeFile(
    destinationWorker,
    [
      'import handler, { generateStaticParamsMap } from "./application.js";',
      "",
      "export { generateStaticParamsMap };",
      "",
      "export default {",
      "  fetch(request, _environment, context) {",
      "    return handler(request, context);",
      "  },",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );

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
  const workerUrl = pathToFileURL(destinationWorker);
  workerUrl.searchParams.set("validation", String(Date.now()));
  const worker = await import(workerUrl.href);

  if (!worker.default || typeof worker.default.fetch !== "function") {
    throw new Error("Sites artifact must export default.fetch");
  }

  console.log("Validated root Sites artifact.");
}
