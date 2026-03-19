import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    // Docker 內用 VITE_PROXY_TARGET=http://backend:3001，本機開發預設 localhost:3001
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      "/auth": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      "/widget": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
