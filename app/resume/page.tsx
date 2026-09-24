'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { FileText,Plus,Copy,Trash2,Download,Upload,Printer,ArrowUp,ArrowDown,Radar,ArrowLeft,Eye,PencilLine,GripVertical } from 'lucide-react';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { ResumeSheet } from '@/components/resume-sheet';
import { FitPreview } from '@/components/fit-preview';
import { importResume } from '@/lib/resume-import';
import { KIND,SECTION_KINDS,TEMPLATES,PAPERS,emptyItem,emptySection,emptyResume,
 type Resume,type ResumeData,type ResumeItem,type ResumeSection } from '@/lib/resume-types';
const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** 可拖出的简历文件。
 *  拖到桌面或文件夹：靠 DownloadURL，Chrome / Edge 会把文件直接下载到落点。
 *  拖到别的网站的上传框：浏览器不允许一个网页把真实文件交给另一个站点的拖放目标，
 *  所以这里也把 File 塞进 dataTransfer（同页面的上传框能接住），但跨站点通常接不住，界面上如实说明。 */
function DragOut({id,fileName}:{id:string;fileName:string}){
 const file=useRef<File|null>(null);
 const url=typeof location==='undefined'?'':`${location.origin}/api/resumes/export?id=${encodeURIComponent(id)}`;
 // dragstart 是同步的，来不及去取文件，所以指针一碰就先备好
 const prepare=useCallback(async()=>{
  if(file.current&&file.current.name===fileName)return;
  try{const r=await fetch(url);if(!r.ok)return;file.current=new File([await r.blob()],fileName,{type:DOCX_MIME})}catch{}
 },[url,fileName]);
 return <span className="dragout" draggable onPointerEnter={prepare} onPointerDown={prepare}
  onDragStart={e=>{
   if(file.current){try{e.dataTransfer.items.add(file.current)}catch{}}
   e.dataTransfer.setData('DownloadURL',`${DOCX_MIME}:${fileName}:${url}`);
   e.dataTransfer.setData('text/uri-list',url);
   e.dataTransfer.setData('text/plain',url);
   e.dataTransfer.effectAllowed='copy';
  }}
  title="按住拖到桌面或文件夹，就会生成这份 .docx">
  <GripVertical size={14}/>拖出 DOCX
 </span>;
}
const TRACKS=['软件工程','AI / 机器学习','数据分析','产品经理','设计','安全','市场 / 运营','其他'];
function Picker({value,onChange,items,label}:any){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue>{items.find((x:any)=>(x.value??x)===value)?.label||value||label}</SelectValue></SelectTrigger><SelectContent>{items.map((x:any)=><SelectItem key={x.value??x} value={x.value??x}>{x.label??x}</SelectItem>)}</SelectContent></Select>}
const Field=({label,value,onChange,placeholder,wide}:any)=>
 <label className={wide?'rf wide':'rf'}><span>{label}</span><input value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label>;
const Area=({label,value,onChange,placeholder,rows=3,note}:any)=>
 <label className="rf wide"><span>{label}{note?<i>{note}</i>:null}</span><textarea rows={rows} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label>;

