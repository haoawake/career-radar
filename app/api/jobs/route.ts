import { db, sameOrigin } from '@/lib/db';
import { SOURCES } from '@/lib/sources';
export async function GET(){try{const d=db();const [jobs,states]=await Promise.all([d.prepare('SELECT id,source,company,title,location,url,substr(description,1,2400) AS description,role,kind,first_seen,last_seen,active,starred,applied FROM jobs ORDER BY first_seen DESC, id ASC').all(),d.prepare('SELECT * FROM sources').all()]);return Response.json({jobs:jobs.results,sources:SOURCES.map(s=>({...s,...states.results.find((x:any)=>x.id===s.id)}))},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'读取岗位失败'},{status:500})}}
export async function PATCH(r:Request){if(!sameOrigin(r))return new Response('Forbidden',{status:403});try{const {id,field,value}:any=await r.json();if(typeof id!=='string'||!['starred','applied'].includes(field)||typeof value!=='boolean')return new Response('Invalid input',{status:400});const result=await db().prepare(`UPDATE jobs SET ${field}=? WHERE id=?`).bind(value?1:0,id).run();return Response.json({ok:result.meta.changes>0},{status:result.meta.changes?200:404});}catch{return Response.json({error:'保存失败'},{status:500})}}


