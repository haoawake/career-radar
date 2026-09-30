# 工程笔记

> 开发过程中的设计取舍、实测数据、放弃的方案与验证记录，按模块整理。项目概览见 [README](../README.md) / [中文说明](../README.zh-CN.md)。

个人求职工作台。按地区、职业、实习类型、级别、签证限制、公司或关键词搜索，打开官方投递链接，保存重点与已投递标记。

## 来源与分类

来源分成两类，可在左侧单独切换：

- **公司自建招聘系统（344 家）**：307 家 Workday 企业招聘站；30 家用企业级招聘系统的公司——Oracle 招聘云 11 家（Oracle、JPMorgan Chase、Goldman Sachs、American Express、Dell、Texas Instruments、Honeywell、Ford、onsemi、Akamai、Fortinet）、Eightfold 6 家（Lockheed Martin、Qualcomm、Lam Research、Boston Scientific、NetApp、Starbucks；Microsoft 也用 Eightfold 的接口）、iCIMS Jibe 4 家（AMD、Rivian、DocuSign、PepsiCo）、SAP SuccessFactors 5 家（SAP、McDonald's、Paramount、Gulfstream、NASSCO）、Avature 4 家（Bloomberg、Electronic Arts、Two Sigma、Deloitte）；以及 Amazon、Microsoft、Google、Apple、IBM、Atlassian、McKinsey 七家单独实现的自建招聘站。
- **招聘平台托管职位（328 家）**：公司托管在 Greenhouse、Ashby、Lever、SmartRecruiters、Rippling 上的官方招聘板。

合计 672 家公司，全部走官方公开接口。同一家公司只保留一个来源，优先取自建系统，避免同一岗位重复收录。来源目录页会注明每家公司使用的系统类型、收录范围与最近更新时间。

另有一个按名单划分的「精选大厂」分类（205 家，含上面 7 家自建站），与前两类交叉。公司下拉框与来源目录按「大厂优先、岗位数从多到少」排序：原先按注册表顺序，四家自建站拼在六百多个来源的末尾，而下拉框不输入时只显示前 80 项，Google、Apple 永远轮不到；默认列表又按首次发现时间倒序，第一个 Google 岗位排在第 319 页，看起来就像没收录。

来源清单由 `scripts/` 下的探测脚本生成：Workday 站点通过各租户的 `robots.txt` 发现后用官方接口验证，招聘板通过平台公开 API 逐一核对公司名。重新生成用 `node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/make-registry.mjs`，生成时会套用 `scripts/registry-fixes.mjs` 里的人工修正（见下一节）。

## 注册表修正与新平台（2026-09-30）

起因是「Google、Apple 这些大厂都没看到」。排查下来是四类问题叠在一起：

- **有但看不见**：Google 其实一直在收录（1833 个在招美国岗位），被上面说的排序和下拉框截断埋住了。
- **被拦**：Apple 一直报 403。
- **连错**：按公司名猜招聘板地址，连到了招聘系统的测试账号（Uber 在 SmartRecruiters 上唯一的岗位叫 "Test UAT"，LinkedIn 在 Lever 上是 "BO Prim"、"Kritika Bug Bash Job 2"）、子公司（Bloomberg 连成了 Bloomberg Industry Group）、窄口径子站点（Chewy 连到兽医临时合同工站，Meijer 连到门店小时工站，Unilever、Invesco 连到校招站）。Hearst 的真实招聘板里混着 39 条 UAT 测试岗位。
- **没接入**：精选大厂名单里有 80 多家不在注册表。原因一是 slug 与公司名对不上（DoorDash 是 `doordashusa`，Anduril 是 `andurilindustries`，Wiz 是 `wizinc`，Hudson River Trading 是 `wehrtyou`）；二是用的招聘系统此前没有连接器。

修正都登记在 `scripts/registry-fixes.mjs`（补登、改连、改名、移除、换平台），单独运行即可联网核实并写回注册表，`make-registry.mjs` 重新生成时也会套用。新平台每家怎么接、有什么坑：

