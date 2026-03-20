<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useAuthStore } from "@/stores/auth";
import {
  fetchProjects,
  fetchSectionsByProject,
  fetchTasksBySection,
} from "@/api/asana";
import type { AsanaProject, AsanaSection, AsanaTask } from "@/types/asana";

const auth = useAuthStore();

type SectionProgress = {
  section: AsanaSection;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  status: "not-started" | "in-progress" | "done" | "behind" | "at-risk";
  latestMilestoneDueOn: string | null;
  /** 此 section 內所有任務的請款金額總和（依指定 custom field） */
  billingTotal: number;
  /** 此 section 內「已完成」任務的請款金額總和（視為已收） */
  billingCollectedTotal: number;
  tasks: AsanaTask[];
};

type ProjectProgress = {
  project: AsanaProject;
  sections: SectionProgress[];
  /** 是否仍在載入此專案底下各 section 的任務 */
  loadingTasks?: boolean;
};

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<ProjectProgress[]>([]);
/** 每次重新載入時遞增，避免舊的非同步回調寫入造成 undefined 或錯位 */
const loadIdRef = ref(0);

/** 僅渲染有效項目，避免 item 為 undefined 時讀取 item.project 報錯 */
const displayItems = computed(() =>
  items.value.filter(
    (i): i is ProjectProgress => i != null && i.project != null
  )
);

// 專案列表：滑鼠拖曳左右滾動用狀態
const isDraggingTimeline = ref(false);
const dragStartX = ref(0);
const dragScrollLeft = ref(0);
const activeTimelineEl = ref<HTMLElement | null>(null);
const timelineDragMoved = ref(false);

// 用來在載入完成後把「最左邊 in-progress 的 section」置中
const timelineRefs = ref<Record<string, HTMLElement | null>>({});
function registerTimelineRef(projectGid: string) {
  return (el: any) => {
    timelineRefs.value[projectGid] = el as HTMLElement | null;
  };
}

function scrollTimelineToLeftMostInProgressCenter(projectGid: string) {
  const el = timelineRefs.value[projectGid];
  if (!el) return;
  if (isDraggingTimeline.value) return;

  const blocks = Array.from(
    el.querySelectorAll<HTMLElement>(".section-block")
  );
  const targetBlock = blocks.find((b) => b.dataset.status === "in-progress");
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

function onSectionClick(
  project: AsanaProject,
  sectionProgress: SectionProgress
) {
  // 若剛剛是拖動時間軸，不要打開任務詳情
  if (timelineDragMoved.value) {
    timelineDragMoved.value = false;
    return;
  }
  selectedSection.value = {
    project,
    section: sectionProgress.section,
    tasks: sectionProgress.tasks,
  };
}

function projectBillingTotal(p: ProjectProgress): number {
  return p.sections.reduce((sum, s) => sum + (s.billingTotal || 0), 0);
}

function projectBillingCollectedTotal(p: ProjectProgress): number {
  return p.sections.reduce(
    (sum, s) => sum + (s.billingCollectedTotal || 0),
    0
  );
}

function projectBillingCollectedRate(p: ProjectProgress): number {
  const total = projectBillingTotal(p);
  if (!total) return 0;
  return (projectBillingCollectedTotal(p) / total) * 100;
}

/** 將已收比例換算成 0~10 顆錢幣 */
function projectBillingFilledCoins(p: ProjectProgress): number {
  const rate = projectBillingCollectedRate(p);
  if (!projectBillingTotal(p)) return 0;
  return Math.max(0, Math.min(10, Math.round(rate / 10)));
}

type ProjectYearBillingLine = {
  key: string;
  /** 年份（例如 2026），沒有 due_on 則為 '-' */
  label: string;
  collected: number;
  total: number;
  isCurrentYear: boolean;
};

function projectBillingYearLines(p: ProjectProgress): ProjectYearBillingLine[] {
  const currentYear = new Date().getFullYear();
  const byYear = new Map<number, { collected: number; total: number }>();
  let noDue = { collected: 0, total: 0 };

  for (const s of p.sections) {
    for (const t of s.tasks) {
      const amountTotal = typeof t.billingAmount === "number" ? t.billingAmount : 0;
      const amountCollected =
        t.completed && typeof t.billingAmount === "number" ? t.billingAmount : 0;

      if (amountTotal === 0 && amountCollected === 0) continue;

      const dueStr = typeof t.due_on === "string" ? t.due_on : "";
      if (dueStr) {
        const dt = new Date(dueStr);
        const y = dt.getFullYear();
        if (!Number.isNaN(y)) {
          const cur = byYear.get(y) ?? { collected: 0, total: 0 };
          byYear.set(y, {
            collected: cur.collected + amountCollected,
            total: cur.total + amountTotal,
          });
          continue;
        }
      }

      noDue.total += amountTotal;
      noDue.collected += amountCollected;
    }
  }

  const yearEntries: ProjectYearBillingLine[] = Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0]) // 小的在上，大的在下
    .map(([year, v]) => ({
      key: String(year),
      label: String(year),
      collected: v.collected,
      total: v.total,
      isCurrentYear: year === currentYear,
    }));

  if (noDue.total > 0 || noDue.collected > 0) {
    yearEntries.push({
      key: "no-due",
      label: "-",
      collected: noDue.collected,
      total: noDue.total,
      isCurrentYear: false,
    });
  }

  return yearEntries;
}

