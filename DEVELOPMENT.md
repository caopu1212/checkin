# 打卡 App — 开发文档

个人打卡记录应用。手机和 PC 通过同一个 Web App 访问，数据存 Supabase 云端并在本地缓存，支持离线打卡、联网后自动同步。

## 架构

- **前端**：Vite + React + TypeScript + Tailwind CSS v4，打包为 PWA（`vite-plugin-pwa`），可在手机浏览器"添加到主屏幕"当作 App 使用。
- **本地存储**：浏览器 IndexedDB（通过 [Dexie](https://dexie.org/)）。所有读写先落地本地，UI 始终读本地数据，天然支持离线。
- **云端**：[Supabase](https://supabase.com)（Postgres + Auth），免费额度够个人使用。
- **同步策略**：本地优先 + 定期/触发式双向同步（见下）。单用户场景，冲突处理用简单的“最后写入者获胜”（按 `updated_at` 比较），没有做复杂的 CRDT，足够用。

```
src/
  lib/
    types.ts      # CheckIn 类型
    supabase.ts   # Supabase client
    db.ts         # Dexie 本地数据库 schema
    sync.ts       # 推送/拉取同步逻辑 + 全局同步触发器
    date.ts       # 日期工具（日历网格、格式化）
    stats.ts      # 统计计算（连续天数、按天分组等）
  hooks/
    useAuth.ts       # Supabase Auth 会话
    useCheckins.ts   # 本地 CRUD（Dexie liveQuery，响应式）
    useSync.ts       # 挂载同步定时器 + online 事件监听
  components/
    Auth.tsx         # 登录/注册
    DayPanel.tsx      # 某一天的详情：打卡按钮 + 列表 + 补录
    CheckInRow.tsx    # 单条打卡记录，点击可编辑时间/备注/删除
    CalendarView.tsx  # 月历视图，每天显示打卡次数
    StatsView.tsx     # 统计卡片 + 近 14 天柱状图
    SyncBadge.tsx     # 同步状态指示
  App.tsx            # 三个 Tab：今日 / 日历 / 统计
```

## 同步是怎么工作的

1. 每次本地增删改（`useCheckins` 里的方法）都会把记录标记 `dirty: true`，并调用 `requestSync()`（800ms 防抖）。
2. `syncNow(userId)`：
   - **push**：把所有 `dirty` 的本地记录 `upsert` 到 Supabase 的 `checkins` 表，成功后清除 `dirty` 标记。
   - **pull**：拉取 `updated_at` 大于上次同步时间的远程记录，写入本地（如果本地同一条正在等待推送且更新，则跳过，避免覆盖未推送的修改）。
3. 触发时机：登录后立即同步一次；每 30 秒轮询一次；浏览器 `online` 事件触发一次；任意本地写入后触发一次（防抖）。
4. 删除是软删除（`deleted: true` 字段），保证删除动作也能正常同步到其它设备，不会被同步逻辑复活。

## 首次运行前需要做的事（只需一次）

### 1. 创建 Supabase 项目

去 [supabase.com](https://supabase.com) 用你自己的账号注册并新建一个项目（免费套餐即可）。这一步需要你自己在网页上完成。

### 2. 建表 + 开启行级安全

在 Supabase 控制台的 **SQL Editor** 里执行：

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

### 3. 关闭邮箱确认（可选，个人用更方便）

Supabase 默认注册后要求邮箱验证。个人用可以去 **Authentication -> Providers -> Email** 关掉 "Confirm email"，这样注册后能直接登录。

### 4. 配置本地环境变量

复制 `.env.example` 为 `.env.local`，填入你项目的 `Project URL` 和 `anon public` key（在 Supabase 控制台 **Settings -> API** 里找）：

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx
```

### 5. 安装依赖并启动

```bash
npm install
npm run dev
```

打开页面后用任意邮箱+密码注册一个账号（这就是你自己的登录账号，只有你能看到自己的数据）。

## 部署到公网（这样手机才能随时访问）

本地 `npm run dev` 只能在同一台电脑/同一局域网访问。要让手机随时能同步，需要把这个静态站点部署到一个公网地址，例如 [Vercel](https://vercel.com)（免费额度足够）：

1. 把这个项目推到 GitHub 仓库。
2. 在 Vercel 里 Import 这个仓库，Framework 选 Vite。
3. 在 Vercel 项目的 Environment Variables 里配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
4. 部署后拿到的域名，手机浏览器打开、登录、添加到主屏幕即可。

（这一步涉及创建 GitHub/Vercel 账号和推送代码，需要你自己操作，我可以在你需要时协助写部署脚本或排查报错。）

## PWA / 离线支持须知

- `vite-plugin-pwa` 生成的 Service Worker 只在生产构建中生效：`npm run build && npm run preview` 才能测试离线安装效果，`npm run dev` 不会注册 SW。
- 离线时打卡记录会正常写入本地 IndexedDB 并显示在界面上，联网后自动同步；不会丢数据。

## 已知的简化 / 后续可以做的事

- 冲突解决是简单的“最后写入者获胜”，没有处理同一条记录在两台离线设备上被分别修改后的合并（极端场景，个人使用概率很低）。
- 图标是脚本生成的占位图（紫色圆底 + 对勾），想要更精致的图标可以自己换 `public/icon-192.png`、`public/icon-512.png`、`public/apple-touch-icon.png`。
- 统计目前只有：今日/本月/总次数、打卡天数、当前连续天数、最长连续天数、近 14 天柱状图。如果想要更细的统计（比如按小时分布、周报），可以在 `src/lib/stats.ts` 里加。