- **Oracle 招聘云**（11 家）：`recruitingCEJobRequisitions` 公开接口，按实例里 United States 地点分面的编号筛美国（各实例不同，注册时从不带筛选的一次查询里取），每页 100 条；地点筛选也会带回主地点在国外、次要地点在美国的岗位，按国家代码再判一次。列表只有简介，完整描述走 `recruitingCEJobRequisitionDetails` 补拉。Akamai、Honeywell、Amex 的品牌域名不转发接口，请求源站，链接用品牌域名；apply.ford.com 的证书链不完整，用源站。
- **Eightfold**：把 Microsoft 的 pcsx 接口改成通用连接器（host + domain），每页固定 10 条（原先的页数估算按 100 条算，低估了 10 倍）。NetApp 没开通 pcsx，用旧版 `/api/apply/v2`。Starbucks 美国两万个岗位里一万九千多个是门店岗位，只取门店以外的 14 个职位类别（393 个）；Lockheed Martin 五千多个里去掉生产制造与安保职能（约 2900 个）。
- **iCIMS Jibe**：`/api/jobs` 按国家筛，列表自带完整描述。PepsiCo 的美国岗位分在 "United States" 与 "USA" 两种写法下。
- **SuccessFactors / Avature**：只有服务端渲染的列表页。SuccessFactors 有表格行与卡片两种排版，同一个解析器处理；Avature 有的站点不写总数（Two Sigma、Deloitte），看分页链接里有没有更大的 `jobOffset` 决定是否还有下一页。两者都必须真的读到总数或岗位行，否则报错——单测里就抓到过一次：维护页没有总数标签时 `Number('')` 是 0，会被当成「共 0 个岗位、本轮完整结束」，把整家公司的历史岗位标成下架。
- **Workday**：Eli Lilly 在 wd115、Vertex 在 wd501，猜不中；Snap、Microchip 在共享域名 `myworkdaysite.com` 上，岗位链接要写成 `/recruiting/{tenant}/{board}`，套常规格式会 500。没有国家筛选项的租户改按办公地点筛，地点编号上限从 80 放宽到 300（Merck 119 个、Thermo Fisher 270 个都能用，Comcast 的 418 个会让接口报 500，这类退回逐条识别）；Moderna 的地点筛选项叫 `primarylocation`，岗位也不带地点文字，地点从链接里的 `/job/Norwood-Massachusetts/…` 取。是否按职能大类收窄改为看美国岗位数（原先看全球总数，Thermo Fisher 会被收窄到只剩实习）。
- **单独实现**：IBM（站内搜索接口，按 `_id` 排序，默认排序翻页会重复）、Atlassian（一次返回全部岗位）、McKinsey（一条岗位是一个岗位族，城市与国家是两个一一对应的数组）、Rippling（每个地点一行，按编号合并）。
- **Greenhouse 地点**：Cloudflare 399 个岗位里 300 个地点写的是 "Hybrid"、51 个 "Distributed"，美国识别只认出 1 个。改为地点只写办公形式时用所属办公室的地址；轻量列表不带办公室，这时补拉一次 `/offices` 对照表（多数招聘板用不上，不多请求）。扫全部 187 块板，这类岗位共 658 个。Lever 改用 `country` 字段判断美国。
- **测试岗位**：`isTestPosting` 只认很明显的写法（整条标题就是 Test/UAT、bug bash、this is a test、两侧都是连字符的 Test 段、全大写 TEST 夹在正常大小写标题里），Test Engineer、Test-Driven…、UAT Analyst、全大写的 SOFTWARE TEST ENGINEER 照常保留。
- **数据整理**（`lib/prune.ts`）：一轮更新完成后，删掉没被标记过的测试岗位、以及 Workday 来源改连新站点后旧站点留下的岗位（按链接前缀判断，改之前核对过全部 Workday 岗位的链接前缀都与当前站点一致）；移出注册表的来源，每个实例启动后清一次。Meijer 因此删掉 2729 条门店小时工岗位，Hearst 删掉 37 条测试岗位。upsert 顺带更新公司名，改过名的来源（Bloomberg Industry Group）已下架的旧岗位也跟着改。

