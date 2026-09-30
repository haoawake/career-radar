import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, classify, isUS, SOURCES, isTestPosting, vagueLocation, greenhouseLocation } from '../lib/sources.ts';
import { parseUsLocation, locationFields, METROS, CITIES } from '../lib/us-locations.ts';
import { SCOPES, inScope, estimatePages, estimateTime, inGroup, bySize } from '../lib/update-scope.ts';
import { parseApple } from '../lib/connectors.ts';
import { RELAY_HOSTS, relayOrigin } from '../lib/node-relay.ts';
import { DROP, PLATFORM_ADD, COMPANY_ADD } from '../scripts/registry-fixes.mjs';
// lib/connectors.ts 的 fetchPage 能处理的来源类型
const CONNECTOR_TYPES=new Set(['workday','greenhouse','ashby','lever','smartrecruiters','amazon','microsoft','eightfold','google','apple','oracle','jibe','successfactors','avature','ibm','atlassian','mckinsey','rippling']);
test('career classification and US scope',()=>{assert.equal(classify('Machine Learning Engineer'),'AI / 机器学习');assert.equal(classify('Frontend Software Engineer'),'软件工程');assert.equal(classify('Data Analyst'),'数据分析');assert.equal(isUS('London, UK'),false);assert.equal(isUS('Remote - US'),true);assert.equal(isUS('San Francisco'),true);assert.equal(isUS('Remote'),false)});
test('stable IDs and internships',()=>{const source=SOURCES[0];const raw={jobs:[{id:123,title:'Software Engineer Intern',location:{name:'New York'},absolute_url:'https://example.org/jobs/123',content:'<p>Build software</p>'},{id:124,title:'Engineer',location:{name:'London'},absolute_url:'https://example.org/jobs/124'}]};const a=normalize(source,raw),b=normalize(source,raw);assert.equal(a.length,1);assert.equal(a[0].id,b[0].id);assert.equal(a[0].kind,'实习');assert.equal(a[0].description,'Build software')});
test('invalid feeds do not become empty success',()=>{assert.throws(()=>normalize(SOURCES[0],{}));assert.throws(()=>normalize(SOURCES[0],{jobs:[{id:1,title:'x',absolute_url:'javascript:alert(1)'}]}))});
test('registry is unique and complete',()=>{
 const ids=new Set(),names=new Set();
 for(const s of SOURCES){
  assert.ok(!ids.has(s.id),'来源编号重复：'+s.id);ids.add(s.id);
  assert.ok(!names.has(s.name.toLowerCase()),'公司重复收录：'+s.name);names.add(s.name.toLowerCase());
  assert.match(s.careerUrl,/^https:\/\//);
  assert.ok(['company','platform'].includes(s.group),s.id+' 缺少分类');
  assert.ok(CONNECTOR_TYPES.has(s.type),s.id+' 的来源类型没有对应的连接器：'+s.type);
  if(s.type==='workday')assert.ok(s.host&&s.tenant&&s.board,s.id+' 缺少 Workday 站点信息');
  if(['greenhouse','ashby','lever','smartrecruiters','rippling'].includes(s.type))assert.ok(s.board,s.id+' 缺少招聘板编号');
  if(['eightfold','microsoft'].includes(s.type))assert.ok(s.host&&s.domain,s.id+' 缺少 Eightfold 站点信息');
  if(s.type==='oracle')assert.ok(s.host&&s.site&&/^\d+$/.test(s.usLocation||''),s.id+' 缺少 Oracle 招聘站编号或美国地点编号');
  if(s.type==='jibe')assert.ok(s.host,s.id+' 缺少 Jibe 招聘站');
  if(['successfactors','avature','mckinsey'].includes(s.type))assert.match(s.list||'',/^https:\/\//,s.id+' 缺少列表页地址');
  if(['successfactors','avature'].includes(s.type))assert.match(s.list,/\{offset\}/,s.id+' 的列表页地址缺少翻页占位');
 }
 assert.ok(SOURCES.filter(s=>s.group==='company').length>200,'公司自建招聘系统应覆盖数百家');
});
test('US location parsing',()=>{
 const one=(t)=>parseUsLocation(t);
 assert.deepEqual(one('San Jose, California').cities,['san-jose-ca']);
 assert.deepEqual(one('New York, NY').metros,['nyc']);
 assert.deepEqual(one('USA-CA-Santa Clara').cities,['santa-clara-ca']);
 assert.deepEqual(one('US-UT-WEST VALLEY CITY-1127').metros,['salt-lake-city']);
 assert.deepEqual(one('Sunnyvale, CA / New York, NY').metros,['bay-area','nyc']);
 assert.equal(one('Remote - US').remote,true);
 // 非美国地点不能被同名美国城市误认
 assert.deepEqual(one('Vancouver, BC, Canada').cities,[]);
 assert.deepEqual(one('Dublin, Ireland').cities,[]);
 assert.deepEqual(one('London, UK').metros,[]);
 // 州名单独出现时至少保留州与兜底都会区
 assert.deepEqual(one('Portland, ME').states,['ME']);
 assert.equal(locationFields('Seattle, WA').cities,'|seattle-wa|');
 assert.equal(locationFields('Bengaluru, India').metros,null);
});
test('metro and city tables line up',()=>{
 const metroIds=new Set(METROS.map(m=>m.id));
 assert.equal(metroIds.size,METROS.length);
 const cityIds=new Set();
 for(const c of CITIES){assert.ok(metroIds.has(c.metro),c.id+' 指向不存在的都会区');assert.ok(!cityIds.has(c.id),'城市编号重复：'+c.id);cityIds.add(c.id)}
});
test('update scopes narrow the refresh queue',()=>{
 const hour=3600000,now=Date.now();
 const data={sources:[
  {id:'a',tier:'major',group:'company',last_success:new Date(now-hour).toISOString(),status:'ok',markedCount:0},
  {id:'b',tier:'other',group:'company',last_success:new Date(now-9*hour).toISOString(),status:'ok',markedCount:2},
  {id:'c',tier:'major',group:'platform',last_success:null,status:'pending',markedCount:0},
  {id:'d',tier:'other',group:'platform',last_success:new Date(now-9*hour).toISOString(),status:'ok',markedCount:0},
 ],regionCounts:{b:12}};
 const ids=(scope,group='all')=>inScope(data,scope,group).map(s=>s.id).sort();
 assert.deepEqual(ids('all'),['a','b','c','d']);          // 强制重跑包含刚更新过的 a
 assert.deepEqual(ids('stale'),['b','c','d']);            // a 一小时前刚更新，跳过
 assert.deepEqual(ids('major'),['c']);                    // a 是大厂但还新鲜
 assert.deepEqual(ids('region'),['b','c']);               // b 在该地区有岗位，c 从未更新过
 assert.deepEqual(ids('group','platform'),['c','d']);
 assert.deepEqual(ids('marked'),['b']);
 assert.equal(new Set(SCOPES.map(s=>s.value)).size,SCOPES.length);
 for(const s of SCOPES)assert.ok(s.label&&s.hint,s.value+' 缺少说明');
});
test('scope time estimate scales with paging cost',()=>{
 assert.equal(estimatePages({type:'workday',run_total:2000}),100);   // Workday 每页固定 20 条
 assert.equal(estimatePages({type:'smartrecruiters',count:250}),3);
 assert.equal(estimatePages({type:'greenhouse',count:900}),1);       // 招聘板一次返回全部
 assert.equal(estimatePages({type:'microsoft',run_total:1177}),118);  // Eightfold 接口每页只有 10 条
 assert.equal(estimatePages({type:'eightfold',count:95}),10);
 assert.equal(estimatePages({type:'workday'}),1);                    // 没有基数时按一页估
 assert.equal(estimateTime([]),'');
 const small=estimateTime([{type:'greenhouse',count:10}]),big=estimateTime(Array.from({length:50},()=>({type:'workday',run_total:2000})));
 assert.match(small,/秒$/);
 assert.match(big,/分钟$/);
});
test('test postings from ATS sandboxes are dropped, real titles are kept',()=>{
 for(const t of ['Test UAT','Corporate UAT TEST JOB - SP','Corporate-Karl Z-UAT-203502-Ext','FDB - Ayla Save - TEST - Clinical Pharmacist','Kritika Bug Bash Job 2','This is a test-Vice President of Sales Test','HTV-DanielleM-Test-Administrative Assistant','Offer Test Newspapers: Sales','Test Job'])
  assert.equal(isTestPosting(t),true,t);
 for(const t of ['Manufacturing Test Engineering Manager','Principal SLT Test Engineer','UAT Analyst','Test-Driven Development Coach','SOFTWARE TEST ENGINEER','Contest Operations Lead','Sample Test Technician','Flight Test Engineer - Rotorcraft'])
  assert.equal(isTestPosting(t),false,t);
});
test('Greenhouse jobs that only name a work arrangement fall back to their offices',()=>{
 for(const l of ['Hybrid','Distributed','In-Office','Distributed; Hybrid','Hybrid or Remote','Remote','TBD'])assert.equal(vagueLocation(l),true,l);
 for(const l of ['Remote India','Austin, TX','Remote - US','London'])assert.equal(vagueLocation(l),false,l);
 // 带描述的完整列表自带 offices；轻量列表靠 /offices 对照表
 assert.equal(greenhouseLocation({id:1,location:{name:'Hybrid'},offices:[{name:'Washington, DC',location:'Washington, DC, United States'}]}),'Washington, DC, United States · Hybrid');
 assert.equal(greenhouseLocation({id:2,location:{name:'Distributed'}},new Map([['2',['Austin, TX','Austin, TX']]])),'Austin, TX · Distributed');
 assert.equal(greenhouseLocation({id:3,location:{name:'TBD'}},new Map([['3',['Boone, IA']]])),'Boone, IA');
 assert.equal(greenhouseLocation({id:4,location:{name:'New York, NY'}},new Map([['4',['London']]])),'New York, NY');// 地点本身有效时不改
 assert.equal(greenhouseLocation({id:5,location:{name:'Hybrid'}}),'Hybrid');// 找不到办公室就原样保留
 const source=SOURCES.find(s=>s.type==='greenhouse');
 const jobs=normalize(source,{jobs:[{id:9,title:'Account Executive',location:{name:'Hybrid'},absolute_url:'https://example.org/9'},{id:10,title:'Engineer',location:{name:'Hybrid'},absolute_url:'https://example.org/10'}]},new Map([['9',['Washington, DC, United States']],['10',['Lisbon, Portugal']]]));
 assert.deepEqual(jobs.map(j=>j.id),[source.id+':9']);// 只有美国办公室的岗位留下
});
test('Apple search API guards against silent empty results',()=>{
 const row={id:'200672396-0157',postingTitle:'Engineer',locations:[]};
 assert.deepEqual(parseApple({res:{searchResults:[row],totalRecords:4504}}),{searchResults:[row],totalRecords:4504});
 assert.throws(()=>parseApple({res:{searchResults:[],totalRecords:0}}),/0 个美国岗位/);// 请求体缺字段时 Apple 会返回 0 条而不是报错
 assert.throws(()=>parseApple({}));
});
test('node relay only serves sources that need it',()=>{
 const needed=new Set(SOURCES.filter(s=>s.via==='node').map(s=>new URL(s.careerUrl).hostname));
 assert.deepEqual([...RELAY_HOSTS].sort(),[...needed].sort());
 assert.ok(needed.has('jobs.apple.com'));
 assert.equal(relayOrigin('http://localhost:3000/api/sync'),'http://127.0.0.1:3000');
 assert.equal(relayOrigin('http://127.0.0.1:5173/api/sync'),'http://127.0.0.1:5173');
});
test('registry fixes stay applied',()=>{
 const ids=new Set(SOURCES.map(s=>s.id));
 for(const id of Object.keys(DROP))assert.ok(!ids.has(id),'已移除的来源又出现了：'+id);
 for(const a of [...PLATFORM_ADD,...COMPANY_ADD]){const s=SOURCES.find(x=>x.id===a.id);assert.ok(s,'缺少补上的来源：'+a.id);assert.equal(s.type,a.type,a.id);assert.equal(s.board,a.board,a.id);assert.equal(s.host,a.host,a.id)}
 const byId=id=>SOURCES.find(s=>s.id===id);
 assert.equal(byId('bloomberg').name,'Bloomberg Industry Group');
 assert.equal(byId('bloomberg-lp').name,'Bloomberg');
 assert.equal(byId('meijer').board,'Meijer');
 assert.equal(byId('chewy').board,'External');
 for(const id of ['anduril','jpmorgan-chase','goldman-sachs','lockheed-martin','sap','ibm','oracle','dell-technologies','snap','qualcomm'])assert.equal(byId(id).tier,'major',id);
 for(const id of ['amd','rivian','pepsico'])assert.equal(byId(id).delay,5000,id+' 要照 robots.txt 的 crawl-delay 翻页');
 for(const s of SOURCES)assert.equal(s.name,s.name.trim(),'名称首尾有空格：'+s.id);
});
test('major group and source ordering',()=>{
 const a={group:'company',tier:'major'},b={group:'platform',tier:'other'};
 assert.equal(inGroup(a,'major'),true);assert.equal(inGroup(b,'major'),false);
 assert.equal(inGroup(b,'platform'),true);assert.equal(inGroup(b,'all'),true);
 const list=[{name:'Small',tier:'other',jobCount:9000},{name:'Google',tier:'major',jobCount:1833},{name:'Apple',tier:'major',jobCount:4504}].sort(bySize);
 assert.deepEqual(list.map(s=>s.name),['Apple','Google','Small']);// 大厂在前，再按岗位数
});
