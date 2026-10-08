# Career Radar（职达）

自托管的求职工作台。直接从雇主官方的申请人跟踪系统（ATS）接口汇总美国科技岗位，为每个岗位提取级别与签证担保信号，并配套一个对 ATS 友好的简历编辑器。

[English](README.md) · [工程笔记](docs/engineering-notes.zh-CN.md)

**技术栈：** TypeScript · React 19（经 vinext / Vite 使用 Server Components）· Cloudflare Workers · D1（SQLite）· Drizzle 迁移 · Tailwind CSS 4 · shadcn/ui

---

## 项目动机

聚合类招聘网站转载滞后、跨站重复，决定一份申请值不值得投的关键信息也常常埋在正文里。Career Radar 改为直接对接数据源：轮询 672 家雇主自己的招聘系统，按官方岗位编号去重，并把两个问题变成一次筛选就能回答：**这个岗位的级别适合我吗？**（级别）以及**岗位描述里是否排除了签证担保？**（签证）

## 核心特性

| | |
|---|---|
| **672 个官方数据源** | 307 个 Workday 租户；企业级招聘系统上的 30 家（Oracle 招聘云上的 JPMorgan Chase、Goldman Sachs、American Express、Oracle、Dell 等 11 家，Eightfold 上的 Lockheed Martin、Qualcomm 等 6 家，以及 iCIMS Jibe、SAP SuccessFactors、Avature）；Amazon、Microsoft、Google、Apple、IBM、Atlassian、McKinsey 的自建招聘站；以及托管在 Greenhouse、Ashby、Lever、SmartRecruiters、Rippling 上的 328 个招聘板。其中 205 家标为精选大厂，可单独筛选。 |
| **可续传的增量同步** | 分页连接器配合租约锁、持久化游标和重复页指纹检测。一轮全量更新约 5,600 次上游请求，并发 8 时约 12 分钟完成。 |
| **带证据的信号提取** | 规则分类器从标题判断级别、从岗位描述判断签证限制，并保存每个判断所依据的原句，方便一眼核对。 |
| **基于 D1 的分面检索** | 地点归一化为州、40 个都会区和 294 个城市。约 13.7 万条数据下，列表查询耗时 18–30 ms。 |
| **简历工作台** | 结构化简历数据模型、三套单栏模板、通过打印样式导出 PDF。DOCX 由手写的 OOXML 加自研 ZIP/CRC32 编码器生成，因为 Workers 运行时没有可用的打包库。 |

## 系统架构

```
浏览器（React 客户端）
  │  刷新循环：8 个来源并发，可续传中断的更新
  ▼
/api/sync ──► 连接器 ──► Workday · Oracle 招聘云 · Eightfold · iCIMS Jibe · SuccessFactors · Avature
  │                      Greenhouse · Ashby · Lever · SmartRecruiters · Rippling
  │                      Amazon · Microsoft · Google · IBM · McKinsey · Apple / Atlassian（经本机 Node 中转）
  │   ├─ 归一化 → 职业与级别分类 → 地点解析 → 签证信号提取
  │   ├─ 列表不含描述时，按需调用详情接口补拉
  │   └─ 以（来源, 官方岗位编号）为键的幂等写入
  ▼
Cloudflare D1（SQLite） ◄── /api/jobs      每次请求两条查询：取行 + 计数
                        ◄── /api/overview  分面统计与来源状态，缓存 45 秒
```

### 数据采集管线

