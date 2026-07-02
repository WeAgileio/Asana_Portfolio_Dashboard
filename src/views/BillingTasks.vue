<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from "vue";
import type { AsanaTask } from "@/types/asana";
import {
  useProjectProgress,
  type ProjectProgress,
} from "@/composables/useProjectProgress";
import ScrollToTopButton from "@/components/ScrollToTopButton.vue";
import ProjectLoadProgressBanner from "@/components/ProjectLoadProgressBanner.vue";
import PageToolbar from "@/components/PageToolbar.vue";
import ProjectSortControl from "@/components/ProjectSortControl.vue";
import {
  applyProjectNameSort,
  type ProjectNameSortOrder,
} from "@/utils/projectDisplaySort";
import { asanaProjectNotesUrl } from "@/utils/asanaUrls";

const isDraggingTimeline = ref(false);
const dragStartX = ref(0);
const dragScrollLeft = ref(0);
const activeTimelineEl = ref<HTMLElement | null>(null);
const timelineDragMoved = ref(false);

const timelineRefs = ref<Record<string, HTMLElement | null>>({});
function registerTimelineRef(projectGid: string) {
  return (el: unknown) => {
    timelineRefs.value[projectGid] = el as HTMLElement | null;
  };
}

function scrollTimelineToLastDoneTask(projectGid: string) {
  const el = timelineRefs.value[projectGid];
  if (!el) return;
  if (isDraggingTimeline.value) return;

  const blocks = Array.from(el.querySelectorAll<HTMLElement>(".billing-task-card"));
  let targetBlock: HTMLElement | undefined;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]!.dataset.status === "done") {
      targetBlock = blocks[i];
      break;
    }
  }
  if (!targetBlock) return;

  const targetLeft =
    targetBlock.offsetLeft - (el.clientWidth - targetBlock.clientWidth) / 2;
  const maxLeft = el.scrollWidth - el.clientWidth;
  el.scrollLeft = Math.max(0, Math.min(targetLeft, maxLeft));
}

function onTimelineMouseDown(event: MouseEvent) {
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  isDraggingTimeline.value = true;
  timelineDragMoved.value = false;
  activeTimelineEl.value = el;
  dragStartX.value = event.clientX;
  dragScrollLeft.value = el.scrollLeft;
}

function onTimelineMouseMove(event: MouseEvent) {
  if (!isDraggingTimeline.value || !activeTimelineEl.value) return;
  const dx = event.clientX - dragStartX.value;
  if (Math.abs(dx) > 3) {
    timelineDragMoved.value = true;
  }
  activeTimelineEl.value.scrollLeft = dragScrollLeft.value - dx;
}

function onTimelineMouseUp() {
  isDraggingTimeline.value = false;
  activeTimelineEl.value = null;
}

const {
  loading,
  error,
  items,
  displayItems,
  projectsOptions,
  projectsOptionsLoading,
  selectedProjectGids,
  projectPickerOpen,
  loadProgress,
  todayLabel,
  projectBillingTotal,
  projectBillingCollectedTotal,
  projectBillingFilledCoins,
  projectBillingYearLines,
  reloadProjectProgress,
  bootstrapFromStorage,
  syncSelectionFromStorage,
} = useProjectProgress({
  onProjectTasksLoaded(projectGid) {
    scrollTimelineToLastDoneTask(projectGid);
  },
});

onMounted(() => {
  void bootstrapFromStorage();
});

onActivated(() => {
  void syncSelectionFromStorage();
});

const projectSearchQuery = ref("");
const projectNameSortOrder = ref<ProjectNameSortOrder>("default");

const filteredDisplayItems = computed(() => {
  const q = projectSearchQuery.value.trim().toLowerCase();
  const base = !q
    ? displayItems.value
    : displayItems.value.filter((item) =>
        item.project.name.toLowerCase().includes(q)
      );
  return applyProjectNameSort(base, projectNameSortOrder.value);
});

type BillingTaskEntry = {
  task: AsanaTask;
};

const billingRows = computed(() => {
  return filteredDisplayItems.value.map((item: ProjectProgress) => {
    const tasks: BillingTaskEntry[] = [];
    for (const sp of item.sections) {
      for (const t of sp.tasks) {
        if (t.billingTaskYes) {
          tasks.push({ task: t });
        }
      }
    }
    return {
      progress: item,
      tasks,
    };
  });
});
</script>

