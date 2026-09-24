// 反向导入：把已有简历读回工具。
// 两条路径——本工具导出的 JSON（含 JSON Resume 标准格式）可无损还原；
// 从 PDF/Word 里复制出来的纯文本只能启发式还原，结果一定要人工核对，所以会一并给出提示。
import { type ResumeData,type ResumeItem,type ResumeSection,type SectionType,KIND,normalizeResume,uid,emptyItem } from './resume-types';

const SECTION_WORDS:[SectionType,RegExp][]=[
 ['education',/^(education|academic background|学历|教育背景|教育经历)\b/i],
 ['experience',/^(experience|work experience|professional experience|employment|internships?|工作经历|实习经历|工作与实习)\b/i],
 ['project',/^(projects?|selected projects|personal projects|项目经历|项目)\b/i],
 ['skill',/^(skills?|technical skills|technologies|专业技能|技能)\b/i],
 ['award',/^(awards?|honors?|certifications?|奖项|荣誉|证书)\b/i],
 ['publication',/^(publications?|papers?|research|论文|发表)\b/i],
];
const BULLET=/^[\s]*[•·▪◦‣*\-–—]\s+/;
const DATE=/((?:19|20)\d{2}(?:[./-]\d{1,2})?|[A-Z][a-z]{2,8}\.?\s+(?:19|20)\d{2})\s*(?:[–—\-~]|to|至)\s*((?:19|20)\d{2}(?:[./-]\d{1,2})?|[A-Z][a-z]{2,8}\.?\s+(?:19|20)\d{2}|present|now|current|至今|现在)/i;
const EMAIL=/[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE=/(\+?\d[\d\s().-]{7,}\d)/;
const URL=/\bhttps?:\/\/\S+|\b(?:www\.|linkedin\.com\/|github\.com\/)\S+/i;

const looksLikeHeading=(line:string)=>{
 const t=line.trim();
 if(!t||t.length>42||BULLET.test(line))return false;
 if(SECTION_WORDS.some(([,re])=>re.test(t)))return true;
 // 全大写且没有句号的短行，常见于简历板块标题
 return /^[A-Z][A-Z\s&/]{2,}$/.test(t)&&!t.includes('.');
};
const headingType=(line:string):SectionType=>{
 const t=line.trim();
 for(const [type,re] of SECTION_WORDS)if(re.test(t))return type;
 return 'custom';
};
/** 从条目首行里拆出「机构 — 地点」与日期区间。 */
function parseHeadLine(line:string){
 let rest=line.trim();let start='',end='',current=false;
 const d=rest.match(DATE);
 if(d){start=d[1].trim();const tail=d[2].trim();
  if(/^(present|now|current|至今|现在)$/i.test(tail))current=true;else end=tail;
  rest=(rest.slice(0,d.index)+' '+rest.slice((d.index||0)+d[0].length)).trim();}
 rest=rest.replace(/[|,·•\-–—\s]+$/,'').replace(/^[|,·•\-–—\s]+/,'');
 const parts=rest.split(/\s*[|·•]\s*|\s+[–—]\s+|\s{3,}/).map(s=>s.trim()).filter(Boolean);
 const org=parts[0]||'';
 const location=parts.slice(1).find(p=>/,\s*[A-Z]{2}\b|remote|美国|中国/i.test(p))||'';
 const role=parts.slice(1).filter(p=>p!==location).join(' · ');
 return {org,role,location,start,end,current};
}
export type ImportResult={data:ResumeData;notes:string[]};
/** 解析粘贴进来的纯文本简历，尽力还原结构；无法确定的部分会在 notes 里说明。 */
export function fromText(text:string):ImportResult{
 const notes:string[]=[];
 const lines=String(text||'').replace(/\r/g,'').split('\n');
 const data=normalizeResume({sections:[]});
 data.sections=[];
 // 抬头：第一个非空行当姓名，联系方式从前若干行里抓
 const head=lines.slice(0,12).join('\n');
 data.basics.name=(lines.find(l=>l.trim())||'').trim().slice(0,80);
 data.basics.email=head.match(EMAIL)?.[0]||'';
 const phone=head.replace(EMAIL,'').match(PHONE)?.[0]||'';
 data.basics.phone=phone.trim();
 for(const m of head.matchAll(new RegExp(URL,'gi'))){
  const url=m[0].replace(/[),.;]+$/,'');
  const label=/linkedin/i.test(url)?'LinkedIn':/github/i.test(url)?'GitHub':'主页';
  if(!data.basics.links.some(l=>l.url===url))data.basics.links.push({label,url});
 }
 let section:ResumeSection|null=null,item:ResumeItem|null=null;
 const pushItem=()=>{if(section&&item&&(item.org||item.role||item.bullets.length||item.tags.length))section.items.push(item);item=null};
 const pushSection=()=>{pushItem();if(section&&section.items.length)data.sections.push(section);section=null};
 for(const raw of lines.slice(1)){
  const line=raw.trimEnd();
  if(!line.trim()){continue}
  if(looksLikeHeading(line)){
   pushSection();
   const type=headingType(line);
   section={id:uid(),type,title:line.trim().replace(/[:：]\s*$/,''),items:[]};
   continue;
  }
  if(!section){section={id:uid(),type:'custom',title:'Summary',items:[]}}
  if(section.type==='skill'){
   // 技能板块按「分类：条目、条目」拆
   const m=line.match(/^\s*([^:：]{1,30})[:：]\s*(.+)$/);
   const entry=emptyItem();entry.bullets=[];
   if(m){entry.org=m[1].trim();entry.tags=m[2].split(/[,，、;；/|]/).map(s=>s.trim()).filter(Boolean)}
   else {entry.tags=line.replace(BULLET,'').split(/[,，、;；/|]/).map(s=>s.trim()).filter(Boolean)}
   if(entry.tags.length)section.items.push(entry);
   continue;
  }
  if(BULLET.test(line)){
   if(!item){item=emptyItem();item.bullets=[]}
   item.bullets.push(line.replace(BULLET,'').trim());
   continue;
  }
  const parsed=parseHeadLine(line);
  if(parsed.start||parsed.end||parsed.current||!item){
   pushItem();
   item=emptyItem();item.bullets=[];
   Object.assign(item,parsed);
  }else if(!item.role){item.role=line.trim()}
  else {item.bullets.push(line.trim())}
 }
 pushSection();
 if(!data.sections.length)notes.push('没有识别出任何板块，可能是纯段落格式的简历；已保留为空白简历，请手动补充。');
 else notes.push(`识别出 ${data.sections.length} 个板块、${data.sections.reduce((n,s)=>n+s.items.length,0)} 条经历。`);
 if(!data.basics.email)notes.push('没找到邮箱，请手动填写联系方式。');
 const untyped=data.sections.filter(s=>s.type==='custom').length;
 if(untyped)notes.push(`${untyped} 个板块没能判断类型，已按「自定义板块」导入，可在编辑器里改成对应经历类型以套用固定排版。`);
 notes.push('纯文本还原是尽力而为的，导入后请逐条核对时间、地点与要点。');
 return {data:normalizeResume(data),notes};
}
/** 解析 JSON：既接受本工具导出的格式，也接受 JSON Resume 标准格式。 */
export function fromJson(text:string):ImportResult{
 let raw:any;
 try{raw=JSON.parse(text)}catch{throw Error('不是合法的 JSON，请检查内容是否完整')}
 const notes:string[]=[];
 if(raw&&typeof raw==='object'&&raw.data&&raw.data.sections)raw=raw.data;// 本工具导出的整份简历
 if(raw&&Array.isArray(raw.sections))return {data:normalizeResume(raw),notes:['按本工具的简历格式导入，内容已完整还原。']};
 if(raw&&typeof raw==='object'&&(raw.basics||raw.work||raw.education)){
  const b=raw.basics||{};
  const sections:ResumeSection[]=[];
  const build=(type:SectionType,rows:any[],map:(r:any)=>Partial<ResumeItem>)=>{
   const items=(rows||[]).map((r:any)=>({...emptyItem(),bullets:[],...map(r)} as ResumeItem));
   if(items.length)sections.push({id:uid(),type,title:KIND[type].defaultTitle,items});
  };
  build('education',raw.education,(r:any)=>({org:r.institution||'',role:[r.studyType,r.area].filter(Boolean).join(', '),
   start:r.startDate||'',end:r.endDate||'',summary:r.score?`GPA ${r.score}`:''}));
  build('experience',raw.work,(r:any)=>({org:r.name||r.company||'',role:r.position||'',location:r.location||'',
   start:r.startDate||'',end:r.endDate||'',bullets:Array.isArray(r.highlights)?r.highlights:r.summary?[r.summary]:[]}));
  build('project',raw.projects,(r:any)=>({org:r.name||'',role:r.roles?.join(' · ')||'',start:r.startDate||'',end:r.endDate||'',
   url:r.url||'',tags:r.keywords||[],bullets:Array.isArray(r.highlights)?r.highlights:r.description?[r.description]:[]}));
  build('skill',raw.skills,(r:any)=>({org:r.name||'',tags:r.keywords||[]}));
  build('award',raw.awards,(r:any)=>({org:r.title||'',role:r.awarder||'',start:r.date||'',summary:r.summary||''}));
  build('publication',raw.publications,(r:any)=>({org:r.name||'',role:r.publisher||'',start:r.releaseDate||'',url:r.url||'',summary:r.summary||''}));
  notes.push('按 JSON Resume 标准格式导入。');
  return {data:normalizeResume({basics:{name:b.name||'',headline:b.label||'',email:b.email||'',phone:b.phone||'',
   location:[b.location?.city,b.location?.region].filter(Boolean).join(', '),summary:b.summary||'',
   links:(b.profiles||[]).map((p:any)=>({label:p.network||'',url:p.url||''}))},sections}),notes};
 }
 throw Error('无法识别的 JSON 结构，支持本工具导出的简历或 JSON Resume 标准格式');
}
export function importResume(text:string):ImportResult{
 const t=String(text||'').trim();
 if(!t)throw Error('内容为空');
 return t.startsWith('{')?fromJson(t):fromText(t);
}
