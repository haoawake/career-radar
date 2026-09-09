# 职达 · 美国科技岗位雷达

个人求职工作台。按职业、实习类型、公司或地点搜索，打开官方投递链接，保存重点与已投递标记。

## 更新与范围

- 接入 Anthropic、Figma、Stripe、Discord、Databricks、Reddit、Airbnb、Cloudflare、OpenAI、Notion、Ramp、Perplexity 的 Greenhouse / Ashby 官方公开职位接口。
- 打开页面时自动更新；页面保持开启时每 15 分钟更新，也可手动更新。关闭页面后不会后台采集。
- 以来源与官方岗位 ID 唯一去重。同标题的不同官方编号保留为不同岗位，避免错误合并不同招聘需求。
- 首次发现时间不等于公司发布时间。“新发现”指首次收录后 24 小时内，首次使用时历史职位也会计入。
- 美国范围根据招聘地点与国家字段识别；仅写 Remote、Americas 或 North America 且没有明确美国信息的记录不收录，可能漏掉模糊地点职位。职业分类依据英文标题，提供关键词检索补充。
- 来源抓取失败保留已有记录，并单独显示失败。成功更新时已从来源消失的记录标为“来源已移除”，保留标记。
- 不是全网覆盖，尚未接入 Google、Microsoft、Amazon、Apple 等自建招聘系统；不保证所有岗位零遗漏，也不判断签证支持或个人申请资格。
- 网页展示岗位摘要，完整要求与岗位开放状态以官网为准。不自动提交简历，也不自动将打开链接视为完成投递。
- 部署默认仅本人访问；数据库是个人工作台的共享存储，不可直接改为公共多人使用，除非另行增加逐用户数据隔离。

## 本地运行

要求 Node.js >= 22.13。

1. `npm ci`
2. `npx wrangler d1 migrations apply DB --local --config wrangler.local.json`
3. `npm run dev`
4. 打开开发服务输出的本地地址。

数据保存在项目 `.wrangler/state`，请勿删除以免丢失本地标记。线上数据库和本地数据库相互独立。

## 验证

- `npx tsc --noEmit`
- `node --experimental-strip-types tests/sources.test.mjs`
- 启动本地服务后运行 `powershell -File tests/integration.ps1`：真实岗位重复抓取、稳定计数、首次发现时间和两类标记持久化；验证后恢复测试岗位原标记。
- `npm run build`

首次开发验证：12 个来源全部返回成功，2481 个美国岗位；重复 Figma 更新未增加计数，重点和投递标记均保留。数据会随招聘变化。
未做浏览器交互/截图检查；可选 WebMCP 搜索工具已实现，当前环境无可用合同验证上下文，未声称验证。
