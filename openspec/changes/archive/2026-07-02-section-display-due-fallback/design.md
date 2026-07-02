## Context

`useProjectProgress.ts` 的 `calcSectionProgress` 目前只從 milestone 任務收集 `latestMilestoneDueOn`（取 **最晚** milestone `due_on`）。`ProgressTimelineByTime.vue` 以此欄位決定：

- 月欄表頭範圍（`monthColumns`）
- section 分桶（`buildBucketMap` → 有值進月欄，null 進 `UNSCHEDULED_KEY`）
- 卡片「截止日期：…」（`formatSectionDueOnDisplay`）
- 格內排序、點月欄後專案列排序（`milestoneTimeMs`）

無 milestone 的 section 永遠 `latestMilestoneDueOn === null`，即使底下任務有 due_on 也進「未排」。

## Goals / Non-Goals

**Goals:**

- 新增 `sectionDisplayDueOn`，依 proposal 規則計算展示用截止日
- 時間序 view 全面改用 `sectionDisplayDueOn` 做月欄歸位與卡片文字
- 保留 `latestMilestoneDueOn` 供既有 status（behind / at-risk / not-started）邏輯不變
- 卡片文案維持「截止日期：…」

**Non-Goals:**

- 不改 `BillingTasksByTime.vue`（任務級，非 section 級）
- 不改請款進展非時間序頁
- 不讓 fallback 日期驅動 behind / at-risk 狀態
- 不變更 Asana API 或任務載入流程

## Decisions

### 1. 新欄位 `sectionDisplayDueOn` 而非覆寫 `latestMilestoneDueOn`

**選擇**：在 `SectionProgress` 加 `sectionDisplayDueOn: string | null`，與 `latestMilestoneDueOn` 並存。

**理由**：status 計算仍綁 milestone；若覆寫原欄位會讓無 milestone 區段誤觸 behind/at-risk，或讓有 milestone 區段語意混淆。

### 2. 計算邏輯集中於 `calcSectionProgress`

**選擇**：在 composable 內以純函式 `resolveSectionDisplayDueOn(tasks)` 計算，mount 時寫入 `SectionProgress`。

**理由**：單一資料來源；view 只讀欄位，避免 `ProgressTimelineByTime.vue` 重複 business rules。

**演算法**：

```
incomplete = tasks.filter(t => !t.completed)
if incomplete.length > 0:
  dues = incomplete tasks with due_on
  return dues.length ? min(dues) : null

dues = all tasks with due_on
return dues.length ? max(dues) : null
```

**取日策略摘要**：

| 情境 | 取法 |
|------|------|
| 有未完成任務（含 milestone 區段） | **最早** 未完成 due |
| 全完成 | **最晚** 有 due 的任務 |
| 有未完成但皆無 due | null → 未排 |

### 3. View 替換點

`ProgressTimelineByTime.vue` 中所有 **展示／分桶／排序** 讀 `latestMilestoneDueOn` 處改為 `sectionDisplayDueOn`：

| 函式 | 用途 |
|------|------|
| `monthColumns` | 月欄 bounds |
| `buildBucketMap` | 分桶 key |
| `formatSectionDueOnDisplay` | 卡片文字 |
| `milestoneTimeMs` | 可改名 `sectionDisplayTimeMs` 或保留名稱但改讀新欄位 |
| `monthColumnSortKeyForItem` | 點月欄排序的 `earliestDueMs` 迴圈 |

`latestMilestoneDueOn` 在 view 中若僅用於上述用途則全數替換；status 仍讀 `sp.status`（已由 composable 算好）。

### 4. 邊界：僅一個任務有 due_on

全完成 fallback 規格寫「多個任務都有截止日期用最晚」；實作上 **≥1 個有 due** 即取 max（單一 due 即該值）。

### 5. 日期比較

沿用現有 `due_on` 字串排序（YYYY-MM-DD）與 `parseDueToYm` / `new Date(due_on)`，與 milestone 路徑一致。

## Risks / Trade-offs

- **[Risk] 展示日過期但 status 仍 in-progress（綠）** → 刻意取捨：status 不綁 fallback，文件與 spec 註明。
- **[Risk] 全完成 section 歸到過去月份佔月欄** → 可接受：反映歷史完成節奏；status 仍 done。
- **[Risk] `monthColumns` 範圍因 fallback 展開** → 預期行為；可能需手動捲動到較早月份（既有「捲到當月」邏輯不變）。

## Migration Plan

- 純前端邏輯；部署後重新載入進度資料即可，無 DB／API migration。
- 回滾：還原 composable + view 讀取欄位即可。

## Open Questions

（無——探索階段已確認。）
