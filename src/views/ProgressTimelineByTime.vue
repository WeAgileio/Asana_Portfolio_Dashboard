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
import { useBytimeScrollAfterReload } from "@/composables/useBytimeScrollAfterReload";
import { useBytimeMonthColWidth } from "@/composables/useBytimeMonthColWidth";
import ScrollToTopButton from "@/components/ScrollToTopButton.vue";
import ProjectLoadProgressBanner from "@/components/ProjectLoadProgressBanner.vue";
import PageToolbar from "@/components/PageToolbar.vue";
import ProjectPickerPanel from "@/components/ProjectPickerPanel.vue";
import ProgressStatusLegend from "@/components/ProgressStatusLegend.vue";
import ProjectSortControl from "@/components/ProjectSortControl.vue";
import {
  applyProjectNameSort,
  type ProjectNameSortOrder,
} from "@/utils/projectDisplaySort";
import { asanaProjectNotesUrl } from "@/utils/asanaUrls";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

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
  loadIdRef,
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
/** 點擊月欄表頭後，將該月欄內有 section 的專案列排到最上（再點同一欄取消） */
const prioritizeMonthKey = ref<string | null>(null);
/** 專案角色篩選：依 GET project(s) 回傳之 `members` 成員姓名 */
const selectedProjectRoleNames = ref<string[]>([]);
const rolePeoplePickerOpen = ref(false);
const rolePeopleTriggerEl = ref<HTMLElement | null>(null);
const rolePeoplePanelPos = ref<{ top: number; left: number; width: number }>({
  top: 0,
  left: 0,
  width: 360,
});

/** 專案成員（GET project(s) `members.name`），用於頂部角色篩選 */
function overviewRoleNamesForItem(item: ProjectProgress): Set<string> {
  return new Set(
    (item.project.memberNames ?? [])
      .map((n) => n.trim())
      .filter(Boolean)
  );
}

const projectRoleOptions = computed(() => {
  const roles = new Set<string>();
  for (const item of displayItems.value) {
    for (const r of overviewRoleNamesForItem(item)) roles.add(r);
  }
  return Array.from(roles).sort((a, b) => a.localeCompare(b, "zh-Hant"));
});

function clearProjectRoleFilter() {
  selectedProjectRoleNames.value = [];
}

function updateRolePeoplePanelPos() {
  const el = rolePeopleTriggerEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const gap = 8;
  const maxWidth = Math.min(360, window.innerWidth - 40);
  // 讓彈窗「往右展開」：左緣對齊按鈕左側（並做視窗邊界夾取）
  const left = Math.max(20, Math.min(rect.left, window.innerWidth - 20 - maxWidth));
  rolePeoplePanelPos.value = {
    top: rect.bottom + gap,
    left,
    width: maxWidth,
  };
}

watch(rolePeoplePickerOpen, (open) => {
  if (!open) return;
  nextTick(() => {
    updateRolePeoplePanelPos();
  });
});

function onWindowReposition() {
  if (!rolePeoplePickerOpen.value) return;
  updateRolePeoplePanelPos();
}

onMounted(() => {
  window.addEventListener("resize", onWindowReposition);
  window.addEventListener("scroll", onWindowReposition, { capture: true });
});

onUnmounted(() => {
  window.removeEventListener("resize", onWindowReposition);
  window.removeEventListener("scroll", onWindowReposition, { capture: true } as any);
});

