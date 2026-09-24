// 从标题判断级别、从岗位描述判断签证限制。纯规则匹配，写库时算一次，筛选直接查字段。
// 规则按库里真实岗位文本校准。原则是宁可漏判也不误伤：被错判成「资深」或「受限」的岗位会被筛掉、根本看不到，
// 漏判只是多看一条。所以拿不准的一律归「未注明 / 未提及」。

export const LEVELS=['实习','应届 / 入门','中级','资深及以上','未注明'] as const;
export const VISAS=['需安全许可','限公民 / 绿卡','不提供担保','可提供担保','未提及'] as const;
/** 这三类对需要工作签证的申请人基本等于不可申请，「排除签证受限」按这里过滤。 */
export const VISA_BLOCKED=['需安全许可','限公民 / 绿卡','不提供担保'];
// 筛选项：实习已有「岗位类型」可选，这里不重复列；「暂无描述」对应 visa 为空（列表接口不带描述、也还没补拉到的岗位）
export const LEVEL_FILTERS=['全部级别','排除资深','应届 / 入门','中级','资深及以上','未注明'];
export const VISA_FILTERS=['全部签证情况','排除签证受限','可提供担保','未提及','不提供担保','限公民 / 绿卡','需安全许可','暂无描述'];

const INTERN=/\bintern(ship)?s?\b|\bco-?op\b/i;
// manager 单列：产品 / 项目经理在匹配前已被换成 PM，剩下的 manager 基本是带人的管理岗
const SENIOR=/\b(senior|sr|snr|principal|staff|lead|director|head of|[sae]?vp|vice president|chief|distinguished|manager)\b/i;
// 职位名紧跟的级别数字：I 是入门；II、III 算中级（Google 的 SWE III 就是中级，往宽了给）；IV 以上资深
const NUMBERED=/\b(?:engineer|developer|scientist|analyst|designer|sde|swe|specialist|consultant|researcher|programmer|manager|pm|mts|associate|administrator|technologist)\s*,?\s*(?:level\s*)?(iv|vi|v|iii|ii|i|[1-6])\b/i;
const ENTRY=/new grad|recent grad|university grad|college grad|early[- ]career|early talent|entry[- ]level|\bjunior\b|\bjr\b|\bassociate\b|\bapprentice|\bresidency\b|\bgraduate\b|\bfellowship\b|\b(leadership|development|rotational) program|\b20\d\d start\b/i;
const MID=/mid[- ]level|\bmid[- ]career\b|\bintermediate\b|,\s*mid\s*$/i;

export function level(title:string,intern=false):typeof LEVELS[number]{
 if(intern||INTERN.test(title))return '实习';
 // 「Member of Technical Staff」是通用头衔，不是 Staff 职级；Associate Product Manager 是应届岗，不能被 manager 判成资深
 const t=title.replace(/member of (the )?technical staff/gi,' MTS ').replace(/\b(product|program|project)\s+manager\b/gi,' PM ').replace(/\bstaff\s+accountant\b/gi,' accountant ');
 if(SENIOR.test(t))return '资深及以上';
 const n=t.match(NUMBERED)?.[1]?.toLowerCase();
 if(n)return n==='i'||n==='1'?'应届 / 入门':['ii','iii','2','3'].includes(n)?'中级':'资深及以上';
 if(ENTRY.test(t))return '应届 / 入门';
 if(MID.test(t))return '中级';
 return '未注明';
}