**robots.txt 与抓取间隔**：新来源注册前用 `scripts/robots.mjs` 核对连接器实际要请求的接口路径（RFC 9309：只看 `User-agent: *` 组，最长匹配，同长时 Allow 优先）。Eightfold 的 robots.txt 先 `Disallow: /` 再 `Allow: /api/pcsx`，只看 Disallow 会误判。Zoom、Palo Alto Networks、Chewy、Snyk、Home Depot 禁止的是招聘板网页路径（`/Zoom/` 等），没有限制 `/wday/cxs/` 数据接口，按规则允许；Intuit、Synopsys、Schwab 的列表接口在被禁止的 `/search-jobs/` 下，Seagate 的在 `/services/` 下，Walmart 禁止 `/api`，这几家不接。`Crawl-delay` 记到来源的 `delay` 上（AMD、Rivian、DocuSign、PepsiCo 都是 5 秒），每次请求前都先等够，描述补拉也改为逐条发。

**限流实测**：Lockheed Martin、Boston Scientific 的 Eightfold 站点在列表翻页加 4 路并发补详情时，四十多秒就把本机 IP 整站封成 403（连不带任何特殊头的 Node 请求也 403），过一阵自动解除；Qualcomm 返回 429，1.5 秒间隔仍会触发；Microsoft 此前就时常 429，1 秒间隔也会触发。现在这几家都按间隔串行请求（Lockheed、Boston Scientific 1 秒，Microsoft 2 秒，Qualcomm 3 秒），描述补拉同样逐条按间隔发、每页只补几条。代价是首次收录慢：Lockheed 近 2900 个岗位要翻 289 页，首轮连同补描述要四五十分钟，之后的更新只补新岗位的描述。

**Apple 与 Atlassian**：Apple 的 403 不是 TLS 指纹——用 Node 复现，带上 workerd 给每个出站请求附加的 `CF-Worker: career-radar.example.com` 头就 403，去掉就 200（`cf-worker: localhost` 这种不像域名的值也能过）。本地开发时这两个来源改由 Vite 开发服务器上的 Node 中转发出（`lib/node-relay.ts`、`vite.config.ts`）：转发时去掉 `cf-*` 头，状态码与响应头（含 Apple 的 CSRF 令牌与 `Set-Cookie`）原样带回；只放行白名单域名，校验每次启动随机生成、经 Worker 环境变量下发的令牌；中转自己拒绝时用 421 并在响应头里注明原因，不和目标站点的 403 混在一起。Atlassian 带不带 `CF-Worker` 头用 curl 都是 200，但从 workerd 发出一律 403，具体按什么识别没有查清，经中转后正常。Apple 改用前端同款 JSON 接口（先取 CSRF 令牌与会话 cookie），每页约 37KB，原来的服务端渲染页要 330KB；请求体缺了 `format` 字段时它不报错而是返回 0 条，已改为 0 条即报错。另外，`vite.config.ts` 起初经 `node-relay.ts` 间接引用了注册表，而 Vite 会把配置文件的依赖都纳入监听，每改一次注册表就重启整个开发服务器，连续几次后 Cloudflare 插件内部的 runner 绑定丢失、所有请求 500，只能整个进程重启；现在 `node-relay.ts` 不引用任何应用代码，白名单与注册表的一致性由单测检查。

