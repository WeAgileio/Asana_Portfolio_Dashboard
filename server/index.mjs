import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cookieSession from "cookie-session";

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

function requireAuth(req, res, next) {
  const token = req.session?.asanaAccessToken;
  if (token) {
    return next();
  }
  // 若設定檔有預設 PAT，自動當作已登入使用
  if (ASANA_DEFAULT_PAT && ASANA_DEFAULT_PAT.trim()) {
    if (!req.session) req.session = {};
    req.session.asanaAccessToken = ASANA_DEFAULT_PAT.trim();
    return next();
  }
  return res.status(401).json({
    message: "尚未登入 Asana，請先在前端點擊「登入 Asana」或使用個人權杖。",
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
  if (req.session?.asanaAccessToken) {
    return res.json({ authenticated: true });
  }
  if (ASANA_DEFAULT_PAT?.trim()) {
    if (!req.session) req.session = {};
    req.session.asanaAccessToken = ASANA_DEFAULT_PAT.trim();
    return res.json({ authenticated: true });
  }
  res.json({ authenticated: false });
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

// 將前端的 GET /api/* 轉發到 Asana API
app.get("/api/*", requireAuth, async (req, res) => {
  const accessToken = req.session.asanaAccessToken;
  const asanaPath = req.path.replace(/^\/api/, "");

  try {
    const data = await asanaGet(asanaPath, accessToken, req.query);
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

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(
    `[asana-oauth] 後端已啟動，監聽埠 ${PORT}。開發時請同時執行：npm run dev（前端）與 npm run server（後端）。`
  );
});

