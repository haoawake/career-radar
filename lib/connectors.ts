import type { Source } from './source-types';
import { classify,isUS,isTestPosting,normalize,plain,secureUrl,vagueLocation } from './sources';
import { locationFields } from './us-locations';
import { signals } from './job-signals';
import { send,RELAY_ERROR_HEADER,type Relay } from './node-relay';
export type Job={id:string;source:string;company:string;title:string;location:string;url:string;description:string;role:string;kind:string;level:string;visa:string|null;visaNote:string|null;cities:string|null;states:string|null;metros:string|null;remote:number};
export type Page={jobs:Job[];next:number|null;total:number;fetched:number;fingerprint:string;warning?:string};
function job(s:Source,id:unknown,title:string,location:string,url:string,description='',intern=false,department=''):Job{const link=secureUrl(url);if(!id||!title||!link)throw Error('岗位数据缺少编号、标题或有效官网链接');const text=plain(description),kind=intern||/\bintern(ship)?\b|co-op/i.test(title)?'实习':'正式 / 其他';return {id:s.id+':'+id,source:s.id,company:s.name,title,location,url:link,description:text,role:classify(title)==='其他'?classify(department):classify(title),kind,...signals(title,kind,text),...locationFields(location)}}
/**
 * 已通过美国判定但地点文本无法定位到城市或州时，仍归入“其他美国地点”，保证地区筛选不会漏掉它们。
 * 各平台的结果都经过这里，顺带去掉招聘系统里的测试岗位。
 */
