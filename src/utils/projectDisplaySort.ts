import type { ProjectProgress } from "@/composables/useProjectProgress";

export type ProjectNameSortOrder = "default" | "asc" | "desc";

export function applyProjectNameSort(
  items: ProjectProgress[],
  order: ProjectNameSortOrder
): ProjectProgress[] {
  if (order === "default") return items;
  const sorted = [...items];
  sorted.sort((a, b) => {
    const cmp = a.project.name.localeCompare(b.project.name, "zh-Hant", {
      sensitivity: "base",
    });
    return order === "asc" ? cmp : -cmp;
  });
  return sorted;
}
