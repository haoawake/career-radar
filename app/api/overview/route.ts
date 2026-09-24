import { db } from '@/lib/db';
import { SOURCES } from '@/lib/sources';
import { readFilters,baseClause,locationClause,whereOf } from '@/lib/job-query';
// 统计、来源状态与地区分面都要扫全表，而且 D1 串行执行，放进列表请求会让每次翻页和标记都等一秒。
// 这里单独提供，并按筛选条件缓存一小段时间：这些数字是给筛选器和侧栏看的，稍有延迟不影响使用。
type Cached={at:number;body:unknown};
const CACHE=new Map<string,Cached>();
const TTL=45000;
export async function GET(r:Request){try{
 const url=new URL(r.url),raw=readFilters(url.searchParams);
 // 分面只跟来源分类与地区有关，不跟关键词、职业这些走：否则每敲一个字都要重算一次全表统计。
 // 代价是下拉里的数字表示“该分类该地区一共有多少岗位”，不随其他筛选变化——这样也更稳定好懂。
 const f={...raw,q:'',role:'',kind:'',view:'',company:''};
 const key=JSON.stringify([f.group,f.metro,f.city]);
 const hit=CACHE.get(key);
 if(hit&&Date.now()-hit.at<TTL&&url.searchParams.get('fresh')!=='1')return Response.json(hit.body,{headers:{'Cache-Control':'no-store','Server-Timing':'cache;dur=0'}});
 const d=db(),t0=Date.now();
 // 地区分面要排除地点条件本身，这样切换地区时仍能看到其他地区各有多少岗位。
 const {clauses:base,values:baseValues}=baseClause(f);
 const cityClauses=[...base],cityValues=[...baseValues];locationClause(f.metro,'',cityClauses,cityValues);
 const regionClauses:string[]=[],regionValues:unknown[]=[];locationClause(f.metro,f.city,regionClauses,regionValues);
 const [states,counts,metroRows,cityRows,regionRows]=await Promise.all([
  d.prepare('SELECT * FROM sources').all<any>(),
  d.prepare('SELECT source,count(*) AS total,sum(starred) AS starred,sum(applied) AS applied,sum(CASE WHEN first_seen>=? THEN 1 ELSE 0 END) AS fresh FROM jobs GROUP BY source').bind(new Date(Date.now()-86400000).toISOString()).all<any>(),
  d.prepare('SELECT metros,remote,count(*) AS n FROM jobs'+whereOf(base)+' GROUP BY metros,remote').bind(...baseValues).all<any>(),
  d.prepare('SELECT cities,count(*) AS n FROM jobs'+(cityClauses.length?whereOf(cityClauses)+' AND ':' WHERE ')+'cities IS NOT NULL GROUP BY cities').bind(...cityValues).all<any>(),
  regionClauses.length?d.prepare('SELECT source,count(*) AS n FROM jobs WHERE '+regionClauses.join(' AND ')+' GROUP BY source').bind(...regionValues).all<any>():Promise.resolve({results:[]as any[]}),
 ]);
 const rows=counts.results||[];
 const stats={total:0,starred:0,applied:0,fresh:0,company:0,platform:0};
 for(const c of rows){stats.total+=c.total;stats.starred+=c.starred;stats.applied+=c.applied;stats.fresh+=c.fresh;const g=SOURCES.find(s=>s.id===c.source)?.group;if(g==='company'||g==='platform')stats[g]+=c.total}
 const tally=(list:any[],field:string)=>{const out:Record<string,number>={};for(const row of list)for(const id of String(row[field]||'').split('|').filter(Boolean))out[id]=(out[id]||0)+row.n;return out};
 const metroCounts=tally(metroRows.results||[],'metros');
 metroCounts.remote=(metroRows.results||[]).filter((x:any)=>x.remote).reduce((n:number,x:any)=>n+x.n,0);
 const body={stats,metroCounts,cityCounts:tally(cityRows.results||[],'cities'),regionCounts:Object.fromEntries((regionRows.results||[]).map((x:any)=>[x.source,x.n])),
  sources:SOURCES.map(s=>{const c=rows.find((x:any)=>x.source===s.id);return {id:s.id,name:s.name,type:s.type,group:s.group,tier:s.tier||'other',careerUrl:s.careerUrl,scope:s.scope,...(states.results||[]).find((x:any)=>x.id===s.id),jobCount:c?.total||0,markedCount:(c?.starred||0)+(c?.applied||0)}})};
 CACHE.set(key,{at:Date.now(),body});
 if(CACHE.size>40)for(const k of [...CACHE.keys()].slice(0,20))CACHE.delete(k);
 return Response.json(body,{headers:{'Cache-Control':'no-store','Server-Timing':`overview;dur=${Date.now()-t0}`}});
 }catch(e){console.error(e);return Response.json({error:'读取统计失败'},{status:500})}}