<template>
  <div class="progress-page">
    <PageToolbar
      :loading="loading"
      :date-label="todayLabel()"
      :projects-options-loading="projectsOptionsLoading"
      @resync="loadProgress({ bypassProxyCache: true })"
      @reload="loadProgress()"
      @open-project-picker="projectPickerOpen = true"
    >
      <template v-if="!error" #filters-inline>
        <ProjectSortControl v-model="projectNameSortOrder" :disabled="loading" />
      </template>
      <template v-if="!error" #search>
        <input
          id="billing-project-search-input"
          v-model="projectSearchQuery"
          type="search"
          class="project-search-input"
          aria-label="依專案名稱篩選，留空顯示全部"
          placeholder="輸入關鍵字篩選專案名稱，留空顯示全部"
          autocomplete="off"
          spellcheck="false"
          :disabled="loading"
        />
      </template>
      <template #legend>
        <div class="billing-legend" aria-label="完成狀態說明">
          <span class="legend-item"
            ><span class="legend-dot legend-done" />已完成</span
          >
          <span class="legend-item"
            ><span class="legend-dot legend-open" />未完成</span
          >
        </div>
      </template>
    </PageToolbar>

    <ProjectLoadProgressBanner
      :loading="loading"
      :items="items"
      :hidden="!!error"
    />

    <main class="page-main">
      <div
        v-if="projectPickerOpen"
        class="selected-overlay"
        @click.self="projectPickerOpen = false"
      >
        <section class="selected-panel project-picker-panel">
          <header class="selected-header">
            <div class="selected-title">選擇要載入的專案</div>
            <div class="selected-range">
              選擇 1 個以上才會只載入部分；不選則載入全部
            </div>
          </header>

          <div class="picker-body">
            <div v-if="projectsOptionsLoading" class="state loading">
              正在載入專案清單…
            </div>

            <div v-else class="picker-checkboxes-wrap">
              <ul class="project-checkbox-list" role="listbox" aria-label="專案清單">
                <li
                  v-for="p in projectsOptions"
                  :key="p.gid"
                  class="project-checkbox-item"
                >
                  <label class="project-checkbox-label">
                    <input
                      v-model="selectedProjectGids"
                      type="checkbox"
                      class="project-checkbox-input"
                      :value="p.gid"
                    />
                    <span class="project-checkbox-text">{{ p.name }}</span>
                  </label>
                </li>
              </ul>

              <div class="picker-actions">
                <button
                  type="button"
                  class="secondary-btn"
                  :disabled="loading"
                  @click="selectedProjectGids = []"
                >
                  載入全部
                </button>
                <button
                  type="button"
                  class="reload-btn"
                  :disabled="loading"
                  @click="
                    projectPickerOpen = false;
                    loadProgress();
                  "
                >
                  {{ loading ? "載入中…" : "套用選擇" }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div v-if="error" class="state error">
        {{ error }}
      </div>
      <div v-else-if="loading && items.length === 0" class="state loading">
        正在載入專案…
      </div>
      <div v-else-if="items.length === 0" class="state empty">
        目前沒有可顯示的專案。
      </div>
      <div
        v-else-if="
          projectSearchQuery.trim() !== '' && billingRows.length === 0
        "
        class="state empty"
      >
        沒有符合關鍵字的專案。
      </div>
      <section v-else class="timeline">
        <article
          v-for="row in billingRows"
          :key="row.progress.project.gid"
          class="project-row"
        >
          <div class="project-name">
            <div class="project-name-text">
              <div class="project-title-row">
                <a
                  class="project-name-link project-name-label"
                  :href="asanaProjectNotesUrl(row.progress.project)"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="'在 Asana 開啟專案狀態'"
                  :aria-label="'在 Asana 開啟專案：' + row.progress.project.name"
                  @click.stop
                >
                  {{ row.progress.project.name }}
                </a>
                <button
                  type="button"
                  class="project-reload-btn"
                  :disabled="row.progress.loadingTasks"
                  :title="
                    row.progress.loadingTasks
                      ? '載入中…'
                      : '重新載入此專案（略過快取，向 Asana 取最新）'
                  "
                  :aria-label="'重新載入專案：' + row.progress.project.name"
                  @click.stop="
                    reloadProjectProgress(row.progress.project.gid, {
                      bypassProxyCache: true,
                    })
                  "
                >
                  <svg
                    class="project-reload-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                </button>
              </div>
              <div
                v-if="!row.progress.loadingTasks && projectBillingTotal(row.progress) > 0"
                class="project-billing-years"
              >
                <div
                  v-for="line in projectBillingYearLines(row.progress)"
                  :key="line.key"
                  class="project-year-line"
                  :class="{ 'project-year-line-current': line.isCurrentYear }"
                >
                  <span
                    class="project-year-label"
                    :class="{ 'project-year-label-current': line.isCurrentYear }"
                  >
                    {{ line.label }}
                  </span>
                  <span
                    class="project-year-amount"
                    :class="{ 'project-year-amount-current': line.isCurrentYear }"
                  >
                    <span class="project-year-amount-collected">
                      {{ line.collected.toLocaleString("zh-TW") }}
                    </span>
                    <span class="project-year-amount-slash">/</span>
                    <span class="project-year-amount-total">
                      {{ line.total.toLocaleString("zh-TW") }}
                    </span>
                  </span>
                </div>
              </div>

              <div
                v-if="!row.progress.loadingTasks && projectBillingTotal(row.progress) > 0"
                class="project-total-divider"
              />

              <div
                v-if="!row.progress.loadingTasks && projectBillingTotal(row.progress) > 0"
                class="project-total-row"
              >
                <span class="project-total-pill">Total</span>
                <span class="project-total-amount">
                  <span class="project-year-amount-collected">
                    {{
                      projectBillingCollectedTotal(row.progress).toLocaleString("zh-TW")
                    }}
                  </span>
                  <span class="project-year-amount-slash">/</span>
                  <span class="project-year-amount-total">
                    {{ projectBillingTotal(row.progress).toLocaleString("zh-TW") }}
                  </span>
                </span>
              </div>

              <div
                v-if="projectBillingTotal(row.progress) > 0"
                class="project-billing-coins"
              >
                <span
                  v-for="n in 10"
                  :key="n"
                  :class="[
                    'coin',
                    { filled: n <= projectBillingFilledCoins(row.progress) },
                  ]"
                >
                  💰
                </span>
              </div>
            </div>
          </div>
          <div class="project-timeline-wrap">
            <div
              class="project-timeline"
              :class="{ dragging: isDraggingTimeline }"
              :ref="registerTimelineRef(row.progress.project.gid)"
              @mousedown.prevent="onTimelineMouseDown"
              @mousemove.prevent="onTimelineMouseMove"
              @mouseup="onTimelineMouseUp"
              @mouseleave="onTimelineMouseUp"
            >
              <template v-if="row.tasks.length > 0">
                <div
                  v-for="entry in row.tasks"
                  :key="entry.task.gid"
                  class="billing-task-card section-block"
                  :data-status="entry.task.completed ? 'done' : 'open'"
                >
                  <div class="section-header">
                    <a
                      class="billing-task-title"
                      :href="entry.task.permalink_url"
                      target="_blank"
                      rel="noopener"
                      @click.stop
                    >
                      {{ entry.task.name }}
                    </a>
                  </div>
                  <div class="task-billing-row">
                    <span
                      v-if="typeof entry.task.billingAmount === 'number'"
                      class="task-billing-value"
                    >
                      💰{{ entry.task.billingAmount.toLocaleString("zh-TW") }}
                    </span>
                    <span v-else class="task-billing-empty" aria-label="無請款金額"
                      >💰 —</span
                    >
                  </div>
                  <div class="section-date">
                    <div>
                      {{
                        entry.task.due_on
                          ? new Date(entry.task.due_on).toLocaleDateString("zh-TW", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })
                          : "截止：—"
                      }}
                    </div>
                  </div>
                  <div class="section-bar">
                    <div
                      class="section-bar-fill"
                      :class="
                        entry.task.completed ? 'status-done' : 'status-progress'
                      "
                      :style="{
                        width: entry.task.completed ? '100%' : '8%',
                      }"
                    />
                  </div>
                  <div class="section-meta">
                    <span class="rate">
                      {{ entry.task.completed ? "已完成" : "未完成" }}
                    </span>
                    <span v-if="entry.task.assignee" class="tasks">
                      {{ entry.task.assignee.name }}
                    </span>
                  </div>
                </div>
              </template>
              <div v-else-if="!row.progress.loadingTasks" class="billing-empty-hint">
                此專案沒有「請款進展」為是的任務。
              </div>
            </div>
            <div v-if="row.progress.loadingTasks" class="timeline-loading-overlay">
              <span class="timeline-loading-text">任務載入中…</span>
            </div>
          </div>
        </article>
      </section>
    </main>

    <ScrollToTopButton />
  </div>