const US=String.raw`(?:us|usa|united states)`;
const NEG=String.raw`(?:unable|not able|cannot|can ?not|can't|won't|will not|do not|does not|don't|doesn't|are not|aren't|is not|isn't|no longer|not)`;
const VISA_WORD=String.raw`(?:visa |employment |immigration |h-?1b |work |employer[- ]?)`;
// 安全许可常写成加分项（nice to have / desired / not required, but a plus），只有硬性要求才算
const CLEARANCE=/\b(?:security clearance|clearance (?:is )?required|ts ?\/ ?sci|top secret|(?:secret|dod|doe|government|federal|public trust|q|sci)[- ](?:level )?clearance|polygraph(?! protection))\b/gi;
const PREFERENCE=/\b(nice[- ]to[- ]have|a plus|preferred|desired|desirable|not required|bonus|advantageous|helpful|ideal(ly)?|beneficial|optional)\b/i;
// 往后只认紧跟的小写修饰（clearance desired / is a plus）；大写的 "NICE TO HAVE:"、"Preferred Qualifications" 是下一段的标题，不修饰前面这条
const TRAILING_PREFERENCE=new RegExp(PREFERENCE.source);
const CITIZEN=[
 new RegExp(String.raw`\b(?:be|are) (?:an? )?(?:\(i\) ?)?${US} (?:citizens?|persons?|nationals?)\b`,'gi'),
 new RegExp(String.raw`\b(?:requires?|required|requirement|restricted to|limited to|open (?:only )?to|only (?:open|available) to)\b[^.;]{0,50}?\b${US} (?:citizens?|citizenship|persons?|nationals?)\b`,'gi'),
 new RegExp(String.raw`\b${US} (?:citizenship|person status)(?: is)? (?:required|mandatory|a requirement)\b`,'gi'),
 new RegExp(String.raw`\b${US} citizens? only\b|\b${US} person status\b|\bitar requirements?:|\bcomply with itar\b|\bconform to ${US} government export regulations\b`,'gi'),
];
const NO_SPONSOR=[
 new RegExp(String.raw`\b${NEG} (?:currently |presently |at this time )?(?:anticipate |expect to |plan to )?(?:able )?(?:to )?(?:(?:offer|provid|support|consider|pursu)(?:e|es|ing)? )?(?:any )?(?:new )?${VISA_WORD}{0,2}sponsor(?!(?:s|ing|ship)? (?:personnel |security |government )*clearances?)`,'gi'),
 new RegExp(String.raw`\bnot (?:be )?eligible for (?:any )?(?:new )?${VISA_WORD}{0,2}sponsorship`,'gi'),
 new RegExp(String.raw`\b${VISA_WORD}{0,2}sponsorship (?:is |will )?(?:not|n't) (?:be )?(?:currently )?(?:available|provided|offered|supported|possible|an option)`,'gi'),
 new RegExp(String.raw`\bno ${VISA_WORD}{0,2}sponsorship\b`,'gi'),
 new RegExp(String.raw`\bnot (?:now or in the future |currently or in the future )?require (?:any )?${VISA_WORD}{0,2}sponsorship`,'gi'),
 new RegExp(String.raw`\bwithout (?:the )?(?:need (?:for|of) |requiring |requirement (?:for|of) |needing )?(?:(?:current|present|now) (?:or|and|/) (?:future|in the future) )?(?:new )?${VISA_WORD}*sponsor`,'gi'),
 /\b(?:unable|not able|cannot|can't|will not|won't|do not|does not) (?:to )?(?:support|accept|consider) (?:h-?1b |visa )transfers?\b/gi,
 /\bpermanently authorized to work\b/gi,
];
// 否定词与签证词隔着从句，如 "may not be able to employ candidates who have ... US visa categories, or support future H-1B sponsorship"。
// 跨度大、误伤风险也大（"If you don't have work authorization, we offer visa sponsorship"），所以排在明确的正面表述之后才判
const NO_SPONSOR_LOOSE=[
 /\b(?:unable|not (?:be )?able|cannot|can't|will not|won't|do not|does not|don't|doesn't|are not|aren't|may not|might not)\b[^.?!]{0,160}?\b(?:visa|h-?1b|f-?1|opt|immigration)\b[^.?!]{0,15}\bsponsor/gi,
];
const SPONSOR=[
 new RegExp(String.raw`\b(?:we|we're|we are) (?:do |will |can |are able to |able to |happy to |are happy to |are open to |may |also )?(?:consider )?(?:offer |provide )?(?:visa )?sponsor(?:ing|ship)?\b[^.?!]{0,60}?\b(?:visas?|h-?1b|immigration|employment authorization|work authorization|green cards?)\b`,'gi'),
 /\b(?:visa|h-?1b|immigration) sponsorship (?:is |will be |may be )?(?:available|provided|offered|possible|supported)\b/gi,
 /\b(?:will|would|willing to|open to) consider sponsoring\b|\b(?:willing|open|happy) to sponsor\b/gi,
 /\beligible for (?:visa |h-?1b |immigration )sponsorship\b/gi,
 /\bconsiders? (?:visa |h-?1b |immigration )sponsorship\b/gi,
 /\b(?:we|we're|we are) (?:do |will |can |also |gladly |happily )?(?:offer|provide|support)s? (?:visa|h-?1b|immigration|employment visa) sponsorship\b/gi,
];
/** 匹配前一小段有否定词就不算，避免 "does not require U.S. citizenship" 被判成限公民。 */
function negated(t:string,at:number,span=30){return /\b(not|no|without|never)\b|n't\b/i.test(t.slice(Math.max(0,at-span),at))}
/** span 为 0 表示不做否定检查（规则本身已含否定词）。 */
function firstHit(t:string,patterns:RegExp[],span:number){
 for(const p of patterns)for(const m of t.matchAll(p))if(!(span&&negated(t,m.index!,span)))return m;
 return null;
}
function clearanceHit(t:string){
 for(const m of t.matchAll(CLEARANCE)){
  const at=m.index!,end=at+m[0].length;
  // 往前看到上一句为止（最多 300 字，覆盖 "Preferred Qualifications:" 这类标题下的条目），往后只看本句 30 字
  const back=t.slice(Math.max(0,at-300),at),cut=back.lastIndexOf('. ');
  const before=cut>=0?back.slice(cut+2):back,after=t.slice(end,end+30).split('.')[0];
  if(PREFERENCE.test(before)||TRAILING_PREFERENCE.test(after)||negated(t,at))continue;
  return m;
 }
 return null;
}
/** 取命中处前后一小段原文，界面上直接给出判断依据，方便核对规则有没有看错。 */
function excerpt(t:string,m:RegExpMatchArray){const at=m.index!,dot=t.lastIndexOf('. ',at);const s=Math.max(dot>=0?dot+2:0,at-90),e=Math.min(t.length,at+m[0].length+90);return (s>0?'…':'')+t.slice(s,e).trim()+(e<t.length?'…':'')}

export function visa(description:string):{visa:typeof VISAS[number]|null;note:string|null}{
 if(!description.trim())return {visa:null,note:null};
 // 先把 U.S. 统一成 US：既简化正则，也避免缩写里的句点被当成句子边界
 const t=description.replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/\bu\.\s?s\.(?:\s?a\.)?|\bu\.\s?s\b/gi,'US');
 const checks:[typeof VISAS[number],()=>RegExpMatchArray|null][]=[
  ['需安全许可',()=>clearanceHit(t)],
  ['限公民 / 绿卡',()=>firstHit(t,CITIZEN,30)],
  ['不提供担保',()=>firstHit(t,NO_SPONSOR,0)],
  // 正面表述只看紧挨着的否定（"not eligible for"、"not willing to"）：前半句的 "If you don't have work authorization, we offer visa sponsorship" 不该拦下
  ['可提供担保',()=>firstHit(t,SPONSOR,12)],
  ['不提供担保',()=>firstHit(t,NO_SPONSOR_LOOSE,0)],
 ];
 for(const [label,check] of checks){const m=check();if(m)return {visa:label,note:excerpt(t,m).slice(0,240)}}
 return {visa:'未提及',note:null};
}
/** 写库用的三个字段，收录岗位时与 role、kind 一起算。 */
export function signals(title:string,kind:string,description:string){const v=visa(description);return {level:level(title,kind==='实习'),visa:v.visa,visaNote:v.note}}
