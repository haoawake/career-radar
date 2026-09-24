// 简历数据模型。条目的渲染规则由 section 的 type 决定：同一类经历（比如实习）导出时
// 永远走同一套排版，编辑时也只显示这类经历用得上的字段。
export type ResumeLink={label:string;url:string};
export type ResumeItem={
 id:string;
 org:string;      // 公司 / 学校 / 项目归属 / 奖项授予方
 role:string;     // 职位 / 学位与专业 / 项目角色
 location:string;
 start:string;    // 自由文本，如 2025.06 或 Jun 2025
 end:string;
 current:boolean; // 至今
 summary:string;  // 一句话说明，实习经历一般留空，教育经历可写 GPA / 主修课程
 bullets:string[];
 tags:string[];   // 技能标签、技术栈
 url:string;
};
export type SectionType='experience'|'education'|'project'|'skill'|'award'|'publication'|'custom';
export type ResumeSection={id:string;type:SectionType;title:string;items:ResumeItem[]};
export type ResumeBasics={name:string;headline:string;email:string;phone:string;location:string;summary:string;links:ResumeLink[]};
export type ResumeData={basics:ResumeBasics;sections:ResumeSection[]};
export type ResumeMeta={id:string;name:string;track:string;template:string;paper:string;created_at:string;updated_at:string};
export type Resume=ResumeMeta&{data:ResumeData};

/** 每种经历用到哪些字段、导出时长什么样，集中定义在这里，编辑器与预览共用。 */
export const SECTION_KINDS:{type:SectionType;label:string;defaultTitle:string;orgLabel:string;roleLabel:string;
 fields:{location:boolean;dates:boolean;role:boolean;summary:boolean;bullets:boolean;tags:boolean;url:boolean};hint:string}[]=[
 {type:'experience',label:'工作 / 实习经历',defaultTitle:'Experience',orgLabel:'公司',roleLabel:'职位',
  fields:{location:true,dates:true,role:true,summary:false,bullets:true,tags:false,url:false},
  hint:'导出为：第一行「公司 — 地点」右对齐起止时间，第二行斜体职位，下面是要点。'},
 {type:'education',label:'教育经历',defaultTitle:'Education',orgLabel:'学校',roleLabel:'学位与专业',
  fields:{location:true,dates:true,role:true,summary:true,bullets:false,tags:false,url:false},
  hint:'导出为：第一行「学校 — 地点」右对齐起止时间，第二行学位与专业，第三行补充说明（GPA、主修课程）。'},
 {type:'project',label:'项目经历',defaultTitle:'Projects',orgLabel:'项目名称',roleLabel:'角色',
  fields:{location:false,dates:true,role:true,summary:false,bullets:true,tags:true,url:true},
  hint:'导出为：第一行「项目名称 · 角色」右对齐时间，技术栈跟在标题后，下面是要点。'},
 {type:'skill',label:'技能',defaultTitle:'Skills',orgLabel:'分类',roleLabel:'',
  fields:{location:false,dates:false,role:false,summary:false,bullets:false,tags:true,url:false},
  hint:'导出为紧凑的「分类：条目、条目」列表，不占多余行高。'},
 {type:'award',label:'奖项 / 证书',defaultTitle:'Awards & Certifications',orgLabel:'名称',roleLabel:'授予方',
  fields:{location:false,dates:true,role:true,summary:true,bullets:false,tags:false,url:false},
  hint:'导出为单行「名称 — 授予方」右对齐时间，可另起一行补充说明。'},
 {type:'publication',label:'论文 / 发表',defaultTitle:'Publications',orgLabel:'标题',roleLabel:'刊物 / 会议',
  fields:{location:false,dates:true,role:true,summary:true,bullets:false,tags:false,url:true},
  hint:'导出为「标题」加斜体刊物名与时间，可附链接。'},
 {type:'custom',label:'自定义板块',defaultTitle:'Additional',orgLabel:'标题',roleLabel:'副标题',
  fields:{location:true,dates:true,role:true,summary:true,bullets:true,tags:true,url:true},
  hint:'所有字段都可用，留空的不会出现在导出结果里。'},
];
export const KIND=Object.fromEntries(SECTION_KINDS.map(k=>[k.type,k])) as Record<SectionType,typeof SECTION_KINDS[number]>;
export const TEMPLATES=[
 {id:'classic',name:'经典衬线',note:'衬线标题配无衬线正文，细分隔线，单栏排版，适合投递大多数美国公司。'},
 {id:'modern',name:'现代无衬线',note:'全无衬线，板块标题带色块强调，姓名更醒目。'},
 {id:'compact',name:'紧凑',note:'字号与行距更收敛，经历多、想压进一页时用。'},
];
export const PAPERS=[{id:'letter',name:'Letter（美国标准）'},{id:'a4',name:'A4'}];

