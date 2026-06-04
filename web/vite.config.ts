import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  define: { global: "globalThis" },
  plugins: [react()],
});
