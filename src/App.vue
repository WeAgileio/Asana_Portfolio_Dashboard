<script setup lang="ts">
import { ref, computed, type Component } from "vue";
import Dashboard from "@/views/Dashboard.vue";
import WeeklyUpdates from "@/views/WeeklyUpdates.vue";
import WeeklyTrends from "@/views/WeeklyTrends.vue";
import ProgressTimeline from "@/views/ProgressTimeline.vue";

type Tab = "dashboard" | "weekly" | "trends" | "progress";

const currentTab = ref<Tab>("dashboard");

const tabComponents: Record<Tab, Component> = {
  dashboard: Dashboard,
  weekly: WeeklyUpdates,
  trends: WeeklyTrends,
  progress: ProgressTimeline,
};

const currentView = computed(() => tabComponents[currentTab.value]);
</script>

<template>
  <div class="app-root">
    <nav class="top-nav">
      <div class="nav-left">
        <span class="logo-dot" />
        <span class="nav-title">Asana 儀表板</span>
      </div>
      <div class="nav-tabs">
        <button
          class="nav-tab"
          :class="{ active: currentTab === 'dashboard' }"
          @click="currentTab = 'dashboard'"
        >
          專案概況
        </button>
        <button
          class="nav-tab"
          :class="{ active: currentTab === 'weekly' }"
          @click="currentTab = 'weekly'"
        >
          本週任務更新
        </button>
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
      </div>
    </nav>

    <main class="app-main">
      <keep-alive>
        <component :is="currentView" />
      </keep-alive>
    </main>
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
.app-main {
  flex: 1;
}
</style>

