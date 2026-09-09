import { db, sameOrigin } from '@/lib/db';
import { SOURCES, normalize } from '@/lib/sources';
export async function POST(r:Request){
 if(!sameOrigin(r))return new Response('Forbidden',{status:403});
 let input:any;try{input=await r.json()}catch{return new Response('Invalid JSON',{status:400})}
 const source=SOURCES.find(s=>s.id===input.source);if(!source)return new Response('Unknown source',{status:400});
 const d=db(),now=new Date().toISOString(),epoch=Date.now();
 await d.prepare('INSERT OR IGNORE INTO sources (id,status,lease_until) VALUES (?, ?, 0)').bind(source.id,'pending').run();
 const lock=await d.prepare('UPDATE sources SET lease_until=?, last_attempt=? WHERE id=? AND lease_until<?').bind(epoch+120000,now,source.id,epoch).run();
 if(!lock.meta.changes)return Response.json({status:'already_running'},{status:202});
 try{
 const url=source.type==='ashby'?`https://api.ashbyhq.com/posting-api/job-board/${source.id}`:`https://boards-api.greenhouse.io/v1/boards/${source.id}/jobs?content=true`;
 const response=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{Accept:'application/json'}});
 if(!response.ok)throw Error(`官方来源暂时不可用 (HTTP ${response.status})`);
 const jobs=normalize(source,await response.json());
 const statements=jobs.map((j:any)=>d.prepare('INSERT INTO jobs (id,source,company,title,location,url,description,role,kind,first_seen,last_seen,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET title=excluded.title,location=excluded.location,url=excluded.url,description=excluded.description,role=excluded.role,kind=excluded.kind,last_seen=excluded.last_seen,active=1').bind(j.id,j.source,j.company,j.title,j.location,j.url,j.description,j.role,j.kind,now,now));
 for(let i=0;i<statements.length;i+=40)await d.batch(statements.slice(i,i+40));
 await d.batch([d.prepare('UPDATE jobs SET active=0 WHERE source=? AND last_seen<>?').bind(source.id,now),d.prepare('UPDATE sources SET status=?,last_success=?,error=NULL,count=?,lease_until=0 WHERE id=?').bind('ok',now,jobs.length,source.id)]);
 return Response.json({ok:true,count:jobs.length});
 }catch(e:any){const error=e.name==='TimeoutError'?'请求超时，历史岗位已保留':String(e.message).slice(0,150);await d.prepare('UPDATE sources SET status=?,error=?,lease_until=0 WHERE id=?').bind('error',error,source.id).run();return Response.json({error},{status:502})}
}