const projectsOptions = ref<AsanaProject[]>([]);
const projectsOptionsLoading = ref(false);

/** 首次進入頁面時只載入前 N 個專案以降低 loading */
const INITIAL_LOAD_LIMIT = 5;
const isFirstLoad = ref(true);

const selectedProjectGids = ref<string[]>([]);
const LS_KEY_PREFIX = "asana_progress_selected_project_gids_v1";
const projectPickerOpen = ref(false);

function getSelectedProjectsStorageKey(): string {
  const hash = auth.getTokenHash();
  return `${LS_KEY_PREFIX}_${hash ?? ""}`;
}

function loadSelectedFromLocalStorage(): string[] {
  try {
    const key = getSelectedProjectsStorageKey();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string");
  } catch {
    return [];
  }
}

function persistSelectedToLocalStorage() {
  try {
    const key = getSelectedProjectsStorageKey();
    localStorage.setItem(key, JSON.stringify(selectedProjectGids.value));
  } catch {
    // ignore
  }
}

watch(selectedProjectGids, () => {
  persistSelectedToLocalStorage();
});

// 切換 PAT（登出／換帳號）時，改為載入該 PAT 對應的專案選擇
watch(
  () => auth.getTokenHash(),
  () => {
    selectedProjectGids.value = loadSelectedFromLocalStorage();
  }
);

const selectedSection = ref<{
  project: AsanaProject;
  section: AsanaSection;
  tasks: AsanaTask[];
} | null>(null);

