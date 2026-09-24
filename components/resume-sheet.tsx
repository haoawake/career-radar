'use client';
import { KIND,tidy,type ResumeData,type ResumeItem,type SectionType } from '@/lib/resume-types';
import { renderItem,hasContent } from '@/lib/resume-render';
// 这里只负责把 renderItem 的结果画出来，排版规则本身在 lib/resume-render.ts，
// 预览与打印走的是同一条路径，所以屏幕上看到的就是导出的样子。
function Item({item,type}:{item:ResumeItem;type:SectionType}){
 const r=renderItem(item,type);
 if(!hasContent(r))return null;
 if(r.skill)return <div className="r-skill">{r.skill.label?<b>{r.skill.label}：</b>:null}<span>{r.skill.values}</span></div>;
 return <div className="r-item">
  {(r.head.primary||r.head.secondary||r.when)?<div className="r-row">
   <div className="r-left">
    {r.head.primary?<b>{r.head.primary}</b>:null}
    {r.head.secondary?<span className="r-sub">{r.head.primary?r.head.separator:''}{r.head.secondary}</span>:null}
   </div>
   {r.when?<div className="r-when">{r.when}</div>:null}
  </div>:null}
  {r.role?<p className="r-role">{r.role}</p>:null}
  {r.note?<p className="r-note">{r.note}</p>:null}
  {r.tags?<p className="r-tags">{r.tags}</p>:null}
  {r.bullets.length?<ul className="r-bullets">{r.bullets.map((b,i)=><li key={i}>{b}</li>)}</ul>:null}
  {r.link?<a className="r-link" href={r.link} target="_blank" rel="noopener noreferrer">{r.link.replace(/^https?:\/\//,'')}</a>:null}
 </div>;
}
export function ResumeSheet({data,template='classic',paper='letter'}:{data:ResumeData;template?:string;paper?:string}){
 const r=tidy(data),b=r.basics;
 const contacts=[b.location,b.phone,b.email].filter(Boolean);
 return <article className={`sheet t-${template} p-${paper}`}>
  <header className="r-head">
   <h1>{b.name||'你的姓名'}</h1>
   {b.headline?<p className="r-headline">{b.headline}</p>:null}
   {/* 联系方式与链接分成固定的两行：挤在一行会随内容长短随机折行，两行的位置永远可预期 */}
   {contacts.length?<p className="r-contact">{contacts.map((c,i)=><span key={'c'+i}>{c}</span>)}</p>:null}
   {b.links.length?<p className="r-contact r-links">
    {b.links.map((l,i)=><span key={'l'+i}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label||l.url.replace(/^https?:\/\//,'')}</a></span>)}
   </p>:null}
  </header>
  {b.summary?<section className="r-section"><h2>Summary</h2><p className="r-note">{b.summary}</p></section>:null}
  {r.sections.map(s=><section className="r-section" key={s.id}>
   <h2>{s.title||KIND[s.type].defaultTitle}</h2>
   <div className={s.type==='skill'?'r-skills':''}>{s.items.map(i=><Item key={i.id} item={i} type={s.type}/>)}</div>
  </section>)}
 </article>;
}
