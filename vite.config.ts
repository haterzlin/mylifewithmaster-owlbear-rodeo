import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { cors: true },
  preview: { cors: true },
});
