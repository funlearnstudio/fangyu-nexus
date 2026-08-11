import vinext from "vinext";
import { defineConfig, type PluginOption } from "vite";
import hostingConfig from "../../.openai/hosting.json";
import { sites } from "../../build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";
const { d1, r2 } = hostingConfig;
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async ({ command }) => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const plugins: PluginOption[] = [
    vinext(),
    sites({ hostingConfigPath: "../../.openai/hosting.json" }),
  ];

  // Production Sites builds require the Cloudflare adapter. Local development
  // and the supervised agent preview use Vinext's web runtime so they remain
  // deterministic without external runtime discovery.
  if (command === "build") {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    );
  }

  return {
    optimizeDeps: {
      exclude: ["mongodb"],
    },
    ssr: {
      external: ["mongodb"],
    },
    server: {
      host: process.env.WEB_HOST ?? "0.0.0.0",
      port: Number(process.env.WEB_PORT ?? 3000),
      allowedHosts: ["terminal.local", "localhost", "127.0.0.1"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins,
  };
});
