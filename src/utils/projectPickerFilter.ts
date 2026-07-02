import type { AsanaProject } from "@/types/asana";
import type { ProjectNameSortOrder } from "@/utils/projectDisplaySort";

export type RecentYearsPreset = "all" | "0.5" | "1" | "3" | "5";
export type CreatedAtSortOrder = "desc" | "asc";

export type ProjectPickerFilterOptions = {
  nameQuery: string;
  recentPreset: RecentYearsPreset;
  year: number | null;
  dateStart: string;
  dateEnd: string;
  createdSort: CreatedAtSortOrder;
  nameSort: ProjectNameSortOrder;
};

export function formatProjectCreatedAt(createdAt: string | null | undefined): string {
  if (!createdAt) return "—";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function parseCreatedLocalDay(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return startOfLocalDay(d);
}

function recentCutoffDate(preset: RecentYearsPreset): Date | null {
  if (preset === "all") return null;
  const today = startOfLocalDay(new Date());
  if (preset === "0.5") {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 6);
    return d;
  }
  const years = Number(preset);
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

export function isCreatedAtFilterActive(options: ProjectPickerFilterOptions): boolean {
  return (
    options.recentPreset !== "all" ||
    options.year != null ||
    options.dateStart.trim() !== "" ||
    options.dateEnd.trim() !== ""
  );
}

export function filterByName(projects: AsanaProject[], query: string): AsanaProject[] {
  const q = query.trim().toLowerCase();
  if (!q) return projects;
  return projects.filter((p) => p.name.toLowerCase().includes(q));
}

export function filterByCreatedAt(
  projects: AsanaProject[],
  options: Pick<
    ProjectPickerFilterOptions,
    "recentPreset" | "year" | "dateStart" | "dateEnd"
  >
): AsanaProject[] {
  if (!isCreatedAtFilterActive(options)) return projects;

  const cutoff = recentCutoffDate(options.recentPreset);
  const startBound = options.dateStart.trim()
    ? parseCreatedLocalDay(options.dateStart.trim())
    : null;
  const endBound = options.dateEnd.trim()
    ? parseCreatedLocalDay(options.dateEnd.trim())
    : null;

  return projects.filter((p) => {
    const day = p.created_at ? parseCreatedLocalDay(p.created_at) : null;
    if (!day) return false;

    if (cutoff && day < cutoff) return false;

    if (options.year != null && day.getFullYear() !== options.year) return false;

    if (startBound && day < startBound) return false;
    if (endBound && day > endBound) return false;

    return true;
  });
}

function createdMsForSort(p: AsanaProject): number {
  if (!p.created_at) return Number.NEGATIVE_INFINITY;
  const t = new Date(p.created_at).getTime();
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

export function sortProjects(
  projects: AsanaProject[],
  createdSort: CreatedAtSortOrder,
  nameSort: ProjectNameSortOrder
): AsanaProject[] {
  const sorted = [...projects];
  sorted.sort((a, b) => {
    const ca = createdMsForSort(a);
    const cb = createdMsForSort(b);
    if (ca !== cb) {
      return createdSort === "desc" ? cb - ca : ca - cb;
    }
    const nameCmp = a.name.localeCompare(b.name, "zh-Hant", { sensitivity: "base" });
    if (nameSort === "asc") return nameCmp;
    if (nameSort === "desc") return -nameCmp;
    return nameCmp;
  });
  return sorted;
}

export function filterAndSortProjects(
  projects: AsanaProject[],
  options: ProjectPickerFilterOptions
): AsanaProject[] {
  let out = filterByName(projects, options.nameQuery);
  out = filterByCreatedAt(out, options);
  return sortProjects(out, options.createdSort, options.nameSort);
}

export function collectProjectYears(projects: AsanaProject[]): number[] {
  const years = new Set<number>();
  for (const p of projects) {
    if (!p.created_at) continue;
    const d = new Date(p.created_at);
    const y = d.getFullYear();
    if (Number.isFinite(y)) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function defaultProjectPickerFilterOptions(): ProjectPickerFilterOptions {
  return {
    nameQuery: "",
    recentPreset: "all",
    year: null,
    dateStart: "",
    dateEnd: "",
    createdSort: "desc",
    nameSort: "default",
  };
}
