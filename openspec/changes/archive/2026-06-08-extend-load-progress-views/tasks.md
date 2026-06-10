## 1. 共用元件

- [x] 1.1 新增 `src/components/ProjectLoadProgressBanner.vue`：自 `BillingTasksByTime.vue` 移入 template、computed 邏輯與 scoped CSS
- [x] 1.2 定義 props：`loading`、`items`（`ProjectProgress[]`）、`hidden`（可選）；`hidden` 或無 active 載入時不渲染
- [x] 1.3 保留 a11y：`role="status"`、`aria-live="polite"`、determinate 時 `role="progressbar"` 與 aria-valuenow/max

## 2. 重構 BillingTasksByTime

- [x] 2.1 以 `<ProjectLoadProgressBanner>` 取代 inline banner markup
- [x] 2.2 移除 `loadProgress*` computed 與 `.load-progress-*` CSS（已移入元件）
- [x] 2.3 確認 `:hidden="!!error"` 行為與重構前一致

## 3. ProgressTimelineByTime

- [x] 3.1 import `ProjectLoadProgressBanner`
- [x] 3.2 在 `</header>` 與 `<main class="page-main">` 之間插入 banner，綁定 `loading`、`items`、`:hidden="!!error"`

## 4. BillingTasks

- [x] 4.1 import `ProjectLoadProgressBanner`
- [x] 4.2 在 `</header>` 與 `<main class="page-main">` 之間插入 banner，綁定 `loading`、`items`（非 `displayRows`）、`:hidden="!!error"`

## 5. 驗證

- [x] 5.1 `npm run build` 通過
- [x] 5.2 手動確認三頁：初始 indeterminate、部分載入 M/N、全部完成後 banner 消失、error 時不顯示
