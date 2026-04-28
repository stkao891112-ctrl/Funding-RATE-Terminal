# 使用 Node.js 作為基底
FROM node:20-slim

# 安裝 Python 3 和 pip
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

# 設定工作目錄
WORKDIR /app

# 先複製 package.json 安裝 Node 依賴
COPY package*.json ./
RUN npm install

# 複製 requirements.txt 並安裝 Python 依賴
COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt

# 複製所有檔案
COPY . .

# 建立前端 Production Build (在此時保持開發依賴可用)
RUN npm run build

# 設定環境變數
ENV NODE_ENV=production
ENV PORT=3000

# 開放連接埠
EXPOSE 3000

# 啟動命令 (同時啟動 Python 和 Node)
CMD ["npm", "start"]
