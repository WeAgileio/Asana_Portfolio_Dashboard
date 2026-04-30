<script setup lang="ts">
import { ref, computed, onMounted, type Component } from "vue";
import { useAuthStore } from "@/stores/auth";
import Login from "@/views/Login.vue";
import WeeklyTrends from "@/views/WeeklyTrends.vue";
import ProgressTimelineByTime from "@/views/ProgressTimelineByTime.vue";
import BillingTasks from "@/views/BillingTasks.vue";
import BillingTasksByTime from "@/views/BillingTasksByTime.vue";

const auth = useAuthStore();

type Tab =
  | "trends"
  | "progressByTime"
  | "billingTasks"
  | "billingTasksByTime";

const currentTab = ref<Tab>("progressByTime");

const tabComponents: Record<Tab, Component> = {
  trends: WeeklyTrends,
  progressByTime: ProgressTimelineByTime,
  billingTasks: BillingTasks,
  billingTasksByTime: BillingTasksByTime,
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
    <nav class="top-nav" aria-label="主要導覽">
      <div class="nav-tabs">
        <button
          type="button"
          class="nav-tab"
          :class="{ active: currentTab === 'trends' }"
          @click="currentTab = 'trends'"
        >
          十週更新統計
        </button>
        <button
          type="button"
          class="nav-tab"
          :class="{ active: currentTab === 'progressByTime' }"
          @click="currentTab = 'progressByTime'"
        >
          專案進展
        </button>
        <button
          type="button"
          class="nav-tab"
          :class="{ active: currentTab === 'billingTasks' }"
          @click="currentTab = 'billingTasks'"
        >
          請款進展
        </button>
        <button
          type="button"
          class="nav-tab"
          :class="{ active: currentTab === 'billingTasksByTime' }"
          @click="currentTab = 'billingTasksByTime'"
        >
          請款進展·時間序
        </button>
      </div>
      <button
        type="button"
        class="nav-logout"
        @click="auth.clearToken()"
      >
        登出
      </button>
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
  min-height: 52px;
  padding: 8px 20px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}
.nav-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  min-width: 0;
}
.nav-tab {
  border: none;
  background: transparent;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  font-weight: 500;
  line-height: 1.2;
}
.nav-tab:hover {
  color: #374151;
  background: #f3f4f6;
}
.nav-tab.active {
  background: #4f46e5;
  color: #ffffff;
  font-weight: 600;
}
.nav-tab.active:hover {
  background: #4338ca;
  color: #ffffff;
}
.nav-logout {
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px;
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

