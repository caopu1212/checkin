# 打卡 App 开发计划

> **本文档是项目的唯一事实来源（Single Source of Truth）。**
> 每次开发前先读这里，开发后更新这里。所有选型决策、进度、待办都记录在本文档内。

- **项目代号**：checkin-app
- **创建日期**：2026-09-22
- **最后更新**：2026-09-25
- **当前阶段**：多事件（分类）打卡功能已完成（含删除/防误触/居中排版），本地验证通过；等待用户执行 Supabase 建表 SQL 并清理实测时产生的重复分类

---

## 目录

1. [项目目标与成功标准](#1-项目目标与成功标准)
2. [总体架构](#2-总体架构)
3. [技术选型](#3-技术选型)
4. [功能开发进度](#4-功能开发进度)
5. [运行与部署](#5-运行与部署)
6. [已知的简化 / 风险](#6-已知的简化--风险)
7. [决策日志](#7-决策日志)
8. [开放问题 / 待确认](#8-开放问题--待确认)
9. [文档维护规则](#9-文档维护规则)
10. [变更记录](#10-变更记录)

---

## 1. 项目目标与成功标准

### 1.1 核心场景

个人打卡记录应用，自己用。手机和 PC 通过同一个 Web App 访问同一份数据，不用担心某台设备数据丢失。

### 1.2 核心需求（按优先级）

| 优先级 | 需求 | 状态 |
|---|---|---|
| P0 | 手机和 PC 数据同步，不丢失 | ✅ 已完成（Supabase 云端 + 本地离线缓存） |
| P0 | 显示每天打卡次数、当天每次打卡的具体时间 | ✅ 已完成 |
| P0 | 日历形式查看 | ✅ 已完成（含左右滑动切月、点标题跳转年月） |
| P0 | 基本统计功能 | ✅ 已完成 |
| P0 | 能修改/删除已打的卡 | ✅ 已完成 |
| P1 | 没网也能打卡（离线支持） | ✅ 已完成（本地优先 + 联网后自动同步） |
| P1 | 更深入的数据分析（不只是基础统计） | ✅ 已完成（回归、聚类、季节性等） |
| P2 | 历史数据迁移（旧记录表格导入） | ✅ 已完成（一次性导入功能） |
| P1 | 针对不同事情分开打卡、分开统计 | ✅ 已完成（"事件"概念，进系统先选事件，数据完全独立） |

### 1.3 明确不做的事（Scope Out）

- ❌ 不做原生 App（React Native / Flutter），PWA 已能满足"像 App 一样用"的需求
- ❌ 不做多用户 / 社交功能，纯个人单用户场景
- ❌ 不做复杂冲突解决（CRDT），单用户场景"最后写入者获胜"已经够用

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│  手机浏览器 / PC 浏览器（PWA，可添加到主屏幕）              │
│  React + TypeScript + Tailwind CSS v4                    │
└───────────────┬───────────────────────────┬─────────────┘
                │ 读写                        │ 读写
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────┐
│  本地 IndexedDB (Dexie)    │◄─►│  Supabase (Postgres+Auth)│
│  离线优先，UI 只读本地        │同步│  云端存储，多设备共享数据   │
└───────────────────────────┘   └─────────────────────────┘
```

- **前端**：Vite + React + TypeScript + Tailwind CSS v4，打包为 PWA（`vite-plugin-pwa`）
- **本地存储**：浏览器 IndexedDB（通过 [Dexie](https://dexie.org/)）。所有读写先落地本地，UI 始终读本地数据，天然支持离线
- **云端**：[Supabase](https://supabase.com)（Postgres + Auth），免费额度够个人使用。项目：`gpttumvhbfdojnnkathi.supabase.co`
- **同步策略**：本地优先 + 定期/触发式双向同步。单用户场景，冲突处理用简单的"最后写入者获胜"（按 `updated_at` 比较），没有做复杂的 CRDT
- **部署**：GitHub（[caopu1212/checkin](https://github.com/caopu1212/checkin)，Public）→ Vercel 自动部署，线上地址 `https://checkin-seven-omega.vercel.app/`

### 2.1 代码结构

```
src/
  data/
    historical-import.json   # 从旧记录表格导出的 [日期, 次数] 数组
  lib/
    types.ts             # CheckIn / Category 类型
    supabase.ts          # Supabase client
    db.ts                # Dexie 本地数据库 schema（checkins / categories / meta）
    sync.ts              # 推送/拉取同步逻辑（categories + checkins）+ 全局同步触发器
    date.ts              # 日期工具（日历网格、格式化）
    stats.ts             # 基础统计（连续天数、按天分组、使用天数等）
    analysis.ts          # 深入分析（星期/月度/时段分布、线性回归、K-Means 聚类、季节性）
    historicalImport.ts  # 历史数据一次性导入逻辑（归属指定分类）
  hooks/
    useAuth.ts        # Supabase Auth 会话
    useCategories.ts  # 分类 CRUD + 首次迁移（自动建默认分类、旧数据归类）
    useCheckins.ts    # 本地 CRUD（按 categoryId 过滤，Dexie liveQuery，响应式）
    useSync.ts        # 挂载同步定时器 + online 事件监听
  components/
    Auth.tsx             # 登录/注册
    CategoryPicker.tsx    # 事件选择页：进系统后先选事件，可新建/改名
    DayPanel.tsx          # 某一天的详情：打卡按钮 + 列表 + 补录
    CheckInRow.tsx        # 单条打卡记录，点击可编辑时间/备注/删除
    CalendarView.tsx      # 月历视图：每天打卡次数、左右滑动切月、点标题跳转年月
    StatsView.tsx         # 统计页：概览/分析 两个子栏目
    AnalysisView.tsx      # 分析子栏目：规律性、趋势、聚类、季节性、分布图表
    HistoricalImport.tsx  # 统计页里的"导入历史数据"卡片（仅历史数据归属的分类可见）
    SyncBadge.tsx         # 同步状态指示
    charts/               # 图表组件（列图/折线/散点，统一样式，遵循 dataviz 设计规范）
  App.tsx  # Workspace（事件选择 ⇄ AppShell）+ AppShell 内三个 Tab：今日 / 日历 / 统计
```

### 2.2 同步是怎么工作的

1. 每次本地增删改（`useCheckins` 里的方法）都会把记录标记 `dirty: true`，并调用 `requestSync()`（800ms 防抖）
2. `syncNow(userId)`：
   - **push**：把所有 `dirty` 的本地记录 `upsert` 到 Supabase 的 `checkins` 表，成功后清除 `dirty` 标记
   - **pull**：拉取 `updated_at` 大于上次同步时间的远程记录，写入本地（如果本地同一条正在等待推送且更新，则跳过，避免覆盖未推送的修改）
3. 触发时机：登录后立即同步一次；每 30 秒轮询一次；浏览器 `online` 事件触发一次；任意本地写入后触发一次（防抖）
4. 删除是软删除（`deleted: true` 字段），保证删除动作也能正常同步到其它设备，不会被同步逻辑复活

### 2.3 历史数据导入是怎么工作的

- 数据源：旧的打卡记录表格（Excel），只有每天的打卡**次数**，没有具体时间
- 导入时给每天的记录在 8:00–22:00 之间均匀生成时间点，备注统一写 `历史导入`
- 已有真实记录的日期会自动跳过，不会重复计数
- 只需在"统计 → 概览"里点一次"导入历史数据"，本地会记一个标记（`historicalImportDone`），之后不会重复出现
- **分析时的处理**：日期本身是真实的，所以星期分布、月度趋势、季节性等按日期的分析仍然包含这些记录；但"时段分布"（按小时）会排除标了 `历史导入` 备注的记录，因为那部分时间是估算生成的，不是真实打卡时间

### 2.4 多事件（分类）是怎么工作的

- **数据模型**：新增 `categories` 表（id、名称、排序、软删除、同步用的 dirty/updatedAt），`checkins` 加一个 `categoryId` 字段。分类和打卡记录走同一套本地优先 + 同步机制
- **导航方式**：登录后先进"选择事件"页（`CategoryPicker`），选中某个事件才进入它自己的 今日/日历/统计 三个 Tab；页头点击标题可"切换事件"回到选择页。不同事件之间的数据完全独立，UI 组件本身不需要感知"当前是哪个分类"，只是从上层拿到已经按 categoryId 过滤好的数据
- **首次迁移**（`useCategories.ts` 里的 `ensureDefaultCategories`）：这个功能是后加的，所以第一次运行时会自动创建两个占位分类（事情A / 事情B），并把所有"迁移前就存在、没有 categoryId"的打卡记录全部归到事情A（因为用户确认历史数据都属于同一个事件）。只执行一次（本地 `categoryMigrationDone` 标记），用一个模块级单例 Promise 防止 React StrictMode 双重调用导致重复创建分类（开发时真实复现过这个问题）
- **历史数据导入的归属**：`HistoricalImport` 组件只在"历史数据所属的那个分类"（`legacyCategoryId`，迁移时记在 meta 里）下才会显示，导入的记录也只写入这个分类，不会因为切换分类而导错地方

---

## 3. 技术选型

| 环节 | 选项 | 状态 |
|---|---|---|
| 云端同步方案 | 云端数据库(Supabase) / 自建服务器 / 纯本地+网盘同步 | ✅ 云端数据库(Supabase)——免费、不用自己管服务器 |
| 使用形式 | PWA / 原生 App+网页 | ✅ PWA——一套代码手机 PC 通用，可离线，开发维护成本最低 |
| 本地存储 | IndexedDB(Dexie) / localStorage | ✅ Dexie——支持结构化查询和响应式（liveQuery），localStorage 容量/查询能力不够 |
| 认证 | Supabase Auth 邮箱密码 / 第三方 OAuth | ✅ 邮箱密码——个人单用户场景最简单 |
| 部署平台 | Vercel / Cloudflare Pages / Netlify | ✅ Vercel——连 GitHub 自动部署，免费额度够用 |
| 图表方案 | 自绘 SVG / 引入 recharts 等图表库 | ✅ 自绘 SVG 组件（`components/charts/`）——避免引入大依赖增加包体积，样式可完全按 dataviz 规范定制 |

---

## 4. 功能开发进度

### Phase 1：MVP ✅ 已完成（2026-09-22）

- [x] Supabase 建表 + RLS + Auth
- [x] 今日打卡（一键打卡、当天次数和时间列表、编辑/删除）
- [x] 日历视图（月历网格，每天显示打卡次数，点日期查看/补录）
- [x] 基础统计（今日/本月/总次数、打卡天数、连续天数）
- [x] 本地优先存储 + 云端双向同步，离线可用
- [x] PWA（可添加到主屏幕，含图标）
- [x] 部署上线（GitHub + Vercel）

**验收**：本人实际登录使用，手机/PC 数据同步正常

### Phase 2：日历导航优化 ✅ 已完成（2026-09-22）

- [x] 日历页左右滑动切换月份（触屏手势）
- [x] 点击月份标题弹出年/月选择面板，直接跳转

### Phase 3：历史数据导入 ✅ 已完成（2026-09-22）

- [x] 解析旧 Excel 表格（700 天 / 962 次记录）
- [x] 应用内一次性导入功能（走正常登录态写入，不需要管理员密钥）
- [x] 跳过已有记录的日期，避免重复计数
- [x] 仓库可见性确认（用户选择保持 Public，历史数据一并提交）

### Phase 4：统计升级为"概览+分析"两个子栏目 ✅ 已完成（2026-09-23）

- [x] 新增"使用天数"统计（从首次打卡到今天的自然日总数）
- [x] 规律性分析：活跃天数占比、平均打卡周期、最长间断
- [x] 月度趋势 + 最小二乘法线性回归（含下月预测）
- [x] 活跃度 K-Means 聚类（k=3，低/中/高）
- [x] 季节性分析（按日历月份跨年汇总，区别于按时间先后的月度趋势）
- [x] 星期分布、时段分布
- [x] 时段分布排除历史导入的估算时间（只统计真实打卡时间）

### Phase 5：图表可视化升级 ✅ 已完成（2026-09-23）

- [x] 遵循 dataviz 技能规范（`references/*.md`）：色彩按数据角色分配、mark 规格、legend、tap 交互
- [x] 聚类点阵图（散点图）：月度活跃度按低/中/高档位着色，横轴为时间
- [x] 月度趋势折线图：实际值 + 虚线回归拟合线，面积填充，端点直接标注数值
- [x] 统一样式的柱状图组件（季节性/星期分布/时段分布共用），替换早期的简易 div 柱状图
- [x] 图表可横向滚动（月份多时），Y 轴固定不跟随滚动
- [x] 点击图表元素显示数值（触屏友好，不依赖 hover）
- [x] 每个数据点/柱子上方常驻标注具体数值（用户反馈"看不出具体数字"后改的，不再只标最大值）

**产出**：`src/components/charts/`（`ColumnChart.tsx` / `LineChart.tsx` / `ScatterChart.tsx` / `Legend.tsx` / `YAxisTicks.tsx` / `scale.ts`）

### Phase 6：多事件（分类）打卡 ✅ 本地验证通过（2026-09-23），⬜ 待部署

- [x] 数据模型：新增 `categories` 表 + `checkins.categoryId`，走同一套同步机制
- [x] "选择事件"页（进系统先选事件，可新建/改名），选中后进入该事件独立的 今日/日历/统计
- [x] 页头"切换事件"入口，随时可以退回选择页
- [x] 首次迁移：自动建默认分类（事情A/事情B），旧数据（含历史导入的 962 条）全部归到事情A
- [x] 历史数据导入功能改为按分类归属显示/写入，不会导错事件
- [x] 修复了 React StrictMode 下migration 逻辑的竞态条件（会导致重复创建分类），改用模块级单例 Promise
- [x] 本地用 devuser 测试：新建/改名分类、跨分类数据隔离、历史导入归属，均验证通过
- [x] 加固多设备首次迁移竞态（迁移前先查云端）——但用户实测时已经在加固前碰到过一次，产生了真实的重复分类数据
- [x] "选择事件"页新增：每个事件显示打卡记录数、删除功能（输入名称二次确认），方便用户自己清理重复/多余的事件
- [x] "选择事件"页整体、以及今日页的"打卡"大按钮，都改为屏幕纵向居中，方便单手操作
- [ ] **待办**：用户需要在 Supabase SQL Editor 里执行 §5 的建表 SQL，然后**用新加的删除功能清理掉重复的分类**（保留有记录的那个，删掉 0 条记录的重复项），之后才算正式跑顺

---

## 5. 运行与部署

### 本地开发

```bash
npm install
npm run dev
```

需要 `.env.local`（不提交到仓库），配置项目自己的 Supabase：

```
VITE_SUPABASE_URL=https://gpttumvhbfdojnnkathi.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

### Supabase 建表 SQL（已执行，记录备查）

```sql
create table public.checkins (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  checked_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

alter table public.checkins enable row level security;

create policy "owner full access" on public.checkins
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index checkins_user_updated_idx on public.checkins(user_id, updated_at);
```

Authentication → Providers → Email 关掉了 "Confirm email"，注册后可直接登录。

### Supabase 迁移 SQL（Phase 6 多事件功能，**待用户执行**）

```sql
create table public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

alter table public.categories enable row level security;

create policy "owner full access" on public.categories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index categories_user_updated_idx on public.categories(user_id, updated_at);

alter table public.checkins add column category_id uuid references public.categories(id);
create index checkins_user_category_idx on public.checkins(user_id, category_id);
```

**必须先执行这段 SQL，再打开更新后的正式站点**，否则同步会报"找不到 categories 表"（本地数据不会丢，只是云端还同步不上，等 SQL 跑完打开一次就会自动补上）。

### 部署（已完成，日常不用再操作）

- 仓库：[github.com/caopu1212/checkin](https://github.com/caopu1212/checkin)（Public）
- 托管：Vercel，Import 该仓库、Framework 选 Vite，环境变量配了 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- 线上地址：`https://checkin-seven-omega.vercel.app/`
- 以后改代码只要 `git push` 到 `main` 分支，Vercel 会自动重新构建部署，不用手动操作

### PWA / 离线支持须知

- `vite-plugin-pwa` 生成的 Service Worker 只在生产构建中生效：`npm run build && npm run preview` 才能测试离线安装效果，`npm run dev` 不会注册 SW
- 离线时打卡记录会正常写入本地 IndexedDB 并显示在界面上，联网后自动同步；不会丢数据

---

## 6. 已知的简化 / 风险

- 冲突解决是简单的"最后写入者获胜"，没有处理同一条记录在两台离线设备上被分别修改后的合并（极端场景，个人使用概率很低）
- 图标是脚本生成的占位图（紫色圆底 + 对勾），想要更精致的图标可以自己换 `public/icon-192.png`、`public/icon-512.png`、`public/apple-touch-icon.png`
- Supabase 免费项目连续约 7 天无请求会自动暂停，需要去控制台手动 Restore（数据不会丢，只是需要手动点一下）
- 历史导入数据的打卡时间是估算生成的（非真实），已在"时段分布"分析里排除，但日历/今日视图里仍会显示这些估算时间，如果不想看到可以逐条编辑
- Bundle 体积 ~586KB（gzip ~170KB），构建时有 chunk 过大的警告；个人单页应用场景下可接受，暂未做代码分割

---

## 7. 决策日志

> 每做一个决定就在这里加一行，写清**决定了什么**和**为什么**。后悔时回来看。

| 日期 | 决策项 | 结论 | 理由 |
|---|---|---|---|
| 2026-09-22 | 同步方案 | ✅ Supabase 云端数据库 | 免费额度够用，不用自己管服务器，比纯本地+网盘同步更可靠 |
| 2026-09-22 | 使用形式 | ✅ PWA，非原生 App | 一套代码手机/PC 通用，离线支持够用，开发维护成本远低于原生 |
| 2026-09-22 | Git 托管可见性 | ✅ Public 仓库 | 用户明确表示"无所谓"，包括历史打卡数据一并提交 |
| 2026-09-22 | 历史数据导入方式 | ✅ 应用内功能，走正常登录态写入，不用 Supabase 密钥 | 系统拦截了直接用 secret key 写库的尝试（判定为凭据探测），改用更安全、也更简单的路径 |
| 2026-09-23 | 图表方案 | ✅ 自绘 SVG 组件，不引入图表库 | 包体积已有警告，且能完全按 dataviz 技能规范定制样式（色彩、交互、间距） |
| 2026-09-23 | 图表配色 | ✅ 数据用 dataviz 技能验证过的蓝色系，UI chrome 保持原有紫色 | 复用已验证的 CVD 安全配色用于图表数据编码，避免重新调色+验证的工作量，同时不改变 App 现有品牌观感 |
| 2026-09-23 | 多事件导航模式 | ✅ 进系统先选事件，再进各自独立的今日/日历/统计（不是"共享页面+分类筛选 Tab"） | 用户明确要求"进入系统后首先要选择事件"、"数据互相独立"，比筛选式 Tab 更符合"独立工作区"的心智模型，且几乎不用改动现有 Today/Calendar/Stats 组件内部逻辑 |
| 2026-09-23 | 历史数据归属 | ✅ 全部归到自动创建的"事情A"（占位名，用户可改名） | 用户确认"之前的打卡都是其中一个事件的"，先用占位名字，以后随时在应用里改 |
| 2026-09-23 | 删除事件的二次确认方式 | ✅ 输入事件名称确认（不是重新输入密码） | 用户要求"避免误触"，给了两个选项后用户选了输入名称确认——不用联网验证、离线也能用，和 GitHub 删仓库同款模式 |
| 2026-09-23 | "居中"需求的正确理解 | ✅ 整个选项列表在屏幕纵向居中，不是文字左右居中 | 第一次改错了方向（改成文字居中），用户纠正后才明白是要方便单手从屏幕中间去点，不是排版对齐问题 |

---

## 8. 开放问题 / 待确认

1. **PWA 图标**：现在是脚本生成的占位图，要不要设计一个更精致的图标？
2. **历史导入时间估算**：现在是 8:00–22:00 均匀分布，如果发现和实际习惯差异较大，要不要改成别的估算策略（比如更贴近星期分布/季节性反映出的模式）？
3. **Bundle 体积**：暂未做代码分割，如果以后加更多功能导致明显变慢，需要考虑 `dynamic import()` 拆分。
4. **事情A / 事情B 改名**：现在还是占位名字，等你确定了实际名字随时可以在"选择事件"页点"改名"。
5. ~~多设备并发建分类的边界情况~~：已修复——迁移前会先查一次云端有没有别的设备已经建过分类，有就直接采用，不会各建一套。**用户实测时确实先遇到了这个 bug（升级 SQL 还没跑就在两台设备上都打开了），出现了两组重复的"事情A/事情B"**，现在已经加了删除功能（带二次确认）可以自己清理掉多余的空分类——删除前会显示每个分类里有几条记录，方便确认哪个是要留的。
6. **事件数量变多后的选择页布局**：现在"选择事件"页是纵向列表，2-3 个正合适；如果以后事件明显变多，可能需要加排序/常用置顶/搜索。

---

## 9. 文档维护规则

**每次开发会话的流程**：

1. **开始时**：读本文档的「当前阶段」和第 4 节的进度表
2. **开发中**：
   - 做了决定 → 更新 [§7 决策日志](#7-决策日志)
   - 完成任务 → 在第 4 节对应 Phase 里勾选 `- [x]`，新功能开新 Phase
   - 发现新问题 → 加到 [§8 开放问题](#8-开放问题--待确认)
3. **结束时**：更新顶部「最后更新」日期和「当前阶段」，在 [§10 变更记录](#10-变更记录) 加一行

**给 AI 助手的提示**：本文档是项目上下文的入口。新会话开始时先读它，不要重新发明已经定过的决策。每次改动代码后，在结束这轮任务前必须回来更新本文档——不是写一次就不管了。

---

## 10. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-22 | 初版创建（DEVELOPMENT.md）：初始 MVP 完成，今日打卡/日历/统计三个 Tab，Supabase 云同步 + 离线本地存储，PWA，部署到 Vercel |
| 2026-09-22 | 日历支持左右滑动切月；点击月份标题可直接跳转年/月 |
| 2026-09-22 | 历史数据一次性导入功能（从旧表格导出的 700 天 / 962 次记录），跳过已有记录的日期避免重复计数 |
| 2026-09-23 | 统计页拆成"概览/分析"子栏目；新增使用天数统计；分析页加入规律性、月度趋势线性回归、K-Means 活跃度聚类、季节性（按日历月）、星期/时段分布；时段分布排除历史导入的估算时间 |
| 2026-09-23 | 图表可视化升级：按 dataviz 技能规范重做图表——聚类点阵图（散点）、月度趋势折线图（含回归拟合线）、统一样式柱状图组件，支持横向滚动和点击查看数值 |
| 2026-09-23 | 文档改版：`DEVELOPMENT.md` 迁移并扩展为 `PLAN.md`，采用带决策日志、开放问题、维护规则的更完整格式（对齐 meeting-copilot 项目的文档习惯） |
| 2026-09-23 | 图表改为每个数据点常驻标注数值（不再只标最大值/依赖点击），用户反馈"不标数字看不出是多少" |
| 2026-09-23 | 新增多事件（分类）打卡：数据模型加 `categories` 表 + `checkins.categoryId`，App 入口改为先选事件再进各自独立的今日/日历/统计；旧数据自动归到占位分类"事情A"。本地测试通过，待用户执行 Supabase 建表 SQL 后上线 |
| 2026-09-23 | 加固多设备首次迁移：建默认分类前先查云端是否已有分类（另一台设备可能已经建过），有就直接采用，避免两台设备各建一套 |
| 2026-09-23 | ~~选择事件页的事件名称居中显示~~：理解错了需求，用户要的是整个选项列表在屏幕纵向居中（方便单手够到），不是文字左右居中；已重做，见下一行 |
| 2026-09-23 | "选择事件"页整体在屏幕纵向居中；每个事件卡片新增打卡记录数显示 + 删除功能（删除需要输入事件名称二次确认，防止误触，参考 GitHub 删仓库的确认模式）；今日页的"打卡"大按钮同样改为纵向居中 |
| 2026-09-25 | 今日页新增"你已经 X 天没打卡了"提示（`daysSinceLastCheckIn`，按最近一次打卡到今天的自然日差算，当天已打卡则不显示） |
