FROM node:20-alpine

WORKDIR /app

# 安裝依賴
COPY package.json package-lock.json* ./
RUN npm install

# 預設指令會在 docker-compose 中覆蓋
CMD ["npm", "run", "dev"]

