## Context

三個資料檢視頁共用類似的 `page-header` 工具列（篩選、搜尋、圖例、同步、載入、選專案）。目前使用 `flex-wrap`，寬度不足時換行佔用額外高度。使用者希望：預設與現在一樣；不需要時整條隱藏（0px）；用 **「隱藏／顯示工具列」** 文字操作；隱藏後以 **偏右小標籤** 還原。

## Goals / Non-Goals

**Goals:**

- 預設顯示完整工具列，行為與現行寬螢幕一致
- 「隱藏」→ 整條工具列 0px，資料區最大化
- 偏右小標籤「顯示工具列」還原
- 寬度不足時自動隱藏（除非使用者已手動選擇顯示）
- 三頁共用 `PageToolbar` + slot
- `localStorage` 記憶 `pageToolbarHidden`

**Non-Goals:**

- chevron ▲/▼ 控件
- 收合後仍留精簡主列（搜尋+同步等）
- 「更多」overflow popover
- 修改 top-nav 或表格本體
- `WeeklyTrends` 頁面

## Decisions

### 1. 單一 state：`hidden`

```ts
hidden: boolean  // false = 顯示完整工具列, true = 0px + 小標籤
```

不使用 chevron / collapsed / overflow 多套 state。

### 2. UI 結構

```
顯示中 (hidden=false):
┌─ .page-toolbar-panel ─────────────────────────────────────┐
│ [filters][search][legend][reload][resync][picker] [隱藏] │
└───────────────────────────────────────────────────────────┘

隱藏中 (hidden=true):
（.page-toolbar-panel display:none 或 height:0，不占流式高度）
                    ┌──────────────┐
                    │ 顯示工具列 ▼ │  ← .page-toolbar-tab，position 偏右
                    └──────────────┘
```

小標籤：
- 位置：**內容區上緣、偏右**（`right: 20px` 或對齊 page-main padding）
- 高度 ~26px，書籤形（下圓角），白底 + 邊框 + 輕 shadow
- `position: sticky` 或 `absolute` 於 progress-page 內，**不計入 page-header 高度**

### 3. 按鈕文案

| 控件 | 文案 | 位置 |
|------|------|------|
| 隱藏 | **隱藏** | 工具列最右端，ghost 次要樣式 |
| 還原 | **顯示工具列** | 偏右小標籤 |

`aria-label`：`隱藏工具列` / `顯示工具列`。

### 4. 自動隱藏

- `ResizeObserver` on toolbar panel track
- 若 `hidden === false` 且 `scrollWidth > clientWidth` 且 `!userPrefersVisible` → `hidden = true`
- 使用者點「顯示工具列」→ `userPrefersVisible = true`，工具列加 `overflow-x: auto` 橫向捲動
- 視窗 resize 時重新評估（若 `userPrefersVisible` 仍 true 則不自動隱藏）

### 5. localStorage

- 鍵名：`pageToolbarHidden`（`"true"` / `"false"`）
- 讀取於 mount；寫入於 `hidden` 變更
- 若值為 `"false"`（使用者曾手動顯示）→ `userPrefersVisible = true`

### 6. Slot 結構

```vue
<PageToolbar
  v-model:hidden="..."
  :loading :date-label :projects-options-loading
  @resync @reload @open-project-picker @hide
>
  <template #search />
  <template #filters-inline />   <!-- 排序 -->
  <template #role-filter />      <!-- 僅專案進展 -->
  <template #legend />
</PageToolbar>
```

隱藏時關閉角色篩選 popover（`@hide` emit）。

### 7. 控件順序（inline 單排）

`filters-inline` → `role-filter` → `search` → `legend` → `reload` → `resync` → `picker` → `隱藏`

`flex-wrap: nowrap`；使用者偏好顯示時 `overflow-x: auto`。

### 8. 響應式

移除三頁 `<900px` `flex-direction: column` toolbar 規則。

## Risks / Trade-offs

| 風險 | 緩解 |
|------|------|
| 小標籤擋到表格 | 偏右放置；可選 hidden 時 `page-main` 加 `padding-top: 28px` 僅推內容不推 header |
| 自動隱藏與手動顯示衝突 | `userPrefersVisible` 旗標 |
| 三頁 CSS 漂移 | 共用元件 |
| 角色 popover 開啟時隱藏 | `@hide` 時 parent 關閉 panel |

## Migration Plan

1. 建立 `PageToolbar.vue`
2. 接入 `BillingTasks` → `BillingTasksByTime` → `ProgressTimelineByTime`
3. 刪除各 view 重複 toolbar CSS
4. 手動驗證：顯示/隱藏、小標籤偏右、自動隱藏、localStorage、三頁

## Open Questions

- （無）