- **来源注册表。** Workday 租户通过各租户的 `robots.txt` 发现，再用其 CXS 接口验证；托管招聘板按公司名逐一对照各平台公开 API 核实（`scripts/make-registry.mjs`）。每家公司只保留一个来源，自建系统优先于托管招聘板，避免同一岗位重复收录。
- **注册表修正。** 按公司名猜招聘板地址，会漏掉 slug 与公司名对不上的雇主（DoorDash 是 `doordashusa`，Anduril 是 `andurilindustries`），有时还会连错：连到招聘系统的测试账号（Uber、LinkedIn）、子公司（连成了 Bloomberg Industry Group 而不是 Bloomberg L.P.），或者窄口径子站点（Meijer 的门店小时工站）。这些修正，以及自动发现覆盖不到的招聘系统上的雇主，都登记在 `scripts/registry-fixes.mjs`，`make-registry.mjs` 每次重新生成都会套用。接入新来源前，会用它的 `robots.txt` 核对连接器实际要请求的接口路径，并把 `Crawl-delay` 记到来源上。
- **连接器。** 每个平台一个适配器（`lib/connectors.ts`），把岗位映射成统一结构。Greenhouse 首次收录之后改用轻量列表（743 KB，带正文时为 9.4 MB），描述再按需补拉。Greenhouse 岗位的地点只写了办公形式（"Hybrid"、"Distributed"）时，改用所属办公室的地址，Cloudflare 因此从只认出 1 个美国岗位变成 215 个。招聘系统测试账号里的占位岗位（"Corporate UAT TEST JOB" 之类）在入库前过滤掉。
- **运行控制。** 每次 `/api/sync` 调用对所属来源持有 120 秒租约，在 20 秒预算内最多抓取 6 页，并保存游标。关闭页面或超时后，下次从中断处继续。如果来源重复返回同一页，本次运行会中止，而不是静默截断。要求了抓取间隔的来源（AMD、Rivian、DocuSign、PepsiCo 都是 5 秒）每次请求前都先等够，描述补拉也改为逐条发送。
- **岗位生命周期。** 在一次**完整**运行中消失的岗位会被软删除（标记为"来源已移除"），用户的标记保留。触及上游条数上限的运行（Workday 2,000 条、Amazon 10,000 条）会标记为不完整，不做任何下架判定。测试岗位、来源改连新站点后旧站点留下的岗位、以及已移出注册表的来源的岗位，只要没被标记过就直接删除。网页类连接器遇到解析不了的页面会报错、不结束本轮，页面改版或维护页不会让整家公司的岗位被标成下架。
- **限流策略。** 上游返回 403、429、5xx 时，按 `Retry-After` 或指数退避重试。描述补拉始终让位于列表分页：
  - 补拉请求遇到 429 不重试，并发也低于列表；
  - 任何请求（列表或详情）遇到 429，都会让所在站点群进入一分钟冷却，期间所有来源暂停补拉。

  Workday 的站点群按 `wdN` 集群划分，因为 287 个租户里有 241 个共用 `wd1` 和 `wd5`。这样一家雇主的补拉不会把另一家的列表分页拖进限流。

### 级别与签证信号

实现位于 `lib/job-signals.ts`。

- **级别（按标题）：** 实习 · 应届 / 入门 · 中级 · 资深及以上 · 未注明。能识别职级后缀（`Engineer II`、`SDE III`）和管培项目（*Rotational Program*、*Early Career*）；形似职级但并非职级的通用头衔，如 *Member of Technical Staff*、*Product Manager*，归为未注明。
- **签证（按描述）：** 需安全许可 · 限美国公民 / 绿卡 · 不提供担保 · 可提供担保 · 未提及。同时命中多类时取更严格的一类。
- **精确率优先于召回率。** 被错标为"资深"或"受限"的岗位会被过滤掉，用户根本看不到；漏判的代价只是多看一条。因此含义模糊的文本一律归为"未注明"或"未提及"，"排除"类筛选也会保留信号尚未计算出来的岗位。已规避的误判包括：
  - 安全许可写成加分项（*nice to have*）；
  - *Employee Polygraph Protection Act*（平权法案模板里的法律名称）；
  - *project sponsors*、*company-sponsored 401(k)*；
  - *deemed export control license*，指雇主会替候选人申请出口许可。
