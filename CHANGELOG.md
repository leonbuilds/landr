# CHANGELOG.md

## 2026-05-02 Session (Phase 1 MVP Init)

### 完成
- [x] 项目脚手架：Next.js 16 + TypeScript + Tailwind CSS + shadcn-style UI components
- [x] 数据库：Prisma + SQLite，6个模型（User, Resume, Job, Application, StatusLog, Setting）
- [x] 用户认证：注册、登录、JWT签发验证、bcryptjs密码哈希
- [x] 数据隔离：所有API Route通过auth中间件注入userId，查询强制过滤
- [x] 简历管理：上传（PDF/Word/文本）、解析、CRUD API、列表页
- [x] AI简历诊断：三维度评分（结构/内容/关键词）+ 修改建议，SVG仪表盘可视化
- [x] 岗位管理：JD输入、AI解析、列表+详情页
- [x] 简历-岗位匹配：匹配度评分 + 绿/红/黄关键词标签 + AI重写建议
- [x] 设置页：API Key加密存储（AES-256）、模型选择、密码修改、账号删除
- [x] LLM适配层：OpenAI兼容SDK，支持DeepSeek/Kimi/通义千问

## 2026-05-02 Phase 2 Complete

### 完成
- [x] 求职信生成API + UI（三种语气：正式/自信/真诚）
- [x] 面试准备题生成API + UI（行为/情景/技术题 + STAR答案展开）
- [x] 申请追踪看板（@dnd-kit拖拽、7列状态流转）
- [x] 数据统计仪表盘（投递趋势柱状图、转化漏斗、5个统计卡片）
- [x] 应用详情API（状态变更日志）
- [x] Edge cases: 空状态、权限拦截、错误提示

## 2026-05-02 Phase 3

### 完成
- [x] CSV数据导出（申请记录导出为CSV文件）
- [x] Turbopack配置修复（root目录警告消除）
- [x] 所有页面完整错误处理（401/403/404/500状态覆盖）
- [x] API Key加密存储、数据脱敏显示

### 完成
- [x] 单元测试：18 tests pass (auth, crypto, ai) via vitest
- [x] 浏览器岗位采集API（支持URL抓取 + 页面内容直接解析）
- [x] jest → vitest迁移（Node v23兼容）
- [x] `/api/jobs/scrape` 端点：提交招聘页面URL或HTML内容，AI自动提取岗位并存入岗位库

### 部署
- `ecosystem.config.cjs` — PM2配置（阿里云ECS）
- `npm run build && pm2 start ecosystem.config.cjs`
