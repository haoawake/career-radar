// 各平台连接器的解析：用真实响应的结构做夹具，替换全局 fetch，不联网。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPage, workdayBase, workdayPlace, oracleJobUrl, detailUrl, detailText } from '../lib/connectors.ts';
import { parseRobots } from '../scripts/robots.mjs';

const urlOf=input=>typeof input==='string'?input:input instanceof URL?input.href:input.url;
/** 把全局 fetch 换成按地址返回夹具的假实现，记录每次请求。 */
async function withFetch(routes,fn){
 const real=globalThis.fetch,calls=[];
 globalThis.fetch=async(input,init={})=>{
  const url=urlOf(input);calls.push({url,init});
  const hit=routes.find(([match])=>typeof match==='string'?url.includes(match):match.test(url));
  if(!hit)return new Response('not found',{status:404});
  const body=typeof hit[1]==='function'?hit[1](url,init):hit[1];
  return new Response(typeof body==='string'?body:JSON.stringify(body),{status:200,headers:hit[2]||{'content-type':typeof body==='string'?'text/html':'application/json'}});
 };
 try{return {result:await fn(),calls}}finally{globalThis.fetch=real}
}
const src=(o)=>({group:'company',careerUrl:'https://example.org/',...o});

test('Oracle keeps jobs with any US location and uses the brand job URL',async()=>{
 const s=src({id:'hw',name:'Honeywell',type:'oracle',host:'x.fa.ocs.oraclecloud.com',site:'CX_1',usLocation:'300000000469866',jobUrl:'https://careers.honeywell.com/en/sites/Honeywell/job/{id}'});
 const list={items:[{TotalJobsCount:3,requisitionList:[
  {Id:'1',Title:'Software Engineer',PrimaryLocation:'Houston, TX, United States',PrimaryLocationCountry:'US',secondaryLocations:[]},
  {Id:'2',Title:'Quality Engineer',PrimaryLocation:'Kuala Lumpur, Malaysia',PrimaryLocationCountry:'MY',secondaryLocations:[{Name:'Dallas, TX, United States',CountryCode:'US'}]},
  {Id:'3',Title:'Buyer',PrimaryLocation:'Bengaluru, India',PrimaryLocationCountry:'IN',secondaryLocations:[]},
 ]}]};
 const {result:p,calls}=await withFetch([['recruitingCEJobRequisitions',list]],()=>fetchPage(s,0));
 assert.match(calls[0].url,/siteNumber=CX_1,limit=100,offset=0,selectedLocationsFacet=300000000469866/);
 assert.deepEqual(p.jobs.map(j=>j.id),['hw:1','hw:2']);
 assert.equal(p.jobs[1].location,'Kuala Lumpur, Malaysia / Dallas, TX, United States');
 assert.equal(p.jobs[0].url,'https://careers.honeywell.com/en/sites/Honeywell/job/1');
 assert.equal(p.jobs[0].description,'');// 列表只有简介，完整描述走详情补拉
 assert.equal(p.next,null);
 assert.equal(oracleJobUrl({...s,jobUrl:undefined},'9'),'https://x.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/9');
 assert.match(detailUrl(s,{id:'hw:158252',url:''}),/recruitingCEJobRequisitionDetails\?.*finder=ById;Id=%22158252%22,siteNumber=CX_1/);
 assert.equal(detailText(s,{items:[{ExternalDescriptionStr:'<p>About</p>',ExternalQualificationsStr:'Must be a US citizen'}]}),'<p>About</p>\nMust be a US citizen');
});

test('Jibe filters by country, keeps descriptions and honors the site path',async()=>{
 const s=src({id:'pep',name:'PepsiCo',type:'jibe',host:'www.pepsicojobs.com',board:'main',params:{country:['United States|USA']}});
 const list={totalCount:2,jobs:[{data:{slug:'476939',title:'Cyber Security Manager',full_location:'Plano, Texas, United States',country_code:'US',description:'<p>Protect</p>',categories:[{name:'IT'}]}},{data:{slug:'5',title:'Sales Rep',full_location:'Toronto, Ontario, Canada',country_code:'CA',categories:[]}}]};
 const {result:p,calls}=await withFetch([['/api/jobs',list]],()=>fetchPage(s,0));
 assert.equal(new URL(calls[0].url).searchParams.get('country'),'United States|USA');
 assert.equal(new URL(calls[0].url).searchParams.get('page'),'1');
 assert.deepEqual(p.jobs.map(j=>[j.id,j.url,j.description]),[['pep:476939','https://www.pepsicojobs.com/main/jobs/476939','Protect']]);
});

