<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AsanaProject } from "@/types/asana";
import type { ProjectNameSortOrder } from "@/utils/projectDisplaySort";
import {
  collectProjectYears,
  defaultProjectPickerFilterOptions,
  filterAndSortProjects,
  formatProjectCreatedAt,
  type ProjectPickerFilterOptions,
} from "@/utils/projectPickerFilter";

const open = defineModel<boolean>("open", { default: false });
const selectedGids = defineModel<string[]>("selectedGids", { default: () => [] });

const props = withDefaults(
  defineProps<{
    projects: AsanaProject[];
    loading?: boolean;
    projectsLoading?: boolean;
  }>(),
  {
    loading: false,
    projectsLoading: false,
  }
);

const emit = defineEmits<{
  apply: [];
  "load-all": [];
}>();

const filters = ref<ProjectPickerFilterOptions>(defaultProjectPickerFilterOptions());

watch(open, (isOpen) => {
  if (!isOpen) {
    filters.value = defaultProjectPickerFilterOptions();
  }
});

const filteredProjects = computed(() =>
  filterAndSortProjects(props.projects, filters.value)
);

const visibleGidSet = computed(
  () => new Set(filteredProjects.value.map((p) => p.gid))
);

const hiddenSelectedCount = computed(() =>
  selectedGids.value.filter((gid) => !visibleGidSet.value.has(gid)).length
);

const allVisibleSelected = computed(() => {
  if (filteredProjects.value.length === 0) return true;
  const selected = new Set(selectedGids.value);
  return filteredProjects.value.every((p) => selected.has(p.gid));
});

const yearOptions = computed(() => collectProjectYears(props.projects));

const nameSortHint = computed(() => {
  switch (filters.value.nameSort) {
    case "asc":
      return "A→Z";
    case "desc":
      return "Z→A";
    default:
      return "預設";
  }
});

function cycleNameSort() {
  const order: ProjectNameSortOrder[] = ["default", "asc", "desc"];
  const i = order.indexOf(filters.value.nameSort);
  filters.value.nameSort = order[(i + 1) % order.length]!;
}

function selectAllVisible() {
  const merged = new Set([
    ...selectedGids.value,
    ...filteredProjects.value.map((p) => p.gid),
  ]);
  selectedGids.value = Array.from(merged);
}

function onLoadAll() {
  selectedGids.value = [];
  emit("load-all");
}

function onApply() {
  open.value = false;
  emit("apply");
}

function onOverlayClick() {
  open.value = false;
}
</script>

<template>
  <div v-if="open" class="picker-overlay" @click.self="onOverlayClick">
    <section class="picker-panel" role="dialog" aria-labelledby="picker-title">
      <header class="picker-header">
        <div id="picker-title" class="picker-title">選擇要載入的專案</div>
        <div class="picker-subtitle">
          選擇 1 個以上才會只載入部分；不選則載入全部
        </div>
        <div class="picker-selection-meta">
          已選 {{ selectedGids.length }} 個
          <span v-if="hiddenSelectedCount > 0" class="picker-hidden-selected">
            （{{ hiddenSelectedCount }} 個未顯示於目前篩選）
          </span>
        </div>
      </header>

      <div class="picker-body">
        <div v-if="projectsLoading" class="picker-state loading">
          正在載入專案清單…
        </div>

        <template v-else>
          <div class="picker-filters">
            <label class="picker-filter-field picker-filter-name">
              <span class="picker-filter-label">專案名稱</span>
              <input
                v-model="filters.nameQuery"
                type="search"
                class="picker-filter-input"
                placeholder="搜尋專案名稱…"
                autocomplete="off"
              />
            </label>

            <label class="picker-filter-field">
              <span class="picker-filter-label">創建時間</span>
              <select v-model="filters.recentPreset" class="picker-filter-select">
                <option value="all">全部</option>
                <option value="0.5">近半年</option>
                <option value="1">近 1 年</option>
                <option value="3">近 3 年</option>
                <option value="5">近 5 年</option>
              </select>
            </label>

            <label class="picker-filter-field">
              <span class="picker-filter-label">年份</span>
              <select
                :value="filters.year ?? ''"
                class="picker-filter-select"
                @change="
                  filters.year =
                    ($event.target as HTMLSelectElement).value === ''
                      ? null
                      : Number(($event.target as HTMLSelectElement).value)
                "
              >
                <option value="">不限</option>
                <option v-for="y in yearOptions" :key="y" :value="y">
                  {{ y }}
                </option>
              </select>
            </label>

            <label class="picker-filter-field picker-filter-date">
              <span class="picker-filter-label">起日</span>
              <input v-model="filters.dateStart" type="date" class="picker-filter-input" />
            </label>

            <label class="picker-filter-field picker-filter-date">
              <span class="picker-filter-label">迄日</span>
              <input v-model="filters.dateEnd" type="date" class="picker-filter-input" />
            </label>

            <label class="picker-filter-field">
              <span class="picker-filter-label">建立排序</span>
              <select v-model="filters.createdSort" class="picker-filter-select">
                <option value="desc">新→舊</option>
                <option value="asc">舊→新</option>
              </select>
            </label>

            <div class="picker-filter-field">
              <span class="picker-filter-label">名稱排序</span>
              <button
                type="button"
                class="picker-name-sort-btn"
                :title="`名稱排序：${nameSortHint}`"
                @click="cycleNameSort"
              >
                {{ nameSortHint }}
              </button>
            </div>
          </div>

          <div class="picker-count-row">
            <div class="picker-count">
              顯示 {{ filteredProjects.length }} / {{ projects.length }} 個專案
            </div>
            <button
              type="button"
              class="secondary-btn picker-select-all-btn"
              :disabled="filteredProjects.length === 0 || allVisibleSelected"
              @click="selectAllVisible"
            >
              全選
            </button>
          </div>

          <div class="picker-list-wrap">
            <div
              v-if="filteredProjects.length === 0"
              class="picker-state empty"
            >
              沒有符合條件的專案
            </div>
            <ul
              v-else
              class="picker-list"
              role="listbox"
              aria-label="專案清單"
            >
              <li
                v-for="p in filteredProjects"
                :key="p.gid"
                class="picker-list-item"
              >
                <label class="picker-row-label">
                  <input
                    v-model="selectedGids"
                    type="checkbox"
                    class="picker-checkbox"
                    :value="p.gid"
                  />
                  <span class="picker-row-name">{{ p.name }}</span>
                  <span class="picker-row-date">{{
                    formatProjectCreatedAt(p.created_at)
                  }}</span>
                </label>
              </li>
            </ul>
          </div>

          <div class="picker-actions">
            <button
              type="button"
              class="secondary-btn"
              :disabled="loading"
              @click="onLoadAll"
            >
              載入全部
            </button>
            <button
              type="button"
              class="apply-btn"
              :disabled="loading"
              @click="onApply"
            >
              {{ loading ? "載入中…" : "套用選擇" }}
            </button>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.25);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  z-index: 40;
}

