import { test } from 'node:test';
import assert from 'node:assert/strict';
import { level, visa, signals, LEVELS, VISAS, VISA_BLOCKED, LEVEL_FILTERS, VISA_FILTERS } from '../lib/job-signals.ts';
import { classify, normalize, SOURCES } from '../lib/sources.ts';
import { detailUrl, detailText, siteOf } from '../lib/connectors.ts';
// 用例里的句子都取自库里真实岗位描述，改规则时它们是回归底线
const v=(text)=>visa(text).visa;

test('level from title',()=>{
 const cases={
  'Senior Software Engineer':'资深及以上','Sr. Staff Engineer, Applied AI':'资深及以上','Staff Data Scientist':'资深及以上',
  'Engineering Manager II - Platform Firmware':'资深及以上','Associate Director, Marketing Oncology':'资深及以上','Data Scientist IV':'资深及以上',
  'Software Engineer I - Elixir, Python, AWS':'应届 / 入门','New Graduate Engineer, Software (Starlink)':'应届 / 入门','Associate Product Manager':'应届 / 入门',
  'Technology Leadership Program - Risk & Security (Analyst)':'应届 / 入门','Engineer I, Engineer II, Engineer III Grid Operations':'应届 / 入门',
  'Software Development Engineer II, AWS SageMaker':'中级','Software Engineer III, Mobile (iOS)':'中级','Structural Engineer 2 / 3':'中级','DevOps Engineer, Mid':'中级',
  // 通用头衔不是职级：Member of Technical Staff、Product Manager 都没写级别
  'Member of Technical Staff':'未注明','Senior Member of Technical Staff':'资深及以上','Product Manager':'未注明','Staff Accountant':'未注明',
  // 罗马数字只认职位名后面单独的 I，不认 iOS、5G 里的字母数字
  'Software Engineer - iOS':'未注明','Systems Engineer 5G':'未注明','Internal Audit Analyst':'未注明',
  'Software Engineer Intern':'实习','Summer 2027 Co-op, Firmware':'实习',
 };
 for(const [title,expected] of Object.entries(cases))assert.equal(level(title),expected,title);
 assert.equal(level('Software Engineer',true),'实习');   // 来源本身标了实习
 for(const f of LEVEL_FILTERS.slice(2))assert.ok(LEVELS.includes(f),f+' 不是合法级别');
});

test('no sponsorship phrasings',()=>{
 for(const text of [
  'Please note that visa sponsorship is not available for this position.',
  'Must be authorized to work in the U.S. without the need for current or future employer sponsorship.',
  'Candidates must be authorized to work in the US without current or future employer-sponsored visa support.',
  'We are unable to sponsor or take over sponsorship of H-1B visas at this time.',
  'Please note we cannot currently sponsor or support visa transfers at this time.',
  'This position is generally not eligible for new visa sponsorship.',
  '**This position is not eligible for employment visa sponsorship.',
  'No immigration sponsorship or transfer available for this role.',
  'Veeva Systems does not anticipate providing sponsorship for employment visa status (e.g., H-1B, OPT) for this employment position.',
  'At this time we are no longer able to sponsor new H-1B visa petitions filed after September 21, 2025 for new hires.',
  'NOTE: Amazon does not sponsor for immigration, including for H-1B, TN, and other non-immigrant visas, for this role.',
  // 否定词和签证词隔着从句
  'The Company may not be able to employ candidates for this role who have United States work authorization related to certain U.S. visa categories, or support future H-1B sponsorship at this time.',
 ])assert.equal(v(text),'不提供担保',text);
});

test('sponsorship available phrasings',()=>{
 for(const text of [
  // 前半句正面、后半句保留：整体仍是提供担保
  "Visa sponsorship: We do sponsor visas! However, we aren't able to successfully sponsor visas for every role and every candidate.",
  'We do sponsor and take over sponsorship of employment visas for this role.',
  'This role is eligible for visa sponsorship.',
  'Zocdoc will consider sponsoring a new qualified applicant for employment authorization for this position.',
  'Docker considers visa sponsorship on a case-by-case basis based on business needs.',
  // 前半句里的 don't 不该把后面的正面表述判成否定
  "If you don't have work authorization, we offer visa sponsorship for qualified candidates.",
 ])assert.equal(v(text),'可提供担保',text);
});

test('citizenship and clearance requirements',()=>{
 for(const text of [
  'ITAR REQUIREMENTS: To conform to U.S. Government export regulations, applicant must be a (i) U.S. citizen or national, (ii) U.S. lawful, permanent resident (aka green card holder).',
  'This position requires that the candidate selected be a US Citizen.',
  'Position Restriction: This position is restricted to US citizens or lawful permanent residents.',
  'Logical access to the AWS GovCloud region will be restricted to Amazon employees who are U.S. Citizens.',
  'U.S. citizenship is required, due to program requirements.',
 ])assert.equal(v(text),'限公民 / 绿卡',text);
 for(const text of [
  'Must possess an active Top Secret/SCI Security Clearance.',
  'Active Top Secret, Top Secret SCI, or DOE Level Q clearance ADDITIONAL REQUIREMENTS: Must be willing to work extended hours',
  // 条目后面跟的大写标题属于下一段，不是这条的修饰
  "Ability to obtain and maintain US security clearance THESE QUALIFICATIONS WOULD BE NICE TO HAVE: Master's degree",
 ])assert.equal(v(text),'需安全许可',text);
 // 安全许可隐含公民身份要求，同时出现时按更严格的算
 assert.equal(v('This position requires that the candidate selected be a US Citizen and obtain and maintain an active TS/SCI security clearance with polygraph.'),'需安全许可');
});

