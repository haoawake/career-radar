import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResume, tidy, emptyResume, dateRange, SECTION_KINDS, KIND, TEMPLATES, PAPERS } from '../lib/resume-types.ts';
import { importResume, fromText, fromJson } from '../lib/resume-import.ts';
import { renderItem, hasContent } from '../lib/resume-render.ts';

test('每种经历都声明了自己的字段与导出规则',()=>{
 const types=new Set();
 for(const k of SECTION_KINDS){
  assert.ok(!types.has(k.type),'经历类型重复：'+k.type);types.add(k.type);
  assert.ok(k.label&&k.defaultTitle&&k.orgLabel,k.type+' 缺少标注');
  assert.ok(k.hint.length>10,k.type+' 没有说明导出后长什么样');
  assert.equal(KIND[k.type],k);
 }
 assert.ok(TEMPLATES.length>=2&&PAPERS.length>=2);
});

test('异常输入不会污染简历结构',()=>{
 const junk=normalizeResume({basics:{name:42,links:[{url:'https://a'},'bad']},sections:[{type:'不存在的类型',items:[{bullets:'不是数组',tags:null}]},null]});
 assert.equal(junk.basics.name,'42');
 assert.deepEqual(junk.basics.links,[{label:'',url:'https://a'}]);
 assert.equal(junk.sections[0].type,'custom');           // 未知类型退回自定义板块
 assert.deepEqual(junk.sections[0].items[0].bullets,[]);
 assert.deepEqual(junk.sections[0].items[0].tags,[]);
 assert.ok(normalizeResume(null).sections.length);        // 空输入也给出可编辑的骨架
 assert.ok(normalizeResume(undefined).basics.name==='');
});

test('导出前会清掉空白，不在 PDF 里留空行',()=>{
 const data=normalizeResume({basics:{name:'  张三  ',links:[{label:'',url:'  '}]},sections:[
  {type:'experience',title:' Experience ',items:[
   {org:' Figma ',role:'',bullets:['  做了事  ','','   '],tags:['  ']},
   {org:'',role:'',bullets:[]},                            // 整条空白，应被丢弃
  ]},
  {type:'project',title:'Projects',items:[{org:'',bullets:[]}]},// 整个板块空白，应被丢弃
 ]});
 const out=tidy(data);
 assert.equal(out.basics.name,'张三');
 assert.deepEqual(out.basics.links,[]);
 assert.equal(out.sections.length,1);
 assert.equal(out.sections[0].items.length,1);
 assert.deepEqual(out.sections[0].items[0].bullets,['做了事']);
 assert.deepEqual(out.sections[0].items[0].tags,[]);
});

test('时间区间按「至今」优先',()=>{
 assert.equal(dateRange({start:'2025.06',end:'2025.09',current:false}),'2025.06 – 2025.09');
 assert.equal(dateRange({start:'2025.06',end:'2025.09',current:true}),'2025.06 – 至今');
 assert.equal(dateRange({start:'',end:'2025.09',current:false}),'2025.09');
 assert.equal(dateRange({start:'',end:'',current:false}),'');
});

test('JSON 往返无损',()=>{
 const original=emptyResume();
 original.basics.name='Zhang San';original.basics.email='z@example.com';
 original.sections[1].items[0]={...original.sections[1].items[0],org:'Figma',role:'SWE Intern',location:'San Francisco, CA',
  start:'2025.06',end:'2025.09',bullets:['把 P99 从 1.2s 降到 30ms']};
 const {data,notes}=fromJson(JSON.stringify({name:'x',data:original}));
 assert.deepEqual(data,normalizeResume(original));
 assert.ok(notes.length);
 assert.throws(()=>fromJson('{'),/不是合法的 JSON/);
 assert.throws(()=>fromJson('{"foo":1}'),/无法识别/);
});