.picker-panel {
  width: min(960px, calc(100vw - 48px));
  max-height: min(88vh, 820px);
  padding: 20px 22px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.picker-header {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.picker-title {
  font-size: 17px;
  font-weight: 700;
  color: #111827;
}

.picker-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.picker-selection-meta {
  font-size: 12px;
  color: #4b5563;
  margin-top: 8px;
}

.picker-hidden-selected {
  color: #6b7280;
}

.picker-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.picker-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 12px;
  flex-shrink: 0;
}

.picker-filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.picker-filter-name {
  flex: 1 1 180px;
}

.picker-filter-date {
  flex: 0 0 auto;
}

.picker-filter-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
}

.picker-filter-input,
.picker-filter-select {
  height: 34px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  color: #111827;
  background: #fff;
  min-width: 0;
}

.picker-filter-input:focus,
.picker-filter-select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.picker-name-sort-btn {
  height: 34px;
  min-width: 56px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  background: #fff;
  cursor: pointer;
}

.picker-name-sort-btn:hover {
  border-color: #9ca3af;
  background: #fafafa;
}

.picker-count-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.picker-count {
  font-size: 12px;
  color: #6b7280;
}

.picker-select-all-btn {
  flex-shrink: 0;
}

.picker-list-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.picker-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
  max-height: min(50vh, 420px);
  overflow-y: auto;
  flex: 1;
  min-height: 220px;
}

.picker-list-item {
  margin: 0;
}

.picker-row-label {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  margin: 4px;
  border-radius: 10px;
  cursor: pointer;
  background: #fff;
  border: 1px solid transparent;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.picker-row-label:hover {
  background: #f3f4f6;
  border-color: #e5e7eb;
}

.picker-checkbox {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: #4f46e5;
  cursor: pointer;
}

.picker-row-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  line-height: 1.35;
  word-break: break-word;
}

.picker-row-date {
  flex-shrink: 0;
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
  white-space: nowrap;
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

.apply-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  border: none;
  background: #4f46e5;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.apply-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.apply-btn:not(:disabled):hover {
  background: #4338ca;
}

.picker-state {
  padding: 24px 12px;
  text-align: center;
  font-size: 14px;
  color: #6b7280;
}

.picker-state.loading {
  color: #4b5563;
}

@media (max-width: 768px) {
  .picker-panel {
    width: calc(100vw - 24px);
    max-height: 90vh;
    padding: 16px;
  }

  .picker-list {
    max-height: 45vh;
    min-height: 180px;
  }

  .picker-row-label {
    padding: 14px;
    font-size: 16px;
  }

  .picker-checkbox {
    width: 22px;
    height: 22px;
  }
}
</style>