test('Eightfold sends site filters, reads standardized US locations and the v2 API',async()=>{
 const pcsx=src({id:'sb',name:'Starbucks',type:'eightfold',host:'starbucks.eightfold.ai',domain:'starbucks.com',params:{filter_job_category:['technology','marketing and brand management']}});
 const body={status:200,data:{count:12,positions:[{id:1,name:'Data Analyst',locations:['Seattle, Washington, United States'],standardizedLocations:['Seattle, WA, US'],positionUrl:'/careers/job/1',department:'Technology'},{id:2,name:'Barista',locations:['Toronto, ON'],standardizedLocations:['Toronto, ON, CA'],positionUrl:'/careers/job/2'}]}};
 const {result:p,calls}=await withFetch([['/api/pcsx/search',body]],()=>fetchPage(pcsx,0));
 assert.deepEqual(new URL(calls[0].url).searchParams.getAll('filter_job_category'),['technology','marketing and brand management']);
 assert.deepEqual(p.jobs.map(j=>j.url),['https://starbucks.eightfold.ai/careers/job/1']);
 assert.equal(p.next,2);// 每页 10 条，按实际返回条数翻页
 const v2=src({id:'na',name:'NetApp',type:'eightfold',api:'v2',host:'netapp.eightfold.ai',domain:'netapp.com'});
 const {result:q,calls:c2}=await withFetch([['/api/apply/v2/jobs',{count:1,positions:[{id:44648258,name:'Client Executive',location:'Home - United States National (HOMEUSN)',canonicalPositionUrl:'https://netapp.eightfold.ai/careers/job/44648258',job_description:'<p>Sell</p>'}]}]],()=>fetchPage(v2,0));
 assert.equal(new URL(c2[0].url).searchParams.get('num'),'10');
 assert.deepEqual(q.jobs.map(j=>[j.id,j.description]),[['na:44648258','Sell']]);
});

const SF_ROWS=`<span>Results <b>1 – 2</b> of <b>3</b></span>
<tr class="data-row"><td><span class="jobTitle hidden-phone"><a href="/job/Reston-Senior-Reliability-Engineer-VA-20191/1432684133/" class="jobTitle-link">Senior Reliability Engineer</a></span><span class="jobLocation"> Reston, VA, US, 20191 </span></td></tr>
<tr class="data-row"><td><a class="jobTitle-link" href="/job/Mexicali-Technician/1400000001/">Technician &amp; Inspector</a><span class="jobLocation">Mexicali, BC, MX</span></td></tr>`;
const SF_TILES=`<span id="tile-search-results-label">Showing 1 to 1 of 255 Jobs</span><ul id="job-tile-list"><li class="job-tile job-id-1343190300" data-url="/job/Burbank-Senior-Data-Engineer-CA-91505/1343190300/"><a class="jobTitle-link fontcolor" href="/job/Burbank-Senior-Data-Engineer-CA-91505/1343190300/">Senior Data Engineer</a><div id="job-1343190300-desktop-section-location-value" class="section-value">Burbank, CA, US, 91505</div></li></ul>`;
test('SuccessFactors pages parse in both table and tile layouts',async()=>{
 const rows=src({id:'gs',name:'Gulfstream',type:'successfactors',careerUrl:'https://careers.gulfstream.com/',list:'https://careers.gulfstream.com/search/?q=&startrow={offset}'});
 const {result:p,calls}=await withFetch([['careers.gulfstream.com/search/',SF_ROWS]],()=>fetchPage(rows,0));
 assert.equal(calls[0].url,'https://careers.gulfstream.com/search/?q=&startrow=0');
 assert.deepEqual(p.jobs.map(j=>[j.id,j.title,j.url]),[['gs:1432684133','Senior Reliability Engineer','https://careers.gulfstream.com/job/Reston-Senior-Reliability-Engineer-VA-20191/1432684133/']]);// 墨西哥的岗位按地点识别排除
 assert.equal(p.total,3);assert.equal(p.next,2);
 const tiles=src({id:'pa',name:'Paramount',type:'successfactors',careerUrl:'https://careers.paramount.com/',list:'https://careers.paramount.com/search/?startrow={offset}',usFiltered:true});
 const {result:t}=await withFetch([['careers.paramount.com',SF_TILES]],()=>fetchPage(tiles,0));
 assert.deepEqual(t.jobs.map(j=>[j.id,j.location]),[['pa:1343190300','Burbank, CA, US, 91505']]);
 assert.equal(t.total,255);
 await assert.rejects(withFetch([['careers.paramount.com','<html>maintenance</html>']],()=>fetchPage(tiles,0)),/页面结构已变化/);
});

