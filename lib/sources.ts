import companySources from './company-sources.json' with { type: 'json' };
import platformSources from './platform-sources.json' with { type: 'json' };
import type { Source } from './source-types';
import { signals } from './job-signals';
// 四家自建招聘系统单独实现，其余来源由注册表提供。
const CUSTOM:Source[]=['amazon','microsoft','google','apple'].map((id,i)=>({id,name:['Amazon','Microsoft','Google','Apple'][i],type:id,group:'company',tier:'major',careerUrl:['https://www.amazon.jobs/','https://apply.careers.microsoft.com/','https://www.google.com/about/careers/applications/jobs/results/','https://jobs.apple.com/'][i],scope:id==='amazon'?'美国 · 软件、数据、产品、设计、营销与 IT 类别':'美国岗位'}));
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
export function normalize(source:typeof SOURCES[number],payload:any){
 if(!payload||!Array.isArray(payload.jobs))throw Error('来源返回格式异常');
 return payload.jobs.map((j:any)=>{const ash=source.type==='ashby';const locations=ash?[j.location,...(j.secondaryLocations||[]).map((x:any)=>x.location)].filter(Boolean).join(' / '):(j.location?.name||'');const country=ash?j.address?.postalAddress?.addressCountry:'';const url=secureUrl(ash?(j.applyUrl||j.jobUrl):j.absolute_url);
 if(!j.id||!j.title||!url)throw Error('岗位数据不完整');
 const description=plain(ash?(j.descriptionPlain||j.descriptionHtml||''):(j.content||'')),kind=/\bintern(ship)?\b|co-op/i.test(j.title+' '+(j.employmentType||''))?'实习':'正式 / 其他';
 return {id:source.id+':'+j.id,source:source.id,company:source.name,title:j.title,location:locations,url,description,role:classify(j.title),kind,...signals(j.title,kind,description),us:isUS(locations,country)};}).filter((j:any)=>j.us);
}




