<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { searchTasksUpdatedSince, fetchTaskLastUpdaterName } from "@/api/asana";
import type { AsanaTask, AsanaProject, AsanaSection } from "@/types/asana";

type WeekTaskMeta = {
  task: AsanaTask;
  project: AsanaProject | null;
  section: AsanaSection | null;
};

type WeekStat = {
  label: string;
  start: Date;
  end: Date;
  totalUpdates: number;
  byUpdater: Record<string, number>;
  tasks: WeekTaskMeta[];
};

/** 前端緩存：切換分頁再回來時不重新請求，僅「重新載入」時才打後端 */
const trendsCache: { weeks: WeekStat[]; error: string | null } = {
  weeks: [],
  error: null,
};

const loading = ref(false);
const error = ref<string | null>(null);
const weeks = ref<WeekStat[]>([]);
const selectedWeek = ref<WeekStat | null>(null);
/** 彈窗內依更新人篩選，null 表示全部 */
const selectedUpdaterFilter = ref<string | null>(null);

watch(selectedWeek, (week) => {
  selectedUpdaterFilter.value = null;
});

/** 彈窗內該週的更新人選項（與卡片上 byUpdater 一致，排序後） */
const updaterOptions = computed(() => {
  const week = selectedWeek.value;
  if (!week) return [];
  return Object.keys(week.byUpdater).sort(
    (a, b) => (week.byUpdater[b] ?? 0) - (week.byUpdater[a] ?? 0)
  );
});

/** 彈窗內依「更新人」篩選後的任務列表 */
const filteredTasksInModal = computed(() => {
  const week = selectedWeek.value;
  if (!week) return [];
  const name = selectedUpdaterFilter.value;
  if (!name) return week.tasks;
  return week.tasks.filter((m) => m.task.updaterName === name);
});

function startOfWeek(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0: Sun ... 1: Mon
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  return d;
}

function endOfWeek(start: Date): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + 7);
  return d;
}

async function loadTrends() {
  loading.value = true;
  error.value = null;
  weeks.value = [];

  try {
    const weekWindows: { label: string; start: Date; end: Date }[] = [];

    for (let i = 0; i < 10; i++) {
      const offset = -i;
      const start = startOfWeek(offset);
      const end = endOfWeek(start);
      const label =
        i === 0
          ? "本週"
          : `第 ${i + 1} 週前`;
      weekWindows.push({ label, start, end });
    }

    for (const w of weekWindows) {
      const raw = await searchTasksUpdatedSince(w.start, w.end);

      const inRange = raw.filter((x) => {
        const t: AsanaTask = x.task;
        const updated =
          t.modified_at || t.completed_at || t.created_at || undefined;
        if (!updated) return false;
        const d = new Date(updated);
        return d >= w.start && d < w.end;
      });

      const stat: WeekStat = {
        label: w.label,
        start: w.start,
        end: w.end,
        totalUpdates: inRange.length,
        byUpdater: {},
        tasks: inRange.map((x) => ({
          task: x.task,
          project: x.project,
          section:
            x.section ??
            ({
              gid: "unknown",
              name: "未分類",
            } as AsanaSection),
        })),
      };

      weeks.value.push(stat);

      (async () => {
        for (const item of inRange) {
          try {
            const name = await fetchTaskLastUpdaterName(item.task.gid, w.start);
            if (!name) continue;
            const target = weeks.value.find(
              (x) => x.start.getTime() === w.start.getTime()
            );
            if (!target) continue;
            target.byUpdater[name] = (target.byUpdater[name] ?? 0) + 1;
            const t = target.tasks.find((m) => m.task.gid === item.task.gid);
            if (t) t.task.updaterName = name;
          } catch {
          }
        }
      })();
    }
  } catch (e) {
    console.error("載入十週趨勢失敗", e);
    error.value = "載入十週更新統計失敗，請稍後重試。";
  } finally {
    loading.value = false;
    trendsCache.weeks = weeks.value;
    trendsCache.error = error.value;
  }
}