export const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
export function emptyItem():ResumeItem{return {id:uid(),org:'',role:'',location:'',start:'',end:'',current:false,summary:'',bullets:[''],tags:[],url:''}}
export function emptySection(type:SectionType):ResumeSection{return {id:uid(),type,title:KIND[type].defaultTitle,items:[emptyItem()]}}
export function emptyResume():ResumeData{
 return {basics:{name:'',headline:'',email:'',phone:'',location:'',summary:'',links:[]},
  sections:[emptySection('education'),emptySection('experience'),emptySection('project'),emptySection('skill')]};
}
const str=(v:unknown)=>typeof v==='string'?v:v==null?'':String(v);
const list=(v:unknown)=>Array.isArray(v)?v:[];
/** 把任意来源（导入的 JSON、旧版本数据）收敛成合法结构，缺字段补空，多余字段丢弃。 */
export function normalizeResume(input:unknown):ResumeData{
 const raw=(input&&typeof input==='object'?input:{}) as any;
 const b=(raw.basics&&typeof raw.basics==='object'?raw.basics:{}) as any;
 const basics:ResumeBasics={name:str(b.name),headline:str(b.headline),email:str(b.email),phone:str(b.phone),location:str(b.location),summary:str(b.summary),
  links:list(b.links).map((l:any)=>({label:str(l?.label),url:str(l?.url)})).filter(l=>l.label||l.url)};
 const sections=list(raw.sections).map((s:any)=>{
  const type:SectionType=KIND[s?.type as SectionType]?s.type:'custom';
  return {id:str(s?.id)||uid(),type,title:str(s?.title)||KIND[type].defaultTitle,
   items:list(s?.items).map((i:any)=>({id:str(i?.id)||uid(),org:str(i?.org),role:str(i?.role),location:str(i?.location),
    start:str(i?.start),end:str(i?.end),current:!!i?.current,summary:str(i?.summary),
    bullets:list(i?.bullets).map(str),tags:list(i?.tags).map(str).filter(Boolean),url:str(i?.url)}))};
 });
 return {basics,sections:sections.length?sections:emptyResume().sections};
}
/** 导出前清掉空白内容，保证「留空的字段不会在 PDF 里留下空行」。 */
export function tidy(data:ResumeData):ResumeData{
 const trim=(s:string)=>s.trim();
 return {basics:{...data.basics,name:trim(data.basics.name),headline:trim(data.basics.headline),email:trim(data.basics.email),
   phone:trim(data.basics.phone),location:trim(data.basics.location),summary:trim(data.basics.summary),
   links:data.basics.links.map(l=>({label:trim(l.label),url:trim(l.url)})).filter(l=>l.url||l.label)},
  sections:data.sections.map(s=>({...s,title:trim(s.title),
   items:s.items.map(i=>({...i,org:trim(i.org),role:trim(i.role),location:trim(i.location),start:trim(i.start),end:trim(i.end),
    summary:trim(i.summary),bullets:i.bullets.map(trim).filter(Boolean),tags:i.tags.map(trim).filter(Boolean),url:trim(i.url)}))
    .filter(i=>i.org||i.role||i.summary||i.bullets.length||i.tags.length)}))
   .filter(s=>s.items.length)};
}
export const dateRange=(i:ResumeItem)=>{const end=i.current?'至今':i.end.trim();const start=i.start.trim();return start&&end?`${start} – ${end}`:start||end};
