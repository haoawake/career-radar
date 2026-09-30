// 由探测结果生成来源注册表：
// lib/platform-sources.json  招聘平台托管的公司招聘板（Greenhouse / Ashby / Lever / SmartRecruiters）
// lib/company-sources.json   公司自建招聘系统（Workday 企业站）
import fs from 'node:fs';
import { majorKeys } from './major-companies.mjs';
import { workdayFacets } from './workday-facets.mjs';
import { applyFixes } from './registry-fixes.mjs';
const read=p=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return []}};
const slug=n=>n.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const key=n=>n.toLowerCase().replace(/[^a-z0-9]/g,'');
const PLATFORM_URL={greenhouse:b=>`https://boards.greenhouse.io/${b}`,ashby:b=>`https://jobs.ashbyhq.com/${b}`,lever:b=>`https://jobs.lever.co/${b}`,smartrecruiters:b=>`https://jobs.smartrecruiters.com/${b}`};
const PRIORITY=['workday','greenhouse','ashby','lever','smartrecruiters'];
const CUSTOM_NAMES=new Set(['amazon','microsoft','google','apple']);


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
// 人工修正：自动发现漏掉或连错的来源（见 registry-fixes.mjs）
await applyFixes(company,platform);
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
