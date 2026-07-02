## Why

`project-picker-filter` 歸檔後，專案選擇器已支援名稱／日期篩選，但使用者仍須逐項勾選目前列表中的專案。篩選後常只剩數十筆，缺少「一次勾選目前顯示項目」會拖慢批次選取流程；此能力已在程式中實作，需補上正式 spec 與驗收紀錄。

## What Changes

- 在 `ProjectPickerPanel` 新增 **「全選」** 按鈕：勾選 **目前篩選結果** 中的全部專案
- **合併** 至既有 `selectedGids`（不取消 hidden 已選、不影響未顯示的已勾選項）
- 列表為空或 **目前可見項目已全部勾選** 時按鈕 disabled
- 將行為寫入 `project-picker-filter` main spec（delta ADDED requirement）

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `project-picker-filter`: 新增「全選目前篩選結果」需求與情境

## Impact

- **修改**：`src/components/ProjectPickerPanel.vue`（若實作與 spec 不一致則對齊）
- **修改**：`openspec/specs/project-picker-filter/spec.md`（歸檔時 sync）
- **不變**：三頁 view、`projectPickerFilter.ts`、localStorage／載入語意
