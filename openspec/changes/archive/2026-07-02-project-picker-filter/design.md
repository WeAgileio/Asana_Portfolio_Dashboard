## Context

「選擇要載入的專案」overlay 在三個 view 各有一份相同結構（checkbox 列表 + 載入全部／套用選擇）。`projectsOptions` 來自 `useProjectProgress` → `fetchProjects()`，已含 `name`、`created_at`，預設排序為建立時間 **新→舊**。

工具列 `projectSearchQuery` 只篩 **已載入** 的專案列，不作用於選擇器。

## Goals / Non-Goals

**Goals:**

- 共用 `ProjectPickerPanel` 含篩選、排序、建立日期顯示
- 名稱關鍵字 + 名稱 A→Z／Z→A
- 創建時間：近 0.5／1／3／5 年、年份、起迄區間篩選 + 新→舊／舊→新排序
- 篩選隱藏列但不取消勾選
- 關閉面板重置篩選 UI

**Non-Goals:**

- 不改 `fetchProjects` 或 Asana opt_fields
- 不 persist 篩選偏好至 localStorage
- 不篩選 workspace／成員／顏色等其他維度
- 不改主畫面 `ProjectSortControl`（已載入專案列排序）

## Decisions

### 1. 抽出 `ProjectPickerPanel.vue`

**選擇**：新元件封裝 overlay、篩選列、列表、actions。

**Props / emits（草案）**：

```vue
projects: AsanaProject[]
loading: boolean
projectsLoading: boolean
v-model:selectedGids: string[]
@apply
@load-all
@close  // overlay 點外部或 ESC（若已有）
```

三 view 保留 `projectPickerOpen` 與 `selectedProjectGids` 來自 composable；面板內部管理 **區域** filter/sort state。

### 2. 篩選／排序管線

**選擇**：純函式 `filterAndSortProjects(projects, options)` 於 `projectPickerFilter.ts`，方便單元測試。

```
輸入: projectsOptions[]
步驟:
  1. filterByName(query)     — trim, toLowerCase, includes
  2. filterByCreatedAt(...)  — 見下
  3. sortByName(order)       — default | asc | desc（default 跳過名稱排序）
  4. sortByCreatedAt(order)  — desc | asc（與 API 預設 desc 一致）

輸出: 顯示用列表
```

**排序優先**：先套用創建時間排序，再套用名稱排序（或 spec 定義：創建時間為主鍵、名稱為次鍵 — 實作時 **創建時間排序優先，同時間再依名稱**）。

建議 tie-break：創建時間排序後 `localeCompare(name)`。

### 3. 創建時間篩選 UI

**選擇**：單列或兩列 compact 控制：

| 控制 | 選項 |
|------|------|
| 快速 | 全部／近半年（0.5 年）／近 1 年／近 3 年／近 5 年 |
| 年份 | 下拉（由 `projects` 有 `created_at` 的年份去重，新→舊 +「不限」） |
| 自訂 | `type=date` 起、迄（可只填一端） |

**語意**：

- **近 N 年**：`created_at >= today - N years`（N 可為 0.5／1／3／5；0.5 即減 6 個月；含當日，以本地日曆日 0:00）
- **指定年份**：`created_at` 的年份 === 選中年份
- **起迄**：`start <= created_at <= end`（缺 start 則只限 upper；缺 end 則只限 lower）
- **無 `created_at`**：不符合任何「有日期條件」的篩選；在「全部」快速選項下仍顯示

快速「全部」且年份「不限」且起迄皆空 → 不過濾日期。

### 4. 創建時間排序 UI

獨立 toggle 或 select：**新→舊**（預設）／**舊→新**。

與名稱排序獨立；兩者同時設定時：**先依創建時間排，再依名稱排**（穩定排序）。

### 5. 名稱搜尋與排序 UI

- 文字 input `placeholder="搜尋專案名稱…"`
- 名稱排序：三態 **預設**／**A→Z**／**Z→A**（可沿用 `ProjectSortControl` 視覺風格的小按鈕，或 picker 專用精簡版）

### 6. 列表列 layout

```
☐  專案名稱                    2024/03/15
   ^ flex name                  ^ muted date, flex-shrink: 0
```

`formatProjectCreatedAt(created_at)` → `toLocaleDateString('zh-TW', { y, m, d })` 或 `—`。

### 7. 已選但隱藏

- `v-model` 仍綁 `selectedProjectGids`；checkbox 只 render 在 **filtered** 列表中
- Header 或 filter 列旁：`已選 {selectedGids.length} 個`（可選：若 hidden selected > 0 加「（{n} 個未顯示於目前篩選）」）

### 8. 面板關閉重置

`watch(open)` → false 時清空 name query、日期篩選、恢復預設排序（不動 selectedGids）。

### 9. 樣式

- 遷移三 view 的 `.project-picker-panel`、`.picker-actions`、`.reload-btn` 等至元件 scoped CSS
- 篩選列 `.picker-filters`：`display: flex; flex-wrap: wrap; gap: 8px`

## Risks / Trade-offs

- **[Risk] 三 view CSS  drift 遺漏** → 一次抽元件並刪除 view 內重複 picker CSS
- **[Risk] 日期篩選時區** → 與現有 `fetchProjects` 排序一致，用 `Date` 本地日曆日解析 `created_at` ISO
- **[Risk] 年份下拉專案很多** → 只列資料中出現的年份，非 1970–2030 全列

## Migration Plan

- 前端 only；部署後開啟選擇器即可使用
- 回滾：還原三 view inline picker

## Open Questions

（探索階段已確認，無待決項目。）