**Workday 游标越界**：Cisco、Wells Fargo 从 9 月 24 日起一直报错，原因是续跑期间岗位总数变少（1323 → 1279、1436 → 1341），游标越过了当前总数：Workday 这时要么返回空页，要么带着真实总数把第一页再给一遍，被判成「分页提前结束 / 重复返回同一页」，一直卡到续跑窗口过期。现在按不完整收尾、下一轮从头来。注意很多租户（Wells Fargo、NVIDIA、Zoom）只在第一页返回总数、后面每页都是 0，判断时只能用大于 0 的总数——第一版漏了这一条，Wells Fargo 从头跑时第二页就收了尾（标为不完整、没有下架任何岗位），已修正并补了单测。

## 地区筛选

- 岗位地点文本会解析成州、都会区与城市三级，写入岗位记录后用于筛选：40 个都会区（旧金山湾区、纽约、西雅图、洛杉矶、奥斯汀…）与约 250 个城市（旧金山、圣何塞、纽约、贝尔维尤…），另有“远程（美国）”一项。
- 一个岗位写了多个地点时会同时归入多个地区，选任一地区都能找到。
- 都会区与城市下拉里显示的是当前其他筛选条件下的岗位数量，可直接搜索中文或英文城市名。
- 地点写法无法定位到城市或州时（例如 Workday 的“3 Locations”、只写 Remote），岗位归入“其他美国地点”，不会从列表里消失。

## 级别与签证筛选

筛选栏有「级别」「签证」两项；职业下拉里的「全部已归类职业」会排除「其他」。来源里有不少零售、餐饮、医疗企业，门店岗位都落在「其他」里，按 9 月 10 日的库算占 69%（Domino's 一家就有 2.4 万条）。

- **级别**按标题判断，分实习、应届 / 入门、中级、资深及以上、未注明。
  - Senior / Staff / Principal / Lead / Director / Manager 等算资深。例外：Member of Technical Staff 是通用头衔，产品 / 项目经理不一定资深，Staff Accountant 是会计入门岗。
  - 职位名后的 I 算入门；II、III 算中级（Google 的 SWE III 就是中级，往宽了给）；IV 以上资深。
  - New Grad、Early Career、Associate、管培项目（Leadership / Rotational Program）等算应届。
- **签证**按岗位描述判断，分需安全许可、限公民 / 绿卡、不提供担保、可提供担保、未提及五类，还没有描述的归「暂无描述」。「排除签证受限」去掉前三类。同时命中多类时按更严格的算（安全许可隐含公民身份）。
- 每个签证判断都保存命中的原句：卡片上的签证标签悬停可看，展开岗位摘要顶部也会列出，方便核对规则有没有看错。
- 原则是宁可漏判也不误伤：被错判成资深或受限的岗位会被筛掉、根本看不到，漏判只是多看一条。所以拿不准的一律归「未注明 / 未提及」；「排除」类筛选也保留字段还没算出来的岗位。已处理的常见误读：
  - 安全许可写成加分项（nice to have / desired / not required, but a plus）不算；紧跟在条目后面的大写标题（"NICE TO HAVE:"）属于下一段，不当作修饰。
  - "Employee Polygraph Protection Act"、"project sponsors"、"company sponsored 401(k)"、"BIN sponsorship"、"does not sponsor personnel security clearances" 都不是签证限制。
  - "deemed export control license" 表示公司会替外籍员工申请许可，不算限制。
  - "We do sponsor visas! However, we aren't able to … for every role" 整体算提供担保；"If you don't have work authorization, we offer visa sponsorship" 不会被前半句的否定词带偏。
  - "Visa sponsorship may not be available in certain remote locations" 这类有条件的表述归未提及。
- 规则在 `lib/job-signals.ts`，测试用例都取自库里真实岗位原文（`tests/signals.test.mjs`）。改规则后可对整库重跑 `node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/eval-signals.mjs <D1 sqlite 副本> [抽样数]`：打印分布，按类别对命中原句去重后抽样，并列出「判为未提及、但签证词紧挨着 sponsor」的疑似漏判。
- 不看工作年限：标题没写级别、正文要求 7 年经验的岗位仍归「未注明」。

## 界面响应

