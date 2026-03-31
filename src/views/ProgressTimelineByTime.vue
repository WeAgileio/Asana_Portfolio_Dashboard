<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onActivated,
  onUnmounted,
} from "vue";
import type { AsanaProject } from "@/types/asana";
import {
  useProjectProgress,
  type SectionProgress,
  type ProjectProgress,
} from "@/composables/useProjectProgress";
import ScrollToTopButton from "@/components/ScrollToTopButton.vue";
import ProjectSortControl from "@/components/ProjectSortControl.vue";
import {
  applyProjectNameSort,
  type ProjectNameSortOrder,
} from "@/utils/projectDisplaySort";

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
} = useProjectProgress();

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

/** 僅在整批初始載入（loading）時禁止橫向拖曳；單專案任務載入時不鎖全表（與專案進度頁一致） */
const bytimeDragScrollDisabled = computed(() => loading.value);

const isDraggingBytimeScroll = ref(false);
const bytimeDragStartX = ref(0);
const bytimeDragScrollLeft = ref(0);
const bytimeScrollEl = ref<HTMLElement | null>(null);
const bytimeHeadScrollEl = ref<HTMLElement | null>(null);
const bytimeBodyScrollEl = ref<HTMLElement | null>(null);
/** 表頭／表身雙層橫向捲動互相同步時避免迴圈 */
const bytimeScrollSyncing = ref(false);
/** 拖曳橫向捲動時為 true，用於避免誤觸開啟 section 詳情 */
const bytimeDragMoved = ref(false);

function onBytimeHeadScroll() {
  if (bytimeScrollSyncing.value) return;
  const h = bytimeHeadScrollEl.value;
  const b = bytimeBodyScrollEl.value;
  if (!h || !b) return;
  bytimeScrollSyncing.value = true;
  b.scrollLeft = h.scrollLeft;
  requestAnimationFrame(() => {
    bytimeScrollSyncing.value = false;
  });
}

function onBytimeBodyScroll() {
  if (bytimeScrollSyncing.value) return;
  const h = bytimeHeadScrollEl.value;
  const b = bytimeBodyScrollEl.value;
  if (!h || !b) return;
  bytimeScrollSyncing.value = true;
  h.scrollLeft = b.scrollLeft;
  requestAnimationFrame(() => {
    bytimeScrollSyncing.value = false;
  });
}

function endBytimeTableDrag() {
  document.removeEventListener("mousemove", onBytimeTableDocumentMove);
  document.removeEventListener("mouseup", onBytimeTableDocumentUp);
  isDraggingBytimeScroll.value = false;
  bytimeScrollEl.value = null;
}

function onBytimeTableDocumentMove(event: MouseEvent) {
  const el = bytimeScrollEl.value;
  if (!isDraggingBytimeScroll.value || !el) return;
  event.preventDefault();
  const dx = event.clientX - bytimeDragStartX.value;
  if (Math.abs(dx) > 3) {
    bytimeDragMoved.value = true;
  }
  const next = bytimeDragScrollLeft.value - dx;
  bytimeScrollSyncing.value = true;
  const h = bytimeHeadScrollEl.value;
  const b = bytimeBodyScrollEl.value;
  if (h) h.scrollLeft = next;
  if (b) b.scrollLeft = next;
  requestAnimationFrame(() => {
    bytimeScrollSyncing.value = false;
  });
}

function onBytimeTableDocumentUp() {
  endBytimeTableDrag();
}

function onBytimeScrollMouseDown(event: MouseEvent) {
  if (bytimeDragScrollDisabled.value) return;
  if (event.button !== 0) return;
  const t = event.target as HTMLElement | null;
  if (!t) return;
  if (t.closest("button, a, input, select, textarea, label")) {
    return;
  }
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  event.preventDefault();
  isDraggingBytimeScroll.value = true;
  bytimeDragMoved.value = false;
  bytimeScrollEl.value = el;
  bytimeDragStartX.value = event.clientX;
  bytimeDragScrollLeft.value = el.scrollLeft;
  document.addEventListener("mousemove", onBytimeTableDocumentMove);
  document.addEventListener("mouseup", onBytimeTableDocumentUp);
}

watch(bytimeDragScrollDisabled, (blocked) => {
  if (blocked) endBytimeTableDrag();
});

onUnmounted(() => {
  endBytimeTableDrag();
});

/** 若為 true：所有 section 只出現在「未排」欄（月欄留白，仍照範圍畫表頭） */
const forceAllSectionsInUnscheduled = false;

const UNSCHEDULED_KEY = "__unscheduled__";
const MONTH_BUFFER = 3;
/** 與 .bytime-col-* CSS 一致，供捲動定位 */
const BYTIME_PROJECT_COL_W = 220;
const BYTIME_UNSCHED_EXPANDED_W = 148;
const BYTIME_UNSCHED_COLLAPSED_W = 80;
const BYTIME_MONTH_COL_W = 154;

type Ym = { y: number; m: number };

type MonthColumn = {
  key: string;
  y: number;
  m: number;
  monthLabel: string;
};

