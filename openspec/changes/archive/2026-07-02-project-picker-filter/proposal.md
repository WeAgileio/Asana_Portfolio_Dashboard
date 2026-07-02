## Why

三個進度頁的「選擇要載入的專案」面板一次列出全部 workspace 專案，專案數多時難以找到目標。使用者需要在勾選前依 **專案名稱** 與 **創建時間** 縮小清單並調整排序，且列表應顯示建立日期以便對照。

## What Changes

- 新增共用 **`ProjectPickerPanel`** 元件，取代三個 view 中重複的專案選擇 overlay markup／樣式
- **名稱**：關鍵字即時搜尋（不分大小寫、子字串）；排序 **A→Z**／**Z→A**／預設（API 建立時間順）
- **創建時間篩選**：**全部**、**近 N 年**（0.5／1／3／5）、**指定年份**、**自訂起迄日期**（可組合語意：落在區間內才顯示）
- **創建時間排序**：**新→舊**／**舊→新**（與名稱排序可疵用：先篩選再排序）
- 列表每列顯示 **專案名稱 + 建立日期**（`created_at` 格式化为 zh-TW 日期；無日期顯示「—」）
- 篩選 **僅影響列表顯示**；已勾選但不符合篩選的專案 **仍保留** 在 `selectedProjectGids`，套用時照常載入
- 顯示 **符合篩選 N / 總 M** 計數；無結果時提示
- 關閉面板時重置篩選／排序 UI 狀態（不寫入 localStorage）

## Capabilities

### New Capabilities

- `project-picker-filter`: 專案選擇面板的名稱搜尋、創建時間篩選與排序、列表建立日期顯示、篩選不影響已選 gid

### Modified Capabilities

（無）

## Impact

- **新增**：`src/components/ProjectPickerPanel.vue`、篩選／排序工具（如 `src/utils/projectPickerFilter.ts`）
- **修改**：`BillingTasks.vue`、`BillingTasksByTime.vue`、`ProgressTimelineByTime.vue`（改用共用面板）
- **不變**：`fetchProjects` API、`selectedProjectGids` localStorage 語意、載入全部／套用選擇行為
- **無後端變更**（`created_at` 已於 `fetchProjects` 取得）
