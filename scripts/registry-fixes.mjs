// 注册表人工修正：自动发现（make-registry.mjs，按公司名猜招聘板地址）会漏掉或连错的来源，
// 以及它不认识的招聘系统（Oracle 招聘云、Eightfold、Jibe、SuccessFactors、Avature 与几家自建站）上的公司。
// make-registry.mjs 生成注册表时会套用这里的修正；单独运行本脚本则联网核实后直接修正现有注册表：
//   node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/registry-fixes.mjs
// 每一条都在 2026-09 逐个核实过：招聘板上的公司名、岗位、美国筛选方式，以及 robots.txt 是否允许请求实际要调的接口。
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { majorKeys } from './major-companies.mjs';
import { workdayEntry } from './workday-facets.mjs';
import { checkRobots } from './robots.mjs';
const key=n=>n.toLowerCase().replace(/[^a-z0-9]/g,'');
const PLATFORM_URL={greenhouse:b=>`https://boards.greenhouse.io/${b}`,ashby:b=>`https://jobs.ashbyhq.com/${encodeURIComponent(b)}`,lever:b=>`https://jobs.lever.co/${b}`,smartrecruiters:b=>`https://jobs.smartrecruiters.com/${b}`,rippling:b=>`https://ats.rippling.com/${b}/jobs`};
const SCOPE={smartrecruiters:'美国岗位（按来源国家字段识别）',rippling:'美国岗位（按地点国家代码识别）'};

/** 招聘板地址（slug）与公司名对不上、自动发现漏掉的公司。 */
export const PLATFORM_ADD=[
 {id:'anduril',name:'Anduril',type:'greenhouse',board:'andurilindustries'},
 {id:'doordash',name:'DoorDash',type:'greenhouse',board:'doordashusa'},
 {id:'everpure-pure-storage',name:'Everpure (Pure Storage)',type:'greenhouse',board:'purestorage'},// 招聘板上的公司名已是 Everpure
 {id:'sentinelone',name:'SentinelOne',type:'greenhouse',board:'sentinellabs'},
 {id:'imc-trading',name:'IMC Trading',type:'greenhouse',board:'imc'},
 {id:'digitalocean',name:'DigitalOcean',type:'greenhouse',board:'digitalocean98'},
 {id:'wiz',name:'Wiz',type:'greenhouse',board:'wizinc'},
 {id:'box',name:'Box',type:'greenhouse',board:'boxinc'},
 {id:'hudson-river-trading',name:'Hudson River Trading',type:'greenhouse',board:'wehrtyou'},
 {id:'hubspot',name:'HubSpot',type:'greenhouse',board:'hubspotjobs'},// hubspot 这块板是空的
 {id:'compass',name:'Compass',type:'greenhouse',board:'urbancompass',usFiltered:true,scope:'美国岗位（整块招聘板都在美国）'},// 地点常写成裸城市名
 {id:'optiver',name:'Optiver',type:'greenhouse',board:'optiverus'},// optiver 这块板是空的
 {id:'sony-interactive-entertainment',name:'Sony Interactive Entertainment',type:'greenhouse',board:'sonyinteractiveentertainmentglobal'},
 {id:'superhuman-grammarly',name:'Superhuman (Grammarly)',type:'ashby',board:'Superhuman Platform Inc'},// Grammarly 已改名 Superhuman
 {id:'kayak',name:'KAYAK',type:'ashby',board:'KAYAK'},
 {id:'opentable',name:'OpenTable',type:'greenhouse',board:'opentable'},
 {id:'nbcuniversal',name:'NBCUniversal',type:'smartrecruiters',board:'NBCUniversal3'},
 {id:'intuitive-surgical',name:'Intuitive Surgical',type:'smartrecruiters',board:'intuitive'},// Workday 上的 intuitive 租户是另一家公司
 {id:'rippling',name:'Rippling',type:'rippling',board:'rippling'},
 {id:'opendoor',name:'Opendoor',type:'rippling',board:'opendoor'},
];
/** 换了招聘平台的公司：旧招聘板已 404，改连新平台上的招聘板（官网招聘页链接到的那一个）。 */
export const MOVED={
 amplitude:{type:'ashby',board:'amplitude'},
 'shield-ai':{type:'lever',board:'shieldai'},
};
// Starbucks 两万个岗位里一万九千多个是门店岗位，只取门店以外的职位类别
const STARBUCKS_CATEGORIES=['retail leadership','technology','manufacturing and distribution','marketing and brand management','finance and accounting','supply chain management','business strategy','human resources','store development and design','culinary and bakery/baking','retail operations','research and development','legal and asset protection','public relations and communications'];
// Lockheed Martin 美国五千多个岗位，去掉生产制造（焊工、机械师）与安保岗位，跟 Workday 大租户只收技术相关职能一致
const LOCKHEED_AREAS=['ent engineering executive staff','general management','finance & business operations','enterprise bus & digital trans','global business dev & strategy','technology & strategic innovation','communications'];
/**
 * 公司自建或企业级招聘系统上的公司。注册时联网探测：Workday 的美国筛选项、Oracle 实例里 United States 地点的编号，
 * 并确认 robots.txt 允许请求实际要调的接口，同时读出它要求的抓取间隔。
 * 猜不中的地址：Eli Lilly 在 wd115、Vertex 在 wd501，Snap 与 Microchip 在共享域名 myworkdaysite.com 上；
 * Zoom、Palo Alto Networks、Chewy、Snyk、Home Depot 的 robots.txt 禁止抓取招聘板网页，但没有限制 /wday/cxs/ 数据接口。
 */
