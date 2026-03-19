<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { searchTasksUpdatedSince, fetchTaskLastUpdaterName } from "@/api/asana";
import type { AsanaTask, AsanaSection, AsanaProject } from "@/types/asana";

type TaskWithMeta = {
  task: AsanaTask;
  section: AsanaSection;
  project: AsanaProject;
};

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<TaskWithMeta[]>([]);

const updaterStats = computed(() => {
  const map = new Map<string, number>();
  for (const item of items.value) {
    const name = item.task.updaterName;
    if (!name) continue;
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
});

function startOfThisWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0: Sun ... 1: Mon
  const diff = day === 0 ? -6 : 1 - day; // 週一為一週開始
  d.setDate(d.getDate() + diff);
  return d;
}

const weekStart = startOfThisWeek();
const weekEnd = (() => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d;
})();

async function loadWeeklyAll() {
  loading.value = true;
  error.value = null;
  items.value = [];

  try {
    const raw = await searchTasksUpdatedSince(weekStart, weekEnd);
    const result: TaskWithMeta[] = raw
      .filter((x) => x.project) // 僅保留有專案歸屬的任務，方便畫面顯示
      .map((x) => ({
        task: x.task,
        section:
          x.section ??
          ({
            gid: "unknown",
            name: "未分類",
          } as AsanaSection),
        project: x.project as AsanaProject,
      }));

    items.value = result.sort((a, b) => {
      const pa = a.project.name.localeCompare(b.project.name, "zh-TW");
      if (pa !== 0) return pa;
      const ta =
        (a.task as any).modified_at ??
        a.task.completed_at ??
        a.task.created_at ??
        "";
      const tb =
        (b.task as any).modified_at ??
        b.task.completed_at ??
        b.task.created_at ??
        "";
      return tb.localeCompare(ta);
    });

    // 非同步補上「更新人」，不阻塞第一次畫面顯示
    (async () => {
      for (const item of items.value) {
        try {
          const name = await fetchTaskLastUpdaterName(
            item.task.gid,
            weekStart
          );
          if (name) {
            item.task.updaterName = name;
          }
        } catch {
          // 忽略單筆錯誤，避免影響其他任務
        }
      }
    })();
  } catch (e) {
    console.error("載入本週更新任務失敗", e);
    error.value = "載入本週更新任務失敗，請稍後重試。";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadWeeklyAll();
});
</script>

<template>
  <div class="weekly-page">
    <header class="weekly-header">
      <div class="title-block">
        <h1>本週任務更新</h1>
        <p>一次查看所有專案中，本週有更新的任務列表。</p>
      </div>

      <div class="controls">
        <button
          class="load-btn"
          type="button"
          :disabled="loading"
          @click="loadWeeklyAll"
        >
          {{ loading ? "載入中…" : "重新載入" }}
        </button>
      </div>
    </header>

    <main class="weekly-main">
      <section v-if="updaterStats.length" class="updater-summary">
        <h2>本週更新人統計</h2>
        <ul class="updater-list">
          <li v-for="[name, count] in updaterStats" :key="name" class="updater-item">
            <span class="updater-name">{{ name }}</span>
            <span class="updater-count">{{ count }} 個任務</span>
          </li>
        </ul>
      </section>

      <div v-if="error" class="state error">
        {{ error }}
      </div>

      <div v-else-if="loading" class="state loading">
        正在載入本週更新的任務…
      </div>

      <div v-else-if="items.length === 0" class="state empty">
        本週尚無更新的任務。
      </div>

      <ul v-else class="task-list">
        <li v-for="item in items" :key="item.task.gid" class="task-row">
          <div class="task-main">
            <a
              class="task-name"
              :href="item.task.permalink_url"
              target="_blank"
              rel="noopener"
            >
              {{ item.task.name }}
            </a>
            <div class="task-meta">
              <span class="badge project">{{ item.project.name }}</span>
              <span class="badge section">{{ item.section.name }}</span>
              <span v-if="item.task.assignee" class="badge assignee">
                指派給：{{ item.task.assignee.name }}
              </span>
            </div>
          </div>
          <div class="task-updated">
            <span class="label">最後更新</span>
            <span class="value">
              {{
                ((item.task as any).modified_at ??
                  item.task.completed_at ??
                  item.task.created_at) &&
                new Date(
                  (item.task as any).modified_at ??
                    item.task.completed_at ??
                    item.task.created_at
                ).toLocaleString("zh-TW")
              }}
              <span v-if="item.task.updaterName" class="updater-inline">
                （更新人：{{ item.task.updaterName }}）
              </span>
            </span>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped>
.weekly-page {
  min-height: 100vh;
  background: #f8f9fb;
  display: flex;
  flex-direction: column;
}
.weekly-header {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.title-block h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #111827;
}
.title-block p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.controls {
  display: flex;
  gap: 8px;
  align-items: center;
}
.load-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  border: none;
  background: #4f46e5;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.load-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.load-btn:not(:disabled):hover {
  background: #4338ca;
}
.weekly-main {
  flex: 1;
  padding: 20px 24px 32px;
}
.updater-summary {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 12px 14px;
  margin-bottom: 16px;
}
.updater-summary h2 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}
.updater-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}
.updater-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #4b5563;
}
.updater-name {
  font-weight: 600;
}
.updater-count {
  font-size: 11px;
  color: #6b7280;
}
.state {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
}
.state.error {
  color: #b91c1c;
}
.state.empty {
  color: #6b7280;
}
.task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-row {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.task-main {
  flex: 1;
  min-width: 0;
}
.task-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  text-decoration: none;
}
.task-name:hover {
  color: #4f46e5;
  text-decoration: underline;
}
.task-meta {
  margin-top: 4px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
}
.badge.section {
  background: #eff6ff;
  color: #1d4ed8;
}
.badge.project {
  background: #fef3c7;
  color: #b45309;
}
.badge.assignee {
  background: #f3f4f6;
  color: #4b5563;
}
.task-updated {
  flex-shrink: 0;
  text-align: right;
  font-size: 11px;
  color: #6b7280;
}
.task-updated .label {
  display: block;
  margin-bottom: 2px;
}
.task-updated .value {
  font-weight: 500;
  color: #111827;
}
.task-updated .updater-inline {
  margin-left: 4px;
  font-weight: 400;
  color: #047857;
}
@media (max-width: 768px) {
  .weekly-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .task-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .task-updated {
    text-align: left;
  }
}
</style>