const searchFilteredDisplayItems = computed(() => {
  const picked = selectedProjectRoleNames.value;
  const pickedSet = picked.length > 0 ? new Set(picked) : null;
  const q = projectSearchQuery.value.trim().toLowerCase();

  const base = displayItems.value.filter((item) => {
    if (!pickedSet) return true;
    for (const r of overviewRoleNamesForItem(item)) {
      if (pickedSet.has(r)) return true;
    }
    return false;
  });

  if (!q) return base;
  return base.filter((item) => item.project.name.toLowerCase().includes(q));
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

/** composable 初始化後賦值；handler 須在此之後才被呼叫 */
let markUserHorizontalScroll: () => void = () => {};

function onBytimeHeadScroll() {
  if (bytimeScrollSyncing.value) return;
  const h = bytimeHeadScrollEl.value;
  const b = bytimeBodyScrollEl.value;
  if (!h || !b) return;
  markUserHorizontalScroll();
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
  markUserHorizontalScroll();
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
    markUserHorizontalScroll();
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

function sectionDisplayTimeMs(sp: SectionProgress): number {
  if (!sp.sectionDisplayDueOn) return Number.POSITIVE_INFINITY;
  const t = new Date(sp.sectionDisplayDueOn).getTime();
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
  for (const item of searchFilteredDisplayItems.value) {
    for (const sp of item.sections) {
      if (!sp.sectionDisplayDueOn) continue;
      const ym = parseDueToYm(sp.sectionDisplayDueOn);
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
    const due = sp.sectionDisplayDueOn;
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
      const dueDiff = sectionDisplayTimeMs(a) - sectionDisplayTimeMs(b);
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
  for (const item of searchFilteredDisplayItems.value) {
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

/**
 * 點月欄後，該月有 section 的專案列：延後(紅) > 風險(黃) > 其餘；
 * 同層再依該月欄內「展示截止日」越早越上。
 */
function monthColumnSortKeyForItem(
  item: ProjectProgress,
  monthKey: string
): { has: boolean; tier: number; earliestDueMs: number } {
  const sections = sectionsInCell(item, monthKey);
  if (sections.length === 0) {
    return { has: false, tier: 99, earliestDueMs: 0 };
  }
  const hasBehind = sections.some((s) => s.status === "behind");
  const hasAtRisk = sections.some((s) => s.status === "at-risk");
  let tier: number;
  if (hasBehind) tier = 0;
  else if (hasAtRisk) tier = 1;
  else tier = 2;

  let earliestDueMs = Infinity;
  for (const s of sections) {
    if (!s.sectionDisplayDueOn) continue;
    const ms = new Date(s.sectionDisplayDueOn).getTime();
    if (Number.isFinite(ms) && ms < earliestDueMs) earliestDueMs = ms;
  }
  return { has: true, tier, earliestDueMs };
}

const filteredDisplayItems = computed(() => {
  const nameSorted = applyProjectNameSort(
    [...searchFilteredDisplayItems.value],
    projectNameSortOrder.value
  );
  const key = prioritizeMonthKey.value;
  if (!key) return nameSorted;

  const scored = nameSorted.map((item, idx) => {
    const meta = monthColumnSortKeyForItem(item, key);
    return {
      item,
      idx,
      has: meta.has,
      tier: meta.tier,
      earliestDueMs: meta.earliestDueMs,
    };
  });
  scored.sort((a, b) => {
    if (a.has !== b.has) return a.has ? -1 : 1;
    if (!a.has) return a.idx - b.idx;
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.earliestDueMs !== b.earliestDueMs) {
      return a.earliestDueMs - b.earliestDueMs;
    }
    return a.idx - b.idx;
  });
  return scored.map((x) => x.item);
});

/** 各月欄表頭：目前篩選下，該月欄內 section 總數（跨所有專列加總） */
const monthColumnSectionCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const col of monthColumns.value) {
    let n = 0;
    for (const item of searchFilteredDisplayItems.value) {
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

    for (const item of searchFilteredDisplayItems.value) {
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

/** 各月欄表頭：已請款金額／目標請款金額（跨所有可見專案加總） */
const monthColumnBillingAmounts = computed(() => {
  const amounts: Record<string, { collected: number; total: number }> = {};

  for (const col of monthColumns.value) {
    let collected = 0;
    let total = 0;
    for (const item of searchFilteredDisplayItems.value) {
      for (const sp of sectionsInCell(item, col.key)) {
        total += sp.billingTotal || 0;
        collected += sp.billingCollectedTotal || 0;
      }
    }
    amounts[col.key] = { collected, total };
  }

  return amounts;
});

const { monthColWidthPx, monthColWidthStyle } = useBytimeMonthColWidth();

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

function onMonthColumnHeaderClick(col: MonthColumn) {
  // 橫向拖曳捲動結束後 bytimeDragMoved 仍可能為 true（下次 mousedown 若發在月欄內有 .stop，捲動層不會重設）。
  // 點月欄是新操作，應清除，否則後續點「有資料的月份」會被誤擋。
  bytimeDragMoved.value = false;
  prioritizeMonthKey.value =
    prioritizeMonthKey.value === col.key ? null : col.key;
}

watch(monthColumns, (cols) => {
  const k = prioritizeMonthKey.value;
  if (!k) return;
  if (!cols.some((c) => c.key === k)) prioritizeMonthKey.value = null;
});

/** 卡片外顯示：section 展示截止日（與格內排序依據一致） */
function formatSectionDueOnDisplay(sp: SectionProgress): string {
  if (!sp.sectionDisplayDueOn) return "—";
  return new Date(sp.sectionDisplayDueOn).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const anyProjectLoadingTasks = computed(() =>
  filteredDisplayItems.value.some((i) => i.loadingTasks)
);

/** 目前展開未排內容的專案 gid；null 表示皆收合。僅該列顯示卡片，點他列會改為只展開該列。 */
const unschedExpandedProjectGid = ref<string | null>(null);

const unschedColumnExpanded = computed(
  () => unschedExpandedProjectGid.value !== null
);

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
  const monthW = monthColWidthPx.value;
  const colStart = leftGutter + idx * monthW;

  const viewport = h.clientWidth || b.clientWidth;
  const targetScroll = colStart + monthW / 2 - viewport / 2;
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

const {
  markUserHorizontalScroll: markUserHorizontalScrollImpl,
  beginBatchReload,
  setupScrollAfterReloadWatch,
} = useBytimeScrollAfterReload({
  headScrollEl: bytimeHeadScrollEl,
  bodyScrollEl: bytimeBodyScrollEl,
  scrollSyncing: bytimeScrollSyncing,
  scrollToCurrentMonth: scrollBytimeToCurrentMonthColumn,
  isLoadDone: () =>
    loadIdRef.value > 0 &&
    !loading.value &&
    !anyProjectLoadingTasks.value,
  monthColumnCount: () => monthColumns.value.length,
  isTableVisible: () =>
    items.value.length > 0 &&
    !(
      projectSearchQuery.value.trim() !== "" &&
      filteredDisplayItems.value.length === 0
    ),
  itemCount: () => items.value.length,
});
markUserHorizontalScroll = markUserHorizontalScrollImpl;

setupScrollAfterReloadWatch();

function beginReloadAndScrollToCurrentMonth() {
  beginBatchReload(() => loadProgress());
}

function beginResyncAndScrollToCurrentMonth() {
  beginBatchReload(() => loadProgress({ bypassProxyCache: true }));
}

const totalUnscheduledCount = computed(() => {
  let n = 0;
  for (const item of filteredDisplayItems.value) {
    n += sectionsInCell(item, UNSCHEDULED_KEY).length;
  }
  return n;
});

/** 未排欄內 section 中狀態為「已完成」者 */
const totalUnscheduledDoneCount = computed(() => {
  let n = 0;
  for (const item of filteredDisplayItems.value) {
    for (const sp of sectionsInCell(item, UNSCHEDULED_KEY)) {
      if (sp.status === "done") n += 1;
    }
  }
  return n;
});

function unschedCountFor(item: ProjectProgress): number {
  return sectionsInCell(item, UNSCHEDULED_KEY).length;
}

function unschedDoneCountFor(item: ProjectProgress): number {
  return sectionsInCell(item, UNSCHEDULED_KEY).filter((sp) => sp.status === "done")
    .length;
}

function expandUnschedColumn(projectGid: string) {
  if (unschedExpandedProjectGid.value === projectGid) {
    unschedExpandedProjectGid.value = null;
  } else {
    unschedExpandedProjectGid.value = projectGid;
  }
}

/** 表頭：收合目前展開的那一列未排 */
function toggleUnschedColumn() {
  unschedExpandedProjectGid.value = null;
}

watch(filteredDisplayItems, (items) => {
  const gid = unschedExpandedProjectGid.value;
  if (!gid) return;
  if (!items.some((i) => i.project.gid === gid)) {
    unschedExpandedProjectGid.value = null;
  }
});

onMounted(() => {
  beginBatchReload(() => bootstrapFromStorage());
});

onActivated(() => {
  void syncSelectionFromStorage();
});
</script>

<template>
  <div class="progress-page">
    <PageToolbar
      :loading="loading"
      :date-label="todayLabel()"
      :projects-options-loading="projectsOptionsLoading"
      @resync="beginResyncAndScrollToCurrentMonth"
      @reload="beginReloadAndScrollToCurrentMonth"
      @open-project-picker="projectPickerOpen = true"
      @hide="rolePeoplePickerOpen = false"
    >
      <template v-if="!error" #filters-inline>
        <ProjectSortControl v-model="projectNameSortOrder" :disabled="loading" />
      </template>
      <template v-if="!error" #role-filter>
        <div class="role-people-filter">
          <span class="role-people-filter-label">專案角色</span>
          <div class="role-people-filter-popover">
            <button
              type="button"
              class="role-people-filter-trigger"
              ref="rolePeopleTriggerEl"
              :disabled="loading || projectRoleOptions.length === 0"
              :aria-expanded="rolePeoplePickerOpen"
              :title="
                projectRoleOptions.length === 0
                  ? '目前沒有可篩選的專案角色'
                  : selectedProjectRoleNames.length > 0
                    ? '已選 ' + selectedProjectRoleNames.length + ' 個角色'
                    : '點擊選擇（可複選）'
              "
              @click="rolePeoplePickerOpen = !rolePeoplePickerOpen"
            >
              <span class="role-people-filter-trigger-text">
                {{
                  projectRoleOptions.length === 0
                    ? '無資料'
                    : selectedProjectRoleNames.length > 0
                      ? '已選 ' + selectedProjectRoleNames.length + ' 個角色'
                      : '選擇（可複選）'
                }}
              </span>
              <span class="role-people-filter-trigger-caret" aria-hidden="true">
                {{ rolePeoplePickerOpen ? "▲" : "▼" }}
              </span>
            </button>

            <Teleport to="body">
              <div
                v-if="rolePeoplePickerOpen"
                class="role-people-filter-panel"
                role="dialog"
                aria-label="專案角色篩選"
                :style="{
                  position: 'fixed',
                  top: rolePeoplePanelPos.top + 'px',
                  left: rolePeoplePanelPos.left + 'px',
                  width: rolePeoplePanelPos.width + 'px',
                }"
              >
                <div class="role-people-filter-panel-actions">
                  <button
                    type="button"
                    class="role-people-filter-clear"
                    :disabled="loading || selectedProjectRoleNames.length === 0"
                    @click="clearProjectRoleFilter"
                  >
                    清除
                  </button>
                  <button
                    type="button"
                    class="role-people-filter-close"
                    :disabled="loading"
                    @click="rolePeoplePickerOpen = false"
                  >
                    關閉
                  </button>
                </div>
                <ul class="role-people-filter-list" role="listbox" aria-label="角色清單">
                  <li
                    v-for="r in projectRoleOptions"
                    :key="r"
                    class="role-people-filter-item"
                  >
                    <label class="role-people-filter-item-label">
                      <input
                        v-model="selectedProjectRoleNames"
                        type="checkbox"
                        class="role-people-filter-item-checkbox"
                        :value="r"
                      />
                      <span class="role-people-filter-item-text">{{ r }}</span>
                    </label>
                  </li>
                </ul>
              </div>
            </Teleport>
          </div>
        </div>
        <button
          type="button"
          class="role-people-filter-clear"
          :disabled="loading || selectedProjectRoleNames.length === 0"
          @click="clearProjectRoleFilter"
        >
          清除角色篩選
        </button>
      </template>
      <template v-if="!error" #search>
        <input
          id="project-search-bytime-input"
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
        <ProgressStatusLegend />
      </template>
    </PageToolbar>

    <ProjectLoadProgressBanner
      :loading="loading"
      :items="items"
      :hidden="!!error"
    />

    <main class="page-main">
      <ProjectPickerPanel
        v-model:open="projectPickerOpen"
        v-model:selected-gids="selectedProjectGids"
        :projects="projectsOptions"
        :loading="loading"
        :projects-loading="projectsOptionsLoading"
        @apply="beginReloadAndScrollToCurrentMonth()"
      />

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
      <section
        v-else
        class="bytime-calendar-section"
        :style="monthColWidthStyle"
      >
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
                          ? '收合未排欄（關閉目前展開的專案列）'
                          : '點各專案列未排格可展開該專案（全體：已完成 ' +
                            totalUnscheduledDoneCount +
                            '，共 ' +
                            totalUnscheduledCount +
                            ' 個 section）'
                      "
                      @click="toggleUnschedColumn"
                    >
                      <span class="unsched-head-label">未排</span>
                      <span class="unsched-head-count-row">
                        <span
                          class="unsched-head-done"
                          :title="'已完成：' + totalUnscheduledDoneCount"
                        >{{ totalUnscheduledDoneCount }}</span>
                        <span class="unsched-head-count-slash" aria-hidden="true">/</span>
                        <span
                          class="unsched-head-count"
                          :title="'未排 section 總數：' + totalUnscheduledCount"
                        >{{ totalUnscheduledCount }}</span>
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
                    class="th-month th-month--sortable"
                    :class="{ 'th-month--prioritized': prioritizeMonthKey === col.key }"
                    role="button"
                    tabindex="0"
                    :title="
                      '點擊：該月有內容的專案列排到最上（延後→風險→其餘，再依截止日）；再點同一欄取消。' +
                      (monthColumnSectionCounts[col.key] ?? 0) +
                      ' 個 section'
                    "
                    @mousedown.stop
                    @click.stop="onMonthColumnHeaderClick(col)"
                    @keydown.enter.prevent="onMonthColumnHeaderClick(col)"
                    @keydown.space.prevent="onMonthColumnHeaderClick(col)"
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
                      <div class="th-month-billing-row" aria-label="已請款／目標請款金額">
                        <span class="th-month-billing-collected">
                          💰
                          {{
                            (
                              monthColumnBillingAmounts[col.key]?.collected ?? 0
                            ).toLocaleString("zh-TW")
                          }}
                        </span>
                        <span class="th-month-billing-slash" aria-hidden="true">/</span>
                        <span class="th-month-billing-total">
                          {{
                            (
                              monthColumnBillingAmounts[col.key]?.total ?? 0
                            ).toLocaleString("zh-TW")
                          }}
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
                      <a
                        class="project-name-link project-name-label"
                        :href="asanaProjectNotesUrl(item.project)"
                        target="_blank"
                        rel="noopener noreferrer"
                        :title="auth.dataSource === 'notion' ? '在 Notion 開啟專案' : '在 Asana 開啟專案狀態'"
                        :aria-label="(auth.dataSource === 'notion' ? '在 Notion 開啟專案：' : '在 Asana 開啟專案：') + item.project.name"
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
                            : auth.dataSource === 'notion'
                              ? '重新載入此專案（略過快取，向 Notion 取最新）'
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
                  :class="{
                    'td-unsched-collapsed':
                      unschedExpandedProjectGid !== item.project.gid,
                  }"
                >
                  <button
                    v-if="unschedExpandedProjectGid !== item.project.gid"
                    type="button"
                    class="unsched-cell-toggle"
                    :aria-label="
                      '展開此專案未排，已完成 ' +
                      unschedDoneCountFor(item) +
                      '，共 ' +
                      unschedCountFor(item) +
                      ' 個 section'
                    "
                    @click="expandUnschedColumn(item.project.gid)"
                  >
                    <span class="unsched-cell-counts">
                      <span
                        class="unsched-cell-done"
                        :title="'已完成：' + unschedDoneCountFor(item)"
                      >{{ unschedDoneCountFor(item) }}</span>
                      <span class="unsched-cell-count-slash" aria-hidden="true">/</span>
                      <span
                        class="unsched-cell-count"
                        :title="'未排 section 總數：' + unschedCountFor(item)"
                      >{{ unschedCountFor(item) }}</span>
                    </span>
                  </button>

                  <template v-if="unschedExpandedProjectGid === item.project.gid">
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
.role-people-filter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 0 0 auto;
}
.role-people-filter-popover {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 0;
}
.role-people-filter-trigger {
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #111827;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  max-width: min(320px, 30vw);
}
.role-people-filter-trigger-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-people-filter-trigger:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  background: #f3f4f6;
}
.role-people-filter-trigger:not(:disabled):hover {
  border-color: #c7d2fe;
  background: #eef2ff;
}
.role-people-filter-trigger-caret {
  font-size: 10px;
  color: #6b7280;
}
.role-people-filter-panel {
  /* 位置由 inline style (fixed) 控制，避免被 overflow 裁切 */
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.16);
  padding: 10px 10px 8px;
  z-index: 50;
}
.role-people-filter-panel-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.role-people-filter-close {
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.role-people-filter-close:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.role-people-filter-close:not(:disabled):hover {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
}
.role-people-filter-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: min(42vh, 340px);
  overflow: auto;
  border-top: 1px solid #f3f4f6;
  padding-top: 6px;
}
.role-people-filter-item {
  margin: 0;
}
.role-people-filter-item-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}
.role-people-filter-item-label:hover {
  background: #f3f4f6;
}
.role-people-filter-item-checkbox {
  width: 18px;
  height: 18px;
  accent-color: #4f46e5;
  cursor: pointer;
  flex-shrink: 0;
}
.role-people-filter-item-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.role-people-filter-label {
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  white-space: nowrap;
}
.role-people-filter-clear {
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  flex: 0 0 auto;
  min-width: 108px;
}
.role-people-filter-clear:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.role-people-filter-clear:not(:disabled):hover {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
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
  scrollbar-gutter: stable;
}
.bytime-thead-scroll.bytime-scroll--drag-disabled,
.bytime-table-scroll.bytime-scroll--drag-disabled {
  cursor: default;
}
.bytime-thead-scroll::-webkit-scrollbar {
  display: none;
  height: 0;
}
.bytime-table-scroll::-webkit-scrollbar {
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
  scrollbar-gutter: stable;
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
  max-width: 220px;
}
.bytime-col-unsched {
  width: 148px;
  min-width: 148px;
  max-width: 148px;
}
.bytime-col-month {
  width: var(--bytime-month-col-w, 208px);
  min-width: var(--bytime-month-col-w, 208px);
  max-width: var(--bytime-month-col-w, 208px);
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
  box-sizing: border-box;
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
  padding: 8px 6px;
  background: #f9fafb;
  width: var(--bytime-month-col-w, 208px);
  min-width: var(--bytime-month-col-w, 208px);
  max-width: var(--bytime-month-col-w, 208px);
  box-sizing: border-box;
  overflow: visible;
}
.th-month-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  line-height: 1.2;
}
.bytime-head-month .th-month.th-month--sortable {
  cursor: pointer;
  outline: none;
  border-radius: 6px;
}
.bytime-head-month .th-month.th-month--sortable:hover {
  background: rgba(79, 70, 229, 0.07);
}
.bytime-head-month .th-month.th-month--sortable:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(99, 102, 241, 0.45);
}
.bytime-head-month .th-month.th-month--prioritized {
  background: rgba(79, 70, 229, 0.12);
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
.th-month-billing-row {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  max-width: 100%;
  font-size: 11px;
  font-weight: 700;
  color: #374151;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow-x: hidden;
}
.th-month-billing-collected {
  color: #16a34a;
}
.th-month-billing-slash {
  color: #9ca3af;
  font-weight: 600;
}
.th-month-billing-total {
  color: #111827;
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
.unsched-head-count-slash {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  line-height: 1;
}
.unsched-head-done {
  font-size: 15px;
  font-weight: 800;
  color: #22c55e;
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
.bytime-grid-table.unsched-col-collapsed .unsched-head-count-slash {
  font-size: 10px;
}
.bytime-grid-table.unsched-col-collapsed .unsched-head-done {
  font-size: 12px;
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
  padding: 6px 6px;
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
.unsched-cell-counts {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 2px;
  line-height: 1;
}
.unsched-cell-count {
  font-size: 15px;
  font-weight: 800;
  color: #4f46e5;
}
.unsched-cell-count-slash {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
}
.unsched-cell-done {
  font-size: 13px;
  font-weight: 800;
  color: #22c55e;
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
  width: var(--bytime-month-col-w, 208px);
  min-width: var(--bytime-month-col-w, 208px);
  max-width: var(--bytime-month-col-w, 208px);
  overflow-x: hidden;
  overflow-wrap: break-word;
  word-break: break-word;
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
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
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
  align-self: stretch;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
.project-year-line {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 6px;
  line-height: 1.25;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.project-year-line-current {
  background: rgba(96, 165, 250, 0.18);
  border-radius: 8px;
  padding: 2px 4px;
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
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
  color: #6b7280;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.project-year-amount-current {
  color: #111827;
  font-size: 12px;
  font-weight: 700;
}
.project-year-amount-collected,
.project-year-amount-total {
  min-width: 0;
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
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 6px;
  align-self: stretch;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin-top: 2px;
  box-sizing: border-box;
}
.project-total-pill {
  color: #22c55e;
  font-weight: 700;
  font-size: 10px;
  text-align: center;
}
.project-total-amount {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
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
  min-width: 0;
}
.section-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
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
  min-width: 0;
  width: 100%;
}
.section-billing {
  margin-bottom: 2px;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  min-width: 0;
  max-width: 100%;
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
    max-width: 140px;
  }
  .bytime-col-unsched {
    width: 112px;
    min-width: 112px;
    max-width: 112px;
  }
  .bytime-col-month {
    width: var(--bytime-month-col-w, 208px);
    min-width: var(--bytime-month-col-w, 208px);
    max-width: var(--bytime-month-col-w, 208px);
  }
  .bytime-body-row > td.bytime-cell-stack:not(.sticky-col-unsched) {
    max-width: var(--bytime-month-col-w, 208px);
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