function parseDueToYm(due: string): Ym | null {
  const m = due.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  return { y, m: mo };
}

function addMonths(ym: Ym, delta: number): Ym {
  const d = new Date(ym.y, ym.m - 1 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function ymKey(ym: Ym): string {
  return `${ym.y}-${String(ym.m).padStart(2, "0")}`;
}

function compareYm(a: Ym, b: Ym): number {
  if (a.y !== b.y) return a.y - b.y;
  return a.m - b.m;
}

function todayYm(): Ym {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1 };
}

/** 月欄索引：優先當月，否則取時間上最接近的一欄 */
function indexOfCurrentMonthColumn(cols: MonthColumn[]): number {
  if (cols.length === 0) return 0;
  const t = todayYm();
  const key = ymKey(t);
  const exact = cols.findIndex((c) => c.key === key);
  if (exact >= 0) return exact;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i]!;
    const dist = Math.abs((c.y - t.y) * 12 + (c.m - t.m));
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function enumerateMonths(from: Ym, to: Ym): MonthColumn[] {
  const out: MonthColumn[] = [];
  let cur = { ...from };
  for (;;) {
    out.push({
      key: ymKey(cur),
      y: cur.y,
      m: cur.m,
      monthLabel: `${cur.m}月`,
    });
    if (cur.y === to.y && cur.m === to.m) break;
    cur = addMonths(cur, 1);
  }
  return out;
}

function milestoneTimeMs(sp: SectionProgress): number {
  if (!sp.latestMilestoneDueOn) return Number.POSITIVE_INFINITY;
  const t = new Date(sp.latestMilestoneDueOn).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** 該 section 內任務「最晚的 created_at」毫秒，作為排序用（無則 0） */
function sectionLatestTaskCreatedMs(sp: SectionProgress): number {
  let max = 0;
  for (const t of sp.tasks) {
    if (!t.created_at) continue;
    const ms = new Date(t.created_at).getTime();
    if (Number.isFinite(ms) && ms > max) max = ms;
  }
  return max;
}

const monthColumns = computed((): MonthColumn[] => {
  const bounds: Ym[] = [];
  for (const item of filteredDisplayItems.value) {
    for (const sp of item.sections) {
      if (!sp.latestMilestoneDueOn) continue;
      const ym = parseDueToYm(sp.latestMilestoneDueOn);
      if (ym) bounds.push(ym);
    }
  }

  let minYm: Ym;
  let maxYm: Ym;
  if (bounds.length === 0) {
    const now = new Date();
    minYm = { y: now.getFullYear(), m: now.getMonth() + 1 };
    maxYm = { ...minYm };
  } else {
    minYm = bounds.reduce((a, b) => (compareYm(a, b) <= 0 ? a : b));
    maxYm = bounds.reduce((a, b) => (compareYm(a, b) >= 0 ? a : b));
  }

  const from = addMonths(minYm, -MONTH_BUFFER);
  const to = addMonths(maxYm, MONTH_BUFFER);
  return enumerateMonths(from, to);
});

const yearHeaderSpans = computed(() => {
  const cols = monthColumns.value;
  const spans: { year: number; colspan: number }[] = [];
  for (const c of cols) {
    const last = spans[spans.length - 1];
    if (last && last.year === c.y) last.colspan += 1;
    else spans.push({ year: c.y, colspan: 1 });
  }
  return spans;
});

function buildBucketMap(item: ProjectProgress): Map<string, SectionProgress[]> {
  const map = new Map<string, SectionProgress[]>();
  map.set(UNSCHEDULED_KEY, []);
  for (const col of monthColumns.value) {
    map.set(col.key, []);
  }

  for (const sp of item.sections) {
    if (forceAllSectionsInUnscheduled) {
      map.get(UNSCHEDULED_KEY)!.push(sp);
      continue;
    }
    const due = sp.latestMilestoneDueOn;
    if (!due) {
      map.get(UNSCHEDULED_KEY)!.push(sp);
      continue;
    }
    const ym = parseDueToYm(due);
    const k = ym ? ymKey(ym) : null;
    if (k && map.has(k)) {
      map.get(k)!.push(sp);
    } else {
      map.get(UNSCHEDULED_KEY)!.push(sp);
    }
  }

  for (const arr of map.values()) {
    arr.sort((a, b) => {
      const dueDiff = milestoneTimeMs(a) - milestoneTimeMs(b);
      if (dueDiff !== 0) return dueDiff;
      const ca = sectionLatestTaskCreatedMs(a);
      const cb = sectionLatestTaskCreatedMs(b);
      if (ca !== cb) return cb - ca;
      return a.section.name.localeCompare(b.section.name, "zh-Hant");
    });
  }
  return map;
}

const cellBucketsByProjectGid = computed(() => {
  const out = new Map<string, Map<string, SectionProgress[]>>();
  for (const item of filteredDisplayItems.value) {
    out.set(item.project.gid, buildBucketMap(item));
  }
  return out;
});

function sectionsInCell(
  item: ProjectProgress,
  cellKey: string
): SectionProgress[] {
  return (
    cellBucketsByProjectGid.value.get(item.project.gid)?.get(cellKey) ?? []
  );
}

/** 各月欄表頭：目前篩選下，該月欄內 section 總數（跨所有專列加總） */
const monthColumnSectionCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const col of monthColumns.value) {
    let n = 0;
    for (const item of filteredDisplayItems.value) {
      n += sectionsInCell(item, col.key).length;
    }
    counts[col.key] = n;
  }
  return counts;
});

