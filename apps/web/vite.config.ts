import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig(() => {
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
    },
    plugins: [vinext()],
  };
});
