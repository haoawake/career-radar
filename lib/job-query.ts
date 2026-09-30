import { SOURCES } from './sources';
import { METROS } from './us-locations';
import { LEVELS,VISAS,VISA_BLOCKED } from './job-signals';
import { inGroup } from './update-scope';
const METRO_IDS=new Set(METROS.map(m=>m.id));
// 来源已有数百个，按分类筛选时不能用绑定参数（D1 限制变量数量）；来源编号是注册表里的固定短横线小写标识，这里再校验一次后内联。
export const GROUP_IN:Record<string,string>=Object.fromEntries(['company','platform','major'].map(g=>[g,SOURCES.filter(s=>inGroup(s,g)).map(s=>{if(!/^[a-z0-9-]+$/.test(s.id))throw Error('来源编号含非法字符：'+s.id);return `'${s.id}'`}).join(',')]));
export const escapeLike=(v:string)=>v.replace(/[\\%_]/g,'\\$&');
export type Filters={q:string;role:string;kind:string;level:string;visa:string;view:string;group:string;company:string;metro:string;city:string;page:number};
export function readFilters(p:URLSearchParams):Filters{
 return {q:(p.get('q')||'').slice(0,200),role:p.get('role')||'',kind:p.get('kind')||'',level:p.get('level')||'',visa:p.get('visa')||'',view:p.get('view')||'',group:p.get('group')||'',company:p.get('company')||'',
  metro:(p.get('metro')||'').slice(0,40),city:(p.get('city')||'').slice(0,60),page:Math.max(1,Math.min(100000,Number(p.get('page'))||1))};
}
/** 地点字段按 |值|值| 存放，用 LIKE 做整段匹配，避免 bay-area 命中 bay-area-north 之类的前缀。 */
export function locationClause(metro:string,city:string,clauses:string[],values:unknown[]){
 if(city){clauses.push("cities LIKE ? ESCAPE '\\'");values.push('%|'+escapeLike(city)+'|%')}
 if(metro==='remote')clauses.push('remote=1');
 else if(metro&&METRO_IDS.has(metro)){clauses.push("metros LIKE ? ESCAPE '\\'");values.push('%|'+metro+'|%')}
}
/** 除地点以外的筛选条件；地点条件单独加，便于分面统计时排除自身。 */
export function baseClause(f:Filters){
 const clauses:string[]=[],values:unknown[]=[];
 if(f.q){clauses.push("(title LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\')");const pattern='%'+escapeLike(f.q)+'%';values.push(pattern,pattern,pattern)}
 if(f.role==='全部已归类职业')clauses.push("role<>'其他'");
 else if(f.role&&f.role!=='全部职业'){clauses.push('role=?');values.push(f.role)}
 if(f.kind&&f.kind!=='全部类型'){clauses.push('kind=?');values.push(f.kind)}
 // 「排除」类筛选保留字段还是空的岗位（尚未补算或还没有描述）：拿不准的宁可留着，不替用户藏起来
 if(f.level==='排除资深'){clauses.push('(level IS NULL OR level<>?)');values.push('资深及以上')}
 else if((LEVELS as readonly string[]).includes(f.level)){clauses.push('level=?');values.push(f.level)}
 if(f.visa==='排除签证受限'){clauses.push(`(visa IS NULL OR visa NOT IN (${VISA_BLOCKED.map(()=>'?').join(',')}))`);values.push(...VISA_BLOCKED)}
 else if(f.visa==='暂无描述')clauses.push('visa IS NULL');
 else if((VISAS as readonly string[]).includes(f.visa)){clauses.push('visa=?');values.push(f.visa)}
 if(f.view==='重点岗位')clauses.push('starred=1');
 if(f.view==='已投递')clauses.push('applied=1');
 if(f.view==='新发现'){clauses.push('first_seen>=?');values.push(new Date(Date.now()-86400000).toISOString())}
 if(GROUP_IN[f.group])clauses.push(`source IN (${GROUP_IN[f.group]})`);
 if(f.company){clauses.push('source=?');values.push(f.company)}
 return {clauses,values};
}
export const whereOf=(clauses:string[])=>clauses.length?' WHERE '+clauses.join(' AND '):'';
