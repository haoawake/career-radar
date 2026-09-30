// 更新范围：来源已有六百多个，一轮全量要几千次官方请求，按需要挑范围能把一次更新压到几分钟内。
export const SCOPES=[
 {value:'stale',label:'需要更新的来源',hint:'跳过 6 小时内已成功更新的来源'},
 {value:'major',label:'精选大厂',hint:'名单里的知名大型科技与主要科技雇主'},
 {value:'region',label:'当前地区的来源',hint:'只更新在所选地区出现过岗位的公司；还没更新过的来源无从判断地区，会一并包含，完整跑过一轮后这个范围会明显变小'},
 {value:'group',label:'当前来源分类',hint:'只更新左侧选中的分类'},
 {value:'marked',label:'我标记过的公司',hint:'有重点或已投递岗位的公司'},
 {value:'all',label:'全部来源（强制重跑）',hint:'忽略更新时间，重新收集所有来源'},
];
export const isFresh=(s:any)=>s.status==='ok'&&s.last_success&&Date.now()-Date.parse(s.last_success)<6*3600000;
/** 来源分类：company / platform 按招聘系统类型分，major（精选大厂）按名单分，与前两者交叉。 */
export const inGroup=(s:{group?:string;tier?:string},group:string)=>group==='all'||(group==='major'?s.tier==='major':s.group===group);
type Ranked={tier?:string;jobCount?:number;name?:string};
/** 来源排序：精选大厂在前，其次按已收录岗位数，再按名称。公司下拉框与来源目录都按这个顺序。 */
export const bySize=(a:Ranked,b:Ranked)=>(b.tier==='major'?1:0)-(a.tier==='major'?1:0)||(b.jobCount||0)-(a.jobCount||0)||String(a.name).localeCompare(String(b.name));
/** 按所选范围挑出这次要更新的来源；除“全部来源”外都会跳过刚更新过的。 */
export function inScope(data:any,scope:string,group:string){
 const all=data.sources||[],region=data.regionCounts||{};
 if(scope==='all')return all;
 // 没有选地区（或该地区还没有任何已收录岗位）时，“当前地区”退回成“需要更新的来源”，避免范围看起来失效。
 if(scope==='region'&&!Object.keys(region).length)scope='stale';
 const picked=scope==='major'?all.filter((s:any)=>s.tier==='major')
  :scope==='region'?all.filter((s:any)=>region[s.id]||!s.last_success)
  :scope==='group'?all.filter((s:any)=>inGroup(s,group))
  :scope==='marked'?all.filter((s:any)=>s.markedCount>0)
  :all;
 return picked.filter((s:any)=>!isFresh(s));
}
// 实测本机并发 8 时的稳定吞吐约 6.6 页/秒（并发提到 12、16 没有提升），用它把范围换算成大致耗时。
const PAGES_PER_SECOND=6.6;
/** 估算一个来源要翻多少页；没更新过的来源没有基数，按一页计，实际会更多。 */
export function estimatePages(s:any){
 const total=s.run_total||s.count||0;
 if(['workday','google','apple'].includes(s.type))return Math.max(1,Math.ceil(total/20));
 if(['microsoft','eightfold'].includes(s.type))return Math.max(1,Math.ceil(total/10));
 if(['successfactors','avature'].includes(s.type))return Math.max(1,Math.ceil(total/15));// 网页类每页 10–25 条
 if(['smartrecruiters','amazon','oracle','jibe','ibm','mckinsey'].includes(s.type))return Math.max(1,Math.ceil(total/100));
 return 1;
}
/** 把一批来源换算成大致耗时文案。 */
export function estimateTime(sources:any[]){
 const pages=sources.reduce((n,s)=>n+estimatePages(s),0);
 const seconds=pages/PAGES_PER_SECOND;
 if(!sources.length)return '';
 return seconds<90?`约 ${Math.max(1,Math.round(seconds))} 秒`:`约 ${Math.round(seconds/60)} 分钟`;
}
