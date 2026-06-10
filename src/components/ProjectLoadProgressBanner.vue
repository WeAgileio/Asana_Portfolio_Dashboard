<script setup lang="ts">
import { computed } from "vue";
import type { ProjectProgress } from "@/composables/useProjectProgress";

const props = withDefaults(
  defineProps<{
    loading: boolean;
    items: ProjectProgress[];
    hidden?: boolean;
  }>(),
  { hidden: false }
);

const loadProgressTotal = computed(() => props.items.length);

const loadProgressDone = computed(() =>
  props.items.filter((i) => !i.loadingTasks).length
);

const loadProgressActive = computed(
  () => props.loading || props.items.some((i) => i.loadingTasks)
);

const loadProgressIndeterminate = computed(
  () => props.loading && props.items.length === 0
);

const loadProgressPercent = computed(() => {
  const total = loadProgressTotal.value;
  if (total === 0) return 0;
  return Math.round((loadProgressDone.value / total) * 100);
});

const loadProgressPendingNames = computed(() =>
  props.items
    .filter((i) => i.loadingTasks)
    .map((i) => i.project.name)
    .slice(0, 2)
);

const showBanner = computed(() => loadProgressActive.value && !props.hidden);
</script>

<template>
  <div
    v-if="showBanner"
    class="load-progress-banner"
    role="status"
    aria-live="polite"
  >
    <div class="load-progress-banner-inner">
      <p class="load-progress-banner-text">
        <template v-if="loadProgressIndeterminate">正在準備專案清單…</template>
        <template v-else>
          已載入 {{ loadProgressDone }} / {{ loadProgressTotal }} 個專案
        </template>
      </p>
      <div
        v-if="loadProgressIndeterminate"
        class="load-progress-bar load-progress-bar--indeterminate"
        aria-hidden="true"
      >
        <div class="load-progress-bar-indeterminate-fill" />
      </div>
      <div
        v-else
        class="load-progress-bar"
        role="progressbar"
        :aria-valuenow="loadProgressDone"
        :aria-valuemax="loadProgressTotal"
        aria-label="專案載入進度"
      >
        <div
          class="load-progress-bar-fill"
          :style="{ width: loadProgressPercent + '%' }"
        />
      </div>
      <p
        v-if="!loadProgressIndeterminate && loadProgressPendingNames.length > 0"
        class="load-progress-banner-sub"
      >
        載入中：{{ loadProgressPendingNames.join("、") }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.load-progress-banner {
  box-sizing: border-box;
  padding: 10px 20px;
  background: #eef2ff;
  border-bottom: 1px solid #c7d2fe;
}
.load-progress-banner-inner {
  max-width: min(920px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.load-progress-banner-text {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #3730a3;
}
.load-progress-banner-sub {
  margin: 0;
  font-size: 12px;
  color: #4b5563;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.load-progress-bar {
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: #e0e7ff;
  overflow: hidden;
}
.load-progress-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: #4f46e5;
  transition: width 0.25s ease;
}
.load-progress-bar--indeterminate .load-progress-bar-indeterminate-fill {
  position: absolute;
  inset: 0;
  width: 40%;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #4f46e5, transparent);
  animation: load-progress-indeterminate 1.2s ease-in-out infinite;
}
@keyframes load-progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}
</style>
