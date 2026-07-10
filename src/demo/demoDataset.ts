import {
  generateDemoDataset,
  type DemoDataset,
  type DemoProjectBundle,
} from "./demoDataGenerator";

let cached: DemoDataset | null = null;

export function getDemoDataset(): DemoDataset {
  if (!cached) {
    cached = generateDemoDataset(new Date());
  }
  return cached;
}

export function getDemoDefaultSelectedProjectGids(): string[] {
  return [...getDemoDataset().defaultSelectedProjectGids];
}

function findBundle(projectGid: string): DemoProjectBundle | undefined {
  return getDemoDataset().bundles.find((b) => b.project.gid === projectGid);
}

export function getDemoProjectsSorted(): DemoDataset["projects"] {
  const all = [...getDemoDataset().projects];
  all.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name, "zh-TW");
  });
  return all;
}

export function getDemoProject(projectGid: string) {
  const bundle = findBundle(projectGid);
  if (!bundle) throw new Error(`Demo project not found: ${projectGid}`);
  return bundle.project;
}

export function getDemoSections(projectGid: string) {
  const bundle = findBundle(projectGid);
  if (!bundle) return [];
  return bundle.sections.map((s) => s.section);
}

export function getDemoTasks(sectionGid: string) {
  for (const bundle of getDemoDataset().bundles) {
    for (const sec of bundle.sections) {
      if (sec.section.gid === sectionGid) {
        return sec.tasks;
      }
    }
  }
  return [];
}