function inUs(jobs:Job[]):Job[]{return jobs.filter(j=>!isTestPosting(j.title)).map(j=>j.metros?j:{...j,metros:'|other-us|'})}
function page(jobs:Job[],ids:string[],offset:number,total:number,size:number,warning?:string):Page{if(!Number.isInteger(total)||total<0)throw Error('官方总数格式异常');if(!ids.length&&offset<total)throw Error('来源分页提前结束，保留历史岗位');return {jobs,next:offset+size<total?offset+size:null,total,fetched:size,fingerprint:ids.join('|'),warning}}
const unique=(xs:unknown[])=>[...new Set(xs.filter((x):x is string=>typeof x==='string'&&!!x.trim()).map(x=>x.trim()))];
/** 网页片段里的纯文本：去标签、解实体、合并空白。 */
const text=(html:string)=>plain(html).replace(/&#\d+;/g,' ').replace(/\s+/g,' ').trim();
const ORACLE_PAGE=100;
/** Oracle 岗位的官网链接：有品牌域名的（Honeywell、Amex、Goldman）用 jobUrl 模板，否则用候选人站点的默认地址。 */
export const oracleJobUrl=(s:Source,id:unknown)=>s.jobUrl?s.jobUrl.replace('{id}',String(id)):`https://${s.host}/hcmUI/CandidateExperience/en/sites/${s.site}/job/${String(id)}`;
// 403 也算：Apple 这类站点在高并发下会用 403 拒绝，压力过去后同样的请求头就恢复 200。
const RETRY_STATUS=new Set([403,429,502,503,504]);
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
/** 限流按站点群算：Workday 按 wdN 集群（287 个租户里 241 个挤在 wd1、wd5 上，配额共用），其余平台按域名。 */
export const siteOf=(url:string)=>{const h=new URL(url).hostname;return h.endsWith('.myworkdayjobs.com')?h.slice(h.indexOf('.')+1):h};
// 某个站点群刚返回过 429（不管是列表还是详情），一分钟内所有来源都不再给它补详情：
// 并发更新时各来源共用配额，别家的详情请求会挤掉这家的列表分页
const COOL_MS=60000,cooling=new Map<string,number>();
const isCooling=(url:string)=>(cooling.get(siteOf(url))||0)>Date.now();
// 几百个来源一起更新时官方接口会短暂限流（实测 Workday 全量扫描中出现 429，稍后单发即恢复）。
// 遇到限流按 Retry-After 或退避重试，不要直接把整个来源判为失败——那会白丢一轮已抓到的进度。
type RequestOptions={body?:object;attempts?:number;retry?:Set<number>;relay?:Relay;headers?:Record<string,string>};
async function request(url:string,{body,attempts=3,retry=RETRY_STATUS,relay,headers}:RequestOptions={}){
 let last='';
 for(let i=0;i<attempts;i++){
  const r=await send(url,{method:body?'POST':'GET',headers:{Accept:'application/json,text/html','Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)},relay);
  if(r.ok)return r;
  const refused=relay&&r.headers.get(RELAY_ERROR_HEADER);if(refused)throw Error('本机中转拒绝了请求：'+decodeURIComponent(refused));
  last=`官方来源 HTTP ${r.status}`;
  if(r.status===429)cooling.set(siteOf(url),Date.now()+COOL_MS);
  if(!retry.has(r.status)||i===attempts-1)break;
  const after=Number(r.headers.get('retry-after'));
  await sleep(Math.min(Number.isFinite(after)&&after>0?after*1000:0||1000*2**i+Math.random()*600,15000));
 }
 throw Error(last);
}
export function parseGoogle(text:string){const m=text.match(/key: 'ds:1', hash: '[^']*', data:([\s\S]*?), sideChannel:/);if(!m)throw Error('Google 页面结构已变化');const d=JSON.parse(m[1]);if(!Array.isArray(d[0])||!Number.isInteger(d[2]))throw Error('Google 岗位数据异常');return d}
/**
 * jobs.apple.com/api/v1/search 的返回：{res:{searchResults,totalRecords}}，每页 20 条。
 * 请求体格式不对时（比如缺了 format 字段）它不报错，而是返回 0 条；Apple 在美国不可能没有岗位，
 * 这里当成异常，免得一轮“完整更新”把库里的 Apple 岗位全部标成下架。
 */
export function parseApple(d:any){const res=d?.res;if(!Array.isArray(res?.searchResults)||!Number.isInteger(res.totalRecords))throw Error('Apple 岗位数据异常');if(!res.totalRecords)throw Error('Apple 搜索接口返回 0 个美国岗位，请求格式可能已变化，历史岗位已保留');return res}
// Apple 的搜索接口要带 CSRF 令牌（令牌接口的响应头）和同一会话的 cookie。会话在实例内缓存十分钟，
// 一次更新连翻几十页不必每页重取；过期被拒（401/403）时丢掉缓存，下一次调用重新取。
const APPLE='https://jobs.apple.com';
let appleSession:{at:number;headers:Record<string,string>}|null=null;
async function appleHeaders(relay?:Relay){
 if(appleSession&&Date.now()-appleSession.at<600000)return appleSession.headers;
 const r=await request(`${APPLE}/api/v1/CSRFToken`,{relay});
 const token=r.headers.get('x-apple-csrf-token');if(!token)throw Error('Apple 没有返回 CSRF 令牌，接口可能已变化');
 const cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 appleSession={at:Date.now(),headers:{'x-apple-csrf-token':token,...(cookie?{cookie}:{})}};
 return appleSession.headers;
}
/** 有的租户（Moderna）岗位不带地点文字，地点只在链接里：/job/Norwood-Massachusetts/…。 */
export const workdayPlace=(path:string)=>decodeURIComponent(String(path||'').split('/job/')[1]?.split('/')[0]||'').replace(/-+/g,' ').trim();
/**
 * Workday 岗位官网链接的前缀：常规租户在 {tenant}.wdN.myworkdayjobs.com/en-US/{board}；
 * 共享域名 wdN.myworkdaysite.com 上的租户（Snap）是 /recruiting/{tenant}/{board}，套用前一种会得到 HTTP 500。
 */
export const workdayBase=(s:Source)=>s.host?.endsWith('.myworkdaysite.com')?`https://${s.host}/recruiting/${s.tenant}/${s.board}`:`https://${s.host}/en-US/${s.board}`;
/** 列表接口不带描述、需要按岗位补拉详情的来源：Greenhouse 轻量列表、Workday、SmartRecruiters、Microsoft。 */
export const DETAIL_TYPES=new Set(['greenhouse','workday','smartrecruiters','microsoft','eightfold','oracle']);
// 岗位下架后详情接口会拒绝（Workday 返回 403、其他平台 404），这种直接放弃；网关错误值得退避重试。
// 429 不重试：详情与列表分页常是同一个站点（Microsoft 实测连续补拉会让后续列表分页也 429，整个来源判为失败），
// 详情只是锦上添花，被限流就立刻收手，把配额留给列表
const DETAIL_RETRY=new Set([502,503,504]);
/** 单个岗位详情的官方接口地址；拿不到时返回空串。 */
export function detailUrl(s:Source,j:{id:string;url:string}){
 const raw=encodeURIComponent(j.id.slice(s.id.length+1)),board=s.board||s.id;
 if(s.type==='greenhouse')return `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${raw}`;
 if(s.type==='smartrecruiters')return `https://api.smartrecruiters.com/v1/companies/${board}/postings/${raw}`;
 if(s.type==='microsoft'||s.type==='eightfold')return `https://${s.host}/api/pcsx/position_details?position_id=${raw}&domain=${encodeURIComponent(s.domain||'')}&hl=en`;
 if(s.type==='oracle')return `https://${s.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${raw}%22,siteNumber=${s.site}`;
 // Workday 的岗位编号还原不出路径，从收录时拼好的官网链接里取回 externalPath
 if(s.type==='workday'){const prefix=workdayBase(s);return j.url.startsWith(prefix+'/job/')?`https://${s.host}/wday/cxs/${s.tenant}/${s.board}${j.url.slice(prefix.length)}`:''}
 return '';
}
/** 从各平台详情响应里取出描述 HTML；SmartRecruiters 的要求与补充说明分在不同段落，签证声明常在补充说明里，一并拼上。 */
export function detailText(s:Source,d:any):string{
 if(s.type==='greenhouse')return typeof d?.content==='string'?d.content:'';
 if(s.type==='workday')return d?.jobPostingInfo?.jobDescription||'';
 if(s.type==='microsoft'||s.type==='eightfold')return d?.data?.jobDescription||'';
 // Oracle 的职责与任职要求分在不同字段，签证声明可能在任何一段里
 if(s.type==='oracle'){const x=d?.items?.[0]||{};return [x.ExternalDescriptionStr,x.ExternalResponsibilitiesStr,x.ExternalQualificationsStr].filter(Boolean).join('\n')}
 if(s.type==='smartrecruiters'){const x=d?.jobAd?.sections||{};return [x.jobDescription,x.qualifications,x.additionalInformation,x.companyDescription].map((p:any)=>p?.text).filter(Boolean).join('\n')}
 return '';
}
/**
 * 按岗位补拉详情，返回 岗位编号 → 纯文本描述。单条失败不影响整批，下一轮更新会再补。
 * 站点群在冷却中、或任何一条被限流（429），就不再发起新请求，并通过 throttled 告诉调用方本次别再补了。
 * 并发比列表低（4）：首轮补积压时几百个来源同时要详情，压力主要来自这里。
 */
export async function fetchDescriptions(s:Source,jobs:{id:string;url:string}[],concurrency=4):Promise<{texts:Map<string,string>;throttled:boolean}>{
 const texts=new Map<string,string>();let next=0,throttled=false;
 // 要求了请求间隔的站点（Qualcomm 连续请求就 429）：详情也一条一条按间隔发
 const lanes=s.delay?1:concurrency;
 await Promise.all(Array.from({length:Math.min(lanes,jobs.length)},async()=>{while(next<jobs.length&&!throttled){const j=jobs[next++];
  try{const url=detailUrl(s,j);if(!url)continue;
   if(isCooling(url)){throttled=true;break}
   if(s.delay)await sleep(s.delay);
   const text=plain(detailText(s,await (await request(url,{retry:DETAIL_RETRY})).json()));if(text)texts.set(j.id,text);
  }catch(e:any){if(/HTTP 429\b/.test(String(e?.message)))throttled=true}
 }}));
 return {texts,throttled};
}
/** Greenhouse /offices 接口是 办公室 → 部门 → 岗位 的树，反过来拼成 岗位编号 → 办公室地址。 */
async function greenhouseOffices(board:string){
 const d:any=await (await request(`https://boards-api.greenhouse.io/v1/boards/${board}/offices`)).json();if(!Array.isArray(d?.offices))throw Error('Greenhouse 办公室列表格式异常');
 const map=new Map<string,string[]>();
 for(const o of d.offices){const place=o.location||o.name;if(!place)continue;for(const dep of o.departments||[])for(const j of dep.jobs||[]){const k=String(j.id);map.set(k,[...(map.get(k)||[]),place])}}
 return map;
}
/** relay：本机 Node 中转（见 lib/node-relay.ts），只用于标了 via: node 的来源。 */
export async function fetchPage(s:Source,offset=0,expectedTotal=0,opts:{light?:boolean;relay?:Relay}={}):Promise<Page>{
 if(s.type==='workday'){
 const d:any=await (await request(`https://${s.host}/wday/cxs/${s.tenant}/${s.board}/jobs`,{body:{limit:20,offset,searchText:'',appliedFacets:s.appliedFacets||{}}})).json();if(!Array.isArray(d.jobPostings))throw Error('Workday 返回格式异常');
 // 续跑时岗位总数已经变少、游标越过了当前总数：Workday 这时返回空页（Cisco）或者带着真实总数把第一页再给一遍
 // （Wells Fargo、Zoom），按原逻辑会一直报“分页提前结束 / 重复返回同一页”卡到续跑窗口过期。直接收尾，标为不完整、不做下架判定，下一轮从头来。
 // 注意很多租户（Wells Fargo、NVIDIA、Zoom）只在第一页给总数、后面每页都是 0，只有总数大于 0 时才能这样判断
 if(offset>0&&d.total>0&&offset>=d.total)return {jobs:[],next:null,total:d.total,fetched:0,fingerprint:'',warning:'本轮更新期间岗位总数减少，游标越过了当前总数；历史岗位不作下架判定'};
 // Workday 偶尔返回没有标题和链接的空记录，跳过它们，但保留分页计数以免错过后续岗位。
 const rows=d.jobPostings;const jobs=inUs(rows.filter((j:any)=>j.title&&j.externalPath).map((j:any)=>job(s,j.externalPath?.split('_').pop()||j.externalPath?.split('/').pop(),j.title,(j.locationsText||workdayPlace(j.externalPath))+(s.usFiltered?' · 美国':''),`${workdayBase(s)}${j.externalPath}`)).filter((j:Job)=>s.usFiltered||isUS(j.location)));
 return page(jobs,rows.map((j:any)=>j.externalPath||'-'),offset,offset>0?Math.max(d.total,expectedTotal):d.total,rows.length,(d.total===2000||expectedTotal===2000)?'来源返回 2000 条上限，可能还有未返回岗位；历史岗位不作下架判定':undefined);
 }
 if(s.type==='lever'){
 const rows:any[]=await (await request(`https://api.lever.co/v0/postings/${s.board||s.id}?mode=json`)).json();if(!Array.isArray(rows))throw Error('Lever 返回格式异常');
 const where=(j:any)=>[j.categories?.location,...(j.categories?.allLocations||[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' / ');
 // 只写了 Remote / Hybrid 的岗位靠 country（主地点的国家代码）判断；多地点岗位的主地点可能在国外，地点文本仍然要看
 const jobs=inUs(rows.filter((j:any)=>j.country==='US'||isUS(where(j))).map((j:any)=>job(s,j.id,j.text,where(j),j.hostedUrl||j.applyUrl,j.descriptionPlain||j.description||'',/intern/i.test(j.categories?.commitment||''),j.categories?.team||'')));
 return {jobs,next:null,total:jobs.length,fetched:jobs.length,fingerprint:''};
 }
 if(s.type==='smartrecruiters'){
 const d:any=await (await request(`https://api.smartrecruiters.com/v1/companies/${s.board||s.id}/postings?limit=100&offset=${offset}`)).json();if(!Array.isArray(d.content)||!Number.isInteger(d.totalFound))throw Error('SmartRecruiters 返回格式异常');
 const rows=d.content;const jobs=inUs(rows.filter((j:any)=>isUS([j.location?.city,j.location?.region].filter(Boolean).join(', '),String(j.location?.country||'').toUpperCase())).map((j:any)=>{const l=j.location||{};const locations=[l.city,l.region].filter(Boolean).join(', ')+(l.remote?' · Remote':'');
 return job(s,j.id,j.name,locations,`https://jobs.smartrecruiters.com/${s.board||s.id}/${j.id}`,'',/intern/i.test(j.typeOfEmployment?.label||''),j.department?.label||j.function?.label||'')}));
 return page(jobs,rows.map((j:any)=>String(j.id)),offset,d.totalFound,rows.length);
 }
 if(s.type==='amazon'){
 const params=new URLSearchParams({offset:String(offset),result_limit:'100','country[]':'USA'});for(const c of ['software-development','data-science','machine-learning-science','business-intelligence','project-program-product-management-technical','project-program-product-management-non-tech','design','marketing','operations-it-support-engineering','systems-quality-security-engineering'])params.append('category[]',c);
 const d:any=await (await request(`https://www.amazon.jobs/en/search.json?${params}`)).json();if(!Array.isArray(d.jobs)||d.error)throw Error('Amazon 返回格式异常');
 const jobs=inUs(d.jobs.filter((j:any)=>isUS(j.location,j.country_code)).map((j:any)=>job(s,j.id_icims||j.id,j.title,j.location,new URL(j.job_path,'https://www.amazon.jobs').href,j.description||'',!!j.is_intern)));return page(jobs,d.jobs.map((j:any)=>String(j.id_icims||j.id)),offset,d.hits,d.jobs.length,d.hits>=10000?'来源结果达到 10000 条上限，可能还有未返回岗位':undefined);
 }
 if(s.type==='microsoft'||s.type==='eightfold'){
 // Eightfold 托管的招聘站（PCS）接口，Microsoft 也用它：host 是招聘站域名，domain 是公司在 Eightfold 里的标识。每页 10 条。
 // params 是站点自己的筛选项（Starbucks 只取门店以外的职位类别）；没开通 pcsx 的公司（NetApp）用旧版 /api/apply/v2，列表自带描述
 const v2=s.api==='v2',q=new URLSearchParams({domain:s.domain||'',location:'United States',start:String(offset),sort_by:'timestamp',...(v2?{num:'10'}:{query:''})});
 for(const [k,vs] of Object.entries(s.params||{}))for(const v of vs)q.append(k,v);
 const d:any=await (await request(`https://${s.host}/api/${v2?'apply/v2/jobs':'pcsx/search'}?${q}`)).json();const body=v2?d:d?.data,rows=body?.positions;
 if(!Array.isArray(rows)||!Number.isInteger(body?.count)||(!v2&&d.status!==200))throw Error(`${s.name} 返回格式异常`);
 // 标准化地点写法不一：Microsoft 是 'US'，Lockheed 是 'Littleton, CO, US'，Lam 是 'NM,US'
 const jobs=inUs(rows.filter((j:any)=>j.standardizedLocations?.some((l:string)=>/(^|,\s*)US$/.test(l))||(j.locations||[j.location]).some((x:string)=>isUS(x||''))).map((j:any)=>job(s,j.id,j.name,unique(j.locations||[j.location]).join(' / '),new URL(j.positionUrl||j.canonicalPositionUrl||`/careers/job/${j.id}`,`https://${s.host}`).href,j.job_description||'',false,j.department||'')));
 return page(jobs,rows.map((j:any)=>String(j.id)),offset,body.count,rows.length);
 }
 if(s.type==='google'){
 const d=parseGoogle(await (await request(`https://www.google.com/about/careers/applications/jobs/results/?location=United%20States&page=${Math.floor(offset/20)+1}`)).text());const rows=d[0];const jobs=inUs(rows.filter((j:any)=>j[9]?.some((l:any)=>l[5]==='US')).map((j:any)=>job(s,j[0],j[1],j[9].map((l:any)=>l[0]).join(' / '),`https://www.google.com/about/careers/applications/jobs/results/${j[0]}/`,[j[4]?.[1],j[3]?.[1],j[10]?.[1]].filter(Boolean).join('\n'))));return page(jobs,rows.map((j:any)=>j[0]),offset,d[2],rows.length);
 }
 if(s.type==='apple'){
 // jobs.apple.com 见到 Workers 运行时给每个出站请求附加的 CF-Worker 头就返回 403，同一台机器用 Node 请求正常。
 // 开发环境经本机 Node 中转（opts.relay）；没有中转（生产环境）时给出可读的说明，而不是让它看起来像一次偶发失败。
 // 用前端同款 JSON 搜索接口：每页约 37KB，服务端渲染的搜索页要 330KB。
 const relay=s.via==='node'?opts.relay:undefined;
 const fail=(e:any):never=>{const m=String(e?.message);if(/HTTP (401|403)\b/.test(m))appleSession=null;throw Error(/HTTP 403\b/.test(m)&&!relay?'jobs.apple.com 拒绝了 Workers 运行时发出的请求（HTTP 403），需要在本机开发服务器（npm run dev）里经 Node 中转才能收录':m)};
 const headers=await appleHeaders(relay).catch(fail);
 const d=parseApple(await (await request(`${APPLE}/api/v1/search`,{relay,headers,body:{query:'',filters:{locations:['postLocation-USA']},page:Math.floor(offset/20)+1,locale:'en-us',sort:'newest',format:{longDate:'MMMM D, YYYY',mediumDate:'MMM D, YYYY'}}}).catch(fail)).json());const rows=d.searchResults;const jobs=inUs(rows.filter((j:any)=>j.locations?.some((l:any)=>l.countryID==='iso-country-USA')).map((j:any)=>job(s,j.id,j.postingTitle,j.locations.map((l:any)=>l.name||[l.city,l.stateProvince,l.countryName].filter(Boolean).join(', ')).join(' / '),`https://jobs.apple.com/en-us/details/${j.positionId}/${j.transformedPostingTitle}`,j.jobSummary)));return page(jobs,rows.map((j:any)=>j.id),offset,d.totalRecords,rows.length);
 }
 if(s.type==='successfactors'){
 // SAP SuccessFactors 的 Career Site Builder 招聘站（SAP、McDonald's、Gulfstream、Paramount…）只有服务端渲染的列表页：
 // 表格行（tr.data-row）或卡片（li.job-tile）两种排版，按 startrow 翻页，每页 10–25 条；筛选条件写在 list 模板里
 const html=await (await request(s.list!.replace('{offset}',String(offset)))).text();
 // 必须真的读到总数：维护页、改版页读不到，不能当成“共 0 个岗位”把历史岗位全标成下架
 const label=html.match(/Results\s*<b>[^<]*<\/b>\s*of\s*<b>([\d,]+)<\/b>/)||html.match(/\bof\s+([\d,]+)\s+Jobs\b/i);
 if(!label)throw Error(`${s.name} 页面结构已变化，历史岗位已保留`);
 const total=Number(label[1].replace(/,/g,''));
 const rows=html.split(/class="(?:data-row["\s]|job-tile\s)/).slice(1).map(chunk=>{
  const a=chunk.match(/<a\b([^>]*jobTitle-link[^>]*)>([\s\S]*?)<\/a>/),href=a?.[1].match(/href="([^"]+)"/)?.[1]||'';
  const where=(chunk.match(/class="jobLocation"[^>]*>([\s\S]*?)<\/span>/)||chunk.match(/section-location-value"[^>]*>([\s\S]*?)<\/div>/)||[])[1]||'';
  return {id:href.match(/\/(\d+)\/?$/)?.[1]||'',title:text(a?.[2]||''),href,location:text(where)};
 }).filter(r=>r.id&&r.title);
 const jobs=inUs(rows.filter(r=>s.usFiltered||isUS(r.location)).map(r=>job(s,r.id,r.title,r.location,new URL(r.href,s.careerUrl).href)));
 return page(jobs,rows.map(r=>r.id),offset,total,rows.length);
 }
 if(s.type==='avature'){
 // Avature 招聘站（Bloomberg、EA、Two Sigma、Deloitte）只有服务端渲染的列表页，每页条数固定（10–20），按 jobOffset 翻页。
 // 有的站点不写总数：分页链接里还有更大的 jobOffset 就说明后面还有
 const html=await (await request(s.list!.replace('{offset}',String(offset)))).text();
 const rows=html.split(/<article\b[^>]*article--result/).slice(1).map(chunk=>{
  const a=chunk.match(/<a\b[^>]*href="([^"]*\/JobDetail\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/),href=(a?.[1]||'').replace(/&amp;/g,'&');
  const where=(chunk.match(/list-item-location"[^>]*>([\s\S]*?)<\/span>/)||chunk.match(/paragraph_inner-span"[^>]*>([\s\S]*?)<\/span>/)||chunk.match(/article__header__text__subtitle"[^>]*>([\s\S]*?)<\/div>/)||[])[1]||'';
  return {id:href.match(/\/(\d+)\/?(?:[?#]|$)/)?.[1]||'',title:text(a?.[2]||''),href,location:text(where),team:text((chunk.match(/list-item-department"[^>]*>([\s\S]*?)<\/span>/)||[])[1]||'')};
 }).filter(r=>r.id&&r.title);
 // 不写总数时一页也解析不出来，分不清是真没岗位还是页面改版，一律当异常，免得一轮“完整更新”把历史岗位全标成下架
 if(!rows.length)throw Error(offset?'来源分页提前结束，保留历史岗位':`${s.name} 页面结构已变化，历史岗位已保留`);
 const stated=Number(((html.match(/aria-label="([\d,]+) results"/)||[])[1]||'').replace(/,/g,''));
 const more=[...html.matchAll(/jobOffset=(\d+)/g)].some(m=>Number(m[1])>offset);
 const jobs=inUs(rows.filter(r=>s.usFiltered||isUS(r.location)).map(r=>job(s,r.id,r.title,r.location,r.href,'',false,r.team)));
 return page(jobs,rows.map(r=>r.id),offset,stated>0?stated:offset+rows.length+(more?1:0),rows.length);
 }
 if(s.type==='oracle'){
 // Oracle 招聘云的候选人站点接口（Oracle、JPMorgan、Honeywell、Ford…）：site 是招聘站编号，usLocation 是该实例里
 // United States 地点分面的编号。地点筛选也会带回主地点在国外、次要地点在美国的岗位，有一个美国地点就收。列表只带简介，完整描述走详情补拉
 const d:any=await (await request(`https://${s.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${s.site},limit=${ORACLE_PAGE},offset=${offset},selectedLocationsFacet=${s.usLocation},sortBy=POSTING_DATES_DESC`)).json();
 const res=d?.items?.[0];if(!Array.isArray(res?.requisitionList)||!Number.isInteger(res.TotalJobsCount))throw Error(`${s.name} 返回格式异常`);
 const rows=res.requisitionList;
 const jobs=inUs(rows.filter((j:any)=>j.PrimaryLocationCountry==='US'||(j.secondaryLocations||[]).some((l:any)=>l.CountryCode==='US')).map((j:any)=>job(s,j.Id,j.Title,unique([j.PrimaryLocation,...(j.secondaryLocations||[]).map((l:any)=>l.Name)]).join(' / '),oracleJobUrl(s,j.Id),'',false,j.JobFamily||j.JobFunction||'')));
 return page(jobs,rows.map((j:any)=>String(j.Id)),offset,res.TotalJobsCount,rows.length);
 }
 if(s.type==='jibe'){
 // iCIMS 的 Jibe 招聘站（AMD、Rivian、DocuSign、PepsiCo）：按国家筛，列表自带完整描述；页码从 1 开始，每页 100 条。
 // country 默认 United States，PepsiCo 的美国岗位分在 United States 与 USA 两种写法下，由 params 覆盖
 const q=new URLSearchParams({page:String(Math.floor(offset/100)+1),limit:'100',sortBy:'posted_date',descending:'true',internal:'false',country:s.params?.country?.[0]||'United States'});
 const d:any=await (await request(`https://${s.host}/api/jobs?${q}`)).json();if(!Array.isArray(d?.jobs)||!Number.isInteger(d.totalCount))throw Error(`${s.name} 返回格式异常`);
 const rows=d.jobs.map((x:any)=>x?.data||{});
 const jobs=inUs(rows.filter((j:any)=>j.country_code==='US'||isUS(j.full_location||'')).map((j:any)=>job(s,j.slug||j.req_id,j.title,j.full_location||[j.city,j.state].filter(Boolean).join(', '),`https://${s.host}/${s.board||'careers-home'}/jobs/${j.slug||j.req_id}`,j.description||'',/intern/i.test(j.employment_type||''),(j.categories||[]).map((c:any)=>c.name).join(' '))));
 return page(jobs,rows.map((j:any)=>String(j.slug||j.req_id)),offset,d.totalCount,rows.length);
 }
 if(s.type==='ibm'){
 // IBM 招聘站背后的站内搜索接口：按国家字段筛美国；默认排序翻页会重复，按 _id 排序；每页 100 条，列表只带摘要
 const d:any=await (await request('https://www-api.ibm.com/search/api/v2',{body:{appId:'careers',scopes:['careers2'],query:{bool:{must:[{term:{field_keyword_05:'United States'}}]}},size:100,from:offset,sort:[{_id:'asc'}],lang:'zz',localeSelector:{},sm:{query:'',lang:'zz'},_source:['_id','title','url','description','field_keyword_08','field_keyword_18','field_keyword_19']}})).json();
 const hits=d?.hits?.hits,total=d?.hits?.total?.value;if(!Array.isArray(hits)||!Number.isInteger(total))throw Error('IBM 返回格式异常');
 const jobs=inUs(hits.filter((h:any)=>h._source?.url&&h._source?.title).map((h:any)=>{const x=h._source,where=String(x.field_keyword_19||'');return job(s,new URL(x.url).searchParams.get('jobId')||h._id,x.title,/\bUS\b|United States/.test(where)?where:[where,'United States'].filter(Boolean).join(', '),x.url,x.description||'',/intern/i.test(x.field_keyword_18||''),x.field_keyword_08||'')}));
 return page(jobs,hits.map((h:any)=>String(h._id)),offset,total,hits.length);
 }
 if(s.type==='atlassian'){
 // Atlassian 招聘页用的列表接口：一次返回全部岗位（约 2MB，带描述），同一岗位会重复出现。
 // 它拒绝 Workers 运行时发出的请求，开发环境经本机 Node 中转（via: node）
 const rows:any[]=await (await request('https://www.atlassian.com/endpoint/careers/listings',{relay:s.via==='node'?opts.relay:undefined})).json();if(!Array.isArray(rows))throw Error('Atlassian 返回格式异常');
 const byId=new Map(rows.filter(j=>j?.id&&j.title).map(j=>[String(j.id),j]));
 const jobs=inUs([...byId.values()].filter(j=>(j.locations||[]).some((l:string)=>/United States/i.test(l))).map(j=>job(s,j.id,j.title,(j.locations||[]).filter((l:string)=>/United States/i.test(l)).join(' / '),`https://www.atlassian.com/company/careers/details/${j.id}`,[j.overview,j.responsibilities,j.qualifications].filter(Boolean).join('\n'),/intern|graduate/i.test(j.type||''),j.category||'')));
 return {jobs,next:null,total:jobs.length,fetched:jobs.length,fingerprint:''};
 }
 if(s.type==='mckinsey'){
 // McKinsey 招聘站背后的网关接口：一条岗位是一个“岗位族”，城市与国家是两个一一对应的数组；start 是从 1 开始的页码
 const d:any=await (await request(`${s.list}&pageSize=100&start=${Math.floor(offset/100)+1}`)).json();if(!Array.isArray(d?.docs)||!Number.isInteger(d.numFound))throw Error('McKinsey 返回格式异常');
 const jobs=inUs(d.docs.filter((j:any)=>j.jobID&&j.title).map((j:any)=>{const cities=(j.cities||[]).filter((_:string,i:number)=>/United States/i.test(j.countries?.[i]||''));return job(s,j.jobID,j.title,unique(cities).map((c:string)=>`${c}, United States`).join(' / ')||'United States',`https://www.mckinsey.com/careers/search-jobs/jobs/${j.friendlyURL||j.jobID}`,[j.whatYouWillDo,j.yourBackground].filter(Boolean).join('\n'),false,[j.interest,j.functions].flat().filter(Boolean).join(' '))}));
 return page(jobs,d.docs.map((j:any)=>String(j.jobID)),offset,d.numFound,d.docs.length);
 }
 if(s.type==='rippling'){
 // Rippling 招聘平台（ats.rippling.com）：每个地点一行，同一岗位编号会重复，按编号合并地点；每页 500 行，页码从 0 开始
 const d:any=await (await request(`https://ats.rippling.com/api/v2/board/${encodeURIComponent(s.board||s.id)}/jobs?page=${Math.floor(offset/500)}&pageSize=500`)).json();if(!Array.isArray(d?.items)||!Number.isInteger(d.totalItems))throw Error(`${s.name} 返回格式异常`);
 const byId=new Map<string,any>();for(const j of d.items){if(!j?.id||!j.name)continue;const x=byId.get(j.id)||{...j,locations:[]};x.locations.push(...(j.locations||[]));byId.set(j.id,x)}
 const jobs=inUs([...byId.values()].filter(j=>j.locations.some((l:any)=>l.countryCode==='US')).map(j=>job(s,j.id,j.name,unique(j.locations.filter((l:any)=>l.countryCode==='US').map((l:any)=>l.name||[l.city,l.stateCode].filter(Boolean).join(', '))).join(' / '),j.url,'',false,j.department?.name||'')));
 return page(jobs,d.items.map((j:any)=>String(j.id)),offset,d.totalItems,d.items.length);
 }
 // Greenhouse 带描述的列表要 9.4MB、不带只要 743KB；已收录过的来源改用轻量列表，描述再按需补。
 const board=s.board||s.id;const url=s.type==='ashby'?`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`:`https://boards-api.greenhouse.io/v1/boards/${board}/jobs${opts.light?'':'?content=true'}`;const payload:any=await (await request(url)).json();
 // 地点只写了 Hybrid、Remote 的 Greenhouse 岗位要靠所属办公室定位；带描述的列表自带办公室，轻量列表没有，这时才补拉一次对照表
 const offices=s.type==='greenhouse'&&Array.isArray(payload?.jobs)&&payload.jobs.some((j:any)=>!j.offices&&vagueLocation(String(j.location?.name||'')))?await greenhouseOffices(board):undefined;
 const jobs:Job[]=inUs(normalize(s,payload,offices).map((j:any)=>({...j,...locationFields(j.location)})));return {jobs,next:null,total:jobs.length,fetched:jobs.length,fingerprint:''};
}
