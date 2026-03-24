import axios from "axios";
import { useAuthStore } from "@/stores/auth";
import type {
  AsanaProject,
  AsanaSection,
  AsanaTask,
  SectionStats,
  ProjectStats,
} from "@/types/asana";

// 經由後端 OAuth proxy 呼叫 Asana API
// Vite dev server 會將 /api/* 轉發到 Node 後端
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// 請求時帶上本地儲存的個人權杖（加密還原後）
api.interceptors.request.use(async (config) => {
  const auth = useAuthStore();
  const token = await auth.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 時清除權杖，觸發顯示登入頁
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) useAuthStore().clearToken();
    return Promise.reject(err);
  }
);

// ─── 基礎 API 請求 ────────────────────────────────────────────────────────────

/** 取得目前使用者可存取的 workspace 列表 */
async function fetchWorkspaces(): Promise<{ gid: string }[]> {
  const res = await api.get("/workspaces");
  return (res.data.data ?? []).map((w: { gid: string }) => ({ gid: w.gid }));
}

/** 依 workspace 分頁取得「全部」專案（Asana 要求分頁時必須指定 workspace） */
export async function fetchProjects(): Promise<AsanaProject[]> {
  const workspaces = await fetchWorkspaces();
  const byGid = new Map<string, AsanaProject>();

  for (const ws of workspaces) {
    let offset: string | undefined = undefined;
    do {
      const params: Record<string, string> = {
        workspace: ws.gid,
        opt_fields: "gid,name,color,archived,created_at",
        limit: "100",
      };
      if (offset) params["offset"] = offset;

      const res = await api.get("/projects", { params });
      const page = (res.data.data ?? []).map((p: any) => ({
        gid: p.gid,
        name: p.name,
        color: p.color ?? null,
        archived: !!p.archived,
        created_at: p.created_at ?? null,
      }));
      for (const p of page) {
        byGid.set(p.gid, p);
      }
      offset = res.data.next_page?.offset;
    } while (offset);
  }

  // 僅保留未封存專案
  const all = Array.from(byGid.values()).filter((p) => !p.archived);
  /** 建立時間新→舊；無建立時間的排在最後，同時間再依名稱 */
  function projectCreatedMs(p: AsanaProject): number {
    if (!p.created_at) return 0;
    const t = new Date(p.created_at).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  all.sort((a, b) => {
    const diff = projectCreatedMs(b) - projectCreatedMs(a);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, "zh-TW");
  });
  return all;
}

export async function fetchProject(projectGid: string): Promise<AsanaProject> {
  const res = await api.get(`/projects/${projectGid}`, {
    params: { opt_fields: "gid,name,color,archived,created_at" },
  });
  const p = res.data.data;
  return {
    gid: p.gid,
    name: p.name,
    color: p.color ?? null,
    archived: !!p.archived,
    created_at: p.created_at ?? null,
  };
}

export async function fetchSectionsByProject(
  projectGid: string
): Promise<AsanaSection[]> {
  const res = await api.get(`/projects/${projectGid}/sections`, {
    params: { opt_fields: "gid,name" },
  });
  return res.data.data.map((s: AsanaSection) => ({
    gid: s.gid,
    name: s.name,
  }));
}

/** 環境變數中的欄位名稱（可逗號分隔多個）；空字串則僅用預設候選名稱 */
const BILLING_FIELD_NAME_ENV =
  typeof import.meta !== "undefined"
    ? String((import.meta as any).env?.VITE_BILLING_FIELD_NAME ?? "").trim()
    : "";

/** 選用：自訂欄位 gid，逗號分隔；有設定時優先於名稱比對 */
const BILLING_FIELD_GID_ENV =
  typeof import.meta !== "undefined"
    ? String((import.meta as any).env?.VITE_BILLING_FIELD_GID ?? "").trim()
    : "";

const DEFAULT_BILLING_FIELD_NAMES = ["請款金額", "請款額"];

function billingNamesToMatch(): string[] {
  const fromEnv = BILLING_FIELD_NAME_ENV.split(/[，,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...fromEnv, ...DEFAULT_BILLING_FIELD_NAMES])];
}

const BILLING_FIELD_GIDS = BILLING_FIELD_GID_ENV.split(/[，,]/)
  .map((s) => s.trim())
  .filter(Boolean);

