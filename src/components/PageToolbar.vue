<script setup lang="ts">
import {
  ref,
  watch,
  onMounted,
  onUnmounted,
  nextTick,
} from "vue";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

const STORAGE_KEY = "pageToolbarHidden";

const props = withDefaults(
  defineProps<{
    loading?: boolean;
    dateLabel: string;
    projectsOptionsLoading?: boolean;
  }>(),
  {
    loading: false,
    projectsOptionsLoading: false,
  }
);

const hidden = defineModel<boolean>("hidden", { default: false });

const emit = defineEmits<{
  resync: [];
  reload: [];
  openProjectPicker: [];
  hide: [];
}>();

const trackRef = ref<HTMLElement | null>(null);
const userPrefersVisible = ref(false);

let overflowDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let resizeObserver: ResizeObserver | null = null;

async function checkOverflow() {
  if (hidden.value || !trackRef.value || userPrefersVisible.value) return;

  await nextTick();
  const track = trackRef.value;
  if (track.scrollWidth <= track.clientWidth) return;

  hidden.value = true;
  emit("hide");
}

function scheduleOverflowCheck() {
  if (hidden.value) return;
  if (overflowDebounceTimer) clearTimeout(overflowDebounceTimer);
  overflowDebounceTimer = setTimeout(() => {
    overflowDebounceTimer = null;
    void checkOverflow();
  }, 100);
}

function hideToolbar() {
  hidden.value = true;
  emit("hide");
}

function showToolbar() {
  userPrefersVisible.value = true;
  hidden.value = false;
}

onMounted(() => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "true") {
    hidden.value = true;
  } else if (raw === "false") {
    hidden.value = false;
    userPrefersVisible.value = true;
  }

  if (trackRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleOverflowCheck());
    resizeObserver.observe(trackRef.value);
  }

  scheduleOverflowCheck();
});

onUnmounted(() => {
  if (overflowDebounceTimer) clearTimeout(overflowDebounceTimer);
  if (resizeObserver) resizeObserver.disconnect();
});

watch(hidden, (value) => {
  localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  if (value) {
    userPrefersVisible.value = false;
    emit("hide");
  } else {
    scheduleOverflowCheck();
  }
});

watch(
  () => props.loading,
  () => scheduleOverflowCheck()
);
</script>

<template>
  <div
    class="page-toolbar-root"
    :class="{ 'page-toolbar-root--hidden': hidden }"
  >
    <header v-show="!hidden" class="page-header">
      <div
        ref="trackRef"
        class="page-toolbar-track"
        :class="{ 'page-toolbar-track--scrollable': userPrefersVisible }"
      >
        <div class="page-toolbar-filters-inline">
          <slot name="filters-inline" />
        </div>

        <div class="page-toolbar-role-filter">
          <slot name="role-filter" />
        </div>

        <div class="page-toolbar-search">
          <slot name="search" />
        </div>

        <div class="page-toolbar-legend">
          <slot name="legend" />
        </div>

        <div class="date-label">日期：{{ dateLabel }}</div>

        <button
          type="button"
          class="reload-btn"
          :disabled="loading"
          @click="emit('reload')"
        >
          {{ loading ? "載入中…" : "重新載入" }}
        </button>

        <button
          type="button"
          class="resync-btn"
          :disabled="loading"
          :title="auth.dataSource === 'notion' ? '略過伺服器快取，向 Notion 重新拉取最新資料' : '略過伺服器快取，向 Asana 重新拉取最新資料'"
          @click="emit('resync')"
        >
          {{ loading ? "載入中…" : "重新同步數據" }}
        </button>

        <button
          type="button"
          class="secondary-btn"
          :disabled="projectsOptionsLoading || loading"
          @click="emit('openProjectPicker')"
        >
          選擇專案
        </button>

        <button
          type="button"
          class="hide-btn"
          aria-label="隱藏工具列"
          @click="hideToolbar"
        >
          隱藏
        </button>
      </div>
    </header>

    <button
      v-if="hidden"
      type="button"
      class="page-toolbar-tab"
      aria-label="顯示工具列"
      @click="showToolbar"
    >
      顯示工具列
      <span class="page-toolbar-tab-caret" aria-hidden="true">▼</span>
    </button>
  </div>
</template>

<style scoped>
.page-toolbar-root {
  position: relative;
  flex-shrink: 0;
}

.page-toolbar-root--hidden {
  height: 0;
  overflow: visible;
  position: relative;
  z-index: 30;
}

.page-header {
  box-sizing: border-box;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.page-toolbar-track {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  gap: 10px;
  flex-wrap: nowrap;
  min-width: 0;
}

.page-toolbar-track--scrollable {
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable;
}

.page-toolbar-track--scrollable::-webkit-scrollbar {
  height: 8px;
}

.page-toolbar-track--scrollable::-webkit-scrollbar-thumb {
  background: rgba(17, 24, 39, 0.18);
  border-radius: 999px;
}

.page-toolbar-track--scrollable::-webkit-scrollbar-track {
  background: transparent;
}

.page-toolbar-filters-inline,
.page-toolbar-role-filter {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  min-width: 0;
}

.page-toolbar-search {
  flex: 1 1 auto;
  min-width: 120px;
  max-width: min(920px, 100%);
}

.page-toolbar-search :deep(.project-search-input) {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  color: #111827;
  background: #fff;
  box-sizing: border-box;
}

.page-toolbar-search :deep(.project-search-input::placeholder) {
  color: #9ca3af;
}

.page-toolbar-search :deep(.project-search-input:focus) {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.page-toolbar-search :deep(.project-search-input:disabled) {
  opacity: 0.65;
  cursor: not-allowed;
  background: #f3f4f6;
}

.page-toolbar-filters-inline :deep(.project-sort-btn),
.page-toolbar-search :deep(.project-sort-btn) {
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 6px;
}

.page-toolbar-filters-inline :deep(.project-sort-glyph--default),
.page-toolbar-search :deep(.project-sort-glyph--default) {
  font-size: 13px;
}

.page-toolbar-filters-inline :deep(.project-sort-glyph--asc),
.page-toolbar-filters-inline :deep(.project-sort-glyph--desc),
.page-toolbar-search :deep(.project-sort-glyph--asc),
.page-toolbar-search :deep(.project-sort-glyph--desc) {
  font-size: 10px;
}

.page-toolbar-legend {
  flex: 0 0 auto;
}

.date-label {
  font-size: 12px;
  color: #4b5563;
  white-space: nowrap;
  flex-shrink: 0;
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
  flex-shrink: 0;
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
  flex-shrink: 0;
}

.resync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.resync-btn:not(:disabled):hover {
  background: #f0fdfa;
  border-color: #0f766e;
}

.secondary-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: none;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.secondary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hide-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.hide-btn:hover {
  background: #f3f4f6;
  color: #374151;
  border-color: #e5e7eb;
}

.page-toolbar-tab {
  position: absolute;
  top: 0;
  right: 20px;
  z-index: 31;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-top: none;
  border-radius: 0 0 8px 8px;
  background: #fff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
}

.page-toolbar-tab:hover {
  background: #eef2ff;
  border-color: #c7d2fe;
}

.page-toolbar-tab-caret {
  font-size: 10px;
  color: #6b7280;
}

@media (max-width: 1199px) {
  .page-header {
    padding: 10px 16px;
  }

  .page-toolbar-tab {
    right: 16px;
  }
}
</style>