- 重点/已投递标记先在本地生效再写库，失败会还原并提示；写库本身约 14ms，不再等待整页重新加载。
- 岗位列表与统计分面拆成两个接口：`/api/jobs` 只做取行与计数两条查询（13.7 万条数据下 18~30ms），`/api/overview` 负责统计、来源状态与地区分面，按「来源分类 + 地区」缓存 45 秒。
- 分面数字表示该分类该地区一共有多少岗位，不随关键词、职业等其他筛选变化，这样连续输入不会反复触发全表统计。

## 简历工作台

`/resume`，与岗位雷达在同一个应用里，顶栏可互相跳转。

- **多份简历按职业方向归档**：每份简历带一个方向标签（软件工程、AI / 机器学习、产品经理…），左栏按方向分组，可新建、复制、删除。
- **按经历类型编辑**：板块分工作/实习、教育、项目、技能、奖项、论文、自定义七类。选定类型后，编辑器只显示这类经历用得上的字段（教育经历没有「要点」，技能只有分类和条目），并直接写明它导出后长什么样。
- **导出规则固定且可测**：排版规则集中在 `lib/resume-render.ts` 的 `renderItem()`，组件只负责把结果画出来。同一类经历永远是同一套结构——实习经历必定是「公司 — 地点」右对齐时间、第二行斜体职位、下面项目符号；项目必定是「名称 · 角色」加技术栈行。留空的字段不会在 PDF 里留下空行。
- **排版**：尺寸全部用相对单位挂在 `.sheet` 的基准字号上，换模板只改字体与基准字号，纵向节奏自动跟着走。三套模板各自内部统一——经典是全衬线（Georgia，正文 10pt、页边距 0.72in），现代是全无衬线（Calibri，抬头左对齐、板块线用主题色），紧凑是无衬线收一档（页边距 0.55in、行距 1.30）。DOCX 的字体、字号、页边距与对应模板一一对应，界面选了哪套导出就是哪套。
- **导出 DOCX 与拖拽**：`/api/resumes/export?id=…` 直接返回 .docx，排版走的是和 PDF 同一套 `renderItem()` 规则，单栏、无表格、无文本框，方便 Workday / Greenhouse 这类 ATS 解析。文件名是「姓名_简历名.docx」，几份简历下载下来不会重名。
  - 编辑器里的「拖出 DOCX」可以按住直接拖到桌面或文件夹生成文件（靠 `DownloadURL`，Chrome / Edge 支持），再从那里拖进招聘网站的上传框。
  - **拖不到别的网站的上传框**：浏览器不允许一个网页把真实文件交给另一个站点的拖放目标，这是安全边界，代码绕不过去。同页面的上传框可以接住（`dataTransfer.items.add`）。
  - .docx 由 `lib/resume-docx.ts` 直接拼 OOXML、`lib/zip.ts` 手写 ZIP 打包（Workers 运行时没有打包库），不引入额外依赖。
- **导出 PDF**：`/resume/print?id=…` 是一张只有简历的页面，浏览器「打印 → 另存为 PDF」得到的就是预览所见。纸张支持 Letter 与 A4，`@page` 按所选纸型注入，多页内容正常分页。三套模板：经典衬线、现代无衬线、紧凑，都是单栏 ATS 友好排版。
- **反向导入**：粘贴或选择文件即可。本工具导出的 `.resume.json` 与 JSON Resume 标准格式可无损还原；从 PDF / Word 复制出来的纯文本走启发式解析，能认出板块标题、带日期的条目头、项目符号、`分类: 条目` 形式的技能行，并在导入后明确提示需要逐条核对。
- 编辑改动延迟 700ms 自动保存；单份简历 JSON 上限 400KB。

## 更新范围与限制

