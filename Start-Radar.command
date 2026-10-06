#!/bin/bash
# Career Radar 一键启动（macOS）：在访达里双击这个文件即可。
# 第一次运行会安装依赖、建好本地数据库；之后每次直接启动，并自动用浏览器打开。
# 服务跑在这个终端窗口里：关掉窗口或按 Control-C 就停止。

cd "$(dirname "$0")" || exit 1
# 双击打开时终端不一定读过 Homebrew 的环境：常见的 Node 安装位置补在最后，不改变已有的优先顺序
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"

fail() {
  printf '\n✗ %s\n\n' "$1"
  read -n 1 -s -r -p "按任意键关闭窗口…"
  echo
  exit 1
}

if ! command -v node > /dev/null 2>&1; then
  open "https://nodejs.org/zh-cn/download"
  fail "没有找到 Node.js。已经打开了下载页面：装好 22.13 或更新的版本（选 LTS），再双击这个文件。"
fi
node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 13) ? 0 : 1)' ||
  fail "Node.js 版本太旧（现在是 $(node -v)），需要 22.13 或更新的版本：https://nodejs.org/zh-cn/download"

# 第一次运行，或者更新了代码（package-lock.json 比已装的依赖新）时才装依赖
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "正在安装依赖，第一次需要几分钟…"
  npm ci || fail "依赖安装失败，请检查网络后再双击一次。"
fi

# 每次都跑一遍：已经建好的表会跳过，更新后新增的表会补上。
# 标准输入接 /dev/null，wrangler 就不会停下来等确认
echo "正在准备本地数据库…"
npx wrangler d1 migrations apply DB --local --config wrangler.local.json < /dev/null ||
  fail "本地数据库初始化失败，上面的输出里有原因。"

echo "正在启动 Career Radar，准备好后会自动打开浏览器…"
opened=""
npm run dev 2>&1 | while IFS= read -r line; do
  printf '%s\n' "$line"
  if [ -z "$opened" ]; then
    # 端口被占用时开发服务器会换一个，所以从它的输出里取实际地址
    url=$(printf '%s' "$line" | sed -E $'s/\x1b\\[[0-9;]*m//g' | grep -oE 'http://(localhost|127\.0\.0\.1):[0-9]+' | head -n 1)
    if [ -n "$url" ]; then
      opened=1
      open "$url"
    fi
  fi
done
