<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import axios from "axios";
import { useDashboardStore } from "@/stores/dashboard";
import OverallSummary from "@/components/OverallSummary.vue";
import SectionCard from "@/components/SectionCard.vue";
import SectionRanking from "@/components/SectionRanking.vue";

const store = useDashboardStore();

/** 手動輸入專案 GID（下拉選單外的專案用） */
const manualGid = ref("");
const showTokenInput = ref(false);
const patToken = ref("");
const patLoading = ref(false);
const patError = ref<string | null>(null);

let refreshTimer: number | undefined;
// 自動重新載入間隔（分鐘），可由 .env.local 的 VITE_REFRESH_INTERVAL_MINUTES 設定，預設 10 分鐘
const REFRESH_INTERVAL_MS =
  (Number(import.meta.env.VITE_REFRESH_INTERVAL_MINUTES) || 10) * 60 * 1000;

function loginWithAsana() {
  window.location.href = "/auth/asana/login";
}

async function loginWithPat() {
  const token = patToken.value.trim();
  if (!token) {
    patError.value = "請輸入個人權杖";
    return;
  }

  patLoading.value = true;
  patError.value = null;
  try {
    await axios.post("/auth/pat-login", { token });
    showTokenInput.value = false;
    patToken.value = "";

    if (!store.projects.length) {
      await store.loadProjects();
    }
    if (store.selectedProjectGid) {
      await store.loadStats();
    }
  } catch (e) {
    patError.value = "個人權杖登入失敗，請確認是否正確。";
  } finally {
    patLoading.value = false;
  }
}

/** 從下拉選單切換專案時直接載入該專案 */
function onProjectChange() {
  const gid = store.selectedProjectGid;
  if (!gid) return;
  store.loadStats(gid);
}

/** 表單送出：有手動 GID 則載入該專案，否則重新載入目前選中的專案 */
function onSubmitManualGid() {
  const gid = manualGid.value.trim();
  if (gid) {
    store.selectedProjectGid = gid;
    store.loadStats(gid);
  } else if (store.selectedProjectGid) {
    store.loadStats();
  }
}

onMounted(async () => {
  await store.loadProjects();
  if (store.selectedProjectGid) {
    await store.loadStats();
  }

  if (REFRESH_INTERVAL_MS > 0) {
    refreshTimer = window.setInterval(async () => {
      if (!store.selectedProjectGid || store.loading) return;
      await store.loadStats();
    }, REFRESH_INTERVAL_MS);
  }
});

onUnmounted(() => {
  if (refreshTimer !== undefined) {
    clearInterval(refreshTimer);
  }
});
</script>

<template>
  <div class="dashboard-page">
    <!-- 頂部工具列 -->
    <header class="toolbar">
      <div class="toolbar-brand">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <circle cx="10" cy="22" r="6" fill="#F06A6A"/>
          <circle cx="22" cy="22" r="6" fill="#62A3FF"/>
          <circle cx="16" cy="10" r="6" fill="#ACA1F7"/>
        </svg>
        <span class="brand-name">Asana 儀表板</span>
      </div>

      <form class="search-form" @submit.prevent="onSubmitManualGid">
        <!-- 下拉選單：選擇要查看的專案（已載入全部專案） -->
        <select
          v-model="store.selectedProjectGid"
          class="project-select"
          :disabled="store.loadingProjects"
          @change="onProjectChange"
        >
          <option value="" disabled>
            {{ store.loadingProjects ? "載入專案列表中…" : "選擇專案…" }}
          </option>
          <option
            v-for="p in store.projects"
            :key="p.gid"
            :value="p.gid"
          >
            {{ p.name }}
          </option>
        </select>

        <!-- 若專案不在列表中可手動輸入 GID -->
        <input
          v-model="manualGid"
          class="gid-input"
          placeholder="或輸入專案 GID"
          type="text"
        />

        <button type="submit" class="refresh-btn" :disabled="store.loading">
          <svg
            v-if="!store.loading"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          <span v-else class="spinner" />
          {{ store.loading ? "載入中…" : "重新整理" }}
        </button>
      </form>

      <button class="login-btn" type="button" @click="loginWithAsana">
        登入 Asana
      </button>

      <button
        class="token-btn"
        type="button"
        @click="showTokenInput = !showTokenInput"
      >
        使用個人權杖
      </button>

      <div v-if="store.lastUpdated" class="last-updated">
        最後更新時間：
        {{ store.lastUpdated.toLocaleString("zh-TW") }}
      </div>
    </header>

    <!-- 主內容區 -->
    <main class="main-content">
      <!-- 個人權杖輸入區 -->
      <section v-if="showTokenInput" class="token-panel">
        <div class="token-panel-header">
          <h2>使用 Asana 個人權杖登入</h2>
          <p>
            建議優先使用 OAuth 登入；若無法使用 OAuth，可以在此貼上
            Personal Access Token。
          </p>
        </div>
        <div class="token-panel-body">
          <input
            v-model="patToken"
            class="token-input"
            type="password"
            placeholder="貼上你的 Asana 個人權杖…"
          />
          <button
            class="token-submit-btn"
            type="button"
            :disabled="patLoading"
            @click="loginWithPat"
          >
            {{ patLoading ? "登入中…" : "使用個人權杖登入" }}
          </button>
        </div>
        <p v-if="patError" class="token-error">{{ patError }}</p>
      </section>

      <!-- 初始提示 -->
      <div v-if="!store.hasData && !store.loading && !store.error" class="empty-state">
        <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
          <circle cx="10" cy="22" r="6" fill="#F06A6A" opacity="0.4"/>
          <circle cx="22" cy="22" r="6" fill="#62A3FF" opacity="0.4"/>
          <circle cx="16" cy="10" r="6" fill="#ACA1F7" opacity="0.4"/>
        </svg>
        <p class="empty-title">選擇專案開始查看</p>
        <p class="empty-desc">
          先登入後，在上方下拉選單選擇要查看的專案；<br />
          或輸入專案 GID 後按重新整理。
        </p>
      </div>

      <!-- 錯誤提示 -->
      <div v-else-if="store.error" class="error-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p>{{ store.error }}</p>
        <button class="retry-btn" @click="store.loadStats()">重試</button>
      </div>

      <!-- 骨架載入 -->
      <div v-else-if="store.loading && !store.hasData" class="skeleton-grid">
        <div v-for="i in 6" :key="i" class="skeleton-card">
          <div class="sk-accent" />
          <div class="sk-body">
            <div class="sk-line wide" />
            <div class="sk-line short" />
            <div class="sk-stats">
              <div v-for="j in 3" :key="j" class="sk-stat" />
            </div>
            <div class="sk-line full" />
          </div>
        </div>
      </div>

      <!-- 實際資料 -->
      <template v-else-if="store.projectStats">
        <!-- 整體摘要 -->
        <OverallSummary :stats="store.projectStats" />

        <div class="content-grid">
          <!-- Section 排名 -->
          <SectionRanking :sections="store.projectStats.sections" />

          <!-- Section 卡片 -->
          <div class="sections-grid">
            <SectionCard
              v-for="s in store.projectStats.sections"
              :key="s.section.gid"
              :stats="s"
            />
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: #f8f9fb;
  display: flex;
  flex-direction: column;
}

