import type { AsanaProject, AsanaSection, AsanaTask } from "@/types/asana";
import {
  getDemoProject,
  getDemoProjectsSorted,
  getDemoSections,
  getDemoTasks,
} from "./demoDataset";

export async function getDemoProjects(): Promise<AsanaProject[]> {
  return getDemoProjectsSorted();
}

export async function getDemoProjectByGid(
  projectGid: string
): Promise<AsanaProject> {
  return getDemoProject(projectGid);
}

export async function getDemoSectionsByProject(
  projectGid: string
): Promise<AsanaSection[]> {
  return getDemoSections(projectGid);
}

export async function getDemoTasksBySection(
  sectionGid: string
): Promise<AsanaTask[]> {
  return getDemoTasks(sectionGid);
}