onMounted(() => {
  if (trendsCache.weeks.length > 0) {
    weeks.value = trendsCache.weeks;
    error.value = trendsCache.error;
    loading.value = false;
    return;
  }
  loadTrends();
});
</script>

<template>
  <div class="trends-page">
    <header class="trends-header">
      <div class="title-block">
        <h1>最近十週更新趨勢</h1>
        <p>統計最近十週的任務更新數量，以及每位更新人對應的更新次數（不列出任務明細）。</p>
      </div>
      <div class="controls">
        <button class="reload-btn" type="button" :disabled="loading" @click="loadTrends">
          {{ loading ? "載入中…" : "重新載入" }}
        </button>
      </div>
    </header>

    <main class="trends-main">
      <div v-if="error" class="state error">
        {{ error }}
      </div>
      <div v-else-if="loading && weeks.length === 0" class="state loading">
        正在載入最近十週的更新統計…
      </div>
      <div v-else-if="weeks.length === 0" class="state empty">
        目前無可統計的更新資料。
      </div>
      <section v-else class="weeks-list">
        <article
          v-for="week in weeks"
          :key="week.start.getTime()"
          class="week-card"
          @click="selectedWeek = week"
        >
          <div class="week-header">
            <div class="week-title">{{ week.label }}</div>
            <div class="week-range">
              {{ week.start.toLocaleDateString("zh-TW") }} ~
              {{ new Date(week.end.getTime() - 1).toLocaleDateString("zh-TW") }}
            </div>
          </div>
          <div class="week-total">
            <span class="total-label">總更新次數</span>
            <span class="total-value">{{ week.totalUpdates }}</span>
          </div>
          <div class="week-updaters" v-if="Object.keys(week.byUpdater).length">
            <div class="updater-title">更新人統計</div>
            <ul class="updater-list">
              <li
                v-for="name in Object.keys(week.byUpdater).sort(
                  (a, b) => week.byUpdater[b] - week.byUpdater[a]
                )"
                :key="name"
                class="updater-row"
              >
                <span class="updater-name">{{ name }}</span>
                <span class="updater-count">{{ week.byUpdater[name] }}</span>
              </li>
            </ul>
          </div>
          <div v-else class="week-no-updaters">
            尚未取得更新人資料（稍後自動補齊）。
          </div>
        </article>
      </section>

      <div
        v-if="selectedWeek"
        class="selected-overlay"
        @click.self="selectedWeek = null"
      >
        <section class="selected-week">
          <header class="selected-header">
            <div class="selected-title">
              {{ selectedWeek.label }} 任務清單
            </div>
            <div class="selected-range">
              {{ selectedWeek.start.toLocaleDateString("zh-TW") }} ~
              {{
                new Date(
                  selectedWeek.end.getTime() - 1
                ).toLocaleDateString("zh-TW")
              }}
            </div>
          </header>
          <div class="filter-row" v-if="updaterOptions.length > 0">
            <label class="filter-label">更新人篩選：</label>
            <select
              v-model="selectedUpdaterFilter"
              class="filter-select"
            >
              <option :value="null">全部</option>
              <option
                v-for="name in updaterOptions"
                :key="name"
                :value="name"
              >
                {{ name }}（{{ selectedWeek?.byUpdater[name] ?? 0 }}）
              </option>
            </select>
            <span class="filter-hint">
              共 {{ filteredTasksInModal.length }} 筆
            </span>
          </div>
          <ul class="tasks-list">
            <li
              v-for="meta in filteredTasksInModal"
              :key="meta.task.gid"
              class="task-row"
            >
              <div class="task-main">
                <a
                  class="task-name"
                  :href="meta.task.permalink_url"
                  target="_blank"
                  rel="noopener"
                >
                  {{ meta.task.name }}
                </a>
                <div class="task-meta">
                  <span class="badge project" v-if="meta.project">
                    {{ meta.project.name }}
                  </span>
                  <span v-if="meta.section" class="badge section">
                    {{ meta.section.name }}
                  </span>
                  <span
                    v-if="meta.task.assignee"
                    class="badge assignee"
                  >
                    指派給：{{ meta.task.assignee.name }}
                  </span>
                  <span
                    v-if="meta.task.creatorName"
                    class="badge creator"
                  >
                    創建人：{{ meta.task.creatorName }}
                  </span>
                </div>
              </div>
              <div class="task-updated">
                <span class="label">最後更新</span>
                <span class="value">
                  {{
                    ((meta.task as any).modified_at ??
                      meta.task.completed_at ??
                      meta.task.created_at) &&
                    new Date(
                      (meta.task as any).modified_at ??
                        meta.task.completed_at ??
                        meta.task.created_at
                    ).toLocaleString("zh-TW")
                  }}
                  <span
                    v-if="meta.task.updaterName"
                    class="updater-inline"
                  >
                    （更新人：{{ meta.task.updaterName }}）
                  </span>
                </span>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.trends-page {
  min-height: 100vh;
  background: #f8f9fb;
  display: flex;
  flex-direction: column;
}
.trends-header {
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
  align-items: center;
}
.reload-btn {
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
.reload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.reload-btn:not(:disabled):hover {
  background: #4338ca;
}
.trends-main {
  flex: 1;
  padding: 20px 24px 32px;
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
.weeks-list {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.selected-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.25);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  z-index: 40;
}
.selected-week {
  width: min(960px, 100% - 40px);
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 14px 16px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
.selected-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
}
.selected-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}
.selected-range {
  font-size: 11px;
  color: #6b7280;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
}
.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  flex-shrink: 0;
}
.filter-select {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font-size: 13px;
  color: #111827;
  background: #fff;
  min-width: 160px;
}
.filter-select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
}
.filter-hint {
  font-size: 12px;
  color: #6b7280;
}
.week-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
}
.week-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.week-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}
.week-range {
  font-size: 11px;
  color: #6b7280;
}
.week-total {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.total-label {
  font-size: 11px;
  color: #6b7280;
}
.total-value {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
}
.week-updaters {
  margin-top: 6px;
}
.updater-title {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 4px;
}
.updater-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.updater-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #374151;
}
.updater-name {
  font-weight: 600;
}
.updater-count {
  font-size: 11px;
  color: #6b7280;
}
.week-no-updaters {
  margin-top: 6px;
  font-size: 11px;
  color: #9ca3af;
}
.week-tasks {
  margin-top: 8px;
  border-top: 1px dashed #e5e7eb;
  padding-top: 6px;
}
.tasks-title {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 4px;
}
.tasks-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tasks-list .task-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid #f3f4f6;
}
.tasks-list .task-row:last-child {
  border-bottom: none;
}
.tasks-list .task-main {
  flex: 1;
  min-width: 0;
}
.tasks-list .task-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  text-decoration: none;
}
.tasks-list .task-name:hover {
  color: #4f46e5;
  text-decoration: underline;
}
.tasks-list .task-meta {
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
}
.badge.project {
  background: #fef3c7;
  color: #b45309;
}
.badge.section {
  background: #eff6ff;
  color: #1d4ed8;
}
.badge.assignee {
  background: #f3f4f6;
  color: #4b5563;
}
.badge.creator {
  background: #ede9fe;
  color: #5b21b6;
}
.tasks-list .task-updated {
  flex-shrink: 0;
  text-align: right;
  font-size: 11px;
  color: #6b7280;
}
.tasks-list .task-updated .label {
  display: block;
  margin-bottom: 2px;
}
.tasks-list .task-updated .value {
  font-weight: 500;
  color: #111827;
}
.tasks-list .updater-inline {
  margin-left: 4px;
  font-weight: 400;
  color: #047857;
}
@media (max-width: 768px) {
  .trends-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .weeks-list {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>