- **评估工具。** `scripts/eval-signals.mjs` 在数据库快照上重放规则：输出各类别分布，按类别对命中原句去重后抽样，并列出疑似漏判。在约 3 万条有描述的岗位上，结果为：不提供担保 3,529 条、限公民 / 绿卡 3,346 条、需安全许可 967 条、可提供担保 598 条。人工抽查未发现误判。

### 查询层

D1 会把同一请求内的语句串行执行，所以列表接口只发两条查询（取行、计数），全部分面统计放到单独带缓存的接口。在约 13.7 万条数据上实测：

- 页面加载：1,131 ms → 18 ms
- 切换地区：1,511 ms → 30 ms
- 关键词搜索：1,210 ms → 172 ms

用 `count(*) OVER ()` 合并成单条查询反而更慢（639 ms），因为窗口函数为了算总数要扫描全部匹配行。

## 实测结果

2026-09-23 全量更新后的筛选漏斗：

| 筛选条件 | 岗位数 |
|---|---:|
| 全部在招美国岗位 | 144,553 |
| 已归类职业（去掉零售、餐饮类门店岗位所在的"其他"） | 45,929 |
| + 排除资深 | 21,739 |
| + 排除签证受限 | 16,588 |
| + 仅正式岗位 | 15,287 |

## Windows / macOS 下载包

GitHub Release 提供两个启动包：

- `CareerRadar-win-x64.zip` — Windows 10/11（64 位）；解压到固定文件夹，双击 `Start-Career-Radar.cmd`。
- `CareerRadar-mac-universal.zip` — macOS Intel / Apple 芯片；解压到固定文件夹，双击 `Start-Career-Radar.command`。首次可能需要 Control+单击打开，或在终端执行 `zsh Start-Career-Radar.command`。

**注意：这是本地 Web 应用启动包，不是原生 EXE / DMG 应用。** 两个平台都需要预先安装 Node.js 22.13+。首次启动会安装依赖、初始化本地 D1 数据库，然后在终端显示访问地址；浏览器打开该地址使用。终端须保持运行。本地数据保存在解压目录的 `.wrangler/state`，请不要直接从临时下载目录运行，也不要在更新时删除旧目录里的该数据文件夹。

## 快速开始

需要 Node.js 22.13 或更高版本。

```bash
npm ci
npx wrangler d1 migrations apply DB --local --config wrangler.local.json
npm run dev
```

打开开发服务输出的本地地址。首次访问会自动更新 6 小时内未更新过的所有来源；中断的更新会在下次打开页面时继续。本地数据保存在 `.wrangler/state`，已被 git 忽略。

## 测试

| 命令 | 覆盖范围 |
|---|---|
| `npm test` | 50 项单元测试：每类连接器的解析（夹具按真实响应的结构构造，替换 `fetch` 离线运行）、`robots.txt` 规则、Apple 中转与 CSRF 会话、注册表约束与修正、地点解析、更新范围、简历渲染 / DOCX / ZIP，以及用真实岗位原文做用例的级别与签证规则 |
| `npx tsc --noEmit` | 类型检查 |
| `powershell -File tests/integration.ps1` | 针对运行中的开发服务：重复同步的幂等性、描述不被覆盖、标记持久化、地区与分类筛选、信号字段完整性，以及签证各类别恰好划分全集 |
| `node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/collect-live.mjs` | 对每个已注册来源做一次真实抓取 |
| `node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/eval-signals.mjs <sqlite 副本>` | 在整库上评估信号规则 |

## 目录结构

