// 本机 Node 中转：个别招聘站（Apple、Atlassian）拒绝 Workers 运行时（workerd）发出的请求，同一台机器用 Node 请求却正常返回。
// Apple 认的是运行时给每个出站请求附加的 CF-Worker 请求头；中转转发时去掉 cf-* 头。
// 开发环境下 vite.config.ts 在 Vite 开发服务器（Node 进程）上挂一个端点，Worker 把这些站点的请求交给它代发。
// 这不是伪装浏览器：请求头与直连时相同，只是换成 Node 自带的 HTTP 客户端。生产环境没有这个端点，照旧直连。
// 这个文件会被 vite.config.ts 引用，不要从这里引入注册表等应用代码：配置文件的依赖一改，Vite 就会重启整个开发服务器。
export const RELAY_PATH='/__radar/relay';
export const RELAY_HEADER='x-radar-relay';
/** 中转自己拒绝请求时（令牌不符、域名不在白名单、Node 请求失败）带上的原因头，状态码 421。 */
export const RELAY_ERROR_HEADER='x-radar-relay-error';
/**
 * 允许中转的域名，只放标了 via: node 的来源，端点不会变成任意转发的开放代理。
 * 与注册表的一致性由 tests/sources.test.mjs 检查。
 */
export const RELAY_HOSTS=new Set(['jobs.apple.com','www.atlassian.com']);
export type Relay={origin:string;token:string};
/**
 * Worker 访问中转端点用的地址。开发服务器只监听 IPv4 回环地址时，localhost 可能先被解析成 ::1 而连不上，统一换成 127.0.0.1。
 */
export function relayOrigin(requestUrl:string){const u=new URL(requestUrl);if(u.hostname==='localhost')u.hostname='127.0.0.1';return u.origin}
/** 经中转发出请求；没有中转时直接请求。 */
export function send(url:string,init:RequestInit,relay?:Relay){
 if(!relay)return fetch(url,init);
 const headers=new Headers(init.headers);headers.set(RELAY_HEADER,relay.token);
 return fetch(`${relay.origin}${RELAY_PATH}?url=${encodeURIComponent(url)}`,{...init,headers});
}
