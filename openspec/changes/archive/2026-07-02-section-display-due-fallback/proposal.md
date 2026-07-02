## Why

專案進展·時間序以 section 的里程碑截止日決定月欄歸位與卡片「截止日期」顯示。許多區段未設 milestone 任務，即使有一般任務的 due_on 也一律落入「未排」，時間軸無法反映實際工作節奏。

## What Changes

- 在 `calcSectionProgress` 新增 **`sectionDisplayDueOn`**，作為時間序展示用截止日（與驅動 behind/at-risk 的 `latestMilestoneDueOn` 分離）
- **有 milestone** 的區段：展示日改為未完成任務 `due_on` 中 **最早** 者（不再用最晚 milestone）
- **無 milestone** 且仍有未完成任務：展示日 = 未完成任務 `due_on` 中 **最早** 者；若皆無 `due_on` → **未排** + 「—」
- **無 milestone** 且全部任務已完成：展示日 = 有 `due_on` 任務中 **最晚** 者；若皆無 `due_on` → **未排** + 「—」
- `ProgressTimelineByTime.vue` 的月欄範圍、section 分桶、卡片「截止日期：…」、格內／專案列排序改讀 `sectionDisplayDueOn`
- 卡片文案維持「截止日期：…」，不區分日期來源
- section 狀態色（behind / at-risk / done 等）**不變**，仍只依 `latestMilestoneDueOn` 計算

## Capabilities

### New Capabilities

- `section-display-due`: 專案進展·時間序 section 展示截止日的 milestone-first fallback 規則（月欄歸位 + 卡片文字）

### Modified Capabilities

（無既有 main spec）

## Impact

- **修改**：`src/composables/useProjectProgress.ts`（`SectionProgress` 型別、`calcSectionProgress`）
- **修改**：`src/views/ProgressTimelineByTime.vue`（bucket、顯示、排序）
- **不變**：`BillingTasksByTime.vue`（任務級分月）、`BillingTasks.vue`、API／後端
- **不變**：section 狀態計算邏輯（仍綁 milestone）
