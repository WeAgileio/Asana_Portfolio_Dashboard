## Context

`ProjectPickerPanel` 已提供篩選、排序與 hidden selection 保留。使用者希望一鍵勾選「目前列表可見」的專案。程式中已有 `selectAllVisible()` 與「全選」按鈕，本 change 以 spec 對齊與驗收為主。

## Goals / Non-Goals

**Goals:**

- 「全選」合併勾選 `filteredProjects` 的全部 gid 至 `selectedGids`
- 保留篩選外已選 gid；不實作「取消全選」或「全 workspace 全選」
- 空列表或全部可見已選時 disabled

**Non-Goals:**

- 不變更篩選／排序邏輯
- 不新增「取消全選目前篩選」
- 不跨頁或持久化全選狀態

## Decisions

1. **合併而非覆寫**  
   `selectedGids = union(selectedGids, visibleGids)`，與 hidden selection 規則一致。

2. **按鈕置於計數列**  
   與「顯示 N / M 個專案」同一列，語意上對應「全選目前顯示」。

3. **Disabled 條件**  
   `filteredProjects.length === 0` 或 `allVisibleSelected`（每個可見 gid 皆在 selected 內）。

4. **實作位置**  
   僅 `ProjectPickerPanel.vue`；不新增 util。

## Risks / Trade-offs

- **[使用者以為全選 workspace]** → 按鈕文案「全選」+ 僅在篩選結果列旁，spec 明確寫「目前篩選顯示」
- **[無取消全選]** → 使用者可逐項取消或清空後重選；非本 change 範圍
