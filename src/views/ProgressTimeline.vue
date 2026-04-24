<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from "vue";
import type { AsanaProject } from "@/types/asana";
import {
  useProjectProgress,
  type SectionProgress,
} from "@/composables/useProjectProgress";
import ScrollToTopButton from "@/components/ScrollToTopButton.vue";
import ProgressStatusLegend from "@/components/ProgressStatusLegend.vue";
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

function scrollTimelineToLastDoneSectionCenter(projectGid: string) {
  const el = timelineRefs.value[projectGid];
  if (!el) return;
  if (isDraggingTimeline.value) return;

  const blocks = Array.from(
    el.querySelectorAll<HTMLElement>(".section-block")
  );
  let targetBlock: HTMLElement | undefined;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]!.dataset.status === "done") {
      targetBlock = blocks[i];
      break;
    }
  }
  if (!targetBlock) return;

  const targetLeft =
    targetBlock.offsetLeft -
    (el.clientWidth - targetBlock.clientWidth) / 2;
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
  selectedSection,
  loadProgress,
  todayLabel,
  projectBillingTotal,
  projectBillingCollectedTotal,
  projectBillingFilledCoins,
  projectBillingYearLines,
  selectSection,
  reloadProjectProgress,
  bootstrapFromStorage,
  syncSelectionFromStorage,
} = useProjectProgress({
  onProjectTasksLoaded(projectGid) {
    scrollTimelineToLastDoneSectionCenter(projectGid);
  },
});

function onSectionClick(
  project: AsanaProject,
  sectionProgress: SectionProgress
) {
  if (timelineDragMoved.value) {
    timelineDragMoved.value = false;
    return;
  }
  selectSection(project, sectionProgress);
}

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
</script>