/** 各月欄表頭：依狀態統計 section 數（含 0），跨所有可見專列加總 */
const monthColumnSectionStatusCounts = computed(() => {
  const counts: Record<
    string,
    {
      notStarted: number;
      inProgress: number;
      done: number;
      behind: number;
      atRisk: number;
    }
  > = {};

  for (const col of monthColumns.value) {
    counts[col.key] = {
      notStarted: 0,
      inProgress: 0,
      done: 0,
      behind: 0,
      atRisk: 0,
    };

    for (const item of filteredDisplayItems.value) {
      for (const sp of sectionsInCell(item, col.key)) {
        switch (sp.status) {
          case "not-started":
            counts[col.key]!.notStarted += 1;
            break;
          case "in-progress":
            counts[col.key]!.inProgress += 1;
            break;
          case "done":
            counts[col.key]!.done += 1;
            break;
          case "behind":
            counts[col.key]!.behind += 1;
            break;
          case "at-risk":
            counts[col.key]!.atRisk += 1;
            break;
        }
      }
    }
  }

  return counts;
});

/** 左側專案欄：該專案 sections 依狀態統計（含 0） */
function projectSectionStatusCounts(item: ProjectProgress): {
  notStarted: number;
  inProgress: number;
  done: number;
  behind: number;
  atRisk: number;
} {
  const out = {
    notStarted: 0,
    inProgress: 0,
    done: 0,
    behind: 0,
    atRisk: 0,
  };

  for (const sp of item.sections) {
    switch (sp.status) {
      case "not-started":
        out.notStarted += 1;
        break;
      case "in-progress":
        out.inProgress += 1;
        break;
      case "done":
        out.done += 1;
        break;
      case "behind":
        out.behind += 1;
        break;
      case "at-risk":
        out.atRisk += 1;
        break;
    }
  }

  return out;
}

function onRowClick(project: AsanaProject, sp: SectionProgress) {
  if (bytimeDragMoved.value) {
    bytimeDragMoved.value = false;
    return;
  }
  selectSection(project, sp);
}

