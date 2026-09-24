import { db,sameOrigin } from '@/lib/db';
import { readFilters,baseClause,locationClause,whereOf } from '@/lib/job-query';
// D1 会把同一请求里的查询排队执行，查询条数本身就是延迟，所以列表只留取行与计数两条
// （各约 10ms），统计、来源状态与地区分面挪到 /api/overview 低频获取。
// 注意别用 count(*) OVER () 合并成一条：窗口函数会为了算总数扫完全部匹配行，实测反而要 639ms。
export async function GET(r:Request){try{
 const d=db(),f=readFilters(new URL(r.url).searchParams);
 const {clauses,values}=baseClause(f);locationClause(f.metro,f.city,clauses,values);
 const where=whereOf(clauses),t0=Date.now();
 const [rows,total]=await Promise.all([
  d.prepare('SELECT id,source,company,title,location,url,substr(description,1,2400) AS description,role,kind,level,visa,visa_note,first_seen,last_seen,active,starred,applied FROM jobs'+where+' ORDER BY first_seen DESC,id ASC LIMIT 30 OFFSET ?').bind(...values,(f.page-1)*30).all<any>(),
  d.prepare('SELECT count(*) AS n FROM jobs'+where).bind(...values).first<{n:number}>(),
 ]);
 return Response.json({jobs:rows.results||[],total:total?.n||0,page:f.page},{headers:{'Cache-Control':'no-store','Server-Timing':`rows;dur=${Date.now()-t0}`}});
 }catch(e){console.error(e);return Response.json({error:'读取岗位失败'},{status:500})}}
export async function PATCH(r:Request){if(!sameOrigin(r))return new Response('Forbidden',{status:403});try{const {id,field,value}:any=await r.json();if(typeof id!=='string'||!['starred','applied'].includes(field)||typeof value!=='boolean')return new Response('Invalid input',{status:400});const result=await db().prepare(`UPDATE jobs SET ${field}=? WHERE id=?`).bind(value?1:0,id).run();return Response.json({ok:result.meta.changes>0},{status:result.meta.changes?200:404});}catch{return Response.json({error:'保存失败'},{status:500})}}
