import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/health": "http://127.0.0.1:5174",
      "/product-numbers": "http://127.0.0.1:5174",
      "/products": "http://127.0.0.1:5174",
      "/snapshots": "http://127.0.0.1:5174",
      "/configurations": "http://127.0.0.1:5174"
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