const avature=(n,more)=>Array.from({length:n},(_,i)=>`<article class="article article--result"><h3><a class="link" href="https://careers.twosigma.com/careers/JobDetail/Quant-Researcher/${100+i}"> Quant Researcher ${i} </a></h3><span class="paragraph_inner-span">${i%2?'United Kingdom - UK London':'United States - NY New York'}</span></article>`).join('')+(more?'<a class="paginationNextLink" href="https://careers.twosigma.com/careers/OpenRoles/?jobRecordsPerPage=10&amp;jobOffset=10">Next</a>':'');
test('Avature pages page by the next link when no total is printed and never finish on an empty page',async()=>{
 const s=src({id:'ts',name:'Two Sigma',type:'avature',list:'https://careers.twosigma.com/careers/OpenRoles/?jobOffset={offset}'});
 const {result:p}=await withFetch([['OpenRoles',avature(10,true)]],()=>fetchPage(s,0));
 assert.equal(p.jobs.length,5);// 伦敦的岗位按地点排除
 assert.equal(p.next,10);// 不写总数，靠分页链接判断后面还有
 const {result:last}=await withFetch([['OpenRoles',avature(3,false)]],()=>fetchPage(s,10));
 assert.equal(last.next,null);
 await assert.rejects(withFetch([['OpenRoles','<main>No jobs</main>']],()=>fetchPage(s,0)),/页面结构已变化/);
 await assert.rejects(withFetch([['OpenRoles','<main></main>']],()=>fetchPage(s,20)),/分页提前结束/);
 const stated=src({id:'bb',name:'Bloomberg',type:'avature',list:'https://bloomberg.avature.net/careers/SearchJobs/?jobOffset={offset}'});
 const html='<div aria-label="343 results"></div><article class="article article--result"><a class="link" href="https://bloomberg.avature.net/careers/JobDetail/Index-Sales/44968"> Index Sales </a><span class="list-item-location">New York, New York, United States of America</span></article>';
 const {result:b}=await withFetch([['SearchJobs',html]],()=>fetchPage(stated,0));
 assert.equal(b.total,343);assert.equal(b.jobs[0].id,'bb:44968');
});

