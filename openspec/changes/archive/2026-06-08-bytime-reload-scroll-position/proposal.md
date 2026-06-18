## Why

請款進展·時間序與進展時間軸頁面在重新載入後一律自動對齊「目前月份」欄，若使用者已手動橫向捲動到其他月份檢視，重新載入完成後仍被強制跳回當月，打斷閱讀脈絡。應改為：未手動捲動時對齊當月；已手動捲動時保留位置。

## What Changes

- 在 `BillingTasksByTime.vue` 與 `ProgressTimelineByTime.vue` 追蹤使用者是否曾**手動**橫向捲動月欄表（拖曳或 scroll 事件），排除程式自動對齊觸發的 scroll
- 整批重新載入（重新載入、重新同步數據、套用專案選擇、首次進頁）完成後：
  - **未**手動捲動 → 維持現有行為，對齊目前月份欄
  - **已**手動捲動 → 還原載入前的 `scrollLeft`，不強制跳回當月
- 單專案列重新載入維持不調整橫向捲動（現狀）
- 抽取共用 composable，避免兩頁重複邏輯

## Capabilities

### New Capabilities

- `bytime-reload-scroll-position`：月欄表視圖在整批載入完成後，依使用者是否手動橫向捲動決定對齊當月或保留捲動位置

### Modified Capabilities

（無）

## Impact

- 新增 `src/composables/useBytimeScrollAfterReload.ts`
- `src/views/BillingTasksByTime.vue` — 改用 composable
- `src/views/ProgressTimelineByTime.vue` — 改用 composable