test('JSON Resume 标准格式可导入',()=>{
 const {data}=fromJson(JSON.stringify({basics:{name:'Li Si',email:'li@example.com',location:{city:'Boston',region:'MA'},
   profiles:[{network:'GitHub',url:'https://github.com/lisi'}]},
  work:[{name:'Stripe',position:'Backend Intern',location:'Seattle, WA',startDate:'2025-06',endDate:'2025-09',highlights:['做了 A','做了 B']}],
  education:[{institution:'Northeastern University',studyType:'MS',area:'Computer Science',startDate:'2024-09',score:'3.9'}],
  skills:[{name:'Languages',keywords:['Go','TypeScript']}]}));
 assert.equal(data.basics.name,'Li Si');
 assert.equal(data.basics.location,'Boston, MA');
 assert.deepEqual(data.basics.links,[{label:'GitHub',url:'https://github.com/lisi'}]);
 const work=data.sections.find(s=>s.type==='experience');
 assert.equal(work.items[0].org,'Stripe');
 assert.equal(work.items[0].role,'Backend Intern');
 assert.deepEqual(work.items[0].bullets,['做了 A','做了 B']);
 const edu=data.sections.find(s=>s.type==='education');
 assert.equal(edu.items[0].role,'MS, Computer Science');
 assert.equal(edu.items[0].summary,'GPA 3.9');
 assert.deepEqual(data.sections.find(s=>s.type==='skill').items[0].tags,['Go','TypeScript']);
});

test('纯文本简历能还原出板块与条目',()=>{
 const text=`Zhang San
Boston, MA | +1 617 555 0100 | zhang@example.com | https://github.com/zhangsan

EDUCATION
Northeastern University — Boston, MA        2024.09 – 2026.05
Master of Science in Computer Science

EXPERIENCE
Figma — San Francisco, CA                   2025.06 – 2025.09
Software Engineer Intern
• 把接口 P99 延迟从 1.2s 降到 30ms
• 接入 13 万条岗位数据的实时筛选

SKILLS
Languages: TypeScript, Go, Python
`;
 const {data,notes}=fromText(text);
 assert.equal(data.basics.name,'Zhang San');
 assert.equal(data.basics.email,'zhang@example.com');
 assert.ok(data.basics.links.some(l=>l.label==='GitHub'));
 const edu=data.sections.find(s=>s.type==='education');
 assert.equal(edu.items[0].org,'Northeastern University');
 assert.equal(edu.items[0].start,'2024.09');
 assert.equal(edu.items[0].end,'2026.05');
 const exp=data.sections.find(s=>s.type==='experience');
 assert.equal(exp.items[0].org,'Figma');
 assert.equal(exp.items[0].location,'San Francisco, CA');
 assert.equal(exp.items[0].bullets.length,2);
 const skill=data.sections.find(s=>s.type==='skill');
 assert.equal(skill.items[0].org,'Languages');
 assert.deepEqual(skill.items[0].tags,['TypeScript','Go','Python']);
 // 启发式解析必须提示需要核对，不能让人以为是无损还原
 assert.ok(notes.some(n=>n.includes('核对')));
});

test('至今与进行中的经历',()=>{
 const {data}=fromText(`Name Here\n\nEXPERIENCE\nOpenAI — San Francisco, CA   2026.01 – Present\nResearch Engineer\n• 做事\n`);
 const exp=data.sections.find(s=>s.type==='experience');
 assert.equal(exp.items[0].current,true);
 assert.equal(exp.items[0].end,'');
 assert.equal(dateRange(exp.items[0]),'2026.01 – 至今');
});

test('导入入口按内容自动分流',()=>{
 assert.ok(importResume('{"basics":{"name":"A"},"work":[]}').data.basics.name==='A');
 assert.ok(importResume('B\n\nEXPERIENCE\nX — Y   2025.01 – 2025.02\n• z').data.sections.length);
 assert.throws(()=>importResume('   '),/内容为空/);
});

