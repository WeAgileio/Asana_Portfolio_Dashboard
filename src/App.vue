<script setup lang="ts">
import { ref, computed, onMounted, type Component } from "vue";
import { useAuthStore } from "@/stores/auth";
import Login from "@/views/Login.vue";
import WeeklyTrends from "@/views/WeeklyTrends.vue";
import ProgressTimeline from "@/views/ProgressTimeline.vue";
import ProgressTimelineByTime from "@/views/ProgressTimelineByTime.vue";

const auth = useAuthStore();

type Tab = "trends" | "progress" | "progressByTime";

const currentTab = ref<Tab>("progress");

const tabComponents: Record<Tab, Component> = {
  trends: WeeklyTrends,
  progress: ProgressTimeline,
  progressByTime: ProgressTimelineByTime,
};

const currentView = computed(() => tabComponents[currentTab.value]);

onMounted(() => {
  auth.loadFromStorage();
});
</script>

<template>
  <div class="app-root">
    <div v-if="!auth.initialized" class="app-loading">載入中…</div>
    <Login v-else-if="!auth.isLoggedIn" />
    <template v-else>
    <nav class="top-nav">
      <div class="nav-left">
        <span class="logo-dot" />
        <span class="nav-title">Asana 儀表板</span>
      </div>
      <div class="nav-tabs">
        <button
          class="nav-tab"
          :class="{ active: currentTab === 'trends' }"
          @click="currentTab = 'trends'"
        >
          十週更新統計
        </button>
        <button
          class="nav-tab"
          :class="{ active: currentTab === 'progress' }"
          @click="currentTab = 'progress'"
        >
          專案進度
        </button>
        <button
          class="nav-tab"
          :class="{ active: currentTab === 'progressByTime' }"
          @click="currentTab = 'progressByTime'"
        >
          進度·時間序
        </button>
        <button
          type="button"
          class="nav-tab nav-logout"
          @click="auth.clearToken()"
        >
          登出
        </button>
      </div>
    </nav>

    <main class="app-main">
      <keep-alive>
        <component :is="currentView" />
      </keep-alive>
    </main>
    </template>
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.top-nav {
  height: 52px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}
.nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #4f46e5;
}
.nav-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}
.nav-tabs {
  display: flex;
  gap: 6px;
}
.nav-tab {
  border: none;
  background: transparent;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
}
.nav-tab.active {
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 600;
}
.nav-logout {
  margin-left: auto;
  color: #6b7280;
}
.nav-logout:hover {
  color: #dc2626;
  background: #fef2f2;
}
.app-main {
  flex: 1;
}
.app-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #6b7280;
}
</style>

