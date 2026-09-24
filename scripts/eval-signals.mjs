// 用本地库里的真实岗位检验级别与签证规则：打印分布，并按类别随机抽样命中原文，供人工核对。
// 用法：node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/eval-signals.mjs <jobs.sqlite> [抽样数]
import { DatabaseSync } from 'node:sqlite';
import { visa, level } from '../lib/job-signals.ts';
const [file,n='8']=process.argv.slice(2);
if(!file)throw Error('请传入 D1 本地 sqlite 文件路径（建议先复制一份）');
const db=new DatabaseSync(file,{readOnly:true});
const rows=db.prepare("SELECT title,kind,role,description FROM jobs WHERE active=1").all();
const t0=performance.now();
const tally=(xs)=>Object.entries(xs.reduce((o,x)=>(o[x]=(o[x]||0)+1,o),{})).sort((a,b)=>b[1]-a[1]);
const levels=rows.map(r=>level(r.title,r.kind==='实习'));
const judged=rows.filter(r=>r.description).map(r=>({...r,...visa(r.description)}));
console.log(`${rows.length} 条在招岗位，${judged.length} 条有描述，规则耗时 ${Math.round(performance.now()-t0)}ms`);
console.log('级别（全部）:',tally(levels));
console.log('级别（已归类职业）:',tally(rows.map((r,i)=>r.role!=='其他'?levels[i]:null).filter(Boolean)));
console.log('签证（有描述）:',tally(judged.map(r=>r.visa)));
const shuffle=(xs)=>xs.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
// 同一家公司的模板会重复成百上千次，按命中原文去重后再抽样，才看得到不同写法
const distinct=(xs,key)=>[...new Map(xs.map(r=>[key(r),r])).values()];
for(const v of ['需安全许可','限公民 / 绿卡','不提供担保','可提供担保']){
 const d=distinct(judged.filter(r=>r.visa===v),r=>r.note.replace(/[^a-z]/gi,'').slice(0,80).toLowerCase());
 console.log(`\n## ${v}（${d.length} 种不同写法）`);for(const r of shuffle(d).slice(0,+n))console.log(` - [${r.title.slice(0,50)}] ${r.note}`);
}
for(const l of ['资深及以上','中级','应届 / 入门','未注明']){
 const titles=[...new Set(rows.filter((r,i)=>levels[i]===l&&r.role!=='其他').map(r=>r.title.trim()))];
 console.log(`\n## 级别 ${l}（已归类职业，${titles.length} 个不同标题）\n  `+shuffle(titles).slice(0,+n*2).join('\n  '));
}
// 漏判排查：判为「未提及」但正文里签证词与 sponsor 挨得很近的
const suspect=judged.filter(r=>r.visa==='未提及'&&/\b(visa|h-?1b|immigration|work authorization)\b.{0,60}sponsor|sponsor.{0,60}\b(visa|h-?1b|immigration)\b/i.test(r.description));
console.log(`\n## 疑似漏判（未提及但签证词挨着 sponsor）${suspect.length} 条`);
for(const r of shuffle(suspect).slice(0,+n)){const m=r.description.replace(/\s+/g,' ').match(/.{0,120}\b(visa|h-?1b|immigration|work authorization)\b.{0,60}sponsor.{0,80}|.{0,80}sponsor.{0,60}\b(visa|h-?1b|immigration)\b.{0,120}/i);console.log(` - [${r.title.slice(0,40)}] ${m?.[0]}`)}
