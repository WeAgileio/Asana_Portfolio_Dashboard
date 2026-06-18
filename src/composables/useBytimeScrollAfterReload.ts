import { ref, watch, nextTick, type Ref } from "vue";

export type BytimeReloadScrollMode = "current-month" | "preserve";

export type UseBytimeScrollAfterReloadOptions = {
  headScrollEl: Ref<HTMLElement | null>;
  bodyScrollEl: Ref<HTMLElement | null>;
  scrollSyncing: Ref<boolean>;
  scrollToCurrentMonth: () => boolean;
  isLoadDone: () => boolean;
  monthColumnCount: () => number;
  isTableVisible: () => boolean;
  /** 已載入專案列數；0 且 isLoadDone 表示確定無資料 */
  itemCount: () => number;
};

export function useBytimeScrollAfterReload(
  options: UseBytimeScrollAfterReloadOptions
) {
  const {
    headScrollEl,
    bodyScrollEl,
    scrollSyncing,
    scrollToCurrentMonth,
    isLoadDone,
    monthColumnCount,
    isTableVisible,
    itemCount,
  } = options;

  const userHasScrolledHorizontally = ref(false);
  const scrollAfterReloadPending = ref(false);
  const reloadScrollMode = ref<BytimeReloadScrollMode>("current-month");
  const savedScrollLeft = ref(0);
  const programmaticScrollActive = ref(false);

  function markUserHorizontalScroll() {
    if (programmaticScrollActive.value) return;
    userHasScrolledHorizontally.value = true;
  }

  function runProgrammaticScroll(fn: () => boolean): boolean {
    programmaticScrollActive.value = true;
    try {
      return fn();
    } finally {
      requestAnimationFrame(() => {
        programmaticScrollActive.value = false;
      });
    }
  }

  function applyScrollLeft(left: number): boolean {
    const h = headScrollEl.value;
    const b = bodyScrollEl.value;
    if (!h || !b) return false;
    scrollSyncing.value = true;
    h.scrollLeft = left;
    b.scrollLeft = left;
    requestAnimationFrame(() => {
      scrollSyncing.value = false;
    });
    return true;
  }

  function clearPendingScroll() {
    scrollAfterReloadPending.value = false;
  }

  function prepareBatchReloadScroll() {
    if (userHasScrolledHorizontally.value) {
      const h = headScrollEl.value;
      savedScrollLeft.value =
        h?.scrollLeft ?? bodyScrollEl.value?.scrollLeft ?? 0;
      reloadScrollMode.value = "preserve";
    } else {
      reloadScrollMode.value = "current-month";
    }
    scrollAfterReloadPending.value = true;
  }

  function beginBatchReload(loadFn: () => void | Promise<void>) {
    prepareBatchReloadScroll();
    void loadFn();
  }

  function tryRestoreScrollLeftAfterDataReady(
    scrollLeft: number,
    retries = 24
  ) {
    nextTick(() => {
      requestAnimationFrame(() => {
        const ok = runProgrammaticScroll(() => applyScrollLeft(scrollLeft));
        if (ok) {
          clearPendingScroll();
          return;
        }
        if (retries <= 0) {
          clearPendingScroll();
          return;
        }
        setTimeout(() => {
          tryRestoreScrollLeftAfterDataReady(scrollLeft, retries - 1);
        }, 80);
      });
    });
  }

  function tryScrollToCurrentMonthAfterDataReady(retries = 24) {
    nextTick(() => {
      requestAnimationFrame(() => {
        const ok = runProgrammaticScroll(scrollToCurrentMonth);
        if (ok) {
          clearPendingScroll();
          return;
        }
        if (retries <= 0) {
          clearPendingScroll();
          return;
        }
        setTimeout(() => {
          tryScrollToCurrentMonthAfterDataReady(retries - 1);
        }, 80);
      });
    });
  }

  function setupScrollAfterReloadWatch() {
    watch(
      () => ({
        pending: scrollAfterReloadPending.value,
        done: isLoadDone(),
        n: monthColumnCount(),
        showTable: isTableVisible(),
        itemCount: itemCount(),
        mode: reloadScrollMode.value,
        saved: savedScrollLeft.value,
      }),
      (s) => {
        if (!s.pending || !s.done) return;
        if (s.itemCount === 0) {
          clearPendingScroll();
          return;
        }
        if (!s.showTable || s.n === 0) {
          // 資料已載入但 DOM／月欄尚未就緒：保留 pending，等 n 或 showTable 更新後再試
          return;
        }
        if (s.mode === "preserve") {
          tryRestoreScrollLeftAfterDataReady(s.saved);
        } else {
          tryScrollToCurrentMonthAfterDataReady();
        }
      },
      { flush: "post" }
    );
  }

  return {
    markUserHorizontalScroll,
    runProgrammaticScroll,
    beginBatchReload,
    setupScrollAfterReloadWatch,
  };
}
