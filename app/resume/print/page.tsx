'use client';
import { useEffect,useState } from 'react';
import { ResumeSheet } from '@/components/resume-sheet';
import type { Resume } from '@/lib/resume-types';
// 单独的打印页：整页只有简历本身，浏览器「打印 → 另存为 PDF」得到的就是所见的排版，
// 多页内容也能正常分页。页边距交给 .sheet 的内边距，@page 只负责纸张尺寸。
export default function PrintResume(){
 const [resume,setResume]=useState<Resume|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  const id=new URLSearchParams(location.search).get('id');
  if(!id){setError('缺少简历编号');return}
  fetch('/api/resumes?id='+encodeURIComponent(id))
   .then(async r=>{if(!r.ok)throw Error((await r.json().catch(()=>({})) as any).error||'读取简历失败');return r.json()})
   .then((d:any)=>setResume(d)).catch(e=>setError(e.message));
 },[]);
 useEffect(()=>{
  if(!resume)return;
  document.title=`${resume.data.basics.name||resume.name} · 简历`;
  document.body.classList.add('printing');
  // 等字体与排版稳定后再唤起打印，避免第一页出现字体回退造成的错行
  const fonts=(document as any).fonts?.ready??Promise.resolve();
  let cancelled=false;
  fonts.then(()=>requestAnimationFrame(()=>{if(!cancelled&&new URLSearchParams(location.search).get('auto')!=='0')window.print()}));
  return()=>{cancelled=true;document.body.classList.remove('printing')};
 },[resume]);
 if(error)return <div style={{padding:40,fontSize:15}}>{error}</div>;
 if(!resume)return <div style={{padding:40,fontSize:15}}>正在准备简历…</div>;
 return <>
  <style>{`@page{size:${resume.paper==='a4'?'A4':'letter'};margin:0}`}</style>
  <div className="noprint" style={{padding:'14px 20px',display:'flex',gap:12,alignItems:'center',fontSize:14,background:'#eef3f6'}}>
   <button onClick={()=>window.print()} style={{background:'#006b61',color:'#fff',border:0,borderRadius:7,padding:'9px 16px',fontSize:14}}>打印 / 另存为 PDF</button>
   <span style={{color:'#5c7075'}}>在打印对话框里把「目标」选成「另存为 PDF」，边距选「无」，并关掉「页眉和页脚」。</span>
  </div>
  <ResumeSheet data={resume.data} template={resume.template} paper={resume.paper}/>
 </>;
}
