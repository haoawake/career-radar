import { db } from '@/lib/db';
import { normalizeResume } from '@/lib/resume-types';
import { buildDocx,resumeFileName } from '@/lib/resume-docx';
// 导出成真实文件。带上 Content-Disposition 的文件名，浏览器拖到桌面或点下载都能拿到正确的名字；
// 拖拽用的 DownloadURL 也指向这里。
export async function GET(r:Request){try{
 const p=new URL(r.url).searchParams,id=p.get('id');
 if(!id)return Response.json({error:'缺少简历编号'},{status:400});
 const row=await db().prepare('SELECT name,paper,template,data FROM resumes WHERE id=?').bind(id).first<any>();
 if(!row)return Response.json({error:'简历不存在'},{status:404});
 const data=normalizeResume(JSON.parse(row.data));
 const format=p.get('format')==='json'?'json':'docx';
 if(format==='json'){
  const name=resumeFileName(data,row.name,'json');
  return new Response(JSON.stringify({name:row.name,paper:row.paper,data},null,2),{headers:{
   'Content-Type':'application/json; charset=utf-8',
   'Content-Disposition':`attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
   'Cache-Control':'no-store'}});
 }
 const file=buildDocx(data,row.paper,row.template);
 const name=resumeFileName(data,row.name,'docx');
 return new Response(file as unknown as BodyInit,{headers:{
  'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'Content-Disposition':`attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
  'Content-Length':String(file.length),
  'Cache-Control':'no-store'}});
 }catch(e){console.error(e);return Response.json({error:'导出失败'},{status:500})}}
