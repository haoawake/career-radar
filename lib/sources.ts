export const SOURCES=[
 {id:'anthropic',name:'Anthropic',type:'greenhouse'},
 {id:'figma',name:'Figma',type:'greenhouse'},
 {id:'stripe',name:'Stripe',type:'greenhouse'},
 {id:'discord',name:'Discord',type:'greenhouse'},
 {id:'databricks',name:'Databricks',type:'greenhouse'},
 {id:'reddit',name:'Reddit',type:'greenhouse'},
 {id:'airbnb',name:'Airbnb',type:'greenhouse'},
 {id:'cloudflare',name:'Cloudflare',type:'greenhouse'},
 {id:'openai',name:'OpenAI',type:'ashby'},
 {id:'notion',name:'Notion',type:'ashby'},
 {id:'ramp',name:'Ramp',type:'ashby'},
 {id:'perplexity',name:'Perplexity',type:'ashby'},
];
export function classify(title:string){
 if(/machine learning|\bAI\b|research scientist|research engineer|deep learning|applied scientist/i.test(title))return 'AI / 机器学习';
 if(/security|cyber|trust.*safety/i.test(title))return '安全';
 if(/data|analytics|business intelligence/i.test(title))return '数据分析';
 if(/product manager|product management/i.test(title))return '产品经理';
 if(/design|\bUX\b|\bUI\b/i.test(title))return '设计';
 if(/engineer|developer|\bSRE\b|software/i.test(title))return '软件工程';
 if(/marketing|growth|operations|content|community/i.test(title))return '市场 / 运营';
 return '其他';
}
export function isUS(location:string,country=''){
 if(country && /^(US|USA|United States|United States of America)$/i.test(country))return true;
 return /united states|\bUSA\b|\bUS\b|san francisco|new york|seattle|austin|boston|los angeles|chicago|mountain view|palo alto|menlo park|san jose|sunnyvale|bellevue|redmond|washington|denver|atlanta|san diego|san mateo|burlingame|santa clara|irvine|raleigh|philadelphia|pittsburgh|portland|cupertino|fremont|santa monica|california|massachusetts|texas|virginia|new jersey|united states remote/i.test(location);
}
export function plain(s:string){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<\/(p|div|li|h\d)>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim().slice(0,20000)}
export function normalize(source:typeof SOURCES[number],payload:any){
 if(!payload||!Array.isArray(payload.jobs))throw Error('来源返回格式异常');
 return payload.jobs.map((j:any)=>{const ash=source.type==='ashby';const locations=ash?[j.location,...(j.secondaryLocations||[]).map((x:any)=>x.location)].filter(Boolean).join(' / '):(j.location?.name||'');const country=ash?j.address?.postalAddress?.addressCountry:'';const url=ash?(j.applyUrl||j.jobUrl):j.absolute_url;
 if(!j.id||!j.title||!url||!/^https:\/\//.test(url))throw Error('岗位数据不完整');
 return {id:source.id+':'+j.id,source:source.id,company:source.name,title:j.title,location:locations,url,description:plain(ash?(j.descriptionPlain||j.descriptionHtml||''):(j.content||'')),role:classify(j.title),kind:/\bintern(ship)?\b|co-op/i.test(j.title+' '+(j.employmentType||''))?'实习':'正式 / 其他',us:isUS(locations,country)};}).filter((j:any)=>j.us);
}
