import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cookieSession from "cookie-session";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config();

const {
  ASANA_CLIENT_ID,
  ASANA_CLIENT_SECRET,
  ASANA_REDIRECT_URI,
  ASANA_DEFAULT_PAT,
  SESSION_SECRET = "dev-secret",
} = process.env;

if (!ASANA_CLIENT_ID || !ASANA_CLIENT_SECRET || !ASANA_REDIRECT_URI) {
  console.warn(
    "[asana-oauth] 請確認環境變數 ASANA_CLIENT_ID / ASANA_CLIENT_SECRET / ASANA_REDIRECT_URI 已設定完畢。"
  );
}

const app = express();

app.use(
  cookieSession({
    name: "asana-session",
    keys: [SESSION_SECRET],
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  })
);

app.use(express.json());

const ASANA_BASE_URL = "https://app.asana.com/api/1.0";

/** 取得請求中的 Asana 權杖：優先 Authorization Bearer，其次 session，最後為可選的預設 PAT（開發用） */
function getAccessToken(req) {
  const auth = req.headers.authorization;
  if (auth && typeof auth === "string" && auth.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  if (req.session?.asanaAccessToken) return req.session.asanaAccessToken;
  if (ASANA_DEFAULT_PAT && ASANA_DEFAULT_PAT.trim()) return ASANA_DEFAULT_PAT.trim();
  return null;
}

function requireAuth(req, res, next) {
  if (getAccessToken(req)) return next();
  return res.status(401).json({
    message: "尚未登入，請使用個人權杖（PAT）登入後使用。",
  });
}

// ───────────────── OAuth 登入流程 ─────────────────

app.get("/auth/asana/login", (req, res) => {
  if (!ASANA_CLIENT_ID || !ASANA_REDIRECT_URI) {
    return res
      .status(500)
      .send("後端未設定 ASANA_CLIENT_ID / ASANA_REDIRECT_URI。");
  }

  const params = new URLSearchParams({
    client_id: ASANA_CLIENT_ID,
    redirect_uri: ASANA_REDIRECT_URI,
    response_type: "code",
    state: "dev-state", // 簡化實作，正式環境建議隨機生成並驗證
  });

  res.redirect(`https://app.asana.com/-/oauth_authorize?${params.toString()}`);
});

app.get("/auth/asana/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Asana OAuth 錯誤：${error}`);
  }

  if (!code) {
    return res.status(400).send("Asana OAuth 回傳缺少 code 參數。");
  }

  try {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ASANA_CLIENT_ID,
      client_secret: ASANA_CLIENT_SECRET,
      redirect_uri: ASANA_REDIRECT_URI,
      code,
    });

    const tokenRes = await axios.post(
      "https://app.asana.com/-/oauth_token",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    req.session.asanaAccessToken = tokenRes.data.access_token;

    // 登入完成後導回前端首頁
    res.redirect("/");
  } catch (e) {
    console.error(
      "[asana-oauth] 交換 access token 失敗：",
      e.response?.data || e.message
    );
    res.status(500).send("Asana OAuth 失敗，請稍後再試。");
  }
});