function normalizeCfName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function parseNumberFromBillingText(s: string | null | undefined): number | null {
  if (s == null || typeof s !== "string") return null;
  const cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pickBillingCustomField(customFields: unknown): Record<string, unknown> | null {
  if (!Array.isArray(customFields)) return null;

  if (BILLING_FIELD_GIDS.length > 0) {
    const byGid = customFields.find(
      (cf: any) =>
        cf &&
        typeof cf.gid === "string" &&
        BILLING_FIELD_GIDS.includes(cf.gid)
    ) as Record<string, unknown> | undefined;
    if (byGid) return byGid;
  }

  const names = billingNamesToMatch();
  for (const want of names) {
    const w = normalizeCfName(want).toLowerCase();
    const found = customFields.find(
      (cf: any) =>
        cf &&
        typeof cf.name === "string" &&
        normalizeCfName(cf.name).toLowerCase() === w
    ) as Record<string, unknown> | undefined;
    if (found) return found;
  }

  return null;
}

function billingAmountFromCustomField(cf: Record<string, unknown> | null): number | null {
  if (!cf) return null;
  const num = cf.number_value;
  if (typeof num === "number" && Number.isFinite(num)) return num;

  const fromText = parseNumberFromBillingText(cf.text_value as string | undefined);
  if (fromText != null) return fromText;

  const fromDisplay = parseNumberFromBillingText(
    cf.display_value as string | undefined
  );
  if (fromDisplay != null) return fromDisplay;

  return null;
}

export async function fetchTasksBySection(
  sectionGid: string
): Promise<AsanaTask[]> {
  const allTasks: AsanaTask[] = [];
  let offset: string | undefined = undefined;

  do {
    const params: Record<string, string> = {
      opt_fields:
        "gid,name,completed,completed_at,created_at,modified_at,due_on,assignee.name,resource_subtype,permalink_url,custom_fields.gid,custom_fields.name,custom_fields.type,custom_fields.number_value,custom_fields.text_value,custom_fields.display_value",
      limit: "100",
    };
    if (offset) params["offset"] = offset;

    const res = await api.get(`/sections/${sectionGid}/tasks`, { params });

    const tasks = res.data.data.map((t: any) => {
      const billingField = pickBillingCustomField(t.custom_fields);
      const billingAmountRaw = billingAmountFromCustomField(billingField);

      const task: AsanaTask = {
        gid: t.gid,
        name: t.name,
        completed: t.completed,
        completed_at: t.completed_at ?? null,
        // Asana 會提供 created_at，若取不到則以 null 表示
        created_at: (t as any).created_at ?? null,
        modified_at: (t as any).modified_at ?? null,
        due_on: t.due_on ?? null,
        assignee: t.assignee ?? null,
        resource_subtype: (t as any).resource_subtype ?? null,
        permalink_url: t.permalink_url,
        billingAmount: billingAmountRaw,
      };

      return task;
    });

    allTasks.push(...tasks);
    offset = res.data.next_page?.offset;
  } while (offset);

  return allTasks;
}

/** 使用 workspace 搜尋 API，找出指定 weekStart 之後有更新的任務 */
export async function searchTasksUpdatedSince(
  weekStart: Date,
  weekEnd?: Date
): Promise<
  {
    task: AsanaTask;
    project: AsanaProject | null;
    section: AsanaSection | null;
  }[]
> {
  const workspaces = await fetchWorkspaces();
  const results: {
    task: AsanaTask;
    project: AsanaProject | null;
    section: AsanaSection | null;
  }[] = [];

  const seen = new Set<string>();
  const since = weekStart.toISOString();
  const before = (weekEnd ?? new Date()).toISOString();

  for (const ws of workspaces) {
    let offset: string | undefined = undefined;
    do {
      const params: Record<string, string> = {
        "modified_at.after": since,
        "modified_at.before": before,
        sort_by: "modified_at",
        limit: "100",
        opt_fields:
          "gid,name,completed,completed_at,created_at,modified_at,due_on,assignee.name,created_by.name,permalink_url,projects.name,projects.gid,memberships.section.name,memberships.section.gid",
      };
      if (offset) params["offset"] = offset;

      const res = await api.get(
        `/workspaces/${ws.gid}/tasks/search`,
        { params }
      );

      const data = res.data.data ?? [];
      for (const t of data as any[]) {
        const task: AsanaTask = {
          gid: t.gid,
          name: t.name,
          completed: t.completed,
          completed_at: t.completed_at ?? null,
          created_at: t.created_at ?? null,
          modified_at: t.modified_at ?? null,
          due_on: t.due_on ?? null,
          assignee: t.assignee ?? null,
          creatorName: (t.created_by && t.created_by.name) ? t.created_by.name : null,
          permalink_url: t.permalink_url,
        };

        const projectSrc = (t.projects && t.projects[0]) || null;
        const project: AsanaProject | null = projectSrc
          ? {
              gid: projectSrc.gid,
              name: projectSrc.name,
              color: projectSrc.color ?? null,
            }
          : null;

        const membership = (t.memberships && t.memberships[0]) || null;
        const sectionSrc = membership?.section || null;
        const section: AsanaSection | null = sectionSrc
          ? {
              gid: sectionSrc.gid,
              name: sectionSrc.name,
            }
          : null;

        if (!task.modified_at && !task.completed_at && !task.created_at) {
          continue;
        }

        const updatedTime =
          task.modified_at ?? task.completed_at ?? task.created_at!;
        if (new Date(updatedTime) < weekStart) continue;

        const key = `${ws.gid}:${task.gid}`;
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({ task, project, section });
      }

      offset = res.data.next_page?.offset;
    } while (offset);
  }

  return results;
}

/** 取某個任務在本週內最後一筆 story 的建立者名稱，作為「更新人」 */
export async function fetchTaskLastUpdaterName(
  taskGid: string,
  weekStart: Date
): Promise<string | null> {
  let offset: string | undefined = undefined;
  let latestName: string | null = null;
  let latestDate: Date | null = null;

  do {
    const params: Record<string, string> = {
      limit: "50",
      opt_fields: "created_by.name,created_at",
    };
    if (offset) params["offset"] = offset;

    const res = await api.get(`/tasks/${taskGid}/stories`, { params });
    const stories = res.data.data ?? [];

    for (const s of stories as any[]) {
      if (!s.created_at || !s.created_by) continue;
      const d = new Date(s.created_at);
      if (d < weekStart) continue;
      if (!latestDate || d > latestDate) {
        latestDate = d;
        latestName = s.created_by.name;
      }
    }

    offset = res.data.next_page?.offset;
  } while (offset);

  if (latestName) {
    return latestName;
  }

  // 若本週內沒有更新紀錄，退而求其次，用最早一筆 story 的建立人當作「創建人」
  offset = undefined;
  let creatorName: string | null = null;
  let creatorDate: Date | null = null;

  do {
    const params: Record<string, string> = {
      limit: "50",
      opt_fields: "created_by.name,created_at",
    };
    if (offset) params["offset"] = offset;

    const res = await api.get(`/tasks/${taskGid}/stories`, { params });
    const stories = res.data.data ?? [];

    for (const s of stories as any[]) {
      if (!s.created_at || !s.created_by) continue;
      const d = new Date(s.created_at);
      if (!creatorDate || d < creatorDate) {
        creatorDate = d;
        creatorName = s.created_by.name;
      }
    }

    offset = res.data.next_page?.offset;
  } while (offset);

  return creatorName;
}

// ─── 組合統計資料 ─────────────────────────────────────────────────────────────

function calcWorkingDays(start: Date, end: Date): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  if (endDate < startDate) return 0;

  let days = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const day = current.getDay(); // 0: Sun, 6: Sat
    if (day !== 0 && day !== 6) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function calcSectionStats(
  section: AsanaSection,
  tasks: AsanaTask[]
): SectionStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completed = tasks.filter((t) => t.completed).length;
  const overdue = tasks.filter((t) => {
    if (t.completed) return false;
    if (!t.due_on) return false;
    return new Date(t.due_on) < today;
  }).length;

  let totalWorkingDays = 0;
  let incompleteWorkingDays = 0;

  for (const task of tasks) {
    if (!task.created_at) continue;

    const start = new Date(task.created_at);
    const end =
      task.completed && task.completed_at
        ? new Date(task.completed_at)
        : today;

    const workDays = calcWorkingDays(start, end);
    totalWorkingDays += workDays;

    if (!task.completed) {
      incompleteWorkingDays += workDays;
    }
  }

  const completionRate = tasks.length === 0 ? 0 : completed / tasks.length;
  const completionRateByDays =
    totalWorkingDays === 0
      ? 0
      : (totalWorkingDays - incompleteWorkingDays) / totalWorkingDays;

  return {
    section,
    tasks,
    total: tasks.length,
    completed,
    incomplete: tasks.length - completed,
    overdue,
    completionRate,
    completionRateByDays,
    totalWorkingDays,
    incompleteWorkingDays,
  };
}