/** 卡片外顯示：里程碑最晚截止日（與格內排序依據一致） */
function formatSectionDueOnDisplay(sp: SectionProgress): string {
  if (!sp.latestMilestoneDueOn) return "—";
  return new Date(sp.latestMilestoneDueOn).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const anyProjectLoadingTasks = computed(() =>
  filteredDisplayItems.value.some((i) => i.loadingTasks)
);

/** false = 未排欄折疊（省寬度），點表頭或列上數字展開 */
const unschedColumnExpanded = ref(false);

/** 重新載入完成後將橫向捲動對齊「目前月份」欄 */
const scrollAfterReloadToCurrentMonth = ref(false);

function scrollBytimeToCurrentMonthColumn() {
  const h = bytimeHeadScrollEl.value;
  const b = bytimeBodyScrollEl.value;
  if (!h || !b) return false;

  const cols = monthColumns.value;
  if (cols.length === 0) return false;

  const idx = indexOfCurrentMonthColumn(cols);
  const unschedW = unschedColumnExpanded.value
    ? BYTIME_UNSCHED_EXPANDED_W
    : BYTIME_UNSCHED_COLLAPSED_W;
  const leftGutter = BYTIME_PROJECT_COL_W + unschedW;
  const colStart = leftGutter + idx * BYTIME_MONTH_COL_W;

  const viewport = h.clientWidth || b.clientWidth;
  const targetScroll = colStart + BYTIME_MONTH_COL_W / 2 - viewport / 2;
  const maxScroll = Math.max(0, h.scrollWidth - h.clientWidth);
  const nextLeft = Math.max(0, Math.min(targetScroll, maxScroll));

  bytimeScrollSyncing.value = true;
  h.scrollLeft = nextLeft;
  b.scrollLeft = nextLeft;
  requestAnimationFrame(() => {
    bytimeScrollSyncing.value = false;
  });
  return true;
}

function beginReloadAndScrollToCurrentMonth() {
  scrollAfterReloadToCurrentMonth.value = true;
  void loadProgress();
}

function beginResyncAndScrollToCurrentMonth() {
  scrollAfterReloadToCurrentMonth.value = true;
  void loadProgress({ bypassProxyCache: true });
}

function tryScrollToCurrentMonthAfterDataReady(retries = 8) {
  nextTick(() => {
    requestAnimationFrame(() => {
      const ok = scrollBytimeToCurrentMonthColumn();
      if (ok) {
        scrollAfterReloadToCurrentMonth.value = false;
        return;
      }
      if (retries <= 0) return;
      setTimeout(() => {
        tryScrollToCurrentMonthAfterDataReady(retries - 1);
      }, 60);
    });
  });
}

watch(
  () => ({
    pending: scrollAfterReloadToCurrentMonth.value,
    done: !loading.value && !anyProjectLoadingTasks.value,
    n: monthColumns.value.length,
    showTable:
      items.value.length > 0 &&
      !(
        projectSearchQuery.value.trim() !== "" &&
        filteredDisplayItems.value.length === 0
      ),
  }),
  (s) => {
    if (!s.pending || !s.done) return;
    if (!s.showTable || s.n === 0) {
      scrollAfterReloadToCurrentMonth.value = false;
      return;
    }
    // 僅在整批資料載完後才滾動，並在 DOM 尚未就緒時短暫重試
    tryScrollToCurrentMonthAfterDataReady();
  },
  { flush: "post" }
);

const totalUnscheduledCount = computed(() => {
  let n = 0;
  for (const item of filteredDisplayItems.value) {
    n += sectionsInCell(item, UNSCHEDULED_KEY).length;
  }
  return n;
});

function unschedCountFor(item: ProjectProgress): number {
  return sectionsInCell(item, UNSCHEDULED_KEY).length;
}

function expandUnschedColumn() {
  unschedColumnExpanded.value = true;
}

function toggleUnschedColumn() {
  unschedColumnExpanded.value = !unschedColumnExpanded.value;
}

onMounted(() => {
  // 首次刷新進頁也要在資料載完後對齊當月欄
  scrollAfterReloadToCurrentMonth.value = true;
  void bootstrapFromStorage();
});

onActivated(() => {
  void syncSelectionFromStorage();
});
</script>

<template>
  <div class="progress-page">
    <header class="page-header">
      <div class="title-block">
        <h1>專案進度 ( 時間序 )</h1>
        <p class="title-block-desc">
          與「專案進度」共用資料；左側為專案與請款摘要，右側為月欄表。有里程碑截止日的 section
          對齊該月；無日期或無法對應月欄者集中在未排。
        </p>
      </div>

      <div
        v-if="!error"
        class="page-header-center"
      >
        <div class="header-search">
          <ProjectSortControl v-model="projectNameSortOrder" :disabled="loading" />
          <span class="header-search-divider" role="separator" aria-hidden="true" />
          <label class="project-search-label" for="project-search-bytime-input">專案搜尋</label>
          <input
            id="project-search-bytime-input"
            v-model="projectSearchQuery"
            type="search"
            class="project-search-input"
            placeholder="輸入關鍵字篩選專案名稱，留空顯示全部"
            autocomplete="off"
            spellcheck="false"
            :disabled="loading"
          />
        </div>
      </div>

      <div class="page-header-right">
        <div class="legend-header" aria-label="狀態圖例">
          <div class="legend-row">
            <span class="legend-item">
              <span class="legend-dot legend-not-started" /> 尚未開始
            </span>
            <span class="legend-item">
              <span class="legend-dot legend-progress" /> 進行中
            </span>
            <span class="legend-item">
              <span class="legend-dot legend-done" /> 已完成
            </span>
          </div>
          <div class="legend-row">
            <span class="legend-item">
              <span class="legend-dot legend-behind" /> 延後（一週內截止未完成）
            </span>
            <span class="legend-item">
              <span class="legend-dot legend-at-risk" /> 風險（兩週內截止且逾 1/4 未完成）
            </span>
          </div>
        </div>
        <div class="meta-right">
          <div class="date-label">日期：{{ todayLabel() }}</div>
          <button
            type="button"
            class="reload-btn"
            :disabled="loading"
            @click="beginReloadAndScrollToCurrentMonth"
          >
            {{ loading ? "載入中…" : "重新載入" }}
          </button>
          <button
            type="button"
            class="resync-btn"
            :disabled="loading"
            title="略過伺服器快取，向 Asana 重新拉取最新資料"
            @click="beginResyncAndScrollToCurrentMonth"
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
                    beginReloadAndScrollToCurrentMonth();
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
      <section v-else class="bytime-calendar-section">
        <div class="bytime-sticky-thead-wrap">
          <div
            ref="bytimeHeadScrollEl"
            class="bytime-thead-scroll"
            :class="{
              'bytime-table-scroll--dragging': isDraggingBytimeScroll,
              'bytime-scroll--drag-disabled': bytimeDragScrollDisabled,
            }"
            @scroll.passive="onBytimeHeadScroll"
            @mousedown="onBytimeScrollMouseDown"
          >
            <table
              class="bytime-grid-table"
              :class="{ 'unsched-col-collapsed': !unschedColumnExpanded }"
            >
              <colgroup>
                <col class="bytime-col-project" />
                <col class="bytime-col-unsched" />
                <col
                  v-for="col in monthColumns"
                  :key="'h-col-' + col.key"
                  class="bytime-col-month"
                />
              </colgroup>
              <thead>
                <tr class="bytime-head-year">
                  <th rowspan="2" class="sticky-col-project">
                    專案
                  </th>
                  <th rowspan="2" class="sticky-col-unsched th-unsched">
                    <button
                      type="button"
                      class="unsched-head-toggle"
                      :aria-expanded="unschedColumnExpanded"
                      :title="
                        unschedColumnExpanded
                          ? '收合未排欄'
                          : '展開未排欄（共 ' + totalUnscheduledCount + ' 個 section）'
                      "
                      @click="toggleUnschedColumn"
                    >
                      <span class="unsched-head-label">未排</span>
                      <span class="unsched-head-count-row">
                        <span class="unsched-head-count">{{ totalUnscheduledCount }}</span>
                        <span class="unsched-chevron" aria-hidden="true">{{
                          unschedColumnExpanded ? "▼" : "▶"
                        }}</span>
                      </span>
                    </button>
                  </th>
                  <th
                    v-for="span in yearHeaderSpans"
                    :key="'y-' + span.year + '-' + span.colspan"
                    class="th-year"
                    :colspan="span.colspan"
                  >
                    {{ span.year }}
                  </th>
                </tr>
                <tr class="bytime-head-month">
                  <th
                    v-for="col in monthColumns"
                    :key="'m-' + col.key"
                    class="th-month"
                  >
                    <div class="th-month-inner">
                      <span class="th-month-label">{{ col.monthLabel }}</span>
                      <span
                        class="th-month-count"
                        :title="
                          '此月欄共 ' +
                          (monthColumnSectionCounts[col.key] ?? 0) +
                          ' 個 section'
                        "
                      >
                        {{ monthColumnSectionCounts[col.key] ?? 0 }}
                      </span>
                      <div class="th-month-status-row" aria-label="各狀態 section 數量">
                        <span
                          class="th-month-status-item th-month-status-not-started"
                          title="尚未開始"
                        >
                          {{ monthColumnSectionStatusCounts[col.key]?.notStarted ?? 0 }}
                        </span>
                        <span
                          class="th-month-status-item th-month-status-in-progress"
                          title="進行中"
                        >
                          {{ monthColumnSectionStatusCounts[col.key]?.inProgress ?? 0 }}
                        </span>
                        <span
                          class="th-month-status-item th-month-status-done"
                          title="已完成"
                        >
                          {{ monthColumnSectionStatusCounts[col.key]?.done ?? 0 }}
                        </span>
                        <span
                          class="th-month-status-item th-month-status-behind"
                          title="落後"
                        >
                          {{ monthColumnSectionStatusCounts[col.key]?.behind ?? 0 }}
                        </span>
                        <span
                          class="th-month-status-item th-month-status-at-risk"
                          title="風險"
                        >
                          {{ monthColumnSectionStatusCounts[col.key]?.atRisk ?? 0 }}
                        </span>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
            </table>
          </div>
        </div>
        <div
          ref="bytimeBodyScrollEl"
          class="bytime-table-scroll bytime-body-scroll"
          :class="{
            'bytime-table-scroll--dragging': isDraggingBytimeScroll,
            'bytime-scroll--drag-disabled': bytimeDragScrollDisabled,
          }"
          @scroll.passive="onBytimeBodyScroll"
          @mousedown="onBytimeScrollMouseDown"
        >
          <table
            class="bytime-grid-table"
            :class="{ 'unsched-col-collapsed': !unschedColumnExpanded }"
          >
            <colgroup>
              <col class="bytime-col-project" />
              <col class="bytime-col-unsched" />
              <col
                v-for="col in monthColumns"
                :key="'b-col-' + col.key"
                class="bytime-col-month"
              />
            </colgroup>
            <tbody>
              <tr
                v-for="item in filteredDisplayItems"
                :key="item.project.gid"
                class="bytime-body-row"
              >
                <th class="sticky-col-project bytime-project-cell">
                  <div class="project-name-text">
                    <div class="project-title-row">
                      <span class="project-name-label">{{ item.project.name }}</span>
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
                          {{ projectBillingTotal(item).toLocaleString("zh-TW") }}
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

                    <div class="project-section-status-row" aria-label="各狀態 section 數量">
                      <span
                        class="project-section-status-item project-section-status-total"
                        title="總數"
                      >
                        {{ item.sections.length }}
                      </span>
                      <span
                        class="project-section-status-item th-month-status-not-started"
                        title="尚未開始"
                      >
                        {{ projectSectionStatusCounts(item).notStarted }}
                      </span>
                      <span
                        class="project-section-status-item th-month-status-in-progress"
                        title="進行中"
                      >
                        {{ projectSectionStatusCounts(item).inProgress }}
                      </span>
                      <span
                        class="project-section-status-item th-month-status-done"
                        title="已完成"
                      >
                        {{ projectSectionStatusCounts(item).done }}
                      </span>
                      <span
                        class="project-section-status-item th-month-status-behind"
                        title="落後"
                      >
                        {{ projectSectionStatusCounts(item).behind }}
                      </span>
                      <span
                        class="project-section-status-item th-month-status-at-risk"
                        title="風險"
                      >
                        {{ projectSectionStatusCounts(item).atRisk }}
                      </span>
                    </div>

                  </div>
                  <div
                    v-if="item.loadingTasks"
                    class="bytime-cell-loading-mask bytime-cell-loading-mask--show-label"
                  >
                    <span class="timeline-loading-text">任務載入中…</span>
                  </div>
                </th>
                <td
                  class="sticky-col-unsched bytime-cell-stack td-unsched"
                  :class="{ 'td-unsched-collapsed': !unschedColumnExpanded }"
                >
                  <button
                    v-if="!unschedColumnExpanded"
                    type="button"
                    class="unsched-cell-toggle"
                    :aria-label="'展開未排，此專案 ' + unschedCountFor(item) + ' 個 section'"
                    @click="expandUnschedColumn"
                  >
                    <span class="unsched-cell-count">{{ unschedCountFor(item) }}</span>
                  </button>

                  <template v-if="unschedColumnExpanded">
                    <div
                      v-for="sp in sectionsInCell(item, UNSCHEDULED_KEY)"
                      :key="sp.section.gid"
                      class="section-block bytime-section-card"
                      :data-status="sp.status"
                      role="button"
                      tabindex="0"
                      @click="onRowClick(item.project, sp)"
                      @keydown.enter.prevent="onRowClick(item.project, sp)"
                      @keydown.space.prevent="onRowClick(item.project, sp)"
                    >
                      <div class="section-header">
                        <span class="section-name">{{ sp.section.name }}</span>
                      </div>
                      <div class="section-due-line">
                        截止日期：{{ formatSectionDueOnDisplay(sp) }}
                      </div>
                      <div class="section-date">
                        <div class="section-billing">
                          <span v-if="sp.billingTotal > 0">
                            💰 {{ sp.billingTotal.toLocaleString("zh-TW") }}
                          </span>
                          <span v-else>&nbsp;</span>
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
                  </template>
                  <div
                    v-if="item.loadingTasks"
                    class="bytime-cell-loading-mask"
                    aria-hidden="true"
                  />
                </td>
                <td
                  v-for="col in monthColumns"
                  :key="col.key"
                  class="bytime-cell-stack"
                >
                  <div
                    v-for="sp in sectionsInCell(item, col.key)"
                    :key="sp.section.gid"
                    class="section-block bytime-section-card"
                    :data-status="sp.status"
                    role="button"
                    tabindex="0"
                    @click="onRowClick(item.project, sp)"
                    @keydown.enter.prevent="onRowClick(item.project, sp)"
                    @keydown.space.prevent="onRowClick(item.project, sp)"
                  >
                    <div class="section-header">
                      <span class="section-name">{{ sp.section.name }}</span>
                    </div>
                    <div class="section-due-line">
                      截止日期：{{ formatSectionDueOnDisplay(sp) }}
                    </div>
                    <div class="section-date">
                      <div class="section-billing">
                        <span v-if="sp.billingTotal > 0">
                          💰 {{ sp.billingTotal.toLocaleString("zh-TW") }}
                        </span>
                        <span v-else>&nbsp;</span>
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
                  <div
                    v-if="item.loadingTasks"
                    class="bytime-cell-loading-mask"
                    aria-hidden="true"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div
        v-if="selectedSection"
        class="selected-overlay"
        @click.self="selectedSection = null"
      >
        <section class="selected-panel">
          <header class="selected-header">
            <div class="selected-title">
              {{ selectedSection.project.name }} -
              {{ selectedSection.section.name }}
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
  min-height: 76px;
  padding: 8px 20px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px 20px;
}
.title-block {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px 14px;
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(480px, 40vw);
}
.title-block h1 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #111827;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.2;
}
.title-block-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: #6b7280;
  flex: 1 1 auto;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.page-header-center {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  flex: 1 1 320px;
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
.page-header-right {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px 16px;
  flex-shrink: 0;
  margin-left: auto;
}
.legend-header {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  line-height: 1.35;
  color: #4b5563;
}
.legend-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px 10px;
}
.page-header-right .legend-dot {
  width: 11px;
  height: 11px;
}
.meta-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
@media (min-width: 1200px) {
  .title-block {
    flex: 0 0 480px;
    min-width: 480px;
    max-width: 480px;
  }
  .title-block-desc {
    display: block;
    -webkit-line-clamp: unset;
    -webkit-box-orient: unset;
    overflow: visible;
  }
  .page-header-center {
    margin-left: 20px;
    padding-left: 4px;
  }
}
@media (max-width: 1199px) {
  .page-header {
    flex-wrap: wrap;
    min-height: 0;
    padding: 10px 16px;
  }
  .title-block {
    max-width: none;
    flex: 1 1 100%;
    min-width: 0;
  }
  .page-header-center {
    flex: 1 1 100%;
    justify-content: flex-start;
  }
  .page-header-right {
    margin-left: 0;
    flex: 1 1 100%;
    flex-wrap: wrap;
    justify-content: space-between;
  }
}
@media (max-width: 640px) {
  .title-block {
    flex-direction: column;
    align-items: flex-start;
  }
  .title-block h1 {
    white-space: normal;
  }
  .title-block-desc {
    -webkit-line-clamp: 5;
  }
  .header-search {
    flex-wrap: wrap;
  }
  .header-search .project-search-input {
    flex-basis: 140px;
    flex-grow: 1;
    min-width: 0;
  }
  .legend-row {
    flex-wrap: wrap;
  }
  .page-header-right {
    flex-direction: column;
    align-items: stretch;
  }
  .meta-right {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
.project-search-label {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
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

.bytime-calendar-section {
  position: relative;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  overflow: visible;
}
/** 包住表頭橫向捲動層，本層 position:sticky 才會貼視窗（不受內層 overflow-x 影響） */
.bytime-sticky-thead-wrap {
  position: sticky;
  top: 0;
  z-index: 25;
  background: #fff;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
  box-shadow: 0 2px 10px -4px rgba(15, 23, 42, 0.12);
}
.bytime-thead-scroll {
  position: relative;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  cursor: grab;
  scrollbar-width: none;
}
.bytime-thead-scroll.bytime-scroll--drag-disabled,
.bytime-table-scroll.bytime-scroll--drag-disabled {
  cursor: default;
}
.bytime-thead-scroll::-webkit-scrollbar {
  display: none;
  height: 0;
}
.bytime-table-scroll {
  position: relative;
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  cursor: grab;
}
.bytime-body-scroll {
  border-radius: 0 0 12px 12px;
}
.bytime-body-scroll .bytime-grid-table tbody tr:first-child > th,
.bytime-body-scroll .bytime-grid-table tbody tr:first-child > td {
  border-top: none;
}
.bytime-col-project {
  width: 220px;
  min-width: 220px;
}
.bytime-col-unsched {
  width: 148px;
  min-width: 148px;
}
.bytime-col-month {
  width: 154px;
  min-width: 154px;
}
.bytime-grid-table.unsched-col-collapsed .bytime-col-unsched {
  width: 80px;
  min-width: 80px;
  max-width: 80px;
}
.bytime-table-scroll--dragging {
  cursor: grabbing;
  user-select: none;
}
.bytime-table-scroll--dragging * {
  cursor: grabbing;
}
.bytime-grid-table {
  /* 勿 min-width:100%，否則 table-layout:fixed 會把剩餘寬度分配到各欄，表頭／表身兩張表分配結果可能差 1px 造成格線錯位 */
  width: max-content;
  border-collapse: collapse;
  table-layout: fixed;
}
.bytime-grid-table th,
.bytime-grid-table td {
  border: 1px solid #e5e7eb;
  vertical-align: top;
}
.bytime-grid-table thead th {
  background: #f9fafb;
  font-size: 14px;
  font-weight: 800;
  color: #111827;
  text-align: center;
  vertical-align: middle;
  padding: 2px 5px;
  line-height: 1.15;
}
.bytime-head-year .th-year {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-align: center;
  vertical-align: middle;
  padding: 2px 5px;
  background: #f9fafb;
}
.bytime-head-month .th-month {
  font-size: 14px;
  font-weight: 700;
  color: #4b5563;
  text-align: center;
  vertical-align: middle;
  padding: 2px 5px;
  background: #f9fafb;
}
.th-month-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  line-height: 1.2;
}
.th-month-label {
  font-size: 14px;
  font-weight: 700;
  color: #4b5563;
}
.th-month-count {
  font-size: 11px;
  font-weight: 700;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.th-month-status-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 10px;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.th-month-status-item {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  white-space: nowrap;
}
.th-month-status-not-started {
  color: #9ca3af;
}
.th-month-status-in-progress {
  color: #60a5fa;
}
.th-month-status-done {
  color: #22c55e;
}
.th-month-status-behind {
  color: #ef4444;
}
.th-month-status-at-risk {
  color: #eab308;
}
.project-section-status-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 10px;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.project-section-status-item {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  white-space: nowrap;
}
.project-section-status-total {
  color: #111827;
}
.sticky-col-project {
  position: sticky;
  left: 0;
  z-index: 5;
  width: 220px;
  min-width: 220px;
  max-width: 220px;
  background: #fff;
  box-shadow: 4px 0 12px -4px rgba(15, 23, 42, 0.12);
}
.bytime-grid-table thead .sticky-col-project {
  z-index: 21;
  background: #f9fafb;
  box-shadow: 4px 0 12px -4px rgba(15, 23, 42, 0.12);
}
.sticky-col-unsched {
  position: sticky;
  left: 220px;
  z-index: 4;
  width: 148px;
  min-width: 148px;
  max-width: 148px;
  background: #fafafa;
  box-shadow: 4px 0 12px -4px rgba(15, 23, 42, 0.08);
}
.bytime-grid-table thead .sticky-col-unsched {
  z-index: 20;
  background: #f9fafb;
  box-shadow: 4px 0 12px -4px rgba(15, 23, 42, 0.08);
}
.th-unsched {
  padding: 2px 3px;
  vertical-align: middle;
  text-align: center;
}
.unsched-head-toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-height: 36px;
  padding: 4px 5px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: #111827;
  font: inherit;
  text-align: center;
  margin: 0 auto;
}
.unsched-head-count-row {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  line-height: 1;
}
.unsched-head-toggle:hover {
  background: rgba(79, 70, 229, 0.08);
}
.unsched-head-label {
  font-size: 12px;
  font-weight: 800;
  line-height: 1.15;
  text-align: center;
}
.unsched-head-count {
  font-size: 17px;
  font-weight: 800;
  color: #4f46e5;
  line-height: 1;
  text-align: center;
}
.unsched-chevron {
  font-size: 11px;
  line-height: 1;
  color: #6b7280;
}
.bytime-grid-table:not(.unsched-col-collapsed) .unsched-head-label {
  font-size: 13px;
}
.bytime-grid-table.unsched-col-collapsed .sticky-col-unsched {
  width: 80px;
  min-width: 80px;
  max-width: 80px;
}
.bytime-grid-table.unsched-col-collapsed .unsched-head-toggle {
  gap: 1px;
  padding: 3px 2px;
  min-height: 40px;
}
.bytime-grid-table.unsched-col-collapsed .unsched-head-label {
  font-size: 11px;
  white-space: nowrap;
}
.bytime-grid-table.unsched-col-collapsed .unsched-head-count-row {
  gap: 2px;
}
.bytime-grid-table.unsched-col-collapsed .unsched-head-count {
  font-size: 13px;
}
.bytime-grid-table.unsched-col-collapsed .unsched-chevron {
  font-size: 9px;
}
.td-unsched-collapsed {
  text-align: center;
  vertical-align: middle;
  padding: 6px 4px;
}
.unsched-cell-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  font: inherit;
}
.unsched-cell-toggle:hover {
  border-color: #c7d2fe;
  background: #eef2ff;
}
.unsched-cell-count {
  font-size: 15px;
  font-weight: 800;
  color: #4f46e5;
}
.bytime-project-cell {
  font-weight: 400;
  text-align: center;
  padding: 12px 10px;
  background: #fff;
}
.bytime-body-row:hover .sticky-col-project,
.bytime-body-row:hover .bytime-project-cell {
  background: #fafafa;
}
/* 未排欄勿再設固定欄寬，寬度完全交給 colgroup／.sticky-col-unsched，避免與表頭 148px 錯位 */
.bytime-cell-stack {
  padding: 8px 6px;
  background: #fff;
}
.bytime-body-row:hover .bytime-cell-stack {
  background: #fafafa;
}
.bytime-body-row .sticky-col-unsched.bytime-cell-stack {
  background: #f9fafb;
}
.bytime-body-row:hover .sticky-col-unsched.bytime-cell-stack {
  background: #f3f4f6;
}
/* 僅月欄 td 需要 position:relative（給載入遮罩）；專案／未排 th,td 必須維持 sticky，勿覆寫成 relative */
.bytime-body-row > td.bytime-cell-stack:not(.sticky-col-unsched) {
  position: relative;
}
.bytime-cell-loading-mask {
  position: absolute;
  inset: 0;
  background: rgba(249, 250, 251, 0.8);
  z-index: 5;
  pointer-events: none;
}
.bytime-cell-loading-mask--show-label {
  display: flex;
  align-items: center;
  justify-content: center;
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

.bytime-section-card {
  margin-bottom: 8px;
  cursor: pointer;
  outline: none;
}
.bytime-section-card:last-child {
  margin-bottom: 0;
}
.bytime-section-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.08);
}
.bytime-section-card:focus-visible {
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.35);
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
}
.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.section-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}
.section-due-line {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  margin-top: 2px;
  line-height: 1.35;
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

.timeline-loading-text {
  font-size: 13px;
  color: #374151;
  background: rgba(255, 255, 255, 0.95);
  padding: 6px 14px;
  border-radius: 999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
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
  .sticky-col-project {
    width: 140px;
    min-width: 140px;
    max-width: 140px;
    font-size: 12px;
  }
  .sticky-col-unsched {
    left: 140px;
    width: 112px;
    min-width: 112px;
    max-width: 112px;
  }
  .bytime-col-project {
    width: 140px;
    min-width: 140px;
  }
  .bytime-col-unsched {
    width: 112px;
    min-width: 112px;
  }
  .bytime-col-month {
    width: 132px;
    min-width: 132px;
  }
  .bytime-grid-table.unsched-col-collapsed .bytime-col-unsched {
    width: 64px;
    min-width: 64px;
    max-width: 64px;
  }
  .bytime-grid-table.unsched-col-collapsed .sticky-col-unsched {
    min-width: 64px;
    width: 64px;
    max-width: 64px;
  }
}
</style>