function todayLabel(): string {
  return new Date().toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 截止日是否在「今天起算一週內」或「已經過期但尚未完成」：
 * - 含今天、含第 7 天
 * - 若截止日在今天之前，視為符合條件（只要還有未完成任務，外層會套用紅色）
 */
function isDueWithinOneWeek(dueDateStr: string): boolean {
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const oneWeekLater = new Date(today);
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  // 若已到期（due < today）也算在內；或在未來 7 天內
  return due <= oneWeekLater;
}

/** 截止日是否在「今天起算兩週內」（含今天、含第 14 天） */
function isDueWithinTwoWeeks(dueDateStr: string): boolean {
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const twoWeeksLater = new Date(today);
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
  return due >= today && due <= twoWeeksLater;
}

function calcSectionProgress(
  section: AsanaSection,
  tasks: AsanaTask[]
): SectionProgress {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionRate =
    totalTasks === 0 ? 0 : completedTasks / Math.max(totalTasks, 1);

  // 請款金額總和（僅計算有 billingAmount 的任務）
  const billingTotal = tasks.reduce(
    (sum, t) => sum + (typeof t.billingAmount === "number" ? t.billingAmount : 0),
    0
  );

  // 已收金額：僅計算「已完成」任務的請款金額
  const billingCollectedTotal = tasks.reduce(
    (sum, t) =>
      sum +
      (t.completed && typeof t.billingAmount === "number" ? t.billingAmount : 0),
    0
  );

  // 里程碑任務中，找最晚的 due_on
  const milestoneDueDates = tasks
    .filter(
      (t) =>
        t.resource_subtype === "milestone" &&
        typeof t.due_on === "string" &&
        t.due_on !== ""
    )
    .map((t) => t.due_on as string);

  let latestMilestoneDueOn: string | null = null;
  if (milestoneDueDates.length > 0) {
    milestoneDueDates.sort();
    latestMilestoneDueOn =
      milestoneDueDates[milestoneDueDates.length - 1] ?? null;
  }

  // 顏色狀態邏輯
  let status: SectionProgress["status"];
  if (totalTasks === 0) {
    // 完全沒有任務 → 一律視為未開始（灰色）
    status = "not-started";
  } else if (completedTasks === totalTasks) {
    // 全部完成 → 綠色
    status = "done";
  } else {
    // 有任務未完成（包含完成數為 0 的情況）先視為進行中，
    // 之後再依截止日決定是否要標示為紅 / 黃
    status = "in-progress";
  }
  // 有里程碑截止日，但時間點「不在兩週內、也不在一週內」，
  // 且完全沒有任何任務完成 → 視為還沒開始（維持灰色）
  if (
    completedTasks === 0 &&
    latestMilestoneDueOn &&
    !isDueWithinTwoWeeks(latestMilestoneDueOn) &&
    !isDueWithinOneWeek(latestMilestoneDueOn)
  ) {
    status = "not-started";
  }

 // 根本沒有里程碑截止日，且完全沒有任何任務完成 → 一樣視為還沒開始（灰色）
 if (!latestMilestoneDueOn && completedTasks === 0) {
    status = "not-started";
  }

  // 截止日在一週內（或已過期），且有任務尚未完成 → 一律視為落後（紅色）
  if (
    status === "in-progress" &&
    latestMilestoneDueOn &&
    isDueWithinOneWeek(latestMilestoneDueOn)
  ) {
    status = "behind";
  }

  // 截止日在兩週內且超過 1/4 任務未完成（完成度 < 75%）→ 標示為風險（黃色）
  //（若同時符合紅色條件，會先被上面吃掉，這裡就不會再進來）
  if (
    status === "in-progress" &&
    latestMilestoneDueOn &&
    isDueWithinTwoWeeks(latestMilestoneDueOn) && 
    !isDueWithinOneWeek(latestMilestoneDueOn) &&
    completionRate < 0.75
  ) {
    status = "at-risk";
  }

 
  
  return {
    section,
    totalTasks,
    completedTasks,
    completionRate,
    status,
    latestMilestoneDueOn,
    billingTotal,
    billingCollectedTotal,
    tasks,
  };
}

async function loadProgress() {
  loading.value = true;
  error.value = null;
  items.value = [];
  loadIdRef.value += 1;
  const thisLoadId = loadIdRef.value;

  try {
    // 每次載入都重新抓一次專案清單，確保權杖或權限變更後可以看到最新專案
    projectsOptionsLoading.value = true;
    const fetchedProjects = await fetchProjects();
    projectsOptions.value = fetchedProjects;
    projectsOptionsLoading.value = false;

    // 過濾掉 localStorage 中可能不再可用的專案 GID（例如權杖更新後看不到）
    if (selectedProjectGids.value.length > 0) {
      selectedProjectGids.value = selectedProjectGids.value.filter((gid) =>
        projectsOptions.value.some((p) => p.gid === gid)
      );
    }

    let projectsToLoad =
      selectedProjectGids.value.length > 0
        ? projectsOptions.value.filter((p) =>
            selectedProjectGids.value.includes(p.gid)
          )
        : projectsOptions.value;

    // 首次進入只載入前 N 個專案，降低初始 loading
    if (isFirstLoad.value) {
      projectsToLoad = projectsToLoad.slice(0, INITIAL_LOAD_LIMIT);
      isFirstLoad.value = false;
    }

    // 第一步：併發取得所有專案的 sections，再把專案與 section 框一次性全部渲染
    const projectSectionList = await Promise.all(
      projectsToLoad.map(async (project) => {
        const sections = await fetchSectionsByProject(project.gid);
        return { project, sections };
      })
    );

    for (const { project, sections } of projectSectionList) {
      const placeholderSections: SectionProgress[] = sections.map((section) =>
        calcSectionProgress(section, [])
      );
      items.value.push({
        project,
        sections: placeholderSections,
        loadingTasks: true,
      });
    }

    // 第二步：併發載入各專案的任務，各自完成時更新對應的 item（不再一個專案全載完才處理下一個）
    projectSectionList.forEach(({ project, sections }, index) => {
      (async () => {
        try {
          const sectionProgressListRaw = await Promise.all(
            sections.map(async (section) => {
              const tasks = await fetchTasksBySection(section.gid);
              if (section.name === "未命名區段" && tasks.length === 0) {
                return null as SectionProgress | null;
              }
              return calcSectionProgress(section, tasks);
            })
          );
          const sectionProgressList = sectionProgressListRaw.filter(
            (x): x is SectionProgress => x !== null
          );
          // 若使用者已重新載入，此回調屬於舊的 load，不再寫入避免錯位或 undefined
          if (thisLoadId !== loadIdRef.value) return;
          items.value[index] = {
            project,
            sections: sectionProgressList,
            loadingTasks: false,
          };
          // 任務載入完成後，將「最左邊 in-progress 的 section」置中顯示
          nextTick(() => {
            if (thisLoadId !== loadIdRef.value) return;
            scrollTimelineToLeftMostInProgressCenter(project.gid);
          });
        } catch (e) {
          console.error("載入專案 section 任務失敗", e);
        }
      })();
    });

    if (projectsToLoad.length === 0) {
      error.value = "目前選擇的專案沒有可載入的資料（可能已被封存或權限不足）。";
    }
  } catch (e) {
    console.error("載入專案進度失敗", e);
    error.value = "載入專案進度失敗，請稍後重試。";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  selectedProjectGids.value = loadSelectedFromLocalStorage();
  loadProgress();
});
</script>

<template>
  <div class="progress-page">
    <header class="page-header">
      <div class="title-block">
        <h1>專案進度</h1>
        <p>以 Asana 專案與 section 為單位，根據任務完成率與里程碑截止日展示專案進度。</p>
      </div>
      <div class="meta">
        <div class="legend-header">
          <span class="legend-item">
            <span class="legend-dot legend-not-started" /> 尚未開始
          </span>
          <span class="legend-item">
            <span class="legend-dot legend-progress" /> 進行中
          </span>
          <span class="legend-item">
            <span class="legend-dot legend-done" /> 已完成
          </span>
          <span class="legend-item">
            <span class="legend-dot legend-behind" /> 落後（一週內截止未完成）
          </span>
          <span class="legend-item">
            <span class="legend-dot legend-at-risk" /> 風險（兩週內截止且逾 1/4 未完成）
          </span>
        </div>
        <div class="meta-right">
          <div class="date-label">日期：{{ todayLabel() }}</div>
          <button
            type="button"
            class="reload-btn"
            :disabled="loading"
            @click="loadProgress"
          >
            {{ loading ? "載入中…" : "重新載入" }}
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

            <div v-else>
              <select
                v-model="selectedProjectGids"
                multiple
                class="project-select"
              >
                <option
                  v-for="p in projectsOptions"
                  :key="p.gid"
                  :value="p.gid"
                >
                  {{ p.name }}
                </option>
              </select>

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
      <section v-else class="timeline">
        <article
          v-for="item in displayItems"
          :key="item.project.gid"
          class="project-row"
        >
          <div class="project-name">
            <div class="project-name-text">
              <span class="project-name-label">
                {{ item.project.name }}
              </span>
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
              v-if="item.loadingTasks"
              class="timeline-loading-overlay"
            >
              <span class="timeline-loading-text">任務載入中…</span>
            </div>
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
.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.legend-header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #4b5563;
}
.meta-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.date-label {
  font-size: 12px;
  color: #4b5563;
}
.reload-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
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
.project-name-label {
  white-space: nowrap;
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

.project-picker-panel {
  width: min(720px, 100% - 40px);
}
.picker-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.picker-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
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
.project-select {
  width: 360px;
  max-width: 55vw;
  height: 130px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #fff;
  font-size: 13px;
}
.project-select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
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
  position: relative;
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
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
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
  .project-select {
    width: 100%;
    max-width: 100%;
  }
  .project-row {
    grid-template-columns: 1fr;
  }
}
</style>

