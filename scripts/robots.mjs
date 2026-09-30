// robots.txt 解析（RFC 9309 的常用子集），接入新来源前用来确认实际要请求的接口路径是否允许抓取：
// 只看 User-agent: * 那一组；Allow 与 Disallow 取最长匹配，一样长时 Allow 优先；支持 * 通配与结尾的 $；
// 另外读出 crawl-delay（秒），注册时记进来源的 delay，更新时翻页照这个间隔。
// 没有 robots.txt、或者对它返回 4xx（myworkdaysite.com 就是 422）的站点，视为不限制。
const cache=new Map();
function pattern(p){const end=p.endsWith('$');const body=(end?p.slice(0,-1):p).split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');return new RegExp('^'+body+(end?'$':''))}
export function parseRobots(text){
 const rules=[];let delay=0,applies=false,inAgents=false;
 for(const raw of text.split(/\r?\n/)){
  const m=raw.replace(/#.*/,'').trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);if(!m)continue;
  const key=m[1].toLowerCase(),value=m[2].trim();
  // 连续的几行 User-agent 属于同一组；规则之后再出现 User-agent 就是新的一组
  if(key==='user-agent'){if(!inAgents)applies=false;applies=applies||value==='*';inAgents=true;continue}
  inAgents=false;if(!applies)continue;
  if((key==='allow'||key==='disallow')&&value)rules.push({allow:key==='allow',path:value,re:pattern(value)});
  else if(key==='crawl-delay'&&Number(value)>0)delay=Number(value)*1000;
 }
 const allows=path=>{let best=null;for(const r of rules)if(r.re.test(path)&&(!best||r.path.length>best.path.length||(r.path.length===best.path.length&&r.allow)))best=r;return !best||best.allow};
 return {allows,delay};
}
export async function robotsFor(host){
 if(!cache.has(host))cache.set(host,fetch(`https://${host}/robots.txt`,{signal:AbortSignal.timeout(20000)}).then(async r=>parseRobots(r.ok?await r.text():'')).catch(()=>parseRobots('')));
 return cache.get(host);
}
/** 确认 robots.txt 允许请求这个接口路径，返回它要求的抓取间隔（毫秒，没有要求时为 0）。 */
export async function checkRobots(host,path){
 const robots=await robotsFor(host);
 if(!robots.allows(path))throw Error(`${host} 的 robots.txt 禁止抓取 ${path}`);
 return robots.delay;
}