export async function fetchProjectStats(
  projectGid: string
): Promise<ProjectStats> {
  const [project, sections] = await Promise.all([
    fetchProject(projectGid),
    fetchSectionsByProject(projectGid),
  ]);

  const sectionStatsArray = await Promise.all(
    sections.map(async (section) => {
      const tasks = await fetchTasksBySection(section.gid);
      return calcSectionStats(section, tasks);
    })
  );

  const totalTasks = sectionStatsArray.reduce((s, x) => s + x.total, 0);
  const totalCompleted = sectionStatsArray.reduce((s, x) => s + x.completed, 0);
  const totalOverdue = sectionStatsArray.reduce((s, x) => s + x.overdue, 0);
  const totalWorkingDays = sectionStatsArray.reduce(
    (s, x) => s + x.totalWorkingDays,
    0
  );
  const incompleteWorkingDays = sectionStatsArray.reduce(
    (s, x) => s + x.incompleteWorkingDays,
    0
  );

  const overallCompletionRate =
    totalTasks === 0 ? 0 : totalCompleted / totalTasks;
  const overallCompletionRateByDays =
    totalWorkingDays === 0
      ? 0
      : (totalWorkingDays - incompleteWorkingDays) / totalWorkingDays;

  return {
    project,
    sections: sectionStatsArray,
    totalTasks,
    totalCompleted,
    totalOverdue,
    overallCompletionRate,
    overallCompletionRateByDays,
    totalWorkingDays,
    incompleteWorkingDays,
  };
}
