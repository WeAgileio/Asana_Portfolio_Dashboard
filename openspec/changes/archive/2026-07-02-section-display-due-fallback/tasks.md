## 1. Composable — sectionDisplayDueOn

- [x] 1.1 在 `SectionProgress` 型別新增 `sectionDisplayDueOn: string | null`
- [x] 1.2 實作 `resolveSectionDisplayDueOn(tasks)`：有未完成 → 最早未完成 due；全完成 → 最晚有 due 任務；否則 null（含 milestone 區段）
- [x] 1.3 在 `calcSectionProgress` 寫入 `sectionDisplayDueOn`；確認 `latestMilestoneDueOn` 與 status 邏輯不變

## 2. ProgressTimelineByTime — 改用展示截止日

- [x] 2.1 `monthColumns` bounds 改讀 `sectionDisplayDueOn`
- [x] 2.2 `buildBucketMap` 分桶 key 改讀 `sectionDisplayDueOn`（null → 未排）
- [x] 2.3 `formatSectionDueOnDisplay` 改讀 `sectionDisplayDueOn`
- [x] 2.4 格內排序／點月欄排序（`milestoneTimeMs`、`monthColumnSortKeyForItem` 等）改讀 `sectionDisplayDueOn`

## 3. 驗證

- [x] 3.1 `npm run build` 通過
- [x] 3.2 手動驗收：有 milestone 仍用最晚 milestone 月欄；無 milestone 未完成取最早 due；皆無 due 未排；全完成取最晚 due；卡片皆為「截止日期：…」
