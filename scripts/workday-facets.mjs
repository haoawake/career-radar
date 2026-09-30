// Workday 招聘站点的探测与美国筛选项：make-registry.mjs 与 registry-fixes.mjs 共用。
import { isUS } from '../lib/sources.ts';
import { workdayBase } from '../lib/connectors.ts';
import { checkRobots } from './robots.mjs';
function flat(xs){return xs.flatMap(x=>[x,...(x.values?flat(x.values):[])])}
// 按办公地点筛美国时最多带多少个地点编号：Merck 119 个、Thermo Fisher 260 个都能正常返回，Comcast 的 408 个会让接口报 500
const MAX_LOCATION_IDS=300;
/** 美国筛选项：优先用国家筛选项；没有时按办公地点筛，有的租户叫 primarylocation（Moderna 的岗位连地点文字都没有，只能靠它）。 */
function usFacet(probe){
 const f=flat(probe.facets||[]);
 const country=f.find(x=>x.values?.some(v=>/^United States( of America)?$/i.test(v.descriptor)));
 if(country)return {[country.facetParameter]:country.values.filter(v=>/^United States( of America)?$/i.test(v.descriptor)).map(v=>v.id)};
 const locations=f.find(x=>/^(locations?|primary_?locations?)$/i.test(x.facetParameter||'')&&x.values?.some(v=>isUS(v.descriptor||'')));
 const picked=locations?.values.filter(v=>isUS(v.descriptor||''))||[];
 return picked.length&&picked.length<=MAX_LOCATION_IDS?{[locations.facetParameter]:picked.map(v=>v.id)}:null;
}
/** 美国岗位到 2000 条上限的大租户，再按职能大类收窄到技术相关岗位。 */
function familyFacet(probe){
 const families=flat(probe.facets||[]).find(x=>x.facetParameter==='jobFamilyGroup');
 const selected=families?.values.filter(v=>!/pharmacy|retail|nursing/i.test(v.descriptor)&&/technology|software|information|data|product|intern|marketing|digital|engineering|research|design|program|univ/i.test(v.descriptor))||[];
 return selected.length?{ids:selected.map(v=>v.id),label:selected.map(v=>v.descriptor).join(' / ')}:null;
}
function compose(us,family){
 const appliedFacets={...us,...(family?{jobFamilyGroup:family.ids}:{})};
 const scope=family?(us?'美国':'美国（逐条识别地点）')+' · '+family.label:us?'美国岗位':'美国岗位（逐条识别美国地点）';
 return {appliedFacets,usFiltered:!!us,scope};
}
/** 依据来源自身的筛选项，尽量让 Workday 只返回美国岗位；筛选项不可用时逐条识别地点。usTotal 默认按全部岗位数估。 */
export function workdayFacets(probe,usTotal=probe.total){return compose(usFacet(probe),usTotal>=2000?familyFacet(probe):null)}
/** 用官方 CXS 接口取一个站点的岗位总数与筛选项（只要一条岗位，筛选项随结果一起返回）。 */
export async function probeWorkday(host,tenant,board,appliedFacets={}){
 const r=await fetch(`https://${host}/wday/cxs/${tenant}/${board}/jobs`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({limit:1,offset:0,searchText:'',appliedFacets}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error(`${host}/${board} HTTP ${r.status}`);
 const d=await r.json();if(!Number.isInteger(d.total))throw Error(`${host}/${board} 返回格式异常`);
 return {total:d.total,facets:d.facets||[]};
}
/**
 * 探测一个 Workday 站点并生成注册表字段：先确认 robots.txt 允许请求它的数据接口，再按美国筛选并实测一次筛选是否可用
 * （地点编号太多时接口会报错，那就退回逐条识别），最后按美国岗位数决定要不要再按职能大类收窄。
 * 只检查实际请求的接口路径 /wday/cxs/…：不少租户禁止抓取招聘板网页（Disallow: /Zoom/），但没有限制这个接口。
 */
export async function workdayEntry({host,tenant,board}){
 const delay=await checkRobots(host,`/wday/cxs/${tenant}/${board}/jobs`);
 const base=workdayBase({host,tenant,board});
 const probe=await probeWorkday(host,tenant,board);
 let us=usFacet(probe),usTotal=probe.total;
 if(us){const checked=await probeWorkday(host,tenant,board,us).catch(()=>null);if(checked?.total)usTotal=checked.total;else us=null}
 return {host,tenant,board,careerUrl:base,...compose(us,usTotal>=2000?familyFacet(probe):null),...(delay?{delay}:{}),total:probe.total,usTotal};
}
