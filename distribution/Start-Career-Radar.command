#!/bin/zsh
set -e
cd "${0:A:h}"
echo "[Career Radar] macOS launcher"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22.13 or newer from https://nodejs.org/"
  read "?Press Return to close..."
  exit 1
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'; then
  echo "Node.js 22.13 or newer is required."
  read "?Press Return to close..."
  exit 1
fi
if [[ ! -f node_modules/.package-lock.json ]]; then
  echo "Installing dependencies on first launch..."
  npm ci
fi
echo "Preparing local database..."
npx --no-install wrangler d1 migrations apply DB --local --config wrangler.local.json
echo "Starting Career Radar. Open the local URL printed below in your browser."
echo "Press Control+C to stop."
npm run dev
