import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ProjectStats } from "@/types/asana";
import { fetchProjectStats, fetchProjects } from "@/api/asana";
import type { AsanaProject } from "@/types/asana";

export const useDashboardStore = defineStore("dashboard", () => {
  const projects = ref<AsanaProject[]>([]);
  const selectedProjectGid = ref<string>(
    import.meta.env.VITE_DEFAULT_PROJECT_GID ?? ""
  );
  const projectStats = ref<ProjectStats | null>(null);
  const loading = ref(false);
  const loadingProjects = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  const hasData = computed(() => projectStats.value !== null);

  async function loadProjects() {
    loadingProjects.value = true;
    try {
      projects.value = await fetchProjects();
      // 若尚未選擇專案，預設選第一個
      if (!selectedProjectGid.value && projects.value.length > 0) {
        selectedProjectGid.value = projects.value[0].gid;
      }
      // 若目前選的 GID 不在列表裡（例如手動輸入的），保留不變
    } catch (e: unknown) {
      console.error("載入專案列表失敗", e);
    } finally {
      loadingProjects.value = false;
    }
  }

  async function loadStats(projectGid?: string) {
    const gid = projectGid ?? selectedProjectGid.value;
    if (!gid) {
      error.value = "請先設定 Asana 專案 GID";
      return;
    }

    loading.value = true;
    error.value = null;
    selectedProjectGid.value = gid;

    try {
      projectStats.value = await fetchProjectStats(gid);
      lastUpdated.value = new Date();
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.message.includes("401")) {
          error.value =
            "尚未登入 Asana 或授權已過期，請點右上角「登入 Asana」或使用個人權杖登入。";
        } else if (e.message.includes("403")) {
          error.value = "無權限存取此專案，請確認 token 的存取範圍。";
        } else if (e.message.includes("404")) {
          error.value = "找不到此專案，請確認專案 GID 是否正確。";
        } else {
          error.value = `載入失敗：${e.message}`;
        }
      } else {
        error.value = "載入失敗，請稍後重試。";
      }
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    projectStats.value = null;
    error.value = null;
    lastUpdated.value = null;
  }

  return {
    projects,
    selectedProjectGid,
    projectStats,
    loading,
    loadingProjects,
    error,
    lastUpdated,
    hasData,
    loadProjects,
    loadStats,
    reset,
  };
});
