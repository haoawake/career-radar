import { SOURCES,isTestPosting } from './sources';
import { workdayBase } from './connectors';
import type { Source } from './source-types';
// 注册表修正之后的数据整理。只删没有标记过的岗位；标记过（重点 / 已投递）的一律保留，显示为「来源已移除」。
const CHUNK=500;
// 先用 LIKE 粗筛出可能是测试岗位的标题，再交给 isTestPosting 精确判断
const TEST_LIKE=['test','uat','bug bash','do not apply','dummy','sample','demo'].map(w=>`title LIKE '%${w}%'`).join(' OR ');
async function drop(d:D1Database,ids:string[]){for(let i=0;i<ids.length;i+=CHUNK)await d.prepare('DELETE FROM jobs WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids.slice(i,i+CHUNK))).run()}
/**
 * 一轮更新完成后调用：删掉这个来源里不该再留着的旧岗位——招聘系统里的测试岗位，
 * 以及 Workday 来源改连新招聘站点后，旧站点收录的岗位（链接前缀不是当前站点）。
 * 两种都不会再出现在来源里，按普通下架处理只会在列表里留下一堆「来源已移除」。
 */
export async function pruneStale(d:D1Database,s:Source,run:string){
 const prefix=s.type==='workday'?workdayBase(s)+'/':'';
 const rows=(await d.prepare(`SELECT id,title,url FROM jobs WHERE source=?1 AND last_seen<>?2 AND starred=0 AND applied=0 AND ((?3<>'' AND substr(url,1,length(?3))<>?3) OR ${TEST_LIKE})`).bind(s.id,run,prefix).all<{id:string;title:string;url:string}>()).results||[];
 const ids=rows.filter(r=>(prefix&&!r.url.startsWith(prefix))||isTestPosting(r.title)).map(r=>r.id);
 await drop(d,ids);
 return ids.length;
}
let orphansChecked=false;
/**
 * 注册表里已经没有的来源（例如连错的测试账号被移除后）：没有标记的岗位删除，标记过的标为来源已移除，来源状态一并清掉。
 * 每个 Worker 实例只检查一次；jobs 按 source 有索引，取不重复的来源编号很快。
 */
export async function pruneOrphans(d:D1Database){
 if(orphansChecked)return 0;orphansChecked=true;
 const known=new Set(SOURCES.map(s=>s.id));
 const [jobs,states]=await Promise.all([d.prepare('SELECT DISTINCT source FROM jobs').all<{source:string}>(),d.prepare('SELECT id FROM sources').all<{id:string}>()]);
 const gone=(jobs.results||[]).map(r=>r.source).filter(x=>!known.has(x));
 for(const g of gone)await d.batch([d.prepare('DELETE FROM jobs WHERE source=? AND starred=0 AND applied=0').bind(g),d.prepare('UPDATE jobs SET active=0 WHERE source=?').bind(g)]);
 const stale=(states.results||[]).map(r=>r.id).filter(x=>!known.has(x));
 if(stale.length)await d.prepare('DELETE FROM sources WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(stale)).run();
 return gone.length;
}
