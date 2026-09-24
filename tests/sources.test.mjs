import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, classify, isUS, SOURCES } from '../lib/sources.ts';
import { parseUsLocation, locationFields, METROS, CITIES } from '../lib/us-locations.ts';
import { SCOPES, inScope, estimatePages, estimateTime } from '../lib/update-scope.ts';
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
  if(s.type==='workday')assert.ok(s.host&&s.tenant&&s.board,s.id+' 缺少 Workday 站点信息');
  if(['greenhouse','ashby','lever','smartrecruiters'].includes(s.type))assert.ok(s.board,s.id+' 缺少招聘板编号');
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
 assert.equal(estimatePages({type:'workday'}),1);                    // 没有基数时按一页估
 assert.equal(estimateTime([]),'');
 const small=estimateTime([{type:'greenhouse',count:10}]),big=estimateTime(Array.from({length:50},()=>({type:'workday',run_total:2000})));
 assert.match(small,/秒$/);
 assert.match(big,/分钟$/);
});
