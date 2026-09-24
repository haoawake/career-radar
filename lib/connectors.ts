import type { Source } from './source-types';
import { classify,isUS,normalize,plain,secureUrl } from './sources';
import { locationFields } from './us-locations';
import { signals } from './job-signals';
export type Job={id:string;source:string;company:string;title:string;location:string;url:string;description:string;role:string;kind:string;level:string;visa:string|null;visaNote:string|null;cities:string|null;states:string|null;metros:string|null;remote:number};
export type Page={jobs:Job[];next:number|null;total:number;fetched:number;fingerprint:string;warning?:string};
function job(s:Source,id:unknown,title:string,location:string,url:string,description='',intern=false,department=''):Job{const link=secureUrl(url);if(!id||!title||!link)throw Error('岗位数据缺少编号、标题或有效官网链接');const text=plain(description),kind=intern||/\bintern(ship)?\b|co-op/i.test(title)?'实习':'正式 / 其他';return {id:s.id+':'+id,source:s.id,company:s.name,title,location,url:link,description:text,role:classify(title)==='其他'?classify(department):classify(title),kind,...signals(title,kind,text),...locationFields(location)}}
/** 已通过美国判定但地点文本无法定位到城市或州时，仍归入“其他美国地点”，保证地区筛选不会漏掉它们。 */
function inUs(jobs:Job[]):Job[]{return jobs.map(j=>j.metros?j:{...j,metros:'|other-us|'})}
function page(jobs:Job[],ids:string[],offset:number,total:number,size:number,warning?:string):Page{if(!Number.isInteger(total)||total<0)throw Error('官方总数格式异常');if(!ids.length&&offset<total)throw Error('来源分页提前结束，保留历史岗位');return {jobs,next:offset+size<total?offset+size:null,total,fetched:size,fingerprint:ids.join('|'),warning}}
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
async function request(url:string,body?:object,attempts=3,retry=RETRY_STATUS){
 let last='';
 for(let i=0;i<attempts;i++){
  const r=await fetch(url,{method:body?'POST':'GET',headers:{Accept:'application/json,text/html','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
  if(r.ok)return r;
  last=`官方来源 HTTP ${r.status}`;
  if(r.status===429)cooling.set(siteOf(url),Date.now()+COOL_MS);
  if(!retry.has(r.status)||i===attempts-1)break;
  const after=Number(r.headers.get('retry-after'));
  await sleep(Math.min(Number.isFinite(after)&&after>0?after*1000:0||1000*2**i+Math.random()*600,15000));
 }
 throw Error(last);
}
export function parseGoogle(text:string){const m=text.match(/key: 'ds:1', hash: '[^']*', data:([\s\S]*?), sideChannel:/);if(!m)throw Error('Google 页面结构已变化');const d=JSON.parse(m[1]);if(!Array.isArray(d[0])||!Number.isInteger(d[2]))throw Error('Google 岗位数据异常');return d}
export function parseApple(text:string){const m=text.match(/window\.__staticRouterHydrationData = JSON\.parse\(("(?:[^"\\]|\\.)*")\)/);if(!m)throw Error('Apple 页面结构已变化');const d=JSON.parse(JSON.parse(m[1]))?.loaderData?.search;if(!Array.isArray(d?.searchResults)||!Number.isInteger(d.totalRecords))throw Error('Apple 岗位数据异常');return d}
/** 列表接口不带描述、需要按岗位补拉详情的来源：Greenhouse 轻量列表、Workday、SmartRecruiters、Microsoft。 */
export const DETAIL_TYPES=new Set(['greenhouse','workday','smartrecruiters','microsoft']);
// 岗位下架后详情接口会拒绝（Workday 返回 403、其他平台 404），这种直接放弃；网关错误值得退避重试。
// 429 不重试：详情与列表分页常是同一个站点（Microsoft 实测连续补拉会让后续列表分页也 429，整个来源判为失败），
// 详情只是锦上添花，被限流就立刻收手，把配额留给列表
const DETAIL_RETRY=new Set([502,503,504]);
/** 单个岗位详情的官方接口地址；拿不到时返回空串。 */
export function detailUrl(s:Source,j:{id:string;url:string}){
 const raw=encodeURIComponent(j.id.slice(s.id.length+1)),board=s.board||s.id;
 if(s.type==='greenhouse')return `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${raw}`;
 if(s.type==='smartrecruiters')return `https://api.smartrecruiters.com/v1/companies/${board}/postings/${raw}`;
 if(s.type==='microsoft')return `https://apply.careers.microsoft.com/api/pcsx/position_details?position_id=${raw}&domain=microsoft.com&hl=en`;
 // Workday 的岗位编号还原不出路径，从收录时拼好的官网链接里取回 externalPath
 if(s.type==='workday'){const prefix=`https://${s.host}/en-US/${s.board}`;return j.url.startsWith(prefix+'/job/')?`https://${s.host}/wday/cxs/${s.tenant}/${s.board}${j.url.slice(prefix.length)}`:''}
 return '';
}
/** 从各平台详情响应里取出描述 HTML；SmartRecruiters 的要求与补充说明分在不同段落，签证声明常在补充说明里，一并拼上。 */
export function detailText(s:Source,d:any):string{
 if(s.type==='greenhouse')return typeof d?.content==='string'?d.content:'';
 if(s.type==='workday')return d?.jobPostingInfo?.jobDescription||'';
 if(s.type==='microsoft')return d?.data?.jobDescription||'';
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
 await Promise.all(Array.from({length:Math.min(concurrency,jobs.length)},async()=>{while(next<jobs.length&&!throttled){const j=jobs[next++];
  try{const url=detailUrl(s,j);if(!url)continue;
   if(isCooling(url)){throttled=true;break}
   const text=plain(detailText(s,await (await request(url,undefined,3,DETAIL_RETRY)).json()));if(text)texts.set(j.id,text);
  }catch(e:any){if(/HTTP 429\b/.test(String(e?.message)))throttled=true}
 }}));
 return {texts,throttled};
}
export async function fetchPage(s:Source,offset=0,expectedTotal=0,opts:{light?:boolean}={}):Promise<Page>{
 if(s.type==='workday'){
 const d:any=await (await request(`https://${s.host}/wday/cxs/${s.tenant}/${s.board}/jobs`,{limit:20,offset,searchText:'',appliedFacets:s.appliedFacets||{}})).json();if(!Array.isArray(d.jobPostings))throw Error('Workday 返回格式异常');
 // Workday 偶尔返回没有标题和链接的空记录，跳过它们，但保留分页计数以免错过后续岗位。
 const rows=d.jobPostings;const jobs=inUs(rows.filter((j:any)=>j.title&&j.externalPath).map((j:any)=>job(s,j.externalPath?.split('_').pop()||j.externalPath?.split('/').pop(),j.title,(j.locationsText||'')+(s.usFiltered?' · 美国':''),`https://${s.host}/en-US/${s.board}${j.externalPath}`)).filter((j:Job)=>s.usFiltered||isUS(j.location)));
 return page(jobs,rows.map((j:any)=>j.externalPath||'-'),offset,offset>0?Math.max(d.total,expectedTotal):d.total,rows.length,(d.total===2000||expectedTotal===2000)?'来源返回 2000 条上限，可能还有未返回岗位；历史岗位不作下架判定':undefined);
 }
 if(s.type==='lever'){
 const rows:any[]=await (await request(`https://api.lever.co/v0/postings/${s.board||s.id}?mode=json`)).json();if(!Array.isArray(rows))throw Error('Lever 返回格式异常');
 const jobs=inUs(rows.map((j:any)=>{const locations=[j.categories?.location,...(j.categories?.allLocations||[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' / ');
 return job(s,j.id,j.text,locations,j.hostedUrl||j.applyUrl,j.descriptionPlain||j.description||'',/intern/i.test(j.categories?.commitment||''),j.categories?.team||'')}).filter((j:Job)=>isUS(j.location)));
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
 if(s.type==='microsoft'){
 const d:any=await (await request(`https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=&location=United%20States&start=${offset}&sort_by=timestamp`)).json();const rows=d.data?.positions;if(!Array.isArray(rows)||d.status!==200)throw Error('Microsoft 返回格式异常');const jobs=inUs(rows.filter((j:any)=>j.standardizedLocations?.includes('US')||j.locations?.some((x:string)=>isUS(x))).map((j:any)=>job(s,j.id,j.name,j.locations.join(' / '),new URL(j.positionUrl,'https://apply.careers.microsoft.com').href,'',false,j.department)));return page(jobs,rows.map((j:any)=>String(j.id)),offset,d.data.count,rows.length);
 }
 if(s.type==='google'){
 const d=parseGoogle(await (await request(`https://www.google.com/about/careers/applications/jobs/results/?location=United%20States&page=${Math.floor(offset/20)+1}`)).text());const rows=d[0];const jobs=inUs(rows.filter((j:any)=>j[9]?.some((l:any)=>l[5]==='US')).map((j:any)=>job(s,j[0],j[1],j[9].map((l:any)=>l[0]).join(' / '),`https://www.google.com/about/careers/applications/jobs/results/${j[0]}/`,[j[4]?.[1],j[3]?.[1],j[10]?.[1]].filter(Boolean).join('\n'))));return page(jobs,rows.map((j:any)=>j[0]),offset,d[2],rows.length);
 }
 if(s.type==='apple'){
 // jobs.apple.com 用 TLS 指纹识别拦截非浏览器客户端：同一台机器用 Node 请求返回 200，
 // 从 Workers 运行时发出的请求一律 403。这里给出可读的说明，而不是让它看起来像一次偶发失败。
 const res=await request(`https://jobs.apple.com/en-us/search?location=united-states-USA&page=${Math.floor(offset/20)+1}`)
  .catch((e:any)=>{throw Error(/403/.test(String(e.message))?'jobs.apple.com 拒绝了服务端发出的请求（HTTP 403），该站点只接受浏览器访问，此来源暂无法收录':e.message)});
 const d=parseApple(await res.text());const rows=d.searchResults;const jobs=inUs(rows.filter((j:any)=>j.locations?.some((l:any)=>l.countryID==='iso-country-USA')).map((j:any)=>job(s,j.id,j.postingTitle,j.locations.map((l:any)=>l.name||[l.city,l.stateProvince,l.countryName].filter(Boolean).join(', ')).join(' / '),`https://jobs.apple.com/en-us/details/${j.positionId}/${j.transformedPostingTitle}`,j.jobSummary)));return page(jobs,rows.map((j:any)=>j.id),offset,d.totalRecords,rows.length);
 }
 // Greenhouse 带描述的列表要 9.4MB、不带只要 743KB；已收录过的来源改用轻量列表，描述再按需补。
 const board=s.board||s.id;const url=s.type==='ashby'?`https://api.ashbyhq.com/posting-api/job-board/${board}`:`https://boards-api.greenhouse.io/v1/boards/${board}/jobs${opts.light?'':'?content=true'}`;const jobs:Job[]=inUs(normalize(s,await (await request(url)).json()).map((j:any)=>({...j,...locationFields(j.location)})));return {jobs,next:null,total:jobs.length,fetched:jobs.length,fingerprint:''};
}
