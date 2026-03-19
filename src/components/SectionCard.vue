<script setup lang="ts">
import { ref, computed } from "vue";
import type { SectionStats } from "@/types/asana";
import CircleProgress from "./CircleProgress.vue";
import LinearProgress from "./LinearProgress.vue";

const props = defineProps<{ stats: SectionStats }>();

const expanded = ref(false);

const cardColor = computed(() => {
  const r = props.stats.completionRate;
  if (r >= 0.8) return "#10b981";
  if (r >= 0.5) return "#f59e0b";
  if (r > 0) return "#ef4444";
  return "#9ca3af";
});

const sortedTasks = computed(() => {
  return [...props.stats.tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
});

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("zh-TW", {
    month: "short",
    day: "numeric",
  });
}

function isOverdue(dueOn: string | null, completed: boolean): boolean {
  if (completed || !dueOn) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueOn) < today;
}
</script>

<template>
  <div class="section-card">
    <!-- 頂部色條 -->
    <div class="card-accent" :style="{ background: cardColor }" />

    <div class="card-body">
      <!-- Header -->
      <div class="card-header">
        <div class="section-name">{{ stats.section.name }}</div>
        <div class="header-progress">
          <CircleProgress
            :rate="stats.completionRate"
            :size="56"
            :stroke-width="5"
            :color="cardColor"
            label="任務"
          />
          <CircleProgress
            :rate="stats.completionRateByDays"
            :size="56"
            :stroke-width="5"
            color="#0ea5e9"
            label="天數"
          />
        </div>
      </div>

      <!-- 統計數字 -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">總任務</span>
        </div>
        <div class="stat-item done">
          <span class="stat-value">{{ stats.completed }}</span>
          <span class="stat-label">已完成</span>
        </div>
        <div class="stat-item pending">
          <span class="stat-value">{{ stats.incomplete }}</span>
          <span class="stat-label">待完成</span>
        </div>
        <div class="stat-item overdue" v-if="stats.overdue > 0">
          <span class="stat-value">{{ stats.overdue }}</span>
          <span class="stat-label">已逾期</span>
        </div>
      </div>

      <div class="stats-row secondary">
        <div class="stat-item working">
          <span class="stat-value">{{ stats.totalWorkingDays }}</span>
          <span class="stat-label">總工作天</span>
        </div>
        <div class="stat-item working-pending">
          <span class="stat-value">{{ stats.incompleteWorkingDays }}</span>
          <span class="stat-label">未完成工作天</span>
        </div>
      </div>

      <!-- 進度條：任務數 vs 天數 -->
      <div class="progress-rows">
        <div class="progress-row">
          <span class="progress-label">任務</span>
          <div class="progress-bar-wrap">
            <LinearProgress :rate="stats.completionRate" :color="cardColor" :show-label="false" />
          </div>
          <span class="progress-pct">{{ (stats.completionRate * 100).toFixed(0) }}%</span>
        </div>
        <div class="progress-row">
          <span class="progress-label">天數</span>
          <div class="progress-bar-wrap">
            <LinearProgress :rate="stats.completionRateByDays" color="#0ea5e9" :show-label="false" />
          </div>
          <span class="progress-pct">{{ (stats.completionRateByDays * 100).toFixed(0) }}%</span>
        </div>
      </div>

      <!-- 展開任務列表 -->
      <button
        class="toggle-btn"
        @click="expanded = !expanded"
        v-if="stats.tasks.length > 0"
      >
        {{ expanded ? "收合" : "展開任務列表" }}
        <svg
          class="arrow"
          :class="{ rotated: expanded }"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <Transition name="slide">
        <ul v-if="expanded" class="task-list">
          <li
            v-for="task in sortedTasks"
            :key="task.gid"
            :class="['task-item', { completed: task.completed }]"
          >
            <span class="task-check">
              <svg
                v-if="task.completed"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10b981"
                stroke-width="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span v-else class="uncheck-circle" />
            </span>

            <a
              :href="task.permalink_url"
              target="_blank"
              rel="noopener"
              class="task-name"
            >
              {{ task.name }}
            </a>

            <div class="task-meta">
              <span
                v-if="task.due_on"
                :class="['due', { overdue: isOverdue(task.due_on, task.completed) }]"
              >
                {{ formatDate(task.due_on) }}
              </span>
              <span v-if="task.assignee" class="assignee">
                {{ task.assignee.name }}
              </span>
            </div>
          </li>
        </ul>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.section-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s;
}
.section-card:hover {
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.1);
}
.card-accent {
  height: 4px;
  flex-shrink: 0;
}
.card-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.section-name {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
  flex: 1;
}
.stats-row {
  display: flex;
  gap: 12px;
}
.stats-row.secondary {
  margin-top: 6px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  background: #f9fafb;
  border-radius: 8px;
  padding: 8px 4px;
}
.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  line-height: 1;
}
.stat-label {
  font-size: 10px;
  color: #9ca3af;
  margin-top: 4px;
}
.stat-item.done .stat-value { color: #10b981; }
.stat-item.pending .stat-value { color: #f59e0b; }
.stat-item.overdue .stat-value { color: #ef4444; }
.stat-item.working .stat-value { color: #3b82f6; }
.stat-item.working-pending .stat-value { color: #f97316; }

.progress-rows { display: flex; flex-direction: column; gap: 8px; }
.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
}
.progress-label {
  font-size: 11px;
  color: #6b7280;
  width: 24px;
  flex-shrink: 0;
}
.progress-bar-wrap { flex: 1; min-width: 0; }
.progress-row .progress-pct {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  width: 28px;
  text-align: right;
  flex-shrink: 0;
}
.header-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  font-size: 12px;
  padding: 4px 0;
  font-family: inherit;
  transition: color 0.2s;
}
.toggle-btn:hover { color: #111827; }
.arrow {
  transition: transform 0.25s ease;
}
.arrow.rotated { transform: rotate(180deg); }

.task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
}
.task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 6px;
  transition: background 0.15s;
}
.task-item:hover { background: #f9fafb; }
.task-check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.uncheck-circle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid #d1d5db;
  display: block;
}
.task-name {
  flex: 1;
  font-size: 13px;
  color: #374151;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-name:hover { color: #4f46e5; text-decoration: underline; }
.task-item.completed .task-name {
  text-decoration: line-through;
  color: #9ca3af;
}
.task-meta {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  align-items: center;
}
.due {
  font-size: 11px;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 999px;
}
.due.overdue {
  color: #ef4444;
  background: #fef2f2;
}
.assignee {
  font-size: 11px;
  color: #6b7280;
  background: #eff6ff;
  padding: 2px 6px;
  border-radius: 999px;
  color: #3b82f6;
}

/* 動畫 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}
.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 400px;
}
</style>