- 打开页面时自动更新最近 6 小时内没有成功更新过的来源；页面保持开启时每 15 分钟再检查一次。关闭页面后不会后台采集。
- **更新范围**可在标题右侧选择，按钮上会显示这次要更新的来源数与预估耗时：需要更新的来源 / 精选大厂（134 家名单）/ 当前地区的来源 / 当前来源分类 / 我标记过的公司 / 全部来源（强制重跑）。除“全部来源”外都会跳过 6 小时内更新过的来源。
- 一次更新一轮全量约 5600 次官方请求；并发 8、每次调用连抓 6 页，实测约 6.6 页/秒，全量约 14 分钟，只更新精选大厂约 5 分钟。中断后从上次停下的分页继续，不会重头再来。
- Greenhouse 来源首次收录时一次性带岗位描述，之后改用轻量列表（抓取+解析实测 8 个来源 1851ms → 637ms），只给新出现或还缺描述的岗位单独补拉详情，每轮最多补 120 条，剩下的下一轮继续。写库时空描述不会覆盖已有描述。
- Workday、SmartRecruiters、Microsoft 的列表接口从不带描述，岗位动辄几万条，所以只给**已归类职业里的非资深岗位**逐条调官方详情接口补拉（Workday `/wday/cxs/{租户}/{站点}/job/…`、SmartRecruiters `/v1/companies/{公司}/postings/{编号}`、Microsoft `/api/pcsx/position_details`），与 Greenhouse 共用每次调用 120 条的上限。签证判断最需要的正是这些岗位；其余岗位签证显示「暂无描述」，要看请点进官网。
- 详情补拉让着列表分页：详情接口遇到 403/404（岗位已下架）直接放弃、不重试；并发 4，比列表低。任何请求（列表或详情）遇到 429，该站点群一分钟内所有来源都停止补详情。站点群按 Workday 的 wdN 集群算（287 个租户里 241 个挤在 wd1、wd5 上，配额共用），其余平台按域名。起因：Microsoft 的列表和详情是同一站点，实测连续补拉会让随后的列表分页也 429、整个来源判为失败；加熔断后同一来源完整跑通（1221 条，途中触发一次熔断）。
- 升级后的第一轮要补积压（Workday 候选岗位约 1.1 万条），压力最大；之后每轮只需补新出现的岗位。补不完的留到下一轮，列表分页照常完成。
- 以来源与官方岗位 ID 唯一去重。同标题的不同官方编号保留为不同岗位，避免错误合并不同招聘需求。
- 首次发现时间不等于公司发布时间。“新发现”指首次收录后 24 小时内，首次使用时历史职位也会计入。
- 美国范围根据招聘地点与国家字段识别；仅写 Remote、Americas 或 North America 且没有明确美国信息的记录不收录，可能漏掉模糊地点职位。职业分类依据英文标题，提供关键词检索补充。
- 来源抓取失败保留已有记录，并单独显示失败。成功更新时已从来源消失的记录标为“来源已移除”，保留标记。
- 几百个来源一起更新时官方接口会短暂限流。遇到 403/429/502/503/504 会按 `Retry-After` 或退避重试 3 次，不把整个来源直接判为失败；一轮全量后出现的 53 个失败来源，重跑后恢复 52 个。
- **Apple、Atlassian 只在本地开发时收录**：这两家拒绝 Workers 运行时发出的请求（Apple 认的是 `CF-Worker` 请求头），本地开发时经 Vite 开发服务器上的 Node 中转（见「注册表修正与新平台」）。部署到 Workers 上没有中转，来源目录会直接说明原因。不伪装浏览器，不绕过人机验证。
- 不是全网覆盖。有意不接入的大厂：Meta（robots.txt 声明自动收集需书面许可）、Tesla（Akamai）、Uber 与 Citadel（Cloudflare 人机验证）、Walmart（robots.txt 禁止 `/api`，只剩逐页抓 1.6 万个岗位页一条路）、Intuit、Synopsys、Charles Schwab、Seagate（列表接口被 robots.txt 禁止）、LinkedIn（岗位只在 linkedin.com，服务条款禁止）、Costco（官网几乎全是门店岗位）、Best Buy（要模拟浏览器会话）、Postman（Greenhouse 板已下线，没找到新的）。General Dynamics 的 Mission Systems、Electric Boat 等业务单元在老式 iCIMS 门户上，还没写连接器。公司名与招聘板编号不一致、又不在修正表里的公司仍会漏掉。不保证所有岗位零遗漏。签证标签只是按描述原文做的规则识别，不代表公司的实际政策，也不判断个人申请资格。
- 网页展示岗位摘要，完整要求与岗位开放状态以官网为准。不自动提交简历，也不自动将打开链接视为完成投递。
- 部署默认仅本人访问；数据库是个人工作台的共享存储，不可直接改为公共多人使用，除非另行增加逐用户数据隔离。