test('things that are not restrictions',()=>{
 for(const text of [
  'An active or recently active U.S. government security clearance (not required, but a plus for future-facing work).',
  'Ability to obtain a S//SAR level security clearance desired.',
  'Nice to Have Security Clearance: An active Secret or TS/SCI clearance is a nice to have for this role.',
  'Preferred Qualifications: - Experience with Kubernetes - Active Secret clearance',
  'Equal Opportunity Employment, Employee Polygraph Protection Act',
  'Docker does not sponsor personnel security clearances.',
  'This role does not require U.S. citizenship.',
  'Serve as the product sponsor for our most important brands; project sponsors and leadership.',
  'Finally, a company sponsored 401(k) retirement plan.',
  'Familiarity with card network protocols, BIN sponsorship models (Visa, Mastercard, or equivalent).',
  'Visa sponsorship may not be available in certain remote locations.',
  'Applicants must be currently authorized to work in the United States on a full-time basis.',
 ])assert.equal(v(text),'未提及',text);
 assert.deepEqual(visa('   '),{visa:null,note:null});
});

test('verdicts carry the sentence they came from',()=>{
 const r=visa('Great benefits and a friendly team. Please note that visa sponsorship is not available for this position. Apply today!');
 assert.equal(r.visa,'不提供担保');
 assert.match(r.note,/visa sponsorship is not available/);
 assert.ok(!r.note.startsWith('Great'),'依据应从命中所在句开始');
 assert.equal(visa('Build distributed systems in Go.').note,null);
 for(const f of VISA_FILTERS.slice(2,-1))assert.ok(VISAS.includes(f),f+' 不是合法签证类别');
 for(const b of VISA_BLOCKED)assert.ok(VISAS.includes(b));
});

test('signals ride along with every collected job',()=>{
 assert.deepEqual(signals('Software Engineer Intern','实习',''),{level:'实习',visa:null,visaNote:null});
 const gh=SOURCES.find(s=>s.type==='greenhouse');
 const [j]=normalize(gh,{jobs:[{id:9,title:'Senior Backend Engineer',location:{name:'Seattle, WA'},absolute_url:'https://example.org/9',content:'&lt;p&gt;We are unable to sponsor visas for this role.&lt;/p&gt;'}]});
 assert.equal(j.level,'资深及以上');assert.equal(j.visa,'不提供担保');assert.match(j.visaNote,/unable to sponsor/);
 // 不带 engineer 字样的技术头衔也归到软件工程
 for(const t of ['Member of Technical Staff','Senior Programmer Analyst','DevOps Specialist','Solutions Architect'])assert.equal(classify(t),'软件工程',t);
});

test('detail endpoints per platform',()=>{
 const wd=SOURCES.find(s=>s.type==='workday'),sr=SOURCES.find(s=>s.type==='smartrecruiters'),gh=SOURCES.find(s=>s.type==='greenhouse'),ms=SOURCES.find(s=>s.id==='microsoft');
 const path='/job/Palo-Alto-HQ/Sr-Software-Engineer_2026045';
 assert.equal(detailUrl(wd,{id:wd.id+':2026045',url:`https://${wd.host}/en-US/${wd.board}${path}`}),`https://${wd.host}/wday/cxs/${wd.tenant}/${wd.board}${path}`);
 assert.equal(detailUrl(wd,{id:wd.id+':1',url:'https://elsewhere.example/job/x'}),'',  '链接不是本租户的就不猜');
 assert.equal(detailUrl(sr,{id:sr.id+':744000',url:''}),`https://api.smartrecruiters.com/v1/companies/${sr.board||sr.id}/postings/744000`);
 assert.equal(detailUrl(gh,{id:gh.id+':123',url:''}),`https://boards-api.greenhouse.io/v1/boards/${gh.board||gh.id}/jobs/123`);
 assert.match(detailUrl(ms,{id:'microsoft:1970393557002603',url:''}),/position_details\?position_id=1970393557002603&/);
 assert.equal(detailText(wd,{jobPostingInfo:{jobDescription:'<p>Hi</p>'}}),'<p>Hi</p>');
 assert.equal(detailText(ms,{data:{jobDescription:'MS'}}),'MS');
 assert.equal(detailText(sr,{jobAd:{sections:{jobDescription:{text:'A'},qualifications:{text:''},additionalInformation:{text:'No visa sponsorship.'}}}}),'A\nNo visa sponsorship.');
 assert.equal(detailText(gh,{content:null}),'');
 // 限流按站点群冷却：同一 Workday 集群的不同租户共用一份配额
 assert.equal(siteOf('https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/x/jobs'),'wd5.myworkdayjobs.com');
 assert.equal(siteOf('https://cisco.wd5.myworkdayjobs.com/en-US/y/job/z'),siteOf('https://hp.wd5.myworkdayjobs.com/a'));
 assert.equal(siteOf('https://apply.careers.microsoft.com/api/pcsx/search'),'apply.careers.microsoft.com');
});