```
app/
  page.tsx                岗位雷达界面
  resume/                 简历工作台与打印视图
  api/                    路由处理：jobs、overview、sync、resumes
lib/
  connectors.ts           平台适配器、重试与冷却、详情补拉
  sources.ts              来源注册表、职业分类、归一化
  node-relay.ts           本机 Node 中转（给拒绝 Workers 运行时的站点用）
  prune.ts                注册表修正后的数据整理
  job-signals.ts          级别与签证规则
  job-query.ts            筛选条件 → SQL
  us-locations.ts         州 / 都会区 / 城市解析
  resume-*.ts, zip.ts     简历模型、渲染、导入、DOCX 与 ZIP 生成
db/schema.ts, drizzle/    数据库结构与迁移
scripts/                  来源发现与修正、robots.txt 检查、在线检查、规则评估
tests/                    单元测试与集成测试
docs/                     工程笔记
```

## 适用范围与已知限制

- **覆盖范围。** 来源并非全网覆盖。以下大厂是有意不接入的：Meta（`robots.txt` 声明自动收集需要书面许可）、Tesla（Akamai 拦截所有非浏览器客户端）、Uber 与 Citadel（Cloudflare 人机验证）、Walmart（`robots.txt` 禁止它的岗位接口，允许的办法只有逐页抓取 1.6 万个岗位页面）、Intuit、Synopsys、Charles Schwab、Seagate（列表接口被 `robots.txt` 禁止）、LinkedIn（岗位只在 linkedin.com 上，服务条款禁止抓取）、Costco（官网岗位几乎都是门店岗位）、Best Buy（需要模拟浏览器会话）。General Dynamics 的几个业务单元用的是老式 iCIMS 门户，还没有连接器。招聘板编号与公司名不一致、又不在修正表里的公司，仍可能被遗漏。
- **Apple 与 Atlassian。** 这两家都拒绝 Workers 运行时发出的请求，同一台机器用 Node 发同样的请求却正常返回。Apple 的触发条件是运行时给每个出站请求附加的 `CF-Worker` 请求头（之前误以为是 TLS 指纹）。本地开发时，这两个来源经 Vite 开发服务器上的中转发出：请求由这台电脑上的 Node 发出，不带运行时附加的 `cf-*` 头，也不伪装浏览器。中转只放行白名单里的域名，并校验每次启动时随机生成的令牌。部署到 Workers 上时没有这个中转，这两个来源会显示为不可用。
- **限流。** 部分 Eightfold 租户（Lockheed Martin、Boston Scientific）在请求过快时会临时封禁客户端 IP，Qualcomm 和 Microsoft 会返回 429。这些来源都设了逐个来源的请求间隔（1–3 秒，描述补拉也算在内），首次收录因此较慢：Lockheed 的 289 页要跑将近一个小时。万一仍被封，之后的更新会从游标处接着跑，期间保留已有岗位。
- **信号属于启发式判断。** 签证标签只反映岗位描述的措辞，不代表雇主的实际政策，也不代表任何申请人的资格。工作年限要求暂未解析。
- **描述补拉覆盖率。** 在列表不含描述的平台上，只为已归类职业的非资深岗位补拉描述。一轮全量更新后，这部分 Workday 岗位的覆盖率为 50%，之后每轮更新都会继续提高。
- **单用户。** 数据库是个人工作区，没有按用户隔离数据。
- **不自动投递。** 应用只链接到官方岗位页面，不会代为提交申请，也不会把打开链接视为已投递。

## 数据使用原则

所有数据都来自雇主公开的招聘接口，也就是其招聘页面自身加载的同一份 JSON（SuccessFactors 与 Avature 则是同一份服务端渲染的列表页）。项目不访问需要登录、付费或身份验证的内容。接入来源前会用 `robots.txt` 核对连接器实际请求的路径，并遵守 `Crawl-delay`；请求遵循 `Retry-After`，出错时退避，上游开始限流时主动降低补拉频率。任何人机验证（Cloudflare、Akamai、Azure WAF）都不绕过，挂着这类验证的站点不接入。

## 后续规划

- 基于大模型、对照结构化简历的匹配度评分，只作用于筛选后的候选岗位
- 投递流程状态跟踪（已投递 → 笔试 → 面试 → offer），并记录每次投递使用的简历版本
- 从岗位描述中提取工作年限要求