## 本地运行

要求 Node.js >= 22.13。

1. `npm ci`
2. `npx wrangler d1 migrations apply DB --local --config wrangler.local.json`
3. `npm run dev`
4. 打开开发服务输出的本地地址。

数据保存在项目 `.wrangler/state`，请勿删除以免丢失本地标记。线上数据库和本地数据库相互独立。

首次接入地区筛选时，已有岗位的地区字段在下一次更新该来源时补齐；已从来源下架的历史岗位在该来源每次更新完成后分批补算。

级别与签证字段同理：迁移 `0005` 只加空列，已有岗位在该来源下一次完成一轮更新时补算（每次最多 4 秒，补不完下一轮继续）。所以升级后第一轮更新跑完之前，「排除资深」「排除签证受限」会保留大量还没算出字段的岗位，看起来像没筛掉多少，属于正常现象。

## 验证

- `npx tsc --noEmit`
- `npm test`（岗位来源、连接器、简历、级别与签证模块共 50 项单元测试；连接器测试按真实响应结构构造夹具、替换 `fetch`，不联网）
- `node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/eval-signals.mjs <D1 sqlite 副本>`：用整库真实岗位检验级别与签证规则（见「级别与签证筛选」）。
- `node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/collect-live.mjs`：对注册表里每个来源做一次真实抓取，报告失败来源与地区识别率。注意它跑在 Node 里，与 Workers 运行时不完全等价（Apple、Atlassian 即为例子），来源可用性以应用内状态为准。
- `node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/registry-fixes.mjs`：联网核实人工修正（探测 Workday 筛选项与 Oracle 美国地点编号、核对 robots.txt）并写回注册表，探测失败的来源会列出来。
- 启动本地服务后运行 `powershell -File tests/integration.ps1`：真实岗位重复抓取、稳定计数、地区与分类筛选、首次发现时间和两类标记持久化，以及同步后级别与签证字段齐全、签证各类别恰好划分全集、「排除」类筛选不会扩大结果；验证后恢复测试岗位原标记。
- `npm run build`

本次开发验证：603 个来源在 Node 下全部抓取成功，其中 Apple 在 Workers 运行时被 403 拦截、应用内无法收录；首页合计 26153 个美国岗位，地区识别到都会区 100%、识别到具体城市 67.2%；应用内 603 个来源实际跑到 575 个完整更新、2 个覆盖不完整、25 个分页更新中、1 个失败（Apple）；本地库 13.9 万个岗位下，旧金山湾区 12760 个、旧金山市 4984 个，两个分类岗位数之和等于总数；重复 Figma 更新未增加计数，岗位描述未被冲空，重点和投递标记均保留。数据会随招聘变化。
界面提速实测（13.7 万条岗位）：标记从 1.2 秒等待变为即时；打开与翻页 1131ms/1596ms → 18ms/25ms；切地区 1511ms → 30ms；关键词搜索 1210ms → 172ms；统计分面命中缓存 20ms。
根因是 D1 会把同一请求里的查询排队执行，原先每次请求都要跑 7 条含全表 GROUP BY 的查询。另外用 `count(*) OVER ()` 把取行与计数合并成一条是反效果：窗口函数为算总数扫完全部匹配行，实测 639ms，拆回两条各约 10ms。