export const COMPANY_ADD=[
 {id:'comcast',name:'Comcast',type:'workday',host:'comcast.wd115.myworkdayjobs.com',tenant:'comcast',board:'Comcast_Careers'},
 {id:'sony',name:'Sony',type:'workday',host:'sonyglobal.wd1.myworkdayjobs.com',tenant:'sonyglobal',board:'SonyGlobalCareers'},
 {id:'sony-pictures-entertainment',name:'Sony Pictures Entertainment',type:'workday',host:'spe.wd1.myworkdayjobs.com',tenant:'spe',board:'SonyPicturesEntertainment'},
 {id:'unity',name:'Unity',type:'workday',host:'unitytech.wd1.myworkdayjobs.com',tenant:'unitytech',board:'Unity'},
 {id:'snap',name:'Snap',type:'workday',host:'wd1.myworkdaysite.com',tenant:'snapchat',board:'snap'},
 {id:'rocket-companies-redfin',name:'Rocket Companies (Redfin)',type:'workday',host:'quickenloans.wd5.myworkdayjobs.com',tenant:'quickenloans',board:'rocket_careers'},// 2025 年收购 Redfin
 {id:'gdit',name:'General Dynamics IT (GDIT)',type:'workday',host:'gdit.wd5.myworkdayjobs.com',tenant:'gdit',board:'External_Career_Site'},
 {id:'merck',name:'Merck',type:'workday',host:'msd.wd5.myworkdayjobs.com',tenant:'msd',board:'SearchJobs'},
 {id:'moderna',name:'Moderna',type:'workday',host:'modernatx.wd1.myworkdayjobs.com',tenant:'modernatx',board:'M_tx'},
 {id:'eli-lilly',name:'Eli Lilly',type:'workday',host:'lilly.wd115.myworkdayjobs.com',tenant:'lilly',board:'LLY'},
 {id:'vertex-pharmaceuticals',name:'Vertex Pharmaceuticals',type:'workday',host:'vrtx.wd501.myworkdayjobs.com',tenant:'vrtx',board:'vertex_careers'},// 注册表里的 Vertex Inc 是报税软件公司
 {id:'stryker',name:'Stryker',type:'workday',host:'stryker.wd1.myworkdayjobs.com',tenant:'stryker',board:'StrykerCareers'},
 {id:'thermo-fisher-scientific',name:'Thermo Fisher Scientific',type:'workday',host:'thermofisher.wd5.myworkdayjobs.com',tenant:'thermofisher',board:'ThermoFisherCareers'},
 {id:'nxp-semiconductors',name:'NXP Semiconductors',type:'workday',host:'nxp.wd3.myworkdayjobs.com',tenant:'nxp',board:'careers'},
 {id:'microchip-technology',name:'Microchip Technology',type:'workday',host:'wd5.myworkdaysite.com',tenant:'microchiphr',board:'External'},
 {id:'zoom',name:'Zoom',type:'workday',host:'zoom.wd5.myworkdayjobs.com',tenant:'zoom',board:'Zoom'},
 {id:'palo-alto-networks',name:'Palo Alto Networks',type:'workday',host:'paloaltonetworks.wd5.myworkdayjobs.com',tenant:'paloaltonetworks',board:'panwexternalcareers'},
 {id:'chewy',name:'Chewy',type:'workday',host:'chewy.wd5.myworkdayjobs.com',tenant:'chewy',board:'External'},// 原先连的是兽医临时合同工站点
 {id:'snyk',name:'Snyk',type:'workday',host:'snyk.wd103.myworkdayjobs.com',tenant:'snyk',board:'External'},
 {id:'home-depot',name:'Home Depot',type:'workday',host:'homedepot.wd5.myworkdayjobs.com',tenant:'homedepot',board:'CareerDepot'},
 {id:'coca-cola',name:'Coca-Cola',type:'workday',host:'coke.wd1.myworkdayjobs.com',tenant:'coke',board:'coca-cola-careers'},
 // 这两家的站点防火墙按频率封 IP：列表翻页加并发补详情，四十多秒就被整站 403，要按间隔慢慢请求
 {id:'lockheed-martin',name:'Lockheed Martin',type:'eightfold',host:'lockheedmartin.eightfold.ai',domain:'lockheedmartin.com',params:{filter_career_area:LOCKHEED_AREAS},scope:'美国 · 工程、项目管理、财务与数据、IT、战略与技术创新（不含生产制造与安保）',delay:1000},
 {id:'boston-scientific',name:'Boston Scientific',type:'eightfold',host:'bostonscientific.eightfold.ai',domain:'bostonscientific.com',delay:1000},
 {id:'qualcomm',name:'Qualcomm',type:'eightfold',host:'careers.qualcomm.com',domain:'qualcomm.com',delay:3000},// 限流严：1.5 秒间隔仍会 429
 {id:'lam-research',name:'Lam Research',type:'eightfold',host:'careers.lamresearch.com',domain:'lamresearch.com'},
 {id:'netapp',name:'NetApp',type:'eightfold',api:'v2',host:'netapp.eightfold.ai',domain:'netapp.com'},// 没开通 pcsx 接口
 {id:'starbucks',name:'Starbucks',type:'eightfold',host:'starbucks.eightfold.ai',domain:'starbucks.com',params:{filter_job_category:STARBUCKS_CATEGORIES},scope:'美国 · 门店以外的职位（总部、技术、供应链、市场等）'},
 {id:'oracle',name:'Oracle',type:'oracle',host:'eeho.fa.us2.oraclecloud.com',site:'CX_45001',careerUrl:'https://careers.oracle.com/'},
 {id:'dell-technologies',name:'Dell Technologies',type:'oracle',host:'enterpriseplatform.dell.com',site:'CX_1001',careerUrl:'https://jobs.dell.com/'},
 {id:'texas-instruments',name:'Texas Instruments',type:'oracle',host:'edbz.fa.us2.oraclecloud.com',site:'CX',careerUrl:'https://careers.ti.com/'},
 {id:'onsemi',name:'onsemi',type:'oracle',host:'hctz.fa.us2.oraclecloud.com',site:'CX_1001',careerUrl:'https://www.onsemi.com/careers'},
 {id:'akamai',name:'Akamai',type:'oracle',host:'fa-extu-saasfaprod1.fa.ocs.oraclecloud.com',site:'CX_1',jobUrl:'https://jobs.akamai.com/en/sites/CX_1/job/{id}',careerUrl:'https://jobs.akamai.com/en/sites/CX_1'},// 品牌域名不转发接口，用源站
 {id:'fortinet',name:'Fortinet',type:'oracle',host:'edel.fa.us2.oraclecloud.com',site:'CX_2001',careerUrl:'https://www.fortinet.com/corporate/careers'},
 {id:'honeywell',name:'Honeywell',type:'oracle',host:'ibqbjb.fa.ocs.oraclecloud.com',site:'CX_1',jobUrl:'https://careers.honeywell.com/en/sites/Honeywell/job/{id}',careerUrl:'https://careers.honeywell.com/'},
 {id:'ford',name:'Ford',type:'oracle',host:'efds.fa.em5.oraclecloud.com',site:'CX_1',careerUrl:'https://www.careers.ford.com/'},// apply.ford.com 的证书链不完整，用源站
 {id:'american-express',name:'American Express',type:'oracle',host:'egug.fa.us2.oraclecloud.com',site:'CX_1',jobUrl:'https://careers.americanexpress.com/en/sites/CX_1/job/{id}',careerUrl:'https://careers.americanexpress.com/'},
 {id:'jpmorgan-chase',name:'JPMorgan Chase',type:'oracle',host:'jpmc.fa.oraclecloud.com',site:'CX_1001',careerUrl:'https://careers.jpmorgan.com/'},
 {id:'goldman-sachs',name:'Goldman Sachs',type:'oracle',host:'hdpc.fa.us2.oraclecloud.com',site:'LateralHiring',jobUrl:'https://higher.gs.com/roles/{id}',careerUrl:'https://higher.gs.com/'},// 社招与校招在同一个站点
 {id:'amd',name:'AMD',type:'jibe',host:'careers.amd.com'},
 {id:'rivian',name:'Rivian',type:'jibe',host:'careers.rivian.com'},
 {id:'docusign',name:'DocuSign',type:'jibe',host:'careers.docusign.com'},
 {id:'pepsico',name:'PepsiCo',type:'jibe',host:'www.pepsicojobs.com',board:'main',params:{country:['United States|USA']}},// 美国岗位分在两种国家写法下
 {id:'sap',name:'SAP',type:'successfactors',list:'https://careers.sap.com/search/?q=&optionsFacetsDD_country=US&sortColumn=referencedate&sortDirection=desc&startrow={offset}',usFiltered:true,careerUrl:'https://careers.sap.com/'},// jobs.sap.com 挂着 Cloudflare 人机验证
 {id:'mcdonalds',name:"McDonald's",type:'successfactors',list:'https://jobs.mcdonalds.com/search/?q=&optionsFacetsDD_country=US&sortColumn=referencedate&sortDirection=desc&startrow={offset}',usFiltered:true,careerUrl:'https://jobs.mcdonalds.com/',scope:'美国 · 公司总部与区域办公室（餐厅岗位在另一个系统）'},
 {id:'paramount',name:'Paramount',type:'successfactors',list:'https://careers.paramount.com/search/?q=&optionsFacetsDD_country=US&sortColumn=referencedate&sortDirection=desc&startrow={offset}',usFiltered:true,careerUrl:'https://careers.paramount.com/'},
 {id:'gulfstream',name:'Gulfstream (General Dynamics)',type:'successfactors',list:'https://careers.gulfstream.com/search/?q=&optionsFacetsDD_country=US&sortColumn=referencedate&sortDirection=desc&startrow={offset}',usFiltered:true,careerUrl:'https://careers.gulfstream.com/'},
 {id:'nassco',name:'NASSCO (General Dynamics)',type:'successfactors',list:'https://jobs.nassco.com/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow={offset}',careerUrl:'https://jobs.nassco.com/'},
 {id:'bloomberg-lp',name:'Bloomberg',type:'avature',list:'https://bloomberg.avature.net/careers/SearchJobs/?jobOffset={offset}',careerUrl:'https://bloomberg.avature.net/careers'},// careers.bloomberg.com 会拦截程序访问
 {id:'electronic-arts',name:'Electronic Arts',type:'avature',list:'https://jobs.ea.com/en_US/careers/SearchJobs/?search=United+States&jobOffset={offset}',careerUrl:'https://jobs.ea.com/en_US/careers'},
 {id:'two-sigma',name:'Two Sigma',type:'avature',list:'https://careers.twosigma.com/careers/OpenRoles/?jobOffset={offset}',careerUrl:'https://careers.twosigma.com/careers'},
 {id:'deloitte',name:'Deloitte',type:'avature',list:'https://apply.deloitte.com/en_US/careers/SearchJobs/?jobOffset={offset}',usFiltered:true,careerUrl:'https://apply.deloitte.com/en_US/careers',scope:'美国岗位（Deloitte US 招聘站）'},
 {id:'ibm',name:'IBM',type:'ibm',careerUrl:'https://www.ibm.com/careers/search'},
 {id:'atlassian',name:'Atlassian',type:'atlassian',careerUrl:'https://www.atlassian.com/company/careers/all-jobs',via:'node'},// 和 Apple 一样拒绝 Workers 运行时发出的请求，Node 请求正常
 {id:'mckinsey',name:'McKinsey & Company',type:'mckinsey',list:'https://gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search?lang=en&countries=United%20States',careerUrl:'https://www.mckinsey.com/careers/search-jobs'},
];
/** 连到了窄口径子站点（校招站、门店小时工站）的 Workday 来源，改连同一租户的主站点。 */
export const WORKDAY_BOARD={
 unilever:'Unilever_Experienced_Professionals',// 原为 Unilever_Early_Careers
 invesco:'IVZ',// 原为 IVZearlycareers
 meijer:'Meijer',// 原为 Meijer_Stores_Hourly（门店小时工）
};
/** 招聘板上的正式名称带后缀，或者根本是另一家公司。 */
export const RENAME={
 bloomberg:'Bloomberg Industry Group',// 这个 Workday 租户只有 Bloomberg Industry Group 一个站点；Bloomberg L.P. 见 bloomberg-lp
 'chime-financial-inc':'Chime','gusto-inc':'Gusto','rubrik-job-board':'Rubrik','marqeta-inc':'Marqeta',
 'coalition-inc':'Coalition','ginkgo-bioworks-inc':'Ginkgo Bioworks','rocket-lab-corporation':'Rocket Lab',
 'employment-opportunities-at-buzzfeed-inc':'BuzzFeed','billtrust-us-careers':'Billtrust',
};
/** 移出注册表的来源与原因。 */
export const DROP={
 uber:'SmartRecruiters 上的 uber 是测试账号，唯一的岗位叫 "Test UAT"；Uber 的招聘站挂着 Cloudflare 人机验证，无法接入',
 linkedin:'Lever 上的 linkedin 是测试账号（"BO Prim"、"Kritika Bug Bash Job 2"），LinkedIn 的真实岗位只在 linkedin.com 上',
 'iterable-inc':'Ashby 上的旧招聘板已下线（404），Iterable 的岗位都在 Greenhouse 的 iterable 板上，保留那一个',
 postman:'Greenhouse 招聘板自 2026-09-09 起 404，各平台都没找到新的公开招聘板；留着只会一直报错、旧岗位一直显示在招',
};
/** 名单里的写法与修正后的正式名称不同、按名称匹配不上的精选大厂（含名单里公司的子公司、改名后的公司）。 */
const MAJOR_IDS=new Set(['everpure-pure-storage','sony-interactive-entertainment','sony-pictures-entertainment','superhuman-grammarly','nbcuniversal','rocket-companies-redfin','gdit','vertex-pharmaceuticals','dell-technologies','onsemi','mckinsey','gulfstream','nassco']);