app.post("/auth/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// 允許直接使用 Asana 個人權杖（Personal Access Token）登入
app.post("/auth/pat-login", (req, res) => {
  const token = (req.body?.token || "").trim();

  if (!token) {
    return res.status(400).json({ message: "請提供個人權杖（token）。" });
  }

  req.session.asanaAccessToken = token;
  res.json({ ok: true });
});

app.get("/auth/status", (req, res) => {
  res.json({ authenticated: !!getAccessToken(req) });
});

// ───────────────── 通用 Asana API Proxy ─────────────────

const asanaClient = axios.create({
  baseURL: ASANA_BASE_URL,
});

async function asanaGet(path, accessToken, params = {}) {
  const res = await asanaClient.get(path, {
    params,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.data;
}

// ───────────────── GET /api/* 記憶體快取（依使用者 token 雜湊隔離）─────────────────

/** 環境變數正數；可寫 300000 或 300_000（底線忽略）。無效則用 fallback。 */
function readPositiveEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(String(raw).replace(/_/g, ""));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function cacheUserIdFromToken(accessToken) {
  return createHash("sha256").update(accessToken, "utf8").digest("hex").slice(0, 32);
}

function shouldBypassApiCache(req) {
  const cc = req.headers["cache-control"];
  if (cc && /no-cache|no-store|max-age=0/i.test(String(cc))) return true;
  const pragma = req.headers.pragma;
  if (pragma && /no-cache/i.test(String(pragma))) return true;
  const q = req.query;
  if (q._t != null && String(q._t) !== "") return true;
  if (q._nocache === "1" || q._nocache === "true") return true;
  return false;
}

const ASANA_PROXY_CACHE_SKIP_KEYS = new Set(["_t", "_nocache"]);

function normalizedQueryString(query) {
  const entries = Object.entries(query)
    .filter(([k]) => !ASANA_PROXY_CACHE_SKIP_KEYS.has(String(k).toLowerCase()))
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v == null ? "" : String(v)])
    .sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}

function asanaForwardQuery(query) {
  const out = { ...query };
  for (const k of Object.keys(out)) {
    if (ASANA_PROXY_CACHE_SKIP_KEYS.has(String(k).toLowerCase())) delete out[k];
  }
  return out;
}

/** 分級 TTL（毫秒）；未設定時各級預設 5 分鐘。 */
function getApiCacheTtlMs(asanaPath) {
  const p = asanaPath.toLowerCase();
  const fiveMin = 5 * 60_000;
  const long = readPositiveEnvNumber("ASANA_PROXY_CACHE_LIST_MS", fiveMin);
  const medium = readPositiveEnvNumber("ASANA_PROXY_CACHE_PROJECT_MS", fiveMin);
  const short = readPositiveEnvNumber("ASANA_PROXY_CACHE_TASK_MS", fiveMin);
  const def = readPositiveEnvNumber("ASANA_PROXY_CACHE_DEFAULT_MS", fiveMin);

  if (/\/tasks(\/|$|\?)/.test(p)) return short;
  if (/\/sections/.test(p)) return short;
  if (/\/workspaces\b/.test(p) && !/\/tasks/.test(p)) return long;
  if (/\/projects\b/.test(p) && !/\/tasks/.test(p) && !/\/sections/.test(p)) {
    return medium;
  }
  return def;
}

const apiResponseCache = new Map();
const API_CACHE_MAX_ENTRIES = readPositiveEnvNumber(
  "ASANA_PROXY_CACHE_MAX_ENTRIES",
  10000
);

function pruneApiCacheIfNeeded() {
  const now = Date.now();
  for (const [key, entry] of apiResponseCache) {
    if (now > entry.expiresAt) apiResponseCache.delete(key);
  }
  while (apiResponseCache.size > API_CACHE_MAX_ENTRIES) {
    const oldest = apiResponseCache.keys().next().value;
    if (oldest === undefined) break;
    apiResponseCache.delete(oldest);
  }
}

function apiCacheGet(cacheKey) {
  const entry = apiResponseCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    apiResponseCache.delete(cacheKey);
    return null;
  }
  return entry.data;
}

function apiCacheSet(cacheKey, data, ttlMs) {
  pruneApiCacheIfNeeded();
  if (apiResponseCache.size >= API_CACHE_MAX_ENTRIES) {
    const oldest = apiResponseCache.keys().next().value;
    if (oldest !== undefined) apiResponseCache.delete(oldest);
  }
  apiResponseCache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
}

// 將前端的 GET /api/* 轉發到 Asana API
app.get("/api/*", requireAuth, async (req, res) => {
  const accessToken = getAccessToken(req);
  const asanaPath = req.path.replace(/^\/api/, "");
  const bypass = shouldBypassApiCache(req);
  const forwardQuery = asanaForwardQuery(req.query);
  const qStr = normalizedQueryString(forwardQuery);
  const cacheKey = `${cacheUserIdFromToken(accessToken)}:${asanaPath}?${qStr}`;

  if (!bypass) {
    const cached = apiCacheGet(cacheKey);
    if (cached !== null) {
      console.log(
        "[asana-proxy-cache] HIT",
        asanaPath,
        qStr ? `?${qStr}` : ""
      );
      res.setHeader("X-Asana-Proxy-Cache", "HIT");
      return res.json(cached);
    }
  }

  try {
    const data = await asanaGet(asanaPath, accessToken, forwardQuery);
    if (!bypass) {
      apiCacheSet(cacheKey, data, getApiCacheTtlMs(asanaPath));
    }
    res.setHeader("X-Asana-Proxy-Cache", bypass ? "BYPASS" : "MISS");
    // 回傳結構維持與 Asana 相同（含 data/next_page 等），前端程式無需改動
    res.json(data);
  } catch (e) {
    const status = e.response?.status || 500;
    console.error(
      "[asana-oauth] 轉發 Asana API 失敗：",
      asanaPath,
      e.response?.data || e.message
    );
    res.status(status).json({
      message: "Asana API 呼叫失敗",
      status,
      error: e.response?.data || e.message,
    });
  }
});

// ───────────────── 生產環境：提供 Vite 建置後的靜態檔 ─────────────────
const distPath = join(__dirname, "..", "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
      return next();
    }
    if (req.method !== "GET") {
      return next();
    }
    res.sendFile(join(distPath, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  const modeHint = existsSync(distPath)
    ? "（已載入 dist/，單一服務提供前端與 API）"
    : "開發時請同時執行：npm run dev（前端）與 npm run server（後端）。";
  console.log(`[asana-oauth] 後端已啟動，監聽埠 ${PORT}。${modeHint}`);
});