更新提速实测：单来源连抓 6 页把本地 HTTP 调用从 11 次降到 2 次（耗时 6.1s→5.7s，上游延迟才是主因）；24 个真实 Workday 来源并发 8 跑出 6.6 页/秒，并发提到 12 与 16 均无提升（6.7 与 6.4 页/秒），因此并发定在 8。

以下加速手段实测无效或性价比不足，已放弃：Workday 每页请求超过 20 条直接返回 400；Greenhouse 的 `updated_after` 参数被忽略，仍返回全量；Workday 按州收窄只有 5/32 个租户提供州级筛选项；Workday 的 `searchText` 不能当地区筛选用（CVS Health 搜 California 只回 31 条、搜 San Jose 回 0 条）；D1 上的 FTS5 全文索引可用且计数从 158ms 降到 3ms，但连表取行仍要 95ms，端到端只从约 170ms 降到约 100ms，却要为每次岗位写入维护同步触发器，暂不引入。

级别与签证验证（2026-09-23，本地库）：
- 规则用 9 月 10 日的库整库检验（2.98 万条有描述），分布为：不提供担保 3529、限公民 / 绿卡 3346、需安全许可 967、可提供担保 598、未提及 21342。每类按命中原句去重后人工抽查，没有发现误判；最后剩 9 条疑似漏判，逐条看过都应判未提及。
- 应用迁移后按页面的方式跑了一轮全量（8 个来源并发）：598 个来源用时 12 分钟，补拉描述 8122 条，详情熔断 204 次；失败 49 个，其中 45 个是 Workday 列表分页 429，重跑两次后全部恢复。最终剩 4 个失败：Apple，以及 3 个招聘板已下线的来源（Postman 的 Greenhouse 板直接请求也是 404，另两个是 Shield AI、Iterable 的 Ashby 板）。README 此前记录的基线是一轮全量 53 个失败，这次量级相当。站点群冷却是这一轮跑完后才加的，还没有经过一次完整的全量检验。
- 全量后 14.46 万条在招岗位的筛选漏斗：全部已归类职业 45929 → 再排除资深 21739 → 再排除签证受限 16588 → 再只看正式岗 15287。已归类职业里应届 / 入门 1433 条、实习 1596 条。
- 候选岗位（已归类职业且非资深）的描述覆盖率：Workday 50.4%（5754 / 11412，其余留待后续几轮补齐），Microsoft 92.3%，Greenhouse 95.8%，SmartRecruiters、Ashby、Amazon、Google 100%。「排除签证受限」的实际效果会随 Workday 描述补齐继续变大。
- 集成测试在全量更新进行中跑通；`npm run build` 通过。页面只核对了服务端渲染出的筛选器与页脚文字；岗位卡片上的级别 / 签证标签与判断依据只经过 API 返回字段的验证，没做浏览器截图检查。

简历模块验证：26 项单测覆盖模板与导出一致性（三套模板的字体、页边距、抬头对齐互不相同，未知模板名回退到经典）、日期用制表位右对齐而非空格凑、 ZIP 与 DOCX 生成（含用已知值校验的 CRC32、包结构回读、XML 转义、纸张尺寸、文件名去重）、数据规范化、空白清理、时间区间、三种导入路径与每种经历的导出结构；对运行中的应用跑过一遍增删改查走查（新建 / 保存 / 读回 / 打印页渲染 / 超大内容返回 413 / 缺编号返回 400 / 查删不存在返回 404 / 越界请求后原内容完好 / 删除后不可查）。导出的四份 .docx 都用 Python 的 zipfile 与 XML 解析器复核过：ZIP 完整、5 个部件全部为合法 XML，抽取文本的顺序与 ATS 读到的一致。
简历排版只做了结构与规则层面的验证，没有做浏览器截图或实际打印检查，纸面观感请自行过目。

未做浏览器交互/截图检查；可选 WebMCP 搜索工具已实现，当前环境无可用合同验证上下文，未声称验证。
