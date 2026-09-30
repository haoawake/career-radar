import { randomUUID, timingSafeEqual } from 'node:crypto';
import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, type Plugin } from 'vite';
import hostingConfig from './.openai/hosting.json';
import { RELAY_ERROR_HEADER, RELAY_HEADER, RELAY_HOSTS, RELAY_PATH } from './lib/node-relay';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding',
  'accept-encoding',
  'proxy-authorization',
  'proxy-connection',
]);

/**
 * 本机 Node 中转（原因见 lib/node-relay.ts），只挂在开发服务器上。
 * 校验本次启动生成的随机令牌，只转发 RELAY_HOSTS 里的 https 地址，不是开放代理。
 */
function nodeRelay(token: string): Plugin {
  const expected = Buffer.from(token);
  return {
    name: 'radar-node-relay',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(RELAY_PATH, async (req, res) => {
        // 中转自己拒绝时用 421 并注明原因，免得和目标站点返回的 403 混在一起、被当成限流反复重试
        const refuse = (reason: string) => {
          res.statusCode = 421;
          res.setHeader(RELAY_ERROR_HEADER, encodeURIComponent(reason)); // 响应头只能是 ASCII
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.end(reason);
        };
        const given = Buffer.from(String(req.headers[RELAY_HEADER] ?? ''));
        if (given.length !== expected.length || !timingSafeEqual(given, expected))
          return refuse('令牌不符，请重启开发服务器');
        let target: URL;
        try {
          target = new URL(new URL(req.url ?? '', 'http://relay').searchParams.get('url') ?? '');
        } catch {
          return refuse('目标地址无效');
        }
        if (target.protocol !== 'https:' || !RELAY_HOSTS.has(target.hostname))
          return refuse(`${target.hostname} 不在中转白名单里`);
        if (req.method !== 'GET' && req.method !== 'POST') return refuse(`不支持 ${req.method} 请求`);
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        // 请求头照 Worker 给的转发（Apple 的 CSRF 令牌与会话 cookie 就在里面），去掉逐跳头、中转令牌，
        // 以及 workerd 自动附加的 cf-* 头：本地开发时它会给每个出站请求加上 CF-Worker，
        // 而 jobs.apple.com 见到这个头就返回 403——请求其实是从这台电脑发出的，这个头只是本地运行时的模拟
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers))
          if (value !== undefined && !HOP_BY_HOP.has(name) && name !== RELAY_HEADER && !name.startsWith('cf-'))
            headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        try {
          const upstream = await fetch(target, {
            method: req.method,
            headers,
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
            signal: AbortSignal.timeout(25000),
          });
          // 状态码与响应头原样返回，Worker 那边的重试、限流冷却与会话逻辑照常生效。
          // Node 的 fetch 已经解压了正文，内容编码与长度头不能再带回去。
          res.statusCode = upstream.status;
          upstream.headers.forEach((value, name) => {
            if (!HOP_BY_HOP.has(name) && name !== 'set-cookie') res.setHeader(name, value);
          });
          const cookies = upstream.headers.getSetCookie();
          if (cookies.length) res.setHeader('set-cookie', cookies);
          res.end(Buffer.from(await upstream.arrayBuffer()));
        } catch (e) {
          refuse(`Node 请求失败：${String((e as Error)?.message ?? e)}`);
        }
      });
    },
  };
}

export default defineConfig(async ({ command }) => {
  // 中转令牌每次启动开发服务器时重新生成，经 Worker 环境变量传给 /api/sync；构建产物里没有它。
  const relayToken = command === 'serve' ? randomUUID() : '';
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      // 放在最前面：中转端点要先于 vinext 与 Cloudflare 插件的请求处理
      ...(relayToken ? [nodeRelay(relayToken)] : []),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: relayToken
          ? { ...localBindingConfig, vars: { NODE_RELAY_TOKEN: relayToken } }
          : localBindingConfig,
      }),
    ],
  };
});
