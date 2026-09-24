// 导出规则的唯一真源：给定一条经历和它所属的板块类型，算出它在 PDF 里要出现哪几行、每行放什么。
// 组件只负责把这个结果画成 HTML，所以规则本身可以直接被测试覆盖——
// 「某一段实习经历导出就一定长那样」靠的是这里，而不是靠 JSX 里散落的条件判断。
import { dateRange,type ResumeItem,type SectionType } from './resume-types';
export type RenderedItem={
 /** 首行左侧：主标题 + 可选的次要信息（地点或角色），中间用固定分隔符 */
 head:{primary:string;secondary:string;separator:string};
 /** 首行右侧的时间区间 */
 when:string;
 /** 第二行，斜体（职位 / 学位 / 刊物） */
 role:string;
 /** 补充说明行（GPA、一句话说明） */
 note:string;
 /** 标签行（技术栈） */
 tags:string;
 bullets:string[];
 link:string;
 /** 技能板块专用的紧凑一行；非技能板块为 null */
 skill:{label:string;values:string}|null;
};
const EMPTY:RenderedItem={head:{primary:'',secondary:'',separator:''},when:'',role:'',note:'',tags:'',bullets:[],link:'',skill:null};
const clean=(s:string)=>String(s||'').trim();
const bullets=(xs:string[])=>(xs||[]).map(clean).filter(Boolean);
export function renderItem(item:ResumeItem,type:SectionType):RenderedItem{
 const when=dateRange(item),org=clean(item.org),role=clean(item.role),location=clean(item.location);
 const note=clean(item.summary),tags=(item.tags||[]).map(clean).filter(Boolean),url=clean(item.url);
 switch(type){
  case 'skill':
   return {...EMPTY,skill:tags.length?{label:org,values:tags.join('、')}:null};
  case 'award':
   return {...EMPTY,head:{primary:org,secondary:role,separator:' — '},when,note};
  case 'publication':
   return {...EMPTY,head:{primary:org,secondary:'',separator:''},when,role,note,link:url};
  case 'education':
   return {...EMPTY,head:{primary:org,secondary:location,separator:' — '},when,role,note};
  case 'project':
   return {...EMPTY,head:{primary:org,secondary:role,separator:' · '},when,tags:tags.join(' · '),bullets:bullets(item.bullets),link:url};
  default: // experience 与 custom 共用同一套：机构 — 地点 / 职位 / 说明 / 标签 / 要点
   return {head:{primary:org,secondary:location,separator:' — '},when,role,note,tags:tags.join(' · '),
    bullets:bullets(item.bullets),link:url,skill:null};
 }
}
/** 这条经历在导出后是否会留下任何可见内容；为空的条目不占位，避免 PDF 里出现空行。 */
export function hasContent(r:RenderedItem){
 return !!(r.skill?.values||r.head.primary||r.head.secondary||r.when||r.role||r.note||r.tags||r.bullets.length||r.link);
}
