// 对注册表中的来源做真实抓取抽样：验证连接器可用、美国筛选生效、地区字段能落到具体城市。
import fs from 'node:fs';
import { SOURCES } from '../lib/sources.ts';
import { fetchPage } from '../lib/connectors.ts';
const only=process.argv[2];// 可传来源类型，如 lever / smartrecruiters / workday
const sample=only?SOURCES.filter(s=>s.type===only):SOURCES;
const limit=Number(process.argv[3]||sample.length);
const picked=sample.filter((_,i)=>i%Math.max(1,Math.ceil(sample.length/limit))===0);
const results=[];let next=0;
await Promise.all(Array.from({length:8},async()=>{while(next<picked.length){const s=picked[next++];
 try{const p=await fetchPage(s);
  const located=p.jobs.filter(j=>j.cities).length,metro=p.jobs.filter(j=>j.metros).length;
  results.push({id:s.id,name:s.name,type:s.type,group:s.group,ok:true,jobs:p.jobs.length,total:p.total,located,metro,sample:p.jobs.slice(0,2).map(j=>`${j.title} @ ${j.location} -> ${j.cities||j.metros||'未识别'}`)});
 }catch(e){results.push({id:s.id,name:s.name,type:s.type,group:s.group,ok:false,error:e.message})}
}}));
fs.mkdirSync('outputs/research',{recursive:true});
fs.writeFileSync('outputs/research/collection-results.json',JSON.stringify(results,null,2));
const ok=results.filter(r=>r.ok),bad=results.filter(r=>!r.ok);
const jobs=ok.reduce((n,r)=>n+r.jobs,0),located=ok.reduce((n,r)=>n+r.located,0),metro=ok.reduce((n,r)=>n+r.metro,0);
console.log('注意：本脚本跑在 Node 里，与线上的 Workers 运行时不完全等价。jobs.apple.com 会按 TLS 指纹拦截，Node 能取到、Workers 一律 403，请以应用内的来源状态为准。');
console.log(`抽样 ${results.length} 个来源：成功 ${ok.length}，失败 ${bad.length}`);
console.log(`首页共 ${jobs} 个美国岗位，其中识别到具体城市 ${located}（${(located/jobs*100||0).toFixed(1)}%），识别到都会区 ${metro}（${(metro/jobs*100||0).toFixed(1)}%）`);
for(const b of bad.slice(0,25))console.log('失败',b.type,b.id,b.error);
for(const r of ok.slice(0,5))console.log(r.id,r.sample[0]||'');
