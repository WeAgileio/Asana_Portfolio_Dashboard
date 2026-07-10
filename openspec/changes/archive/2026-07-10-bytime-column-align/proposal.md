## Why

「請款進展·時間序」與「專案進展·時間序」的月欄表採表頭／表身雙表結構，月欄固定 154px，但表頭 billing 列（`white-space: nowrap`）在載入時即被長數字撐寬，表身 td 卻被 `max-width: 154px` 限制，導致兩表欄寬不一致、格線從第一欄起就錯位。使用者要求請款金額完整顯示，不能以截斷換取對齊。

## What Changes

- 新增共用 composable，依各月欄表頭 billing 字串動態計算月欄寬度（下限維持 154px），表頭與表身兩表共用同一數值
- 以 CSS 變數 `--bytime-month-col-w` 綁定 `<colgroup>`、表頭 `th`、表身 `td` 及 scroll 定位常數，確保載入即對齊
- 統一表頭／表身橫向捲動容器的 scrollbar 行為，避免 `scrollbar-gutter` 造成可視寬度差
- 同步修改 `BillingTasksByTime.vue` 與 `ProgressTimelineByTime.vue`

## Capabilities

### New Capabilities

- `bytime-column-align`：月欄表表頭與表身欄寬一致，billing 金額完整顯示且載入即對齊

### Modified Capabilities

（無）

## Impact

- 新增 `src/composables/useBytimeMonthColWidth.ts`
- `src/views/BillingTasksByTime.vue` — 動態月欄寬、CSS 變數、scroll 常數
- `src/views/ProgressTimelineByTime.vue` — 同上
- 月欄可能略寬（約 190–210px），橫向捲動距離略增
