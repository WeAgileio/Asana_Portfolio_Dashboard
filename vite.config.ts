import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { parse } from "dotenv";

function displayEnvValue(key, value) {
  if (value == null || String(value).trim() === "") return "（未設定）";
  if (/SECRET|TOKEN|PASSWORD|_PAT$|ENCRYPT_KEY/i.test(key)) return "（已設定）";
  return String(value);
}

function readDotenv(filename) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return null;
  return parse(readFileSync(path));
}

function logDotenv(filename, record) {
  console.log(`[config] 前端 ${filename}：`);
  if (!record) {
    console.log("  （沒有這個檔案）");
    return;
  }
  const keys = Object.keys(record).sort();
  if (keys.length === 0) {
    console.log("  （沒有設定）");
    return;
  }
  for (const key of keys) {
    console.log(`  ${key}=${displayEnvValue(key, record[key])}`);
  }
}

export default defineConfig(({ mode }) => {
  const layers = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
  const merged = {};
  for (const filename of layers) {
    const record = readDotenv(filename);
    if (!record) continue;
    logDotenv(filename, record);
    Object.assign(merged, record);
  }
  console.log("[config] 前端採用（後者覆寫前者）：");
  const adopted = Object.keys(merged).sort();
  if (adopted.length === 0) console.log("  （沒有設定）");
  for (const key of adopted) {
    console.log(`  ${key}=${displayEnvValue(key, merged[key])}`);
  }

  return {
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
  };
});
