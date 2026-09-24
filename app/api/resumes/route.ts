import { db,sameOrigin } from '@/lib/db';
import { normalizeResume,emptyResume,uid,TEMPLATES,PAPERS,type Resume } from '@/lib/resume-types';
const TEMPLATE_IDS=new Set(TEMPLATES.map(t=>t.id)),PAPER_IDS=new Set(PAPERS.map(p=>p.id));
const MAX_BYTES=400000;// 一份简历的 JSON 上限，避免误粘贴整本文档把库撑爆
const text=(v:unknown,max:number)=>typeof v==='string'?v.slice(0,max):'';
const row=(r:any):Resume=>({id:r.id,name:r.name,track:r.track,template:r.template,paper:r.paper,
 created_at:r.created_at,updated_at:r.updated_at,data:normalizeResume(JSON.parse(r.data))});
export async function GET(r:Request){try{
 const d=db(),id=new URL(r.url).searchParams.get('id');
 if(id){const one=await d.prepare('SELECT * FROM resumes WHERE id=?').bind(id).first<any>();
  return one?Response.json(row(one)):Response.json({error:'简历不存在'},{status:404})}
 // 列表不带正文，避免几十份简历一次全拉回来
 const all=await d.prepare('SELECT id,name,track,template,paper,created_at,updated_at,length(data) AS size FROM resumes ORDER BY updated_at DESC').all<any>();
 return Response.json({resumes:all.results||[]},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error(e);return Response.json({error:'读取简历失败'},{status:500})}}
export async function POST(r:Request){
 if(!sameOrigin(r))return new Response('Forbidden',{status:403});
 try{
  const body:any=await r.json();
  const now=new Date().toISOString(),id=uid();
  const data=body.data?normalizeResume(body.data):emptyResume();
  const json=JSON.stringify(data);
  if(json.length>MAX_BYTES)return Response.json({error:'简历内容过大'},{status:413});
  const name=text(body.name,120)||'未命名简历';
  const template=TEMPLATE_IDS.has(body.template)?body.template:'classic';
  const paper=PAPER_IDS.has(body.paper)?body.paper:'letter';
  await db().prepare('INSERT INTO resumes (id,name,track,template,paper,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
   .bind(id,name,text(body.track,60),template,paper,json,now,now).run();
  return Response.json({id},{status:201});
 }catch(e){console.error(e);return Response.json({error:'新建简历失败'},{status:500})}}
export async function PUT(r:Request){
 if(!sameOrigin(r))return new Response('Forbidden',{status:403});
 try{
  const body:any=await r.json();
  if(typeof body?.id!=='string')return Response.json({error:'缺少简历编号'},{status:400});
  const json=JSON.stringify(normalizeResume(body.data));
  if(json.length>MAX_BYTES)return Response.json({error:'简历内容过大'},{status:413});
  const template=TEMPLATE_IDS.has(body.template)?body.template:'classic';
  const paper=PAPER_IDS.has(body.paper)?body.paper:'letter';
  const now=new Date().toISOString();
  const res=await db().prepare('UPDATE resumes SET name=?,track=?,template=?,paper=?,data=?,updated_at=? WHERE id=?')
   .bind(text(body.name,120)||'未命名简历',text(body.track,60),template,paper,json,now,body.id).run();
  return res.meta.changes?Response.json({ok:true,updated_at:now}):Response.json({error:'简历不存在'},{status:404});
 }catch(e){console.error(e);return Response.json({error:'保存失败'},{status:500})}}
export async function DELETE(r:Request){
 if(!sameOrigin(r))return new Response('Forbidden',{status:403});
 try{
  const id=new URL(r.url).searchParams.get('id');
  if(!id)return Response.json({error:'缺少简历编号'},{status:400});
  const res=await db().prepare('DELETE FROM resumes WHERE id=?').bind(id).run();
  return res.meta.changes?Response.json({ok:true}):Response.json({error:'简历不存在'},{status:404});
 }catch(e){console.error(e);return Response.json({error:'删除失败'},{status:500})}}