const item=(o={})=>({id:'i',org:'',role:'',location:'',start:'',end:'',current:false,summary:'',bullets:[],tags:[],url:'',...o});

test('实习经历的导出结构是固定的',()=>{
 const r=renderItem(item({org:'Figma',role:'Software Engineer Intern',location:'San Francisco, CA',
  start:'2025.06',end:'2025.09',bullets:['做了 A','','  ','做了 B'],summary:'',tags:[]}),'experience');
 assert.deepEqual(r.head,{primary:'Figma',secondary:'San Francisco, CA',separator:' — '});
 assert.equal(r.when,'2025.06 – 2025.09');
 assert.equal(r.role,'Software Engineer Intern');   // 第二行永远是职位
 assert.deepEqual(r.bullets,['做了 A','做了 B']);    // 空白要点不占行
 assert.equal(r.note,'');assert.equal(r.tags,'');assert.equal(r.skill,null);
 // 同一类经历换一条内容，结构完全一致
 const r2=renderItem(item({org:'Stripe',role:'Backend Intern',location:'Seattle, WA',start:'2024.06',end:'2024.08'}),'experience');
 assert.deepEqual(Object.keys(r2),Object.keys(r));
 assert.equal(r2.head.separator,r.head.separator);
});

test('每种板块各自的导出规则互不串味',()=>{
 const base=item({org:'A',role:'B',location:'C',start:'2025',end:'2026',summary:'D',tags:['x','y'],url:'https://u',bullets:['z']});
 const edu=renderItem(base,'education');
 assert.equal(edu.head.secondary,'C');              // 教育经历第一行跟地点
 assert.equal(edu.note,'D');                        // GPA 之类走补充说明
 assert.deepEqual(edu.bullets,[]);                  // 教育经历不出要点
 assert.equal(edu.link,'');
 const proj=renderItem(base,'project');
 assert.equal(proj.head.secondary,'B');             // 项目第一行跟角色，不跟地点
 assert.equal(proj.head.separator,' · ');
 assert.equal(proj.tags,'x · y');                   // 技术栈单独一行
 assert.deepEqual(proj.bullets,['z']);
 assert.equal(proj.link,'https://u');
 const award=renderItem(base,'award');
 assert.equal(award.head.secondary,'B');            // 奖项第一行跟授予方
 assert.deepEqual(award.bullets,[]);
 assert.equal(award.role,'');                       // 不额外出斜体行
 const pub=renderItem(base,'publication');
 assert.equal(pub.role,'B');                        // 刊物名走斜体行
 assert.equal(pub.head.secondary,'');
 const skill=renderItem(base,'skill');
 assert.deepEqual(skill.skill,{label:'A',values:'x、y'});
 assert.equal(skill.when,'');assert.deepEqual(skill.bullets,[]);
});

test('空字段不会在导出里留下痕迹',()=>{
 const bare=renderItem(item({org:'Figma'}),'experience');
 assert.equal(bare.when,'');assert.equal(bare.role,'');assert.equal(bare.note,'');
 assert.equal(bare.head.secondary,'');
 assert.equal(hasContent(bare),true);
 assert.equal(hasContent(renderItem(item(),'experience')),false);   // 整条空白不渲染
 assert.equal(hasContent(renderItem(item({tags:[]}),'skill')),false);// 没有条目的技能行不渲染
 assert.equal(hasContent(renderItem(item({tags:['Go']}),'skill')),true);
});

import { zip, crc32 } from '../lib/zip.ts';
import { buildDocx, resumeFileName } from '../lib/resume-docx.ts';
import zlib from 'node:zlib';

