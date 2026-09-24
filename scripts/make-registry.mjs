// 由探测结果生成来源注册表：
// lib/platform-sources.json  招聘平台托管的公司招聘板（Greenhouse / Ashby / Lever / SmartRecruiters）
// lib/company-sources.json   公司自建招聘系统（Workday 企业站）
import fs from 'node:fs';
import { isUS } from '../lib/sources.ts';
import { majorKeys } from './major-companies.mjs';
const read=p=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return []}};
const slug=n=>n.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const key=n=>n.toLowerCase().replace(/[^a-z0-9]/g,'');
const PLATFORM_URL={greenhouse:b=>`https://boards.greenhouse.io/${b}`,ashby:b=>`https://jobs.ashbyhq.com/${b}`,lever:b=>`https://jobs.lever.co/${b}`,smartrecruiters:b=>`https://jobs.smartrecruiters.com/${b}`};
const PRIORITY=['workday','greenhouse','ashby','lever','smartrecruiters'];
const CUSTOM_NAMES=new Set(['amazon','microsoft','google','apple']);

function flat(xs){return xs.flatMap(x=>[x,...(x.values?flat(x.values):[])])}
/** 依据来源自身的筛选项，尽量让 Workday 只返回美国岗位；筛选项不可用时逐条识别地点。 */
function workdayFacets(probe){
 const f=flat(probe.facets||[]);let appliedFacets={},usFiltered=false,scope='美国岗位';
 const country=f.find(x=>x.values?.some(v=>/^United States( of America)?$/i.test(v.descriptor)));
 if(country){appliedFacets[country.facetParameter]=country.values.filter(v=>/^United States( of America)?$/i.test(v.descriptor)).map(v=>v.id);usFiltered=true}
 else{const locations=f.find(x=>/^(locations|location)$/i.test(x.facetParameter||'')&&x.values?.some(v=>isUS(v.descriptor||'')));
  if(locations){const picked=locations.values.filter(v=>isUS(v.descriptor||''));if(picked.length<=80){appliedFacets[locations.facetParameter]=picked.map(v=>v.id);usFiltered=true}}}
 if(!usFiltered)scope='美国岗位（逐条识别美国地点）';
 if(probe.total>=2000){
  const families=f.find(x=>x.facetParameter==='jobFamilyGroup');
  const selected=families?.values.filter(v=>!/pharmacy|retail|nursing/i.test(v.descriptor)&&/technology|software|information|data|product|intern|marketing|digital|engineering|research|design|program|univ/i.test(v.descriptor));
  if(selected?.length){appliedFacets.jobFamilyGroup=selected.map(v=>v.id);scope=(usFiltered?'美国':'美国（逐条识别地点）')+' · '+selected.map(v=>v.descriptor).join(' / ')}
 }
 return {appliedFacets,usFiltered,scope};
}

const existing=read('lib/company-sources.json');
const discovered=read('outputs/research/workday-discovered.json');
const boards=[...read('outputs/research/board-probes.json'),...read('outputs/research/board-probes-extra.json'),...read('outputs/research/board-probes-retry.json')];

const taken=new Map();// 公司名 -> 已选来源；同一家公司只保留一个来源，避免同岗位重复收录
const company=[],platform=[];
for(const s of existing){taken.set(key(s.name),'workday');company.push({...s,tier:majorKeys.has(key(s.name))?'major':'other'})}
for(const p of discovered){
 if(taken.has(key(p.name))||CUSTOM_NAMES.has(key(p.name)))continue;
 taken.set(key(p.name),'workday');
 company.push({id:slug(p.name),name:p.name,type:'workday',group:'company',tier:majorKeys.has(key(p.name))?'major':'other',host:p.host,tenant:p.tenant,board:p.board,careerUrl:`https://${p.host}/en-US/${p.board}`,...workdayFacets(p)});
}
for(const type of PRIORITY.slice(1))for(const b of boards.filter(x=>x.platform===type)){
 // 用招聘板上的正式公司名去重：候选名单里的不同写法（Blend / Blend Labs）可能指向同一家公司。
 const name=b.official||b.name,k=key(name);
 if(taken.has(k)||taken.has(key(b.name))||CUSTOM_NAMES.has(k))continue;
 taken.set(k,type);taken.set(key(b.name),type);
 platform.push({id:slug(name),name,type,group:'platform',tier:majorKeys.has(k)?'major':'other',board:b.slug,careerUrl:PLATFORM_URL[type](b.slug),scope:type==='smartrecruiters'?'美国岗位（按来源国家字段识别）':'美国岗位（逐条识别美国地点）'});
}
for(const list of [company,platform]){const ids=new Set();for(const s of list){let id=s.id,n=2;while(ids.has(id))id=s.id+'-'+n++;s.id=id;ids.add(id)}}
// 首批接入的来源必须始终在册：它们的编号是数据库里岗位编号的前缀，漏掉会让历史标记失去归属。
const CORE=['anthropic','figma','stripe','discord','databricks','reddit','airbnb','cloudflare','openai','notion','ramp','perplexity'];
const missing=CORE.filter(id=>![...company,...platform].some(s=>s.id===id));
if(missing.length)throw Error('探测结果缺少已接入来源，请重新探测后再生成：'+missing.join(','));
const clash=company.filter(c=>platform.some(p=>p.id===c.id));
if(clash.length)throw Error('来源编号在两个分类间重复：'+clash.map(c=>c.id).join(','));
fs.writeFileSync('lib/company-sources.json',JSON.stringify(company,null,1));
fs.writeFileSync('lib/platform-sources.json',JSON.stringify(platform,null,1));
console.log('公司自建招聘系统',company.length+CUSTOM_NAMES.size,'家（含 4 家单独实现）；平台托管招聘板',platform.length,'家');
console.log('Workday 中已按来源筛选出美国岗位的',company.filter(c=>c.usFiltered).length,'家');
console.log('精选大厂',[...company,...platform].filter(s=>s.tier==='major').length+CUSTOM_NAMES.size,'家');
