import { ref, computed, watch, nextTick, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import {
  fetchProjects,
  fetchSectionsByProject,
  fetchTasksBySection,
} from "@/api/asana";
import type { AsanaProject, AsanaSection, AsanaTask } from "@/types/asana";

export type SectionProgress = {
  section: AsanaSection;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  status: "not-started" | "in-progress" | "done" | "behind" | "at-risk";
  latestMilestoneDueOn: string | null;
  billingTotal: number;
  billingCollectedTotal: number;
  tasks: AsanaTask[];
};

export type ProjectProgress = {
  project: AsanaProject;
  sections: SectionProgress[];
  loadingTasks?: boolean;
};

export type ProjectYearBillingLine = {
  key: string;
  label: string;
  collected: number;
  total: number;
  isCurrentYear: boolean;
};

export type UseProjectProgressOptions = {
  /** 某專案任務載入完成並寫入 items 後呼叫（已做 loadId / nextTick） */
  onProjectTasksLoaded?: (projectGid: string) => void;
};

const INITIAL_LOAD_LIMIT = 5;
const LS_KEY_PREFIX = "asana_progress_selected_project_gids_v1";

function isDueWithinOneWeek(dueDateStr: string): boolean {
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const oneWeekLater = new Date(today);
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  return due <= oneWeekLater;
}

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

  const billingTotal = tasks.reduce(
    (sum, t) => sum + (typeof t.billingAmount === "number" ? t.billingAmount : 0),
    0
  );

  const billingCollectedTotal = tasks.reduce(
    (sum, t) =>
      sum +
      (t.completed && typeof t.billingAmount === "number" ? t.billingAmount : 0),
    0
  );

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

  let status: SectionProgress["status"];
  if (totalTasks === 0) {
    status = "not-started";
  } else if (completedTasks === totalTasks) {
    status = "done";
  } else {
    status = "in-progress";
  }
  if (
    completedTasks === 0 &&
    latestMilestoneDueOn &&
    !isDueWithinTwoWeeks(latestMilestoneDueOn) &&
    !isDueWithinOneWeek(latestMilestoneDueOn)
  ) {
    status = "not-started";
  }

  if (!latestMilestoneDueOn && completedTasks === 0) {
    status = "not-started";
  }

  if (
    status === "in-progress" &&
    latestMilestoneDueOn &&
    isDueWithinOneWeek(latestMilestoneDueOn)
  ) {
    status = "behind";
  }

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

// ─── 多個進度分頁共用同一筆資料，避免重複打 API ───
const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<ProjectProgress[]>([]);
const loadIdRef = ref(0);

const displayItems = computed(() =>
  items.value.filter(
    (i): i is ProjectProgress => i != null && i.project != null
  )
);

const projectsOptions = ref<AsanaProject[]>([]);
const projectsOptionsLoading = ref(false);
const isFirstLoad = ref(true);
const selectedProjectGids = ref<string[]>([]);

const selectedSection = ref<{
  project: AsanaProject;
  section: AsanaSection;
  tasks: AsanaTask[];
} | null>(null);

const projectTasksLoadedListeners = new Set<(gid: string) => void>();

let progressCoreWatchersReady = false;
let didBootstrapProgressLoad = false;

function getSelectedProjectsStorageKey(): string {
  const auth = useAuthStore();
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

function ensureProgressCoreWatchers() {
  if (progressCoreWatchersReady) return;
  progressCoreWatchersReady = true;
  const auth = useAuthStore();

  watch(selectedProjectGids, () => {
    persistSelectedToLocalStorage();
  });

  watch(
    () => auth.getTokenHash(),
    (hash) => {
      selectedProjectGids.value = loadSelectedFromLocalStorage();
      if (hash == null) {
        didBootstrapProgressLoad = false;
        items.value = [];
      }
    }
  );
}

async function refreshProjectsOptions() {
  projectsOptionsLoading.value = true;
  try {
    const fetchedProjects = await fetchProjects();
    projectsOptions.value = fetchedProjects;
    if (selectedProjectGids.value.length > 0) {
      selectedProjectGids.value = selectedProjectGids.value.filter((gid) =>
        fetchedProjects.some((p) => p.gid === gid)
      );
    }
  } finally {
    projectsOptionsLoading.value = false;
  }
}

function todayLabel(): string {
  return new Date().toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

function projectBillingFilledCoins(p: ProjectProgress): number {
  const rate = projectBillingCollectedRate(p);
  if (!projectBillingTotal(p)) return 0;
  return Math.max(0, Math.min(10, Math.round(rate / 10)));
}

function projectBillingYearLines(p: ProjectProgress): ProjectYearBillingLine[] {
  const currentYear = new Date().getFullYear();
  const byYear = new Map<number, { collected: number; total: number }>();
  let noDue = { collected: 0, total: 0 };

  for (const s of p.sections) {
    for (const t of s.tasks) {
      const amountTotal =
        typeof t.billingAmount === "number" ? t.billingAmount : 0;
      const amountCollected =
        t.completed && typeof t.billingAmount === "number"
          ? t.billingAmount
          : 0;

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
    .sort((a, b) => a[0] - b[0])
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

function selectSection(project: AsanaProject, sp: SectionProgress) {
  selectedSection.value = {
    project,
    section: sp.section,
    tasks: sp.tasks,
  };
}

async function loadProgress() {
  loading.value = true;
  error.value = null;
  loadIdRef.value += 1;
  const thisLoadId = loadIdRef.value;

  try {
    await refreshProjectsOptions();

    let projectsToLoad =
      selectedProjectGids.value.length > 0
        ? projectsOptions.value.filter((p) =>
            selectedProjectGids.value.includes(p.gid)
          )
        : projectsOptions.value;

    if (isFirstLoad.value) {
      projectsToLoad = projectsToLoad.slice(0, INITIAL_LOAD_LIMIT);
      isFirstLoad.value = false;
    }

    const projectSectionList = await Promise.all(
      projectsToLoad.map(async (project) => {
        const sections = await fetchSectionsByProject(project.gid);
        return { project, sections };
      })
    );

    const existingByProjectGid = new Map(
      items.value.map((item) => [item.project.gid, item] as const)
    );
    items.value = projectSectionList.map(({ project, sections }) => {
      const existingItem = existingByProjectGid.get(project.gid);
      const existingSectionByGid = new Map(
        (existingItem?.sections ?? []).map((sp) => [sp.section.gid, sp] as const)
      );
      const mergedSections: SectionProgress[] = sections.map(
        (section) =>
          existingSectionByGid.get(section.gid) ??
          calcSectionProgress(section, [])
      );
      return {
        project,
        sections: mergedSections,
        loadingTasks: true,
      };
    });

    projectSectionList.forEach(({ project, sections }) => {
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
          if (thisLoadId !== loadIdRef.value) return;
          const idx = items.value.findIndex((x) => x.project.gid === project.gid);
          if (idx < 0) return;
          items.value[idx] = {
            project,
            sections: sectionProgressList,
            loadingTasks: false,
          };
          nextTick(() => {
            if (thisLoadId !== loadIdRef.value) return;
            projectTasksLoadedListeners.forEach((fn) => {
              try {
                fn(project.gid);
              } catch (e) {
                console.error(e);
              }
            });
          });
        } catch (e) {
          console.error("載入專案 section 任務失敗", e);
          if (thisLoadId !== loadIdRef.value) return;
          const idx = items.value.findIndex((x) => x.project.gid === project.gid);
          if (idx >= 0) {
            items.value[idx] = {
              ...items.value[idx]!,
              loadingTasks: false,
            };
          }
        }
      })();
    });

    if (projectsToLoad.length === 0) {
      items.value = [];
      error.value = "目前選擇的專案沒有可載入的資料（可能已被封存或權限不足）。";
    }
  } catch (e) {
    console.error("載入專案進度失敗", e);
    error.value = "載入專案進度失敗，請稍後重試。";
  } finally {
    loading.value = false;
  }
}

function bootstrapFromStorage() {
  selectedProjectGids.value = loadSelectedFromLocalStorage();
  if (didBootstrapProgressLoad) return;
  didBootstrapProgressLoad = true;
  void loadProgress();
}

function syncSelectionFromStorage() {
  selectedProjectGids.value = loadSelectedFromLocalStorage();
}

export function useProjectProgress(options?: UseProjectProgressOptions) {
  ensureProgressCoreWatchers();

  if (options?.onProjectTasksLoaded) {
    const fn = options.onProjectTasksLoaded;
    projectTasksLoadedListeners.add(fn);
    onUnmounted(() => {
      projectTasksLoadedListeners.delete(fn);
    });
  }

  const projectPickerOpen = ref(false);
  watch(projectPickerOpen, (open) => {
    if (open) {
      void refreshProjectsOptions().catch((e) => {
        console.error("開啟選擇專案時更新清單失敗", e);
      });
    }
  });

  return {
    loading,
    error,
    items,
    loadIdRef,
    displayItems,
    projectsOptions,
    projectsOptionsLoading,
    isFirstLoad,
    selectedProjectGids,
    projectPickerOpen,
    selectedSection,
    refreshProjectsOptions,
    loadProgress,
    todayLabel,
    projectBillingTotal,
    projectBillingCollectedTotal,
    projectBillingCollectedRate,
    projectBillingFilledCoins,
    projectBillingYearLines,
    selectSection,
    bootstrapFromStorage,
    syncSelectionFromStorage,
  };
}
