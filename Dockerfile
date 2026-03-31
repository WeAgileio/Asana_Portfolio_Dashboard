# 生產映像：建置 Vue 前端 + 以 Node 提供 API 與靜態檔
# 一般建置：docker build -t yuminggood/asana_dashboard:<tag> [--build-arg VITE_BILLING_FIELD=請款金額] .
# ARM64 建置：docker buildx build --platform linux/arm64/v8 -t yuminggood/asana_dashboard:<tag> [--build-arg VITE_BILLING_FIELD=請款金額] .
# 執行：docker run -p 3001:3001 --env-file .env yuminggood/asana_dashboard:<tag>

FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
ARG TARGETPLATFORM
ARG VITE_BILLING_FIELD=
ENV VITE_BILLING_FIELD=$VITE_BILLING_FIELD
RUN npm run build

FROM --platform=$TARGETPLATFORM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# 後端 GET /api/* 代理快取（毫秒）；docker run --env-file .env 或 -e 可覆寫
ENV ASANA_PROXY_CACHE_LIST_MS=3000000 \
    ASANA_PROXY_CACHE_PROJECT_MS=3000000 \
    ASANA_PROXY_CACHE_TASK_MS=3000000 \
    ASANA_PROXY_CACHE_DEFAULT_MS=3000000 \
    ASANA_PROXY_CACHE_MAX_ENTRIES=10000

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server ./server

EXPOSE 3001

CMD ["node", "server/index.mjs"]
