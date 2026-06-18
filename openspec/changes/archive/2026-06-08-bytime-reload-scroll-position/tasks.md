## 1. Composable

- [x] 1.1 新增 `src/composables/useBytimeScrollAfterReload.ts`
- [x] 1.2 實作 `tryRestoreScrollLeftAfterDataReady`（nextTick + rAF + retry）
- [x] 1.3 實作 `setupScrollAfterReloadWatch`：依 mode 對齊當月或還原位置

## 2. BillingTasksByTime

- [x] 2.1 整合 composable，移除 inline watch 與 reload scroll 邏輯
- [x] 2.2 scroll／拖曳 handler 呼叫 `markUserHorizontalScroll`
- [x] 2.3 重新載入／重新同步／套用選擇／onMounted 改走 `beginBatchReload`

## 3. ProgressTimelineByTime

- [x] 3.1 同 BillingTasksByTime 整合 composable
- [x] 3.2 確認單專案列 reload 不觸發 batch scroll

## 4. 驗證

- [x] 4.1 `npm run build` 通過
