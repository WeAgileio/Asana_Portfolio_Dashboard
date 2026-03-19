<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    rate: number;
    height?: number;
    color?: string;
    showLabel?: boolean;
  }>(),
  {
    height: 8,
    showLabel: true,
  }
);

const pct = computed(() => `${(props.rate * 100).toFixed(1)}%`);
const barWidth = computed(
  () => `${(Math.min(1, Math.max(0, props.rate)) * 100).toFixed(2)}%`
);

const barColor = computed(() => {
  if (props.color) return props.color;
  const r = props.rate;
  if (r >= 0.8) return "#10b981";
  if (r >= 0.5) return "#f59e0b";
  return "#ef4444";
});
</script>

<template>
  <div class="linear-progress">
    <div
      class="track"
      :style="{ height: height + 'px', borderRadius: height + 'px' }"
    >
      <div
        class="fill"
        :style="{
          width: barWidth,
          background: barColor,
          borderRadius: height + 'px',
        }"
      />
    </div>
    <span v-if="showLabel" class="label">{{ pct }}</span>
  </div>
</template>

<style scoped>
.linear-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
.track {
  flex: 1;
  background: #f3f4f6;
  overflow: hidden;
}
.fill {
  height: 100%;
  transition: width 0.6s ease;
}
.label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  min-width: 40px;
  text-align: right;
}
</style>
