## Context

兩個 bytime 月欄表視圖（`BillingTasksByTime.vue`、`ProgressTimelineByTime.vue`）使用**表頭／表身雙表 + 雙 scroll 同步**架構。欄寬由 `<colgroup>` 與 CSS class 固定（專案 220px、未排 148px、月欄 154px）。表頭月欄含 billing 列（`💰 collected / total`，`white-space: nowrap`），表身月欄 td 有 `max-width: 154px` 但表頭 th 無對應限制，導致表頭表被內容撐寬、表身表維持 154px，載入即格線錯位。

既有防錯位措施（`width: max-content`、`scrollbar-gutter: stable`、表身 `overflow-x: hidden`）無法解決「表頭需更寬以完整顯示 billing」與「兩表同寬」的矛盾。

**約束：** billing 金額必須完整顯示，不可截斷或縮字到難以閱讀。

## Goals / Non-Goals

**Goals:**

- 表頭與表身月欄邊界在 `scrollLeft = 0` 及任意捲動位置均對齊
- 表頭 billing 金額完整可見
- 兩頁行為一致，共用 composable
- scroll 定位（對齊當月）使用與 CSS 相同的月欄寬

**Non-Goals:**

- 合併雙表為單表結構重構（若動態寬度已解決則不做）
- 抽離共用 bytime-grid 元件（除非兩頁 CSS 重複過多）
- 修改十週統計或其他非 bytime 視圖

## Decisions

### 1. 動態月欄寬 via composable

**決策：** 新增 `useBytimeMonthColWidth(billingAmountsByMonth)`，回傳 `monthColWidthPx`（number）與 `monthColWidthStyle`（CSS 變數物件）。

**計算邏輯：**

- 對每個月 key，組出表頭 billing 列最長字串：`💰 {collected} / {total}`（`toLocaleString('zh-TW')`）
- 以字元數 × 估計 px（11px tabular-nums ≈ 6.5–7px/char）+ 水平 padding（12px）估算寬度
- 取所有月份最大值，與下限 `BYTIME_MONTH_COL_MIN = 154` 比較，`Math.ceil` 後回傳
- 無 billing 資料時回傳 154

**替代方案：**

| 方案 | 不採原因 |
|------|----------|
| 固定加寬至 220px | 小數字浪費空間；超大金額仍可能不夠 |
| Canvas/DOM measure | 準確但重；字元估算對 tabular-nums 足夠 |
| 表頭 overflow + tooltip | 違反「完整顯示」需求 |

### 2. CSS 變數 `--bytime-month-col-w` 單一來源

**決策：** 在 `.bytime-calendar-section` 綁定 `:style="{ '--bytime-month-col-w': monthColWidthPx + 'px' }"`。

CSS 更新：

```css
.bytime-col-month {
  width: var(--bytime-month-col-w, 154px);
  min-width: var(--bytime-month-col-w, 154px);
  max-width: var(--bytime-month-col-w, 154px);
}
.bytime-head-month .th-month {
  width: var(--bytime-month-col-w, 154px);
  min-width: var(--bytime-month-col-w, 154px);
  max-width: var(--bytime-month-col-w, 154px);
  overflow: visible; /* 完整顯示，不截斷 */
}
.bytime-body-row > td.bytime-cell-stack:not(.sticky-col-unsched) {
  max-width: var(--bytime-month-col-w, 154px);
}
```

表頭 th 與表身 td、colgroup 三者同值，消除撐寬差異。

### 3. Scroll 定位常數同步

**決策：** 將硬編碼 `BYTIME_MONTH_COL_W = 154` 改為 composable 回傳的 `monthColWidthPx`，用於 `scrollBytimeToCurrentMonthColumn` 等計算。

### 4. Scrollbar 行為統一

**決策：** 表身 `.bytime-table-scroll` 也隱藏 webkit scrollbar（與表頭一致），保留 `scrollbar-gutter: stable`。避免表身多出 scrollbar 佔位導致可視寬度差。

**替代：** 表頭也顯示 scrollbar — 視覺較醜，不採。

## Risks / Trade-offs

| 風險 | 緩解 |
|------|------|
| 字元寬度估算不足，極大金額仍撐寬 | 加 8–12px buffer；實測 demo 250 萬與 production 千萬級 |
| 資料更新後月欄寬變化導致 scroll 跳動 | composable 為 computed，寬度只增不減或整批 reload 時重算 acceptable |
| 兩頁 CSS 重複修改 | 改動對稱、註解引用 composable；後續可抽共用 |
| 月欄變寬增加橫向捲動 | 可接受；優先對齊與可讀性 |

## Migration Plan

- 純前端 CSS/composable 變更，無資料遷移
- 部署後目視驗證兩頁表頭格線與表身對齊
- 回滾：還原 composable 與 CSS 變數綁定即可

## Open Questions

（無 — 需求已確認：兩頁、載入即錯、完整顯示 billing）
