<script setup lang="ts">
import { computed } from "vue";
import type { SectionStats } from "@/types/asana";
import LinearProgress from "./LinearProgress.vue";

const props = defineProps<{ sections: SectionStats[] }>();

const sorted = computed(() =>
  [...props.sections]
    .filter((s) => s.total > 0)
    .sort((a, b) => b.completionRate - a.completionRate)
);
</script>

<template>
  <div class="ranking-card">
    <div class="card-title">Section 完成度排名</div>
    <div v-if="sorted.length === 0" class="empty">尚無資料</div>
    <ul v-else class="ranking-list">
      <li
        v-for="(s, i) in sorted"
        :key="s.section.gid"
        class="ranking-item"
      >
        <span class="rank" :class="{ top: i < 3 }">{{ i + 1 }}</span>
        <div class="item-main">
          <div class="name">{{ s.section.name }}</div>
          <div class="bars">
            <div class="bar-row">
              <span class="bar-label">任務</span>
              <div class="bar">
                <LinearProgress :rate="s.completionRate" :height="5" :show-label="false" />
              </div>
              <span class="bar-pct">{{ (s.completionRate * 100).toFixed(0) }}%</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">天數</span>
              <div class="bar">
                <LinearProgress :rate="s.completionRateByDays" :height="5" color="#0ea5e9" :show-label="false" />
              </div>
              <span class="bar-pct">{{ (s.completionRateByDays * 100).toFixed(0) }}%</span>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ranking-card {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
}
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 16px;
}
.ranking-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ranking-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.rank {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: #f3f4f6;
  color: #6b7280;
  flex-shrink: 0;
  margin-top: 2px;
}
.rank.top {
  background: #fef3c7;
  color: #d97706;
}
.item-main { flex: 1; min-width: 0; }
.name {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 6px;
}
.bars { display: flex; flex-direction: column; gap: 4px; }
.bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bar-label {
  font-size: 10px;
  color: #9ca3af;
  width: 24px;
  flex-shrink: 0;
}
.bar { flex: 1; min-width: 0; }
.bar-pct {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  width: 26px;
  text-align: right;
  flex-shrink: 0;
}
.empty {
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
  padding: 16px 0;
}
</style>
