<script setup lang="ts">
import { computed, ref } from "vue";
import axios from "axios";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const pat = ref("");
const error = ref("");
const loading = ref(false);
const isNotion = computed(() => auth.dataSource === "notion");

async function login() {
  const token = (pat.value || "").trim();
  if (!token) {
    error.value = isNotion.value ? "請輸入 Notion 整合金鑰" : "請輸入個人權杖（PAT）";
    return;
  }
  error.value = "";
  loading.value = true;
  try {
    if (isNotion.value) {
      await axios.get("/api/notion/access", {
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      await axios.get("/api/workspaces", {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    await auth.saveToken(token);
  } catch (e: any) {
    // 登入失敗時在 console 輸出詳細原因，方便除錯（例如 CORS、後端未啟動、網路錯誤）
    console.error("[登入失敗]", {
      message: e?.message,
      code: e?.code,
      status: e?.response?.status,
      statusText: e?.response?.statusText,
      data: e?.response?.data,
      config: e?.config
        ? {
            url: e.config.url,
            baseURL: e.config.baseURL,
            method: e.config.method,
          }
        : undefined,
      error: e,
    });
    const msg =
      e.response?.data?.message ||
      (e.response?.status === 401
        ? isNotion.value
          ? "整合金鑰無效，或專案總表尚未分享給此整合。"
          : "權杖無效或已過期，請檢查後重試"
        : "連線失敗，請稍後再試");
    error.value = msg;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">{{ isNotion ? "Notion 儀表板" : "Asana 儀表板" }}</h1>
      <p class="login-desc">
        {{
          isNotion
            ? "請輸入 Notion 整合金鑰。專案總表必須已分享給這個整合。"
            : "請使用您的 Asana 個人權杖（Personal Access Token）登入後使用。"
        }}
      </p>
      <form class="login-form" @submit.prevent="login">
        <label class="label">{{ isNotion ? "整合金鑰" : "個人權杖（PAT）" }}</label>
        <input
          v-model="pat"
          type="password"
          class="input"
          :placeholder="isNotion ? '輸入 Notion 整合金鑰' : '輸入您的 Asana PAT'"
          autocomplete="off"
          :disabled="loading"
        />
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="btn" :disabled="loading">
          {{ loading ? "驗證中…" : "登入" }}
        </button>
      </form>
      <p class="hint">
        {{
          isNotion
            ? "金鑰會加密儲存於本機瀏覽器，僅供此應用呼叫 Notion API 使用。"
            : "權杖會加密儲存於本機瀏覽器，僅供此應用呼叫 Asana API 使用。"
        }}
      </p>
      <p class="help-link">
        <template v-if="isNotion">
          建立整合並分享專案總表：
          <a
            href="https://developers.notion.com/docs/create-a-notion-integration"
            target="_blank"
            rel="noopener noreferrer"
          >
            Notion 整合說明
          </a>
        </template>
        <template v-else>
          取得個人權杖與 API 說明請見：
          <a
            href="https://help.asana.com/s/article/api?language=en_US"
            target="_blank"
            rel="noopener noreferrer"
          >
            Asana API 說明
          </a>
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  padding: 20px;
}
.login-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  padding: 32px;
}
.login-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: #111827;
}
.login-desc {
  margin: 0 0 24px;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}
.input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
}
.error {
  margin: 0;
  font-size: 13px;
  color: #dc2626;
}
.btn {
  padding: 10px 16px;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.btn:hover:not(:disabled) {
  background: #4338ca;
}
.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.hint {
  margin: 20px 0 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
}
.help-link {
  margin: 16px 0 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}
.help-link a {
  color: #4f46e5;
  text-decoration: none;
}
.help-link a:hover {
  text-decoration: underline;
}
</style>