export default function ResumeManager(){
 const [list,setList]=useState<any[]>([]),[current,setCurrent]=useState<Resume|null>(null);
 const [tab,setTab]=useState<'edit'|'preview'>('edit'),[message,setMessage]=useState('正在读取简历…');
 const [importing,setImporting]=useState(false),[importText,setImportText]=useState(''),[saving,setSaving]=useState(false);
 const saveTimer=useRef<any>(null),alive=useRef(true);

 const loadList=useCallback(async(select?:string)=>{
  const r=await fetch('/api/resumes');if(!r.ok)throw Error('读取简历列表失败');
  const d:any=await r.json();if(!alive.current)return d;
  setList(d.resumes);
  const pick=select||current?.id||d.resumes[0]?.id;
  if(pick&&pick!==current?.id)await open(pick);
  else if(!d.resumes.length)setCurrent(null);
  setMessage(d.resumes.length?`共 ${d.resumes.length} 份简历`:'还没有简历，点「新建简历」开始，或从已有简历导入');
  return d;
 },[current?.id]);
 async function open(id:string){
  const r=await fetch('/api/resumes?id='+encodeURIComponent(id));
  if(!r.ok){setMessage('读取简历失败');return}
  const d:any=await r.json();if(alive.current)setCurrent(d);
 }
 useEffect(()=>{alive.current=true;loadList().catch(e=>setMessage(e.message));return()=>{alive.current=false}},[]);// eslint-disable-line react-hooks/exhaustive-deps

 /** 改动后延迟保存，避免每敲一个字都写库；离开页面前会立即冲刷。 */
 const scheduleSave=useCallback((next:Resume)=>{
  setCurrent(next);
  clearTimeout(saveTimer.current);
  saveTimer.current=setTimeout(async()=>{
   setSaving(true);
   try{
    const r=await fetch('/api/resumes',{method:'PUT',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({id:next.id,name:next.name,track:next.track,template:next.template,paper:next.paper,data:next.data})});
    if(!r.ok)throw Error((await r.json().catch(()=>({})) as any).error||'保存失败');
    const d:any=await r.json();
    if(alive.current){setMessage('已保存 · '+new Date(d.updated_at).toLocaleTimeString());
     setList(xs=>xs.map(x=>x.id===next.id?{...x,name:next.name,track:next.track,updated_at:d.updated_at}:x))}
   }catch(e:any){if(alive.current)setMessage(e.message)}
   finally{if(alive.current)setSaving(false)}
  },700);
 },[]);
 // 与服务端 resumeFileName() 一致：姓名 + 简历名，几份简历拖出来不会重名
 const clean=(v:string)=>v.trim().replace(/[\\/:*?"<>|·]/g,' ').replace(/\s+/g,'_').replace(/^_|_$/g,'');
 const docxName=[clean(current?.data.basics.name||''),clean(current?.name||'')].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join('_')+'.docx';
 const patch=(fn:(d:ResumeData)=>ResumeData)=>{if(current)scheduleSave({...current,data:fn(current.data)})};
 const setMeta=(k:'name'|'track'|'template'|'paper',v:string)=>{if(current)scheduleSave({...current,[k]:v})};

 async function create(data?:ResumeData,name?:string){
  const r=await fetch('/api/resumes',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({name:name||'未命名简历',track:'',template:'classic',paper:'letter',data:data||emptyResume()})});
  if(!r.ok){setMessage('新建失败');return}
  const d:any=await r.json();await loadList(d.id);setTab('edit');
 }
 async function duplicate(){if(!current)return;await create(current.data,current.name+' 副本')}
 async function remove(id:string,name:string){
  if(!confirm(`删除简历「${name}」？此操作不可撤销。`))return;
  const r=await fetch('/api/resumes?id='+encodeURIComponent(id),{method:'DELETE'});
  if(!r.ok){setMessage('删除失败');return}
  if(current?.id===id)setCurrent(null);
  const d:any=await (await fetch('/api/resumes')).json();
  setList(d.resumes);if(d.resumes.length)await open(d.resumes[0].id);
  setMessage('已删除「'+name+'」');
 }
 function exportJson(){
  if(!current)return;
  const blob=new Blob([JSON.stringify({name:current.name,track:current.track,template:current.template,paper:current.paper,data:current.data},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=(current.data.basics.name||current.name).replace(/[\\/:*?"<>|]/g,'_')+'.resume.json';
  a.click();URL.revokeObjectURL(a.href);
 }
 async function doImport(){
  try{
   const {data,notes}=importResume(importText);
   const guess=data.basics.name?data.basics.name+' 的简历':'导入的简历';
   await create(data,guess);
   setImporting(false);setImportText('');
   setMessage('导入完成 · '+notes.join(' '));
  }catch(e:any){setMessage('导入失败：'+e.message)}
 }
 // ---- 板块与条目编辑 ----
 const move=<T,>(xs:T[],i:number,d:number)=>{const j=i+d;if(j<0||j>=xs.length)return xs;const c=[...xs];[c[i],c[j]]=[c[j],c[i]];return c};
 const editSection=(sid:string,fn:(s:ResumeSection)=>ResumeSection)=>patch(d=>({...d,sections:d.sections.map(s=>s.id===sid?fn(s):s)}));
 const editItem=(sid:string,iid:string,fn:(i:ResumeItem)=>ResumeItem)=>editSection(sid,s=>({...s,items:s.items.map(i=>i.id===iid?fn(i):i)}));

 if(!current&&!list.length)return <Shell message={message} onCreate={()=>create()} onOpenImport={()=>setImporting(true)}
  importing={importing} importText={importText} setImportText={setImportText} doImport={doImport} onCloseImport={()=>setImporting(false)}/>;

 return <div className="shell"><header>
   <div className="brand"><FileText size={28}/><b>简历工作台<span> / RESUME</span></b></div>
   <a className="header-note backlink" href="/"><ArrowLeft size={15}/><Radar size={15}/> 回到岗位雷达</a>
   <div className="profile">{saving?'保存中…':'自动保存'}</div>
  </header>
  <div className="resume-shell">
   <aside className="rlist">
    <div className="eyebrow">我的简历</div>
    <div className="rlist-actions">
     <button className="primary" onClick={()=>create()}><Plus size={16}/>新建简历</button>
     <button className="ghost" onClick={()=>setImporting(true)}><Upload size={16}/>导入</button>
    </div>
    {TRACKS.concat(['']).map(track=>{
     const rows=list.filter(x=>(x.track||'')===track);if(!rows.length)return null;
     return <div key={track||'none'} className="rgroup">
      <div className="rgroup-title">{track||'未分类'}</div>
      {rows.map(x=><button key={x.id} className={current?.id===x.id?'rcard active':'rcard'} onClick={()=>open(x.id)}>
       <b>{x.name}</b><small>{new Date(x.updated_at).toLocaleString()}</small></button>)}
     </div>;
    })}
   </aside>
   <main className="rmain">
    {current?<>
     <div className="rtop">
      <input className="rname" value={current.name} onChange={e=>setMeta('name',e.target.value)} aria-label="简历名称"/>
      <Picker label="职业方向" value={current.track} items={[{value:'',label:'未分类'},...TRACKS.map(t=>({value:t,label:t}))]} onChange={(v:string)=>setMeta('track',v)}/>
      <Picker label="模板" value={current.template} items={TEMPLATES.map(t=>({value:t.id,label:t.name}))} onChange={(v:string)=>setMeta('template',v)}/>
      <Picker label="纸张" value={current.paper} items={PAPERS.map(p=>({value:p.id,label:p.name}))} onChange={(v:string)=>setMeta('paper',v)}/>
      <div className="rtop-actions">
       <button className="ghost" onClick={duplicate}><Copy size={15}/>复制</button>
       <a className="ghost" href={'/api/resumes/export?id='+current.id} download><Download size={15}/>下载 DOCX</a>
       <DragOut id={current.id} fileName={docxName}/>
       <button className="ghost" onClick={exportJson}><Download size={15}/>导出 JSON</button>
       <button className="primary" onClick={()=>window.open('/resume/print?id='+current.id,'_blank','noopener')}><Printer size={15}/>导出 PDF</button>
       <button className="ghost danger" onClick={()=>remove(current.id,current.name)}><Trash2 size={15}/>删除</button>
      </div>
     </div>
     <div className="rnote">{TEMPLATES.find(t=>t.id===current.template)?.note}</div>
     <div className="rnote">把「拖出 DOCX」拖到桌面或文件夹即可生成文件（Chrome / Edge 支持），再从那里拖进招聘网站的上传框。浏览器不允许网页把文件直接交给另一个站点的上传框，所以中间这一步省不掉。PDF 走「导出 PDF」的打印对话框，选「另存为 PDF」。</div>
     <div className="rtabs">
      <button className={tab==='edit'?'active':''} onClick={()=>setTab('edit')}><PencilLine size={15}/>编辑</button>
      <button className={tab==='preview'?'active':''} onClick={()=>setTab('preview')}><Eye size={15}/>预览（即导出效果）</button>
      <span role="status">{message}</span>
     </div>
     {tab==='preview'?<FitPreview><ResumeSheet data={current.data} template={current.template} paper={current.paper}/></FitPreview>:
     <div className="reditor">
      <section className="rblock">
       <h3>基本信息</h3>
       <div className="rgrid">
        <Field label="姓名" value={current.data.basics.name} onChange={(v:string)=>patch(d=>({...d,basics:{...d.basics,name:v}}))} placeholder="张三 / Zhang San"/>
        <Field label="求职方向（显示在姓名下方）" value={current.data.basics.headline} onChange={(v:string)=>patch(d=>({...d,basics:{...d.basics,headline:v}}))} placeholder="Software Engineer · Backend"/>
        <Field label="邮箱" value={current.data.basics.email} onChange={(v:string)=>patch(d=>({...d,basics:{...d.basics,email:v}}))} placeholder="you@example.com"/>
        <Field label="电话" value={current.data.basics.phone} onChange={(v:string)=>patch(d=>({...d,basics:{...d.basics,phone:v}}))} placeholder="+1 617 000 0000"/>
        <Field label="所在地" value={current.data.basics.location} onChange={(v:string)=>patch(d=>({...d,basics:{...d.basics,location:v}}))} placeholder="Boston, MA"/>
       </div>
       <Area label="个人简介" note="留空则不出现在简历里" rows={3} value={current.data.basics.summary}
        onChange={(v:string)=>patch(d=>({...d,basics:{...d.basics,summary:v}}))} placeholder="两三句话概括你的方向与优势"/>
       <Area label="链接" note="每行一条，格式：名称 空格 网址" rows={3}
        value={current.data.basics.links.map(l=>`${l.label} ${l.url}`.trim()).join('\n')}
        onChange={(v:string)=>patch(d=>({...d,basics:{...d.basics,links:v.split('\n').map(line=>{const t=line.trim();if(!t)return null;const m=t.match(/^(\S+)\s+(\S+)$/);return m?{label:m[1],url:m[2]}:{label:'',url:t}}).filter(Boolean) as any}}))}
        placeholder={'GitHub https://github.com/you\nLinkedIn https://linkedin.com/in/you'}/>
      </section>
      {current.data.sections.map((s,si)=>{
       const kind=KIND[s.type];
       return <section className="rblock" key={s.id}>
        <div className="rblock-head">
         <input className="rsection-title" value={s.title} onChange={e=>editSection(s.id,x=>({...x,title:e.target.value}))} aria-label="板块标题"/>
         <span className="rkind">{kind.label}</span>
         <div className="rblock-actions">
          <button title="上移" onClick={()=>patch(d=>({...d,sections:move(d.sections,si,-1)}))}><ArrowUp size={15}/></button>
          <button title="下移" onClick={()=>patch(d=>({...d,sections:move(d.sections,si,1)}))}><ArrowDown size={15}/></button>
          <button title="删除板块" className="danger" onClick={()=>{if(confirm(`删除板块「${s.title}」及其下全部内容？`))patch(d=>({...d,sections:d.sections.filter(x=>x.id!==s.id)}))}}><Trash2 size={15}/></button>
         </div>
        </div>
        <p className="rhint">{kind.hint}</p>
        {s.items.map((item,ii)=><div className="ritem" key={item.id}>
         <div className="ritem-head">
          <b>{item.org||kind.orgLabel}{item.role?' · '+item.role:''}</b>
          <div className="rblock-actions">
           <button title="上移" onClick={()=>editSection(s.id,x=>({...x,items:move(x.items,ii,-1)}))}><ArrowUp size={14}/></button>
           <button title="下移" onClick={()=>editSection(s.id,x=>({...x,items:move(x.items,ii,1)}))}><ArrowDown size={14}/></button>
           <button title="删除这条" className="danger" onClick={()=>editSection(s.id,x=>({...x,items:x.items.filter(i=>i.id!==item.id)}))}><Trash2 size={14}/></button>
          </div>
         </div>
         <div className="rgrid">
          <Field label={kind.orgLabel} value={item.org} onChange={(v:string)=>editItem(s.id,item.id,i=>({...i,org:v}))}/>
          {kind.fields.role&&<Field label={kind.roleLabel} value={item.role} onChange={(v:string)=>editItem(s.id,item.id,i=>({...i,role:v}))}/>}
          {kind.fields.location&&<Field label="地点" value={item.location} onChange={(v:string)=>editItem(s.id,item.id,i=>({...i,location:v}))} placeholder="San Jose, CA"/>}
          {kind.fields.dates&&<><Field label="开始时间" value={item.start} onChange={(v:string)=>editItem(s.id,item.id,i=>({...i,start:v}))} placeholder="2025.06"/>
           <label className="rf"><span>结束时间</span>
            <div className="rend"><input value={item.current?'':item.end} disabled={item.current} placeholder="2025.09" onChange={e=>editItem(s.id,item.id,i=>({...i,end:e.target.value}))}/>
             <label className="rcheck"><input type="checkbox" checked={item.current} onChange={e=>editItem(s.id,item.id,i=>({...i,current:e.target.checked}))}/>至今</label></div>
           </label></>}
          {kind.fields.url&&<Field label="链接" value={item.url} onChange={(v:string)=>editItem(s.id,item.id,i=>({...i,url:v}))} placeholder="https://…"/>}
         </div>
         {kind.fields.summary&&<Area label="补充说明" rows={2} value={item.summary} onChange={(v:string)=>editItem(s.id,item.id,i=>({...i,summary:v}))}
          placeholder={s.type==='education'?'GPA 3.9 / 主修课程：算法、分布式系统':'一句话说明'}/>}
         {kind.fields.tags&&<Field wide label={s.type==='skill'?'条目（用逗号分隔）':'技术栈 / 标签（用逗号分隔）'} value={item.tags.join('、')}
          onChange={(v:string)=>editItem(s.id,item.id,i=>({...i,tags:v.split(/[,，、]/).map(t=>t.trim()).filter(Boolean)}))} placeholder="React、TypeScript、PostgreSQL"/>}
         {kind.fields.bullets&&<Area label="要点" note="每行一条，导出成项目符号" rows={4} value={item.bullets.join('\n')}
          onChange={(v:string)=>editItem(s.id,item.id,i=>({...i,bullets:v.split('\n')}))}
          placeholder={'用动词开头，写清做了什么、用了什么、结果如何\n把接口 P99 延迟从 1.2s 降到 30ms，支撑 13 万条数据的实时筛选'}/>}
        </div>)}
        <button className="radd" onClick={()=>editSection(s.id,x=>({...x,items:[...x.items,emptyItem()]}))}><Plus size={15}/>添加一条{kind.label}</button>
       </section>;
      })}
      <section className="rblock addblock">
       <h3>添加板块</h3>
       <div className="rkinds">{SECTION_KINDS.map(k=><button key={k.type} onClick={()=>patch(d=>({...d,sections:[...d.sections,emptySection(k.type)]}))}>
        <b>{k.label}</b><small>{k.hint}</small></button>)}</div>
      </section>
     </div>}
    </>:<div className="rempty">选择左侧的一份简历开始编辑</div>}
   </main>
  </div>
  {importing&&<ImportDialog text={importText} setText={setImportText} onClose={()=>setImporting(false)} onSubmit={doImport}/>}
 </div>;
}
function ImportDialog({text,setText,onClose,onSubmit}:any){
 return <div className="rmodal" role="dialog" aria-label="导入简历"><div className="rmodal-box">
  <h3>导入已有简历</h3>
  <p className="rhint">支持两种来源：① 本工具导出的 <code>.resume.json</code>，或 JSON Resume 标准格式，粘贴后可无损还原；② 从 PDF / Word 里复制出来的纯文本，会尽力还原成板块与条目，导入后请逐条核对。</p>
  <div className="rmodal-actions" style={{marginBottom:10}}>
   <label className="ghost filepick"><Upload size={15}/>选择文件
    <input type="file" accept=".json,.txt,.md,application/json,text/plain" onChange={async e=>{const f=e.target.files?.[0];if(f)setText(await f.text())}}/></label>
  </div>
  <textarea rows={14} value={text} onChange={e=>setText(e.target.value)} placeholder="把简历内容粘贴到这里，或点上面的按钮选择文件…"/>
  <div className="rmodal-actions">
   <button className="ghost" onClick={onClose}>取消</button>
   <button className="primary" disabled={!text.trim()} onClick={onSubmit}><Upload size={15}/>导入并新建简历</button>
  </div>
 </div></div>;
}
function Shell({message,onCreate,onOpenImport,onCloseImport,importing,importText,setImportText,doImport}:any){
 return <div className="shell"><header>
   <div className="brand"><FileText size={28}/><b>简历工作台<span> / RESUME</span></b></div>
   <a className="header-note backlink" href="/"><ArrowLeft size={15}/><Radar size={15}/> 回到岗位雷达</a>
  </header>
  <div className="rstart">
   <h1>还没有简历</h1>
   <p className="muted">{message}</p>
   <div className="rstart-actions">
    <button className="primary" onClick={onCreate}><Plus size={16}/>新建简历</button>
    <button className="ghost" onClick={onOpenImport}><Upload size={16}/>从已有简历导入</button>
   </div>
  </div>
  {importing&&<ImportDialog text={importText} setText={setImportText} onClose={onCloseImport} onSubmit={doImport}/>}
 </div>;
}
