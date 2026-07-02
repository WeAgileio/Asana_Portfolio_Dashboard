## 1. 對齊實作

- [x] 1.1 確認 `ProjectPickerPanel.vue` 的 `selectAllVisible` 合併 `selectedGids` 與 `filteredProjects` gid，不覆寫 hidden 已選
- [x] 1.2 確認「全選」在列表為空或 `allVisibleSelected` 時 disabled，按鈕位於計數列旁

## 2. 驗證

- [x] 2.1 手動驗收：篩選後全選、部分已選再全選、hidden 已選仍保留、空列表／全已選 disabled
- [x] 2.2 `npm run build` 通過