</template>

<style scoped>
.progress-page {
  min-height: 100vh;
  background: #f8f9fb;
  display: flex;
  flex-direction: column;
}
.billing-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: #4b5563;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}
.legend-done {
  background: #22c55e;
}
.legend-open {
  background: #60a5fa;
}
.page-main {
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
.timeline {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.project-row {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}
.project-name {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.project-name-text {
  font-size: 15px;
  font-weight: 800;
  color: #111827;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.project-title-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  max-width: 100%;
}
.project-name-link.project-name-label {
  display: block;
  min-width: 0;
  max-width: 100%;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.project-name-link.project-name-label:hover {
  color: #4f46e5;
  text-decoration: underline;
}
.project-name-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.project-reload-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
}
.project-reload-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #4f46e5;
}
.project-reload-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.project-reload-icon {
  display: block;
}
.project-billing-years {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 2px;
  width: 100%;
}
.project-year-line {
  display: grid;
  grid-template-columns: 62px 1fr;
  align-items: center;
  column-gap: 8px;
  line-height: 1.25;
}
.project-year-line-current {
  background: rgba(96, 165, 250, 0.18);
  border-radius: 8px;
  padding: 2px 8px;
}
.project-year-label {
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
}
.project-year-label-current {
  color: #60a5fa;
  font-size: 15px;
  font-weight: 700;
}
.project-year-amount {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 4px;
  align-items: center;
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.project-year-amount-current {
  color: #111827;
  font-size: 14px;
  font-weight: 700;
}
.project-year-amount-collected,
.project-year-amount-total {
  text-align: right;
}
.project-year-amount-slash {
  text-align: center;
}
.project-total-divider {
  width: 100%;
  height: 1px;
  background: #e5e7eb;
  margin: 2px 0 0;
}
.project-total-row {
  display: grid;
  grid-template-columns: 62px 1fr;
  align-items: center;
  column-gap: 8px;
  width: 100%;
  margin-top: 2px;
}
.project-total-pill {
  color: #22c55e;
  font-weight: 700;
  font-size: 10px;
  line-height: 1;
  text-align: center;
}
.project-total-amount {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 4px;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
}
.project-billing-coins {
  margin-top: 2px;
  display: flex;
  gap: 0;
  align-items: center;
}
.project-billing-coins .coin {
  font-size: 18px;
  line-height: 1;
  opacity: 0.25;
}
.project-billing-coins .coin + .coin {
  margin-left: -4px;
}
.project-billing-coins .coin.filled {
  opacity: 1;
}
.picker-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.picker-checkboxes-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.project-checkbox-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
  max-height: min(58vh, 520px);
  overflow-y: auto;
  flex: 1;
  min-height: 280px;
}
.project-checkbox-item {
  margin: 0;
}
.project-checkbox-label {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  margin: 4px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  background: #fff;
  border: 1px solid transparent;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.project-checkbox-label:hover {
  background: #f3f4f6;
  border-color: #e5e7eb;
}
.project-checkbox-input {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: #4f46e5;
  cursor: pointer;
}
.project-checkbox-text {
  flex: 1;
  min-width: 0;
  line-height: 1.35;
  word-break: break-word;
}
.picker-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
  padding-top: 4px;
}
.secondary-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  border: none;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.secondary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.project-timeline {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: row;
  gap: 8px;
  overflow-x: auto;
  cursor: grab;
  align-items: stretch;
}
.project-timeline-wrap {
  position: relative;
  min-width: 0;
}
.project-timeline.dragging {
  cursor: grabbing;
  position: relative;
}
.timeline-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(249, 250, 251, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.timeline-loading-text {
  font-size: 13px;
  color: #374151;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 10px;
  border-radius: 999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.section-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 200px;
}
.billing-task-title {
  font-size: 12px;
  font-weight: 600;
  color: #4f46e5;
  text-decoration: none;
  line-height: 1.35;
  word-break: break-word;
}
.billing-task-title:hover {
  text-decoration: underline;
}
.task-billing-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 12px;
  line-height: 1.35;
}
.task-billing-value {
  font-weight: 700;
  color: #111827;
  text-align: right;
  min-width: 0;
}
.task-billing-empty {
  color: #9ca3af;
  font-weight: 600;
}
.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.section-date {
  font-size: 11px;
  color: #6b7280;
}
.section-bar {
  position: relative;
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}
.section-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  min-width: 4px;
}
.status-progress {
  background: #60a5fa;
}
.status-done {
  background: #22c55e;
}
.section-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #4b5563;
  padding: 4px 8px;
  border-radius: 6px;
}
.section-meta .rate {
  font-weight: 600;
}
.billing-empty-hint {
  font-size: 13px;
  color: #9ca3af;
  padding: 12px 8px;
  align-self: center;
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
.selected-panel {
  width: min(960px, 100% - 40px);
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 14px 16px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
.selected-panel.project-picker-panel {
  width: min(960px, calc(100vw - 48px));
  max-height: min(88vh, 820px);
  padding: 20px 22px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.selected-panel.project-picker-panel .selected-header {
  margin-bottom: 12px;
  flex-shrink: 0;
}
.selected-panel.project-picker-panel .selected-title {
  font-size: 17px;
}
.selected-panel.project-picker-panel .selected-range {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
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
@media (max-width: 768px) {
  .selected-panel.project-picker-panel {
    width: calc(100vw - 24px);
    max-height: 90vh;
    padding: 16px;
  }
  .project-checkbox-list {
    max-height: 50vh;
    min-height: 200px;
  }
  .project-checkbox-label {
    padding: 16px 14px;
    font-size: 16px;
  }
  .project-checkbox-input {
    width: 22px;
    height: 22px;
  }
  .project-row {
    grid-template-columns: 1fr;
  }
}
</style>