/** Oracle 实例里 United States 地点分面的编号：各实例不同，从不带筛选的一次查询的地点分面里取。 */
async function oracleUsLocation(host,site){
 const r=await fetch(`https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&finder=findReqs;siteNumber=${site},facetsList=LOCATIONS,limit=1,offset=0`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error(`${host} HTTP ${r.status}`);
 const us=((await r.json())?.items?.[0]?.locationsFacet||[]).find(x=>x.Name==='United States');
 if(!us)throw Error(`${host} 的地点分面里没有 United States`);
 return String(us.Id);
}
/** 各类来源注册时要请求的接口路径（用来核对 robots.txt）与要补的字段。 */
const PROBE={
 workday:async a=>workdayEntry(a),
 eightfold:async a=>({careerUrl:`https://${a.host}/careers`,delay:await checkRobots(a.host,a.api==='v2'?'/api/apply/v2/jobs':'/api/pcsx/search')}),
 oracle:async a=>({delay:await checkRobots(a.host,'/hcmRestApi/resources/latest/recruitingCEJobRequisitions'),usLocation:await oracleUsLocation(a.host,a.site),scope:'美国岗位（含次要地点在美国的岗位）'}),
 jibe:async a=>({careerUrl:`https://${a.host}/`,delay:await checkRobots(a.host,'/api/jobs')}),
 successfactors:async a=>{const u=new URL(a.list.replace('{offset}','0'));return {delay:await checkRobots(u.host,u.pathname)}},
 avature:async a=>{const u=new URL(a.list.replace('{offset}','0'));return {delay:await checkRobots(u.host,u.pathname)}},
 ibm:async()=>({delay:await checkRobots('www-api.ibm.com','/search/api/v2')}),
 atlassian:async()=>({delay:await checkRobots('www.atlassian.com','/endpoint/careers/listings')}),
 mckinsey:async a=>{const u=new URL(a.list);return {delay:await checkRobots(u.host,u.pathname)}},
 rippling:async a=>({delay:await checkRobots('ats.rippling.com',`/api/v2/board/${a.board}/jobs`)}),
};
async function build(a,group){
 const probed=PROBE[a.type]?await PROBE[a.type](a):{};
 const {total:_total,usTotal:_usTotal,delay,...extra}=probed;// 探测到的岗位数只用于决定筛选方式，不写进注册表
 const entry={...a,group,...extra,...(a.scope?{scope:a.scope}:{})};
 if(!entry.careerUrl)entry.careerUrl=PLATFORM_URL[a.type]?.(a.board);
 if(!entry.scope)entry.scope=SCOPE[a.type]||(entry.usFiltered||['ibm','atlassian','mckinsey','jibe','eightfold'].includes(a.type)?'美国岗位':'美国岗位（逐条识别美国地点）');
 if(delay)entry.delay=delay;
 return entry;
}

/**
 * 就地修正 company（公司自建与企业级招聘系统）与 platform（平台托管招聘板）两份注册表。
 * 会联网：Workday 与 Oracle 要探测筛选项，所有新来源都要核对 robots.txt。探测失败的来源跳过并在最后列出，不影响其余修正。
 */
export async function applyFixes(company,platform){
 const skipped=[];
 for(const list of [company,platform])for(let i=list.length-1;i>=0;i--)if(DROP[list[i].id])list.splice(i,1);
 for(const s of company){
  const board=WORKDAY_BOARD[s.id];if(!board||s.board===board)continue;
  const {total:_total,usTotal:_usTotal,...fixed}=await workdayEntry({host:s.host,tenant:s.tenant,board});
  Object.assign(s,fixed);
 }
 for(const s of platform){const m=MOVED[s.id];if(m)Object.assign(s,m,{careerUrl:PLATFORM_URL[m.type](m.board),scope:SCOPE[m.type]||'美国岗位（逐条识别美国地点）'})}
 for(const s of [...company,...platform])s.name=(RENAME[s.id]||s.name).trim();
 for(const [list,adds,group] of [[platform,PLATFORM_ADD,'platform'],[company,COMPANY_ADD,'company']]){
  for(const a of adds){
   const all=[...company,...platform];
   if(all.some(s=>s.id===a.id)){const i=list.findIndex(s=>s.id===a.id);if(i<0)continue;list.splice(i,1)}// 已在册的按这里的定义重建
   else if(all.some(s=>key(s.name)===key(a.name)||(s.type===a.type&&s.board&&s.board===a.board&&s.host===a.host)))continue;
   try{list.push(await build(a,group))}catch(e){skipped.push(`${a.name}：${e.message}`)}
  }
 }
 for(const s of [...company,...platform])s.tier=majorKeys.has(key(s.name))||MAJOR_IDS.has(s.id)?'major':'other';
 return skipped;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const company=read('lib/company-sources.json'),platform=read('lib/platform-sources.json');
 const before=[...company,...platform].length;
 const skipped=await applyFixes(company,platform);
 fs.writeFileSync('lib/company-sources.json',JSON.stringify(company,null,1));
 fs.writeFileSync('lib/platform-sources.json',JSON.stringify(platform,null,1));
 console.log(`注册表 ${before} → ${company.length+platform.length} 个来源；精选大厂 ${[...company,...platform].filter(s=>s.tier==='major').length} 家（另有 4 家单独实现）`);
 if(skipped.length)console.log('未能接入：\n '+skipped.join('\n '));
}
