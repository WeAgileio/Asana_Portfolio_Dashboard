<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    rate: number; // 0 ~ 1
    size?: number;
    strokeWidth?: number;
    color?: string;
    trackColor?: string;
    label?: string;
  }>(),
  {
    size: 80,
    strokeWidth: 7,
    color: "#10b981",
    trackColor: "#e5e7eb",
  }
);

const radius = computed(() => (props.size - props.strokeWidth) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const offset = computed(
  () => circumference.value * (1 - Math.min(1, Math.max(0, props.rate)))
);
const pct = computed(() => (props.rate * 100).toFixed(1));
</script>

<template>
  <div class="circle-progress" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="trackColor"
        :stroke-width="strokeWidth"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="color"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        class="progress-circle"
        transform="rotate(-90)"
        :transform-origin="`${size / 2} ${size / 2}`"
      />
    </svg>
    <div class="inner">
      <span class="pct">{{ pct }}%</span>
      <span v-if="label" class="label">{{ label }}</span>
    </div>
  </div>
</template>

<style scoped>
.circle-progress {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.inner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
}
.pct {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}
.label {
  font-size: 10px;
  color: #6b7280;
  margin-top: 2px;
}
.progress-circle {
  transition: stroke-dashoffset 0.6s ease;
}
</style>
