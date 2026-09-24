// 探测 Greenhouse / Lever / Ashby / SmartRecruiters / Workable 上的公司招聘板，并核对公司名称。
import fs from 'node:fs';
import { COMPANIES, slugs } from './companies.mjs';
import { EXTRA } from './companies-extra.mjs';
const MODE=process.argv[2]||'';
// retry 模式只补探当前注册表里还没有的公司：首轮探测可能因为网络抖动漏掉本来可用的招聘板。
const registered=MODE==='retry'?new Set([...JSON.parse(fs.readFileSync('lib/company-sources.json','utf8')),...JSON.parse(fs.readFileSync('lib/platform-sources.json','utf8'))].map(x=>x.name.toLowerCase().replace(/[^a-z0-9]/g,''))):null;
const ALL=[...COMPANIES,...EXTRA].filter((v,i,a)=>a.indexOf(v)===i);
const LIST=MODE==='retry'?ALL.filter(n=>!registered.has(n.toLowerCase().replace(/[^a-z0-9]/g,''))):MODE==='extra'?EXTRA:COMPANIES;
const OUT=MODE==='retry'?'outputs/research/board-probes-retry.json':MODE==='extra'?'outputs/research/board-probes-extra.json':'outputs/research/board-probes.json';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const match=(a,b)=>{const x=norm(a),y=norm(b);return !!x&&!!y&&(x.includes(y)||y.includes(x))};
async function get(url){const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!r.ok)return null;const t=await r.text();try{return JSON.parse(t)}catch{return null}}
const probes={
 async greenhouse(slug,name){const b=await get(`https://boards-api.greenhouse.io/v1/boards/${slug}`);if(!b?.name||!match(b.name,name))return null;const d=await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);if(!Array.isArray(d?.jobs)||!d.jobs.length)return null;return {official:b.name,total:d.jobs.length,sample:d.jobs.slice(0,2).map(j=>`${j.title} @ ${j.location?.name}`)}},
 async lever(slug,name){const d=await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);if(!Array.isArray(d)||!d.length)return null;const host=d[0].hostedUrl||'';if(!host.includes(`/${slug}/`))return null;return {official:name,total:d.length,sample:d.slice(0,2).map(j=>`${j.text} @ ${j.categories?.location}`)}},
 async ashby(slug,name){const d=await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);if(!Array.isArray(d?.jobs)||!d.jobs.length)return null;return {official:name,total:d.jobs.length,sample:d.jobs.slice(0,2).map(j=>`${j.title} @ ${j.location}`)}},
 async smartrecruiters(slug,name){const d=await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=10`);if(!Number.isInteger(d?.totalFound)||!d.totalFound||!d.content?.length)return null;const official=d.content[0].company?.name;if(official&&!match(official,name))return null;return {official:official||name,total:d.totalFound,sample:d.content.slice(0,2).map(j=>`${j.name} @ ${j.location?.city}`)}},
 async workable(slug,name){const d=await get(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`);if(!d?.name||!match(d.name,name)||!Array.isArray(d.jobs)||!d.jobs.length)return null;return {official:d.name,total:d.jobs.length,sample:d.jobs.slice(0,2).map(j=>`${j.title} @ ${j.location?.city}`)}},
};
const platforms=Object.keys(probes);
const results=[];let next=0,done=0;
await Promise.all(Array.from({length:20},async()=>{while(next<LIST.length){const name=LIST[next++];const cands=slugs(name);
 for(const platform of platforms){let hit=null;
  for(const slug of cands){try{hit=await probes[platform](slug,name)}catch{hit=null}if(hit){results.push({name,platform,slug,...hit});console.log(`${platform.padEnd(15)} ${slug.padEnd(24)} ${hit.total}`);break}}
 }
 if(++done%40===0)console.error(`... ${done}/${LIST.length}`);
}}));
fs.writeFileSync(OUT,JSON.stringify(results,null,2));
console.log('FOUND',results.length,'boards over',LIST.length,'companies');
