# AIChemistry

AI 驱动的化学化合物推荐与查询桌面应用。

## 项目结构

```
AIChemistry/
├── demo/                          # Electron 桌面应用（前端）
│   ├── src/main/                  # Electron 主进程
│   │   ├── ai-server/             # AI 对话服务（LangChain + Agent）
│   │   │   └── tools/crs-tools.ts # 与 CRS 后端通信的工具
│   │   └── database/              # 本地数据库（SQLite + LanceDB）
│   └── src/renderer/              # Vue 3 前端界面
├── CRS/
│   └── chemical-recommender-system/  # 化学推荐系统后端（Python）
└── README.md                      # 本文件
```

## 前置条件

- **Node.js** >= 18
- **npm** >= 9
- **Docker**（运行 CRS 后端需要）

## 拉取项目

```bash
# 克隆 AIChemistry（主项目）
git clone https://github.com/mgyforever/AIChemistry.git
cd AIChemistry

# 克隆 CRS 后端（chemical-recommender-system）
git clone https://github.com/sandialabs/chemical-recommender-system.git CRS/chemical-recommender-system
```

### 更新 CRS 子项目

```bash
cd CRS/chemical-recommender-system
git pull origin main
```

## 启动项目

### 1. 启动 CRS 后端

CRS 使用 Docker 运行，启动前确保 Docker 已启动。

```bash
# 进入 CRS 目录
cd CRS/chemical-recommender-system

# 创建 .env 配置文件（可选）
# 默认无需配置即可运行

# 启动 CRS 服务
docker compose up -d
```

CRS 启动后，Web 界面会在 `http://localhost:5005` 可用，同时提供 REST API 供前端调用。

关闭 CRS：

```bash
docker compose down
```

### 2. 启动 Demo 桌面应用

```bash
# 回到项目根目录
cd demo

# 安装依赖
npm install

# 配置环境变量
# 复制 .env 模板（如存在）或创建 .env，填入 API Key
```

**注意**：由于终端编码问题，建议使用 `dev.ps1` 启动开发服务器：

```powershell
.\dev.ps1
```

或者手动设置编码后启动：

```powershell
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
npm run dev
```

### 3. 构建

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 相关链接

- [AIChemistry 仓库](https://github.com/mgyforever/AIChemistry)
- [CRS / chemical-recommender-system 仓库](https://github.com/sandialabs/chemical-recommender-system)
