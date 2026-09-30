import companySources from './company-sources.json' with { type: 'json' };
import platformSources from './platform-sources.json' with { type: 'json' };
import type { Source } from './source-types';
import { signals } from './job-signals';
// 四家自建招聘系统单独实现，其余来源由注册表提供。
// Apple 的站点拒绝 Workers 运行时发起的 TLS 握手、却接受 Node，开发环境下经本机 Node 中转（via: node，见 vite.config.ts）。
const CUSTOM:Source[]=([
 {id:'amazon',name:'Amazon',careerUrl:'https://www.amazon.jobs/',scope:'美国 · 软件、数据、产品、设计、营销与 IT 类别'},
 // Microsoft 的列表与详情是同一个站点，连续补详情会让列表分页也 429（实测 1 秒间隔仍会触发）：按 2 秒间隔串行请求
 {id:'microsoft',name:'Microsoft',careerUrl:'https://apply.careers.microsoft.com/',host:'apply.careers.microsoft.com',domain:'microsoft.com',delay:2000},
 {id:'google',name:'Google',careerUrl:'https://www.google.com/about/careers/applications/jobs/results/'},
 {id:'apple',name:'Apple',careerUrl:'https://jobs.apple.com/',via:'node'},
] as Pick<Source,'id'|'name'|'careerUrl'|'scope'|'via'|'host'|'domain'|'delay'>[]).map(s=>({type:s.id,group:'company',tier:'major',scope:'美国岗位',...s}));
export const SOURCES:Source[]=[...platformSources as unknown as Source[],...companySources as unknown as Source[],...CUSTOM];
export function classify(title:string){
 if(/machine learning|\bAI\b|research scientist|research engineer|deep learning|applied scientist/i.test(title))return 'AI / 机器学习';
 if(/security|cyber|trust.*safety/i.test(title))return '安全';
 if(/data|analytics|business intelligence/i.test(title))return '数据分析';
 if(/product manager|product management/i.test(title))return '产品经理';
 if(/design|\bUX\b|\bUI\b/i.test(title))return '设计';
 // 不带 engineer 字样的技术头衔：Member of Technical Staff、Programmer、DevOps、Solutions / Cloud Architect 等
 if(/engineer|developer|\bSRE\b|software|programmer|devops|member of (the )?technical staff|\bSDE\b|\bSWE\b|\b(solutions?|cloud|systems|platform|enterprise|infrastructure) architect/i.test(title))return '软件工程';
 if(/marketing|growth|operations|content|community/i.test(title))return '市场 / 运营';
 return '其他';
}
export function isUS(location:string,country=''){
 if(country)return /^(US|USA|United States|United States of America)$/i.test(country);
 if(/\bunited states\b|\bUSA\b|\bUS\b/i.test(location))return true;
 if(/\b(canada|india|china|taiwan|singapore|japan|israel|ireland|united kingdom|germany|france|australia|mexico|brazil|costa rica|poland|korea|malaysia|philippines|vietnam|italy|netherlands|spain|switzerland|belgium|sweden|indonesia|thailand|colombia|chile)\b/i.test(location))return false;
 if(/\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia)\b/i.test(location))return true;
 if(/,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)(?:\b|\d)/.test(location)||/^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s+-/.test(location))return true;
 return /san francisco|seattle|austin|boston|los angeles|chicago|mountain view|palo alto|menlo park|san jose|sunnyvale|bellevue|redmond|denver|atlanta|san diego|san mateo|burlingame|santa clara|irvine|raleigh|philadelphia|pittsburgh|portland|cupertino|fremont|santa monica/i.test(location);
}
/** 只接受 http/https 的官方链接，并统一升级为 https；其它协议一律视为无效。 */
export function secureUrl(url:unknown){const u=typeof url==='string'?url:'';return /^https?:\/\//i.test(u)?u.replace(/^http:\/\//i,'https://'):''}
export function plain(s:string){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<\/(p|div|li|h\d)>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim().slice(0,20000)}
/** 地点只写了办公形式（Hybrid、Remote、Distributed、In-Office、TBD…），看不出在哪个国家。 */
export function vagueLocation(location:string){return !location.replace(/\b(hybrid|remote|distributed|in[- ]office|office|on[- ]?site|flexible|flex|anywhere|tbd|multiple locations|various locations|or|and|first|friendly|based|work from home|wfh)\b/gi,'').replace(/[\s;,/|()&+-]+/g,'')}
/**
 * 招聘系统里的测试岗位（Hearst 的招聘板上曾有几十条 "Corporate UAT TEST JOB"），不是真实职位。
 * 只认得很明显的写法：整条标题就是 Test / UAT 之类；bug bash、do not apply、this is a test 字样；
 * 两侧都是连字符的独立 Test 段（"HTV-DanielleM-Test-Administrative Assistant"）；
 * 或全大写的 TEST、带编号的 UAT 夹在正常大小写的标题里。Test Engineer、Test-Driven…、UAT Analyst 这类真实职位照常保留；
 * 有的公司整条标题全大写，那里的 TEST 是正常用词，也不算。
 */
export function isTestPosting(title:string){
 const t=title.trim();
 if(/^(test|uat|dummy|sample|demo)([\s_-]+(test|uat|job|posting|req|requisition|position|role|\d+))*$/i.test(t))return true;
 if(/\bbug bash\b|\bdo not apply\b|\bthis is a test\b|\btest (job|posting|requisition|req|offer|account)\b|\b(offer|dummy|fake) test\b/i.test(t))return true;
 if(/[-–—]\s*test\s*[-–—]/i.test(t))return true;
 return t!==t.toUpperCase()&&(/\bTEST\b/.test(t)||/\bUAT\b[\s#-]*(\d|req)/i.test(t));
}
/**
 * Greenhouse 岗位的地点：location.name 只写了办公形式时（Cloudflare 大多数岗位是 "Hybrid"），改用所属办公室的地址，
 * 并保留办公形式。带描述的完整列表自带 offices；轻量列表不带，由调用方传入 /offices 接口拼出的 岗位 → 办公室地址 对照表。
 */
type GreenhouseJob={id:string|number;location?:{name?:string};offices?:{name?:string;location?:string|null}[]};
export function greenhouseLocation(j:GreenhouseJob,offices?:Map<string,string[]>){
 const named=String(j.location?.name||'').trim();
 if(!vagueLocation(named))return named;
 const places=Array.isArray(j.offices)?j.offices.map(o=>o.location||o.name||'').filter(Boolean):offices?.get(String(j.id))||[];
 if(!places.length)return named;
 return [...new Set(places)].join(' / ')+(/\b(hybrid|remote|distributed|in[- ]office|on[- ]?site)\b/i.test(named)?` · ${named}`:'');
}
export function normalize(source:typeof SOURCES[number],payload:any,offices?:Map<string,string[]>){
 if(!payload||!Array.isArray(payload.jobs))throw Error('来源返回格式异常');
 return payload.jobs.map((j:any)=>{const ash=source.type==='ashby';const locations=ash?[j.location,...(j.secondaryLocations||[]).map((x:any)=>x.location)].filter(Boolean).join(' / '):greenhouseLocation(j,offices);const country=ash?j.address?.postalAddress?.addressCountry:'';const url=secureUrl(ash?(j.applyUrl||j.jobUrl):j.absolute_url);
 if(!j.id||!j.title||!url)throw Error('岗位数据不完整');
 const description=plain(ash?(j.descriptionPlain||j.descriptionHtml||''):(j.content||'')),kind=/\bintern(ship)?\b|co-op/i.test(j.title+' '+(j.employmentType||''))?'实习':'正式 / 其他';
 // usFiltered：整块招聘板都是美国岗位（Compass 的地点常写成 "Boca Raton" 这样的裸城市名，逐条识别会漏）
 return {id:source.id+':'+j.id,source:source.id,company:source.name,title:j.title,location:locations,url,description,role:classify(j.title),kind,...signals(j.title,kind,description),us:!!source.usFiltered||isUS(locations,country)};}).filter((j:any)=>j.us);
}