// 从我们自己写的 ZIP 里把某个文件读回来，用来验证包结构没写错
function readZip(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const dec=new TextDecoder();
 let end=bytes.length-22;
 while(end>=0&&v.getUint32(end,true)!==0x06054b50)end--;
 assert.ok(end>=0,'找不到中央目录结束记录');
 const count=v.getUint16(end+8,true);let at=v.getUint32(end+16,true);
 const out={};
 for(let i=0;i<count;i++){
  assert.equal(v.getUint32(at,true),0x02014b50,'中央目录签名不对');
  const nameLen=v.getUint16(at+28,true),size=v.getUint32(at+24,true),local=v.getUint32(at+42,true);
  const name=dec.decode(bytes.subarray(at+46,at+46+nameLen));
  assert.equal(v.getUint32(local,true),0x04034b50,'本地文件头签名不对');
  const lnLen=v.getUint16(local+26,true),lxLen=v.getUint16(local+28,true);
  const data=bytes.subarray(local+30+lnLen+lxLen,local+30+lnLen+lxLen+size);
  assert.equal(v.getUint32(local+14,true),crc32(data),name+' 的 CRC 不匹配');
  out[name]=dec.decode(data);
  at+=46+nameLen+v.getUint16(at+30,true)+v.getUint16(at+32,true);
 }
 return out;
}

test('ZIP 写入器产出合法压缩包',()=>{
 const enc=new TextEncoder();
 const bytes=zip([{name:'a.txt',data:enc.encode('hello')},{name:'dir/b.txt',data:enc.encode('世界')}]);
 const files=readZip(bytes);
 assert.deepEqual(Object.keys(files),['a.txt','dir/b.txt']);
 assert.equal(files['a.txt'],'hello');
 assert.equal(files['dir/b.txt'],'世界');
 // CRC32 用已知值校验，避免实现写错却自洽
 assert.equal(crc32(enc.encode('hello')),zlib.crc32?zlib.crc32(Buffer.from('hello')):0x3610a686);
 assert.equal(zip([]).length,22);// 空包只有结束记录
});

test('DOCX 是结构完整的 Word 文档',()=>{
 const data=normalizeResume({basics:{name:'Zhang San',headline:'SWE',email:'z@example.com',location:'Boston, MA',
   links:[{label:'github.com/zs',url:'https://github.com/zs'}]},
  sections:[
   {type:'experience',title:'Experience',items:[{org:'Figma',role:'SWE Intern',location:'San Francisco, CA',
     start:'2025.06',end:'2025.09',bullets:['把 P99 从 1.2s 降到 30ms','支撑实时筛选']}]},
   {type:'skill',title:'Skills',items:[{org:'Languages',tags:['Go','TypeScript']}]},
  ]});
 const files=readZip(buildDocx(data,'letter'));
 for(const part of ['[Content_Types].xml','_rels/.rels','word/_rels/document.xml.rels','word/styles.xml','word/document.xml'])
  assert.ok(files[part],'缺少部件 '+part);
 const doc=files['word/document.xml'];
 assert.match(doc,/^<\?xml version="1\.0"/);
 assert.ok(doc.includes('</w:document>'),'文档没有正常闭合');
 for(const s of ['Zhang San','Figma','SWE Intern','San Francisco, CA','2025.06 – 2025.09','Languages','Go、TypeScript',
   '把 P99 从 1.2s 降到 30ms','github.com/zs'])
  assert.ok(doc.includes(s),'导出内容里少了：'+s);
 assert.ok(doc.includes('w:pgSz w:w="12240"'),'Letter 纸张尺寸不对');
 assert.ok(buildDocx(data,'a4').length>0&&readZip(buildDocx(data,'a4'))['word/document.xml'].includes('w:w="11906"'),'A4 纸张尺寸不对');
 // 空白条目不应该在 Word 里留下空段落
 const bare=readZip(buildDocx(normalizeResume({sections:[{type:'experience',title:'Experience',items:[{org:'',bullets:[]}]}]})))['word/document.xml'];
 assert.ok(!bare.includes('Experience'),'空板块不该出现在导出里');
});