/* ── 工具列 ── */
.toolbar {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.toolbar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.brand-name {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
}
.search-form {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.project-select {
  height: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 13px;
  color: #374151;
  background: #fff;
  cursor: pointer;
  max-width: 200px;
  outline: none;
  font-family: inherit;
}
.gid-input {
  flex: 1;
  height: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  color: #374151;
  min-width: 0;
  font-family: inherit;
}
.gid-input:focus { border-color: #4f46e5; }
.refresh-btn {
  height: 36px;
  padding: 0 14px;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
  white-space: nowrap;
  font-family: inherit;
}
.refresh-btn:hover:not(:disabled) { background: #4338ca; }
.refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.last-updated {
  font-size: 11px;
  color: #9ca3af;
  flex-shrink: 0;
}

.login-btn {
  height: 32px;
  padding: 0 12px;
  background: #111827;
  color: #fff;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}
.login-btn:hover {
  background: #020617;
}

.token-btn {
  height: 32px;
  padding: 0 12px;
  background: #f9fafb;
  color: #111827;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}
.token-btn:hover {
  background: #eef2ff;
  border-color: #c7d2fe;
}

/* ── 主內容 ── */
.main-content {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.token-panel {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.token-panel-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}
.token-panel-header p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.token-panel-body {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.token-input {
  flex: 1;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 12px;
  font-family: inherit;
}
.token-submit-btn {
  height: 32px;
  padding: 0 12px;
  background: #4b5563;
  color: #fff;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}
.token-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.token-submit-btn:hover:not(:disabled) {
  background: #374151;
}
.token-error {
  margin: 0;
  font-size: 12px;
  color: #b91c1c;
}

/* ── 空狀態 ── */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 24px;
  gap: 12px;
}
.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #374151;
  margin: 0;
}
.empty-desc {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
  line-height: 1.8;
}
.empty-desc code {
  background: #f3f4f6;
  padding: 2px 5px;
  border-radius: 4px;
  color: #4f46e5;
  font-size: 12px;
}

/* ── 錯誤狀態 ── */
.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 80px 24px;
}
.error-state p {
  color: #ef4444;
  font-size: 14px;
  margin: 0;
}
.retry-btn {
  padding: 8px 20px;
  background: #fef2f2;
  color: #ef4444;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 600;
}
.retry-btn:hover { background: #fee2e2; }

/* ── 排版 ── */
.content-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  align-items: start;
}
.sections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* ── 骨架 ── */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.skeleton-card {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  overflow: hidden;
  animation: pulse 1.6s ease-in-out infinite;
}
.sk-accent {
  height: 4px;
  background: #f3f4f6;
}
.sk-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sk-line {
  background: #f3f4f6;
  border-radius: 4px;
  height: 12px;
}
.sk-line.wide { width: 70%; }
.sk-line.short { width: 40%; }
.sk-line.full { width: 100%; }
.sk-stats {
  display: flex;
  gap: 8px;
}
.sk-stat {
  flex: 1;
  height: 44px;
  background: #f3f4f6;
  border-radius: 8px;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (max-width: 900px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
