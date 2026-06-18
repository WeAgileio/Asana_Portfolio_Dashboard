## Context

兩頁共用 bytime 月欄表：表頭／表身雙層 scroll 同步、拖曳捲動，以及整批載入完成後 `scrollBytimeToCurrentMonthColumn()` 對齊目前月份。

## Goals / Non-Goals

**Goals:** 偵測手動橫向捲動；整批載入完成後依是否手動捲動對齊當月或還原 `scrollLeft`；兩頁共用 composable。

**Non-Goals:** 單專案列 reload 的 scroll；語意級 month key 還原；`BillingTasks.vue`。

## Decisions

### composable `useBytimeScrollAfterReload`

- `markUserHorizontalScroll()` — head/body scroll、拖曳 move 呼叫；`programmaticScrollActive` 時忽略
- `beginBatchReload(loadFn)` — reload 前保存 scrollLeft 或設 current-month 模式
- `runProgrammaticScroll(fn)` — 自動 scroll 不計入手動捲動
- `setupScrollAfterReloadWatch()` — 載入完成後對齊或還原（含 retry）