test('IBM, Atlassian, McKinsey and Rippling shapes',async()=>{
 const ibm=src({id:'ibm',name:'IBM',type:'ibm'});
 const {result:i}=await withFetch([['www-api.ibm.com',{hits:{total:{value:2},hits:[{_id:'a',_source:{url:'https://careers.ibm.com/careers/JobDetail?jobId=131892',title:'2027 Intern — Marketing Analytics',field_keyword_18:'Internship',field_keyword_19:'New York, US'}},{_id:'b',_source:{url:'https://careers.ibm.com/careers/JobDetail?jobId=5',title:'Architect',field_keyword_19:'Multiple Cities'}}]}}]],()=>fetchPage(ibm,0));
 assert.deepEqual(i.jobs.map(j=>[j.id,j.kind,j.location]),[['ibm:131892','实习','New York, US'],['ibm:5','正式 / 其他','Multiple Cities, United States']]);
 const at=src({id:'at',name:'Atlassian',type:'atlassian'});
 const row={id:25099,title:'Enterprise Sales Manager',locations:['New York - United States - New York, New York 10003 United States','Remote - Remote'],category:'Sales',overview:'<p>Sell</p>'};
 const {result:a}=await withFetch([['atlassian.com',[row,row,{id:1,title:'AE (India)',locations:['Remote - India - Remote']}]]],()=>fetchPage(at,0));
 assert.deepEqual(a.jobs.map(j=>[j.id,j.url]),[['at:25099','https://www.atlassian.com/company/careers/details/25099']]);// 重复行合并、只留美国地点
 const mk=src({id:'mk',name:'McKinsey',type:'mckinsey',list:'https://gateway.mckinsey.com/x/v1/api/jobs/search?lang=en&countries=United%20States'});
 const {result:m,calls}=await withFetch([['gateway.mckinsey.com',{numFound:1,docs:[{jobID:'15178',title:'Associate',cities:['Atlanta','London','Austin'],countries:['United States','United Kingdom','United States'],friendlyURL:'associate-15178'}]}]],()=>fetchPage(mk,0));
 assert.match(calls[0].url,/&pageSize=100&start=1$/);
 assert.equal(m.jobs[0].location,'Atlanta, United States / Austin, United States');// 城市与国家按下标配对
 const rp=src({id:'rp',name:'Rippling',type:'rippling',board:'rippling'});
 const {result:r}=await withFetch([['ats.rippling.com',{totalItems:3,items:[{id:'u1',name:'BizOps Manager',url:'https://ats.rippling.com/rippling/jobs/u1',locations:[{name:'New York, NY',countryCode:'US'}]},{id:'u1',name:'BizOps Manager',url:'https://ats.rippling.com/rippling/jobs/u1',locations:[{name:'San Francisco, CA',countryCode:'US'}]},{id:'u2',name:'AE',url:'https://ats.rippling.com/rippling/jobs/u2',locations:[{name:'Toronto',countryCode:'CA'}]}]}]],()=>fetchPage(rp,0));
 assert.deepEqual(r.jobs.map(j=>[j.id,j.location]),[['rp:u1','New York, NY / San Francisco, CA']]);// 每个地点一行，按编号合并
});

test('Workday helpers: myworkdaysite links and locations hidden in the path',async()=>{
 assert.equal(workdayBase({host:'wd1.myworkdaysite.com',tenant:'snapchat',board:'snap'}),'https://wd1.myworkdaysite.com/recruiting/snapchat/snap');
 assert.equal(workdayBase({host:'nxp.wd3.myworkdayjobs.com',tenant:'nxp',board:'careers'}),'https://nxp.wd3.myworkdayjobs.com/en-US/careers');
 assert.equal(workdayPlace('/job/Norwood-Massachusetts/Sr-Manager--COE-SAP_R19801'),'Norwood Massachusetts');
 assert.equal(workdayPlace(''),'');
 const s=src({id:'mo',name:'Moderna',type:'workday',host:'modernatx.wd1.myworkdayjobs.com',tenant:'modernatx',board:'M_tx',usFiltered:true});
 const {result:p}=await withFetch([['/wday/cxs/',{total:1,jobPostings:[{title:'Scientist',externalPath:'/job/Cambridge-Massachusetts/Scientist_R1'}]}]],()=>fetchPage(s,0));
 assert.equal(p.jobs[0].location,'Cambridge Massachusetts · 美国');
 assert.match(p.jobs[0].states||'',/\|MA\|/);
 // 续跑时岗位总数变少、游标已越过当前总数（Cisco 1318 / 1279）：收尾并标为不完整，而不是一直报错卡住
 const {result:tail}=await withFetch([['/wday/cxs/',{total:1279,jobPostings:[]}]],()=>fetchPage(s,1318,1323));
 assert.equal(tail.next,null);assert.equal(tail.jobs.length,0);assert.match(tail.warning,/总数减少/);
 // 很多租户只在第一页给总数，后面每页 total 都是 0：这是正常翻页，不能当成越界提前收尾
 const row=i=>({title:'Engineer '+i,externalPath:`/job/Austin-TX/Engineer_R${i}`});
 const {result:mid}=await withFetch([['/wday/cxs/',{total:0,jobPostings:Array.from({length:20},(_,i)=>row(20+i))}]],()=>fetchPage(s,20,1341));
 assert.equal(mid.next,40);assert.equal(mid.jobs.length,20);assert.equal(mid.warning,undefined);
});