<template>
  <div class="progress-page">
    <header class="page-header">
      <div class="page-header-toolbar">
        <div class="toolbar-left">
          <div v-if="!error" class="header-search">
            <ProjectSortControl v-model="projectNameSortOrder" :disabled="loading" />
          <span class="header-search-divider" role="separator" aria-hidden="true" />
          <input
            id="project-search-input"
            v-model="projectSearchQuery"
            type="search"
            class="project-search-input"
            aria-label="依專案名稱篩選，留空顯示全部"
            placeholder="輸入關鍵字篩選專案名稱，留空顯示全部"
              autocomplete="off"
              spellcheck="false"
              :disabled="loading"
            />
          </div>
        </div>
        <div class="toolbar-right">
          <ProgressStatusLegend />
          <div class="meta-right">
            <div class="date-label">日期：{{ todayLabel() }}</div>
            <button
              type="button"
              class="reload-btn"
              :disabled="loading"
              @click="loadProgress()"
            >
              {{ loading ? "載入中…" : "重新載入" }}
            </button>
            <button
              type="button"
              class="resync-btn"
              :disabled="loading"
              title="略過伺服器快取，向 Asana 重新拉取最新資料"
              @click="loadProgress({ bypassProxyCache: true })"
            >
              {{ loading ? "載入中…" : "重新同步數據" }}
            </button>
            <button
              type="button"
              class="secondary-btn"
              :disabled="projectsOptionsLoading || loading"
              @click="projectPickerOpen = true"
            >
              選擇專案
            </button>
          </div>
        </div>
      </div>
    </header>

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
        正在載入專案進度…
      </div>
      <div v-else-if="items.length === 0" class="state empty">
        目前沒有可顯示的專案進度。
      </div>
      <div
        v-else-if="
          projectSearchQuery.trim() !== '' && filteredDisplayItems.length === 0
        "
        class="state empty"
      >
        沒有符合關鍵字的專案。
      </div>
      <section v-else class="timeline">
        <article
          v-for="item in filteredDisplayItems"
          :key="item.project.gid"
          class="project-row"
        >
          <div class="project-name">
            <div class="project-name-text">
              <div class="project-title-row">
                <a
                  class="project-name-link project-name-label"
                  :href="asanaProjectNotesUrl(item.project)"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="'在 Asana 開啟專案狀態'"
                  :aria-label="'在 Asana 開啟專案：' + item.project.name"
                  @click.stop
                >
                  {{ item.project.name }}
                </a>
                <button
                  type="button"
                  class="project-reload-btn"
                  :disabled="item.loadingTasks"
                  :title="
                    item.loadingTasks
                      ? '載入中…'
                      : '重新載入此專案（略過快取，向 Asana 取最新）'
                  "
                  :aria-label="'重新載入專案：' + item.project.name"
                  @click.stop="
                    reloadProjectProgress(item.project.gid, {
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
                v-if="!item.loadingTasks && projectBillingTotal(item) > 0"
                class="project-billing-years"
              >
                <div
                  v-for="line in projectBillingYearLines(item)"
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
                v-if="!item.loadingTasks && projectBillingTotal(item) > 0"
                class="project-total-divider"
              />

              <div
                v-if="!item.loadingTasks && projectBillingTotal(item) > 0"
                class="project-total-row"
              >
                <span class="project-total-pill">Total</span>
                <span class="project-total-amount">
                  <span class="project-year-amount-collected">
                    {{
                      projectBillingCollectedTotal(item).toLocaleString("zh-TW")
                    }}
                  </span>
                  <span class="project-year-amount-slash">/</span>
                  <span class="project-year-amount-total">
                    {{
                      projectBillingTotal(item).toLocaleString("zh-TW")
                    }}
                  </span>
                </span>
              </div>

              <div
                v-if="projectBillingTotal(item) > 0"
                class="project-billing-coins"
              >
                <span
                  v-for="n in 10"
                  :key="n"
                  :class="['coin', { filled: n <= projectBillingFilledCoins(item) }]"
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
              :ref="registerTimelineRef(item.project.gid)"
              @mousedown.prevent="onTimelineMouseDown"
              @mousemove.prevent="onTimelineMouseMove"
              @mouseup="onTimelineMouseUp"
              @mouseleave="onTimelineMouseUp"
            >
              <div
                v-for="sp in item.sections"
                :key="sp.section.gid"
                class="section-block"
                :data-status="sp.status"
                @click="onSectionClick(item.project, sp)"
              >
              <div class="section-header">
                <span class="section-name">
                  {{ sp.section.name }}
                </span>
              </div>
              <div class="section-date">
                <div class="section-billing">
                  <span v-if="sp.billingTotal > 0">
                    💰 {{ sp.billingTotal.toLocaleString("zh-TW") }}
                  </span>
                  <span v-else>&nbsp;</span>
                </div>
                <div>
                  {{ sp.latestMilestoneDueOn || "-" }}
                </div>
              </div>
              <div class="section-bar">
                <div
                  class="section-bar-fill"
                  :class="[
                    sp.status === 'done'
                      ? 'status-done'
                      : sp.status === 'behind'
                      ? 'status-behind'
                      : sp.status === 'at-risk'
                      ? 'status-at-risk'
                      : sp.status === 'in-progress'
                      ? 'status-progress'
                      : 'status-not-started',
                  ]"
                  :style="{ width: `${Math.max(sp.completionRate * 100, 3)}%` }"
                />
              </div>
              <div
                class="section-meta"
                :class="{
                  'section-meta-behind': sp.status === 'behind',
                  'section-meta-at-risk': sp.status === 'at-risk',
                }"
              >
                <span class="rate">
                  完成度：{{ (sp.completionRate * 100).toFixed(0) }}%
                </span>
                <span class="tasks">
                  任務：{{ sp.completedTasks }}/{{ sp.totalTasks }}
                </span>
              </div>
              </div>
            </div>
            <div
              v-if="item.loadingTasks"
              class="timeline-loading-overlay"
            >
              <span class="timeline-loading-text">任務載入中…</span>
            </div>
          </div>
        </article>
      </section>

      <div
        v-if="selectedSection"
        class="selected-overlay"
        @click.self="selectedSection = null"
      >
        <section class="selected-panel">
          <header class="selected-header">
            <div class="selected-title">
              {{ selectedSection.project.name }} - {{ selectedSection.section.name }}
            </div>
          </header>
          <ul class="tasks-list">
            <li
              v-for="task in selectedSection.tasks"
              :key="task.gid"
              class="task-row"
              :class="{
                'task-milestone': task.resource_subtype === 'milestone',
              }"
            >
              <div class="task-main">
                <div class="task-title-line">
                  <span
                    v-if="task.resource_subtype === 'milestone'"
                    class="badge milestone"
                  >
                    里程碑
                  </span>
                  <a
                    class="task-name"
                    :href="task.permalink_url"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ task.name }}
                  </a>
                </div>
                <div class="task-meta">
                  <span class="badge project">
                    {{ selectedSection.project.name }}
                  </span>
                  <span class="badge section">
                    {{ selectedSection.section.name }}
                  </span>
                  <span
                    v-if="task.assignee"
                    class="badge assignee"
                  >
                    指派給：{{ task.assignee.name }}
                  </span>
                  <span
                    v-if="task.due_on"
                    class="badge due-date"
                  >
                    截止日：
                    {{
                      new Date(task.due_on).toLocaleDateString("zh-TW", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                    }}
                  </span>
                </div>
              </div>
              <div class="task-updated">
                <span class="label">最後更新</span>
                <span class="value">
                  {{
                    (task.modified_at ??
                      task.completed_at ??
                      task.created_at) &&
                    new Date(
                      task.modified_at ??
                        task.completed_at ??
                        task.created_at!
                    ).toLocaleString("zh-TW")
                  }}
                </span>
                <span
                  class="status-pill"
                  :class="task.completed ? 'status-done-pill' : 'status-open-pill'"
                >
                  {{ task.completed ? "已完成" : "未完成" }}
                </span>
              </div>
            </li>
          </ul>
        </section>
      </div>

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
.page-header {
  box-sizing: border-box;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.page-header-toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px 16px;
  flex-wrap: wrap;
}
.toolbar-left {
  flex: 1 1 auto;
  min-width: 0;
}
.toolbar-right {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px 20px;
  flex: 0 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
}
.header-search {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  min-width: 0;
  width: 100%;
  max-width: min(600px, 100%);
}
.header-search :deep(.project-sort-btn) {
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 6px;
}
.header-search :deep(.project-sort-glyph--default) {
  font-size: 13px;
}
.header-search :deep(.project-sort-glyph--asc),
.header-search :deep(.project-sort-glyph--desc) {
  font-size: 10px;
}
.header-search-divider {
  width: 1px;
  height: 20px;
  flex-shrink: 0;
  background: #d1d5db;
  align-self: center;
}
.header-search .project-search-input {
  flex: 1 1 200px;
  min-width: min(100%, 320px);
}
.meta-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
@media (max-width: 1199px) {
  .page-header {
    padding: 10px 16px;
  }
}
@media (max-width: 900px) {
  .page-header-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar-right {
    justify-content: space-between;
    width: 100%;
  }
  .meta-right {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}
@media (max-width: 640px) {
  .header-search {
    flex-wrap: wrap;
  }
  .header-search .project-search-input {
    flex-basis: 140px;
    flex-grow: 1;
    min-width: 0;
  }
  .meta-right {
    justify-content: flex-start;
  }
}
.date-label {
  font-size: 12px;
  color: #4b5563;
  white-space: nowrap;
}
.reload-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: none;
  background: #4f46e5;
  color: #fff;
  font-size: 12px;
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
.resync-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #0d9488;
  background: #fff;
  color: #0f766e;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.resync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.resync-btn:not(:disabled):hover {
  background: #f0fdfa;
  border-color: #0f766e;
}
.page-header .secondary-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  font-weight: 600;
}
.page-main {
  flex: 1;
  padding: 20px 24px 32px;
}
.project-search-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  color: #111827;
  background: #fff;
}
.project-search-input::placeholder {
  color: #9ca3af;
}
.project-search-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
.project-search-input:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  background: #f3f4f6;
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
.project-billing-total {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
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
.project-filter {
  margin: 16px 0 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.project-filter-summary {
  margin: 16px 0 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.filter-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.filter-sub-summary {
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
}
.filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
.filter-left {
  min-width: 220px;
}
.filter-label {
  font-size: 12px;
  font-weight: 700;
  color: #111827;
}
.filter-sub {
  margin-top: 4px;
  font-size: 11px;
  color: #6b7280;
}
.filter-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.section-name {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
}
.section-date {
  font-size: 11px;
  color: #6b7280;
}
.section-billing {
  margin-bottom: 2px;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
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
}
.status-not-started {
  background: #d1d5db;
}
.status-progress {
  background: #60a5fa;
}
.status-done {
  background: #22c55e;
}
.status-behind {
  background: #ef4444;
}
.status-at-risk {
  background: #eab308;
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
.section-meta-behind {
  background: rgba(239, 68, 68, 0.15);
}
.section-meta-at-risk {
  background: rgba(234, 179, 8, 0.2);
}
.section-meta .rate {
  font-weight: 600;
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
.legend-not-started {
  background: #d1d5db;
}
.legend-progress {
  background: #60a5fa;
}
.legend-done {
  background: #22c55e;
}
.legend-behind {
  background: #ef4444;
}
.legend-at-risk {
  background: #eab308;
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
/* 專案選擇彈窗：較大版面、捲動僅在清單內（需覆寫上一段 .selected-panel） */
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
.tasks-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.task-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid #f3f4f6;
}
.task-row:last-child {
  border-bottom: none;
}
.task-milestone {
  background: #fdf2f8;
}
.task-milestone .task-name {
  color: #9d174d;
}
.task-main {
  flex: 1;
  min-width: 0;
}
.task-title-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
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
.badge.milestone {
  background: #fce7f3;
  color: #9d174d;
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
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
}
.status-done-pill {
  background: #dcfce7;
  color: #166534;
}
.status-open-pill {
  background: #fee2e2;
  color: #b91c1c;
}
@media (max-width: 768px) {
  .project-filter {
    flex-direction: column;
    align-items: flex-start;
  }
  .filter-left {
    min-width: unset;
  }
  .filter-right {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
  }
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