test('XML 特殊字符会被转义，不会破坏文档',()=>{
 const data=normalizeResume({basics:{name:'A & B <script>'},sections:[
  {type:'experience',title:'Exp',items:[{org:'X & Y',bullets:['用 <div> 与 "引号" 测试']}]}]});
 const doc=readZip(buildDocx(data))['word/document.xml'];
 assert.ok(doc.includes('A &amp; B &lt;script&gt;'));
 assert.ok(doc.includes('&lt;div&gt;'));
 assert.ok(!doc.includes('<script>'));
});

test('导出文件名区分不同简历且不含非法字符',()=>{
 const d=normalizeResume({basics:{name:'ZIHAO LUO'}});
 assert.equal(resumeFileName(d,'Software Engineering Intern','docx'),'ZIHAO_LUO_Software_Engineering_Intern.docx');
 assert.equal(resumeFileName(d,'Data Analytics Intern','docx'),'ZIHAO_LUO_Data_Analytics_Intern.docx');
 assert.equal(resumeFileName(d,'ZIHAO LUO','docx'),'ZIHAO_LUO.docx');           // 重名不重复拼接
 assert.equal(resumeFileName(normalizeResume({}),'','docx'),'Resume.docx');      // 全空时的兜底
 assert.match(resumeFileName(normalizeResume({basics:{name:'a/b\c:d*e?f"g<h>i|j'}}),'x','docx'),/^[^\/:*?"<>|]+$/);
});

test('选哪套模板，导出的 Word 就是哪套',()=>{
 const data=normalizeResume({basics:{name:'Zhang San'},sections:[
  {type:'experience',title:'Experience',items:[{org:'Figma',role:'SWE',start:'2025',end:'2026',bullets:['做事']}]}]});
 const of=t=>readZip(buildDocx(data,'letter',t));
 const classic=of('classic'),modern=of('modern'),compact=of('compact');
 // 经典是衬线，另外两套是无衬线——之前这里写死 Calibri，界面选了经典也没用
 assert.match(classic['word/styles.xml'],/w:ascii="Georgia"/);
 assert.match(modern['word/styles.xml'],/w:ascii="Calibri"/);
 assert.match(classic['word/styles.xml'],/w:eastAsia="SimSun"/);
 assert.match(modern['word/styles.xml'],/w:eastAsia="Microsoft YaHei"/);
 // 紧凑模板页边距更窄，正文更小
 const margin=x=>Number(x['word/document.xml'].match(/w:pgMar w:top="(\d+)"/)[1]);
 assert.ok(margin(compact)<margin(classic),'紧凑模板应该有更窄的页边距');
 assert.equal(margin(classic),margin(modern));
 // 现代模板抬头左对齐、板块标题用主题色
 assert.match(modern['word/document.xml'],/<w:jc w:val="left"\/>/);
 assert.match(modern['word/document.xml'],/w:color w:val="00695C"/);
 assert.ok(!classic['word/document.xml'].includes('00695C'),'经典模板不该出现主题色');
 // 未知模板名回退到经典，而不是崩掉或出空文档
 assert.deepEqual(of('不存在的模板')['word/styles.xml'],classic['word/styles.xml']);
});

test('日期用制表位右对齐，而不是靠空格凑',()=>{
 const data=normalizeResume({sections:[{type:'experience',title:'Exp',
  items:[{org:'Figma',location:'SF',start:'2025.06',end:'2025.09',bullets:['x']}]}]});
 const doc=readZip(buildDocx(data))['word/document.xml'];
 assert.match(doc,/<w:tab w:val="right" w:pos="\d+"\/>/,'缺少右对齐制表位');
 assert.match(doc,/<w:r><w:tab\/><\/w:r>/,'日期前应该有一个制表符');
 assert.ok(!doc.includes('    '),'不该用连续空格排版');
 // 要点是悬挂缩进，不是靠空格缩进
 assert.match(doc,/<w:ind w:left="230" w:hanging="230"\/>/);
});
