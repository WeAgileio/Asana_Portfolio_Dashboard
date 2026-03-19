<script setup lang="ts">
import type { ProjectStats } from "@/types/asana";
import CircleProgress from "./CircleProgress.vue";

defineProps<{ stats: ProjectStats }>();

function formatTime(date: Date): string {
  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="overall-summary">
    <div class="summary-left">
      <div class="project-name">{{ stats.project.name }}</div>
      <div class="summary-stats">
        <div class="s-item">
          <span class="s-value">{{ stats.totalTasks }}</span>
          <span class="s-label">任務總數</span>
        </div>
        <div class="s-divider" />
        <div class="s-item done">
          <span class="s-value">{{ stats.totalCompleted }}</span>
          <span class="s-label">已完成</span>
        </div>
        <div class="s-divider" />
        <div class="s-item pending">
          <span class="s-value">{{ stats.totalTasks - stats.totalCompleted }}</span>
          <span class="s-label">待完成</span>
        </div>
        <div class="s-divider" />
        <div class="s-item overdue" v-if="stats.totalOverdue > 0">
          <span class="s-value">{{ stats.totalOverdue }}</span>
          <span class="s-label">已逾期</span>
        </div>
        <div class="s-item sections">
          <span class="s-value">{{ stats.sections.length }}</span>
          <span class="s-label">Sections</span>
        </div>
      </div>
    </div>

    <div class="summary-right">
      <CircleProgress
        :rate="stats.overallCompletionRate"
        :size="100"
        :stroke-width="8"
        color="#4f46e5"
        label="任務完成度"
      />
      <CircleProgress
        :rate="stats.overallCompletionRateByDays"
        :size="100"
        :stroke-width="8"
        color="#0ea5e9"
        label="天數完成度"
      />
    </div>
  </div>
</template>

<style scoped>
.overall-summary {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%);
  border-radius: 16px;
  padding: 24px 28px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  box-shadow: 0 8px 32px rgba(79, 70, 229, 0.3);
}
.project-name {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.3px;
  margin-bottom: 16px;
}
.summary-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.s-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.s-value {
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  color: #fff;
}
.s-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}
.s-item.done .s-value { color: #6ee7b7; }
.s-item.pending .s-value { color: #fde68a; }
.s-item.overdue .s-value { color: #fca5a5; }
.s-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.15);
}
.summary-right {
  display: flex;
  align-items: center;
  gap: 20px;
}
.summary-right :deep(.pct) { color: #fff; }
.summary-right :deep(.label) { color: rgba(255,255,255,0.6); }
</style>
