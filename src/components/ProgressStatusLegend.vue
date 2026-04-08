<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";

/** 視窗寬度 ≤1250px 時隱藏內聯圖例，改為按鈕＋彈窗 */
const NARROW_MQ = "(max-width: 1250px)";

const isNarrow = ref(false);
const showModal = ref(false);
let mq: MediaQueryList | null = null;

function applyMq() {
  if (!mq) return;
  isNarrow.value = mq.matches;
  if (!mq.matches) showModal.value = false;
}

onMounted(() => {
  mq = window.matchMedia(NARROW_MQ);
  applyMq();
  mq.addEventListener("change", applyMq);
});

onUnmounted(() => {
  mq?.removeEventListener("change", applyMq);
});

watch(isNarrow, (n) => {
  if (!n) showModal.value = false;
});
</script>

<template>
  <div class="progress-legend-root">
    <div
      v-show="!isNarrow"
      class="legend-header"
      aria-label="狀態圖例"
    >
      <div class="legend-row">
        <span class="legend-item">
          <span class="legend-dot legend-not-started" /> 尚未開始
        </span>
        <span class="legend-item">
          <span class="legend-dot legend-progress" /> 進行中
        </span>
        <span class="legend-item">
          <span class="legend-dot legend-done" /> 已完成
        </span>
      </div>
      <div class="legend-row">
        <span class="legend-item">
          <span class="legend-dot legend-behind" /> 延後（一週內截止未完成）
        </span>
        <span class="legend-item">
          <span class="legend-dot legend-at-risk" /> 風險（兩週內截止且逾 1/4 未完成）
        </span>
      </div>
    </div>

    <button
      v-if="isNarrow"
      type="button"
      class="legend-toggle-btn"
      aria-haspopup="dialog"
      :aria-expanded="showModal"
      @click="showModal = true"
    >
      狀態圖例
    </button>

    <Teleport to="body">
      <div
        v-if="showModal && isNarrow"
        class="legend-overlay"
        @click.self="showModal = false"
      >
        <div
          class="legend-panel"
          role="dialog"
          aria-modal="true"
          aria-label="狀態圖例"
        >
          <div class="legend-panel-head">
            <span class="legend-panel-title">狀態圖例</span>
            <button
              type="button"
              class="legend-panel-close"
              aria-label="關閉"
              @click="showModal = false"
            >
              關閉
            </button>
          </div>
          <div class="legend-panel-body">
            <div class="legend-header legend-header--modal" aria-label="狀態圖例">
              <div class="legend-row">
                <span class="legend-item">
                  <span class="legend-dot legend-not-started" /> 尚未開始
                </span>
                <span class="legend-item">
                  <span class="legend-dot legend-progress" /> 進行中
                </span>
                <span class="legend-item">
                  <span class="legend-dot legend-done" /> 已完成
                </span>
              </div>
              <div class="legend-row">
                <span class="legend-item">
                  <span class="legend-dot legend-behind" /> 延後（一週內截止未完成）
                </span>
                <span class="legend-item">
                  <span class="legend-dot legend-at-risk" /> 風險（兩週內截止且逾 1/4 未完成）
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.progress-legend-root {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
}
.legend-header {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  line-height: 1.35;
  color: #4b5563;
}
.legend-header--modal {
  font-size: 13px;
}
.legend-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.legend-dot {
  width: 11px;
  height: 11px;
  border-radius: 999px;
  display: inline-block;
  flex-shrink: 0;
}
.legend-not-started {
  background: #d1d5db;
}
.legend-progress {
  background: #60a5fa;
}
.legend-done {
  background: #22c55e;
}
.legend-behind {
  background: #ef4444;
}
.legend-at-risk {
  background: #eab308;
}
.legend-toggle-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
}
.legend-toggle-btn:hover {
  border-color: #a5b4fc;
  background: #f5f5ff;
  color: #4f46e5;
}
.legend-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 16px;
}
.legend-panel {
  width: min(420px, 100%);
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);
  max-height: min(80vh, 480px);
  overflow: auto;
}
.legend-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid #f3f4f6;
}
.legend-panel-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}
.legend-panel-close {
  border: none;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
}
.legend-panel-close:hover {
  background: #e0e7ff;
}
.legend-panel-body {
  padding: 14px 16px 16px;
}
</style>
