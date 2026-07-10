## 1. Demo mode 基礎設施



- [x] 1.1 新增 `src/demo/isDemoMode.ts`（讀取 `import.meta.env.VITE_DEMO_MODE === 'true'`）

- [x] 1.2 更新 `Dockerfile` 加入 `ARG`/`ENV VITE_DEMO_MODE`；`.env.example` 與 `vite-env.d.ts` 補型別註解

- [x] 1.3 更新 `src/stores/auth.ts`：demo mode 下自動注入固定 demo token 與 `tokenHash`，略過 Login 需求



## 2. 假資料生成器



- [x] 2.1 新增 `src/demo/demoDataGenerator.ts`：以 `today` 為 anchor 生成 4 個虛構專案、sections、tasks

- [x] 2.2 實作進度敘事（done / in-progress / at-risk / not-started）與請款 task（`billingTaskYes`、`billingAmount`）

- [x] 2.3 新增 `src/demo/demoDataset.ts`：模組級 singleton 快取，首次呼叫時 generate



## 3. API mock 層



- [x] 3.1 新增 `src/demo/demoApi.ts`：`getDemoProjects`、`getDemoProject`、`getDemoSections`、`getDemoTasks`

- [x] 3.2 更新 `src/api/asana.ts`：四個 fetch function 在 demo mode 短路至 demoApi，正式路徑不變



## 4. App shell（demo UI）



- [x] 4.1 更新 `App.vue`：demo mode 隱藏「十週更新統計」tab；顯示「展示模式 · 示意資料」badge

- [x] 4.2 Demo mode 隱藏或停用「登出」，避免進入需 PAT 的 Login 頁

- [x] 4.3 確認 `useProjectProgress` 預設載入至少 3 個 demo 專案（必要時在 composable 或 demo 初始化設定 default selected gids）



## 5. 部署與文件



- [x] 5.1 新增 `docker-compose.demo.yml`（demo 映像 tag、獨立 port，不設 `ASANA_DEFAULT_PAT`）

- [x] 5.2 更新 `README.md`：本機 demo 驗證（`VITE_DEMO_MODE=true npm run dev`）、demo 映像建置與部署步驟

- [x] 5.3 手動驗證：三 tab 可互動、專案篩選／全選、請款數字顯示、無 outbound Asana 請求

