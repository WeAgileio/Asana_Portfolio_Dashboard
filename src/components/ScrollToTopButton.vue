<script setup lang="ts">
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
</script>

<template>
  <button
    type="button"
    class="scroll-to-top-btn"
    aria-label="回到頂端"
    title="回到頂端"
    @click="scrollToTop"
  >
    <svg
      class="scroll-to-top-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  </button>
</template>

<style scoped>
.scroll-to-top-btn {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 35;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: #4f46e5;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
}
.scroll-to-top-btn:hover {
  background: #4338ca;
}
.scroll-to-top-btn:focus {
  outline: none;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #6366f1;
}
.scroll-to-top-icon {
  display: block;
  margin-top: -2px;
}
@media (max-width: 640px) {
  .scroll-to-top-btn {
    right: 16px;
    bottom: 16px;
    width: 42px;
    height: 42px;
  }
}
</style>