test('Greenhouse light lists fetch the offices map only when locations are vague',async()=>{
 const s=src({id:'cf',name:'Cloudflare',type:'greenhouse',group:'platform',board:'cloudflare'});
 const light={jobs:[{id:7,title:'Account Executive',location:{name:'Hybrid'},absolute_url:'https://boards.greenhouse.io/cloudflare/jobs/7'}]};
 const offices={offices:[{name:'Washington, DC',location:'Washington, DC, United States',departments:[{jobs:[{id:7}]}]}]};
 const {result:p,calls}=await withFetch([['/offices',offices],['/jobs',light]],()=>fetchPage(s,0,0,{light:true}));
 assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/v1/boards/cloudflare/jobs','/v1/boards/cloudflare/offices']);
 assert.equal(p.jobs[0].location,'Washington, DC, United States · Hybrid');
 const {calls:plain}=await withFetch([['/jobs',{jobs:[{id:8,title:'Engineer',location:{name:'Austin, TX'},absolute_url:'https://boards.greenhouse.io/cloudflare/jobs/8'}]}]],()=>fetchPage(s,0,0,{light:true}));
 assert.equal(plain.length,1);// 地点都有效时不多请求
});

test('Apple goes through the local relay with a CSRF session',async()=>{
 const s=src({id:'apple',name:'Apple',type:'apple',careerUrl:'https://jobs.apple.com/',via:'node'});
 const relay={origin:'http://127.0.0.1:3000',token:'t0ken'};
 const token=()=>new Response('',{status:200,headers:[['x-apple-csrf-token','abc'],['set-cookie','a=1; Path=/'],['set-cookie','b=2; Path=/']]});
 const real=globalThis.fetch,calls=[];
 globalThis.fetch=async(input,init={})=>{const url=urlOf(input);calls.push({url,init});if(url.includes(encodeURIComponent('/api/v1/CSRFToken')))return token();return new Response(JSON.stringify({res:{totalRecords:4504,searchResults:[{id:'200672396-0157',postingTitle:'Engineer',positionId:'200672396',transformedPostingTitle:'engineer',locations:[{name:'Austin',countryID:'iso-country-USA'}]}]}}),{status:200})};
 try{
  const p=await fetchPage(s,0,0,{relay});
  assert.ok(calls.every(c=>c.url.startsWith('http://127.0.0.1:3000/__radar/relay?url=')),'所有请求都经过本机中转');
  const search=calls.find(c=>c.url.includes(encodeURIComponent('/api/v1/search')));
  const h=new Headers(search.init.headers);
  assert.equal(h.get('x-radar-relay'),'t0ken');assert.equal(h.get('x-apple-csrf-token'),'abc');assert.equal(h.get('cookie'),'a=1; b=2');
  assert.match(search.init.body,/"format"/);// 缺了 format 字段 Apple 会返回 0 条
  assert.equal(p.jobs[0].url,'https://jobs.apple.com/en-us/details/200672396/engineer');
 }finally{globalThis.fetch=real}
});

test('robots.txt rules follow longest match with Allow winning ties',()=>{
 const eightfold=parseRobots('User-agent: *\nDisallow: /\nAllow: /$\nAllow: /careers\nAllow: /api/pcsx\n');
 assert.equal(eightfold.allows('/api/pcsx/search'),true);
 assert.equal(eightfold.allows('/api/other'),false);
 assert.equal(eightfold.allows('/'),true);
 const workday=parseRobots('User-agent: *\nDisallow: /Zoom/\nDisallow: /refreshFacet/\n');
 assert.equal(workday.allows('/wday/cxs/zoom/Zoom/jobs'),true);// 只禁止招聘板网页，没有禁止数据接口
 assert.equal(workday.allows('/Zoom/job/x'),false);
 const talentbrew=parseRobots('User-agent: Googlebot\nAllow: /\n\nUser-agent: *\nDisallow: /search-jobs/\nCrawl-delay: 5\n');
 assert.equal(talentbrew.allows('/search-jobs/results'),false);
 assert.equal(talentbrew.delay,5000);
 assert.equal(parseRobots('').allows('/anything'),true);
});
