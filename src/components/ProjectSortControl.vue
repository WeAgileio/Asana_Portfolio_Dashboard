<script setup lang="ts">
import { computed } from "vue";
import type { ProjectNameSortOrder } from "@/utils/projectDisplaySort";

const sortOrder = defineModel<ProjectNameSortOrder>({ default: "default" });

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    /** 是否顯示右側灰色說明文字（表頭橫列排版通常關閉） */
    showHint?: boolean;
  }>(),
  { showHint: false }
);

const hintText = computed(() => {
  switch (sortOrder.value) {
    case "desc":
      return "排序依據專案名稱大到小";
    case "asc":
      return "排序依據專案名稱小到大";
    default:
      return "排序依據 Asana 回傳順序";
  }
});

const ariaLabel = computed(
  () => `專案排序，目前：${hintText.value}。點擊切換排序方式`
);

function cycle() {
  if (props.disabled) return;
  const order: ProjectNameSortOrder[] = ["default", "asc", "desc"];
  const i = order.indexOf(sortOrder.value);
  sortOrder.value = order[(i + 1) % order.length]!;
}
</script>

<template>
  <div class="project-sort-wrap">
    <button
      type="button"
      class="project-sort-btn"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :title="hintText"
      @click="cycle"
    >
      <span class="project-sort-btn-label">專案排序</span>
      <span
        class="project-sort-glyph"
        :class="{
          'project-sort-glyph--default': sortOrder === 'default',
          'project-sort-glyph--asc': sortOrder === 'asc',
          'project-sort-glyph--desc': sortOrder === 'desc',
        }"
        aria-hidden="true"
      >
        <template v-if="sortOrder === 'default'">A</template>
        <template v-else-if="sortOrder === 'asc'">▲</template>
        <template v-else>▼</template>
      </span>
    </button>
    <span v-if="showHint" class="project-sort-hint">{{ hintText }}</span>
  </div>
</template>

<style scoped>
.project-sort-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-wrap: wrap;
}

.project-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  color: #111827;
  background: #fff;
  cursor: pointer;
  flex-shrink: 0;
}

.project-sort-btn:hover:not(:disabled) {
  border-color: #9ca3af;
  background: #fafafa;
}

.project-sort-btn:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.project-sort-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  background: #f3f4f6;
}

.project-sort-btn-label {
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.project-sort-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25em;
  font-size: 13px;
  line-height: 1;
  color: #111827;
}

.project-sort-glyph--default {
  font-weight: 800;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 15px;
}

.project-sort-glyph--asc,
.project-sort-glyph--desc {
  font-size: 11px;
  color: #374151;
}

.project-sort-hint {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
  flex: 1;
  min-width: 140px;
}
</style>
