import { db,sameOrigin } from '@/lib/db';
import { SOURCES } from '@/lib/sources';
import { fetchPage,fetchDescriptions,type Job } from '@/lib/connectors';
import { locationFields } from '@/lib/us-locations';
const PAGE_BUDGET_MS=20000;// 单次调用最多连续抓取多久，剩下的交给下一次调用继续
const DESCRIPTIONS_PER_RUN=120;// 每轮最多补多少条 Greenhouse 描述，剩下的下一轮继续，直到补齐
/** 首次收录某个 Greenhouse 来源时一次性带描述；之后改用轻量列表，只给缺描述的岗位单独补拉。 */
async function fillGreenhouseDescriptions(d:D1Database,source:string,jobs:Job[]){
 const rows=await d.prepare("SELECT id FROM jobs WHERE source=? AND description<>''").bind(source).all<{id:string}>();
 const filled=new Set((rows.results||[]).map(r=>r.id));
 const missing=jobs.filter(j=>!j.description&&!filled.has(j.id)).slice(0,DESCRIPTIONS_PER_RUN);
 if(!missing.length)return 0;
 const s=SOURCES.find(x=>x.id===source)!;
 const texts=await fetchDescriptions(s,missing.map(j=>j.id.slice(source.length+1)));
 let n=0;for(const j of missing){const text=texts.get(j.id.slice(source.length+1));if(text){j.description=text;n++}}
 return n;
}
/** 为历史遗留、已不在来源中的岗位补算地区字段，每次完成一轮补一批，避免长事务。 */
async function backfillLocations(d:D1Database,source:string,run:string){
 const stale=await d.prepare('SELECT id,location FROM jobs WHERE source=? AND last_seen<>? AND metros IS NULL AND remote=0 LIMIT 300').bind(source,run).all<{id:string;location:string}>();
 const rows=stale.results||[];if(!rows.length)return 0;
 const queries=rows.map(r=>{const f=locationFields(r.location);return d.prepare('UPDATE jobs SET cities=?,states=?,metros=?,remote=? WHERE id=?').bind(f.cities,f.states,f.metros,f.remote,r.id)});
 for(let i=0;i<queries.length;i+=40)await d.batch(queries.slice(i,i+40));
 return rows.length;
}
export async function POST(r:Request){
 if(!sameOrigin(r))return new Response('Forbidden',{status:403});let input:any;try{input=await r.json()}catch{return new Response('Invalid JSON',{status:400})}
 const s=SOURCES.find(x=>x.id===input.source);if(!s)return new Response('Unknown source',{status:400});
 const maxPages=Math.max(1,Math.min(10,Number(input.pages)||6));
 const d=db(),now=new Date().toISOString(),epoch=Date.now();await d.prepare('INSERT OR IGNORE INTO sources (id,status,lease_until) VALUES (?,?,0)').bind(s.id,'pending').run();
 const lock=await d.prepare('UPDATE sources SET lease_until=?,last_attempt=? WHERE id=? AND lease_until<?').bind(epoch+120000,now,s.id,epoch).run();if(!lock.meta.changes)return Response.json({busy:true,done:false},{status:202});
 const state:any=await d.prepare('SELECT * FROM sources WHERE id=?').bind(s.id).first();
 const continuing=state.run_started&&state.cursor>0&&Date.now()-Date.parse(state.run_started)<6*3600000;
 const run=continuing?state.run_started:now;
 let offset=continuing?state.cursor:0,expected=continuing?state.run_total:0,fingerprint=state.fingerprint,warning=continuing?state.warning:null,pages=0,count=state.run_count||0,total=expected;
 const deadline=Date.now()+PAGE_BUDGET_MS;
 try{
  // 一次调用里连续抓多页：Workday 每页固定 20 条，逐页往返会让几百个来源的更新慢得没法用。
  const light=s.type==='greenhouse'&&!!(await d.prepare('SELECT 1 AS n FROM jobs WHERE source=? LIMIT 1').bind(s.id).first<{n:number}>());
  let described=0;
  for(;;){
   const p=await fetchPage(s,offset,expected,{light});
   if(light)described+=await fillGreenhouseDescriptions(d,s.id,p.jobs);
   if(offset>0&&p.fingerprint&&p.fingerprint===fingerprint)throw Error('来源重复返回同一页，更新未完成，历史岗位已保留');
   warning=p.warning||warning;fingerprint=p.fingerprint;total=p.total;expected=p.total;
   const queries=p.jobs.map(j=>d.prepare('INSERT INTO jobs (id,source,company,title,location,url,description,role,kind,cities,states,metros,remote,first_seen,last_seen,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET title=excluded.title,location=excluded.location,url=excluded.url,description=CASE WHEN length(excluded.description)>0 THEN excluded.description ELSE jobs.description END,role=excluded.role,kind=excluded.kind,cities=excluded.cities,states=excluded.states,metros=excluded.metros,remote=excluded.remote,last_seen=excluded.last_seen,active=1').bind(j.id,j.source,j.company,j.title,j.location,j.url,j.description,j.role,j.kind,j.cities,j.states,j.metros,j.remote,run,run));
   for(let i=0;i<queries.length;i+=40)await d.batch(queries.slice(i,i+40));
   pages++;
   if(p.next===null){
    count=(await d.prepare('SELECT count(*) AS n FROM jobs WHERE source=? AND last_seen=?').bind(s.id,run).first<{n:number}>())?.n||0;
    const finish=[d.prepare('UPDATE sources SET status=?,last_success=?,count=?,cursor=0,run_started=NULL,run_total=?,run_count=?,warning=?,fingerprint=NULL,error=NULL,lease_until=0 WHERE id=?').bind(warning?'partial':'ok',new Date().toISOString(),count,p.total,count,warning||null,s.id)];
    if(!warning)finish.unshift(d.prepare('UPDATE jobs SET active=0 WHERE source=? AND last_seen<>?').bind(s.id,run));
    await d.batch(finish);
    const backfilled=await backfillLocations(d,s.id,run);
    return Response.json({done:true,count,pages,warning,backfilled,described});
   }
   offset=p.next;
   await d.prepare('UPDATE sources SET status=?,cursor=?,run_started=?,run_total=?,run_count=?,fingerprint=?,warning=?,error=NULL,lease_until=? WHERE id=?').bind('syncing',offset,run,p.total,count,fingerprint,warning||null,Date.now()+120000,s.id).run();
   if(pages>=maxPages||Date.now()>deadline)break;
  }
  count=(await d.prepare('SELECT count(*) AS n FROM jobs WHERE source=? AND last_seen=?').bind(s.id,run).first<{n:number}>())?.n||0;
  await d.prepare('UPDATE sources SET run_count=?,lease_until=0 WHERE id=?').bind(count,s.id).run();
  return Response.json({done:false,offset,total,count,pages,described});
 }catch(e:any){const error=String(e.name==='TimeoutError'?'请求超时，可再次更新继续收集':e.message).slice(0,250);await d.prepare('UPDATE sources SET status=?,error=?,lease_until=0 WHERE id=?').bind('error',error,s.id).run();return Response.json({error},{status:502})}
}
