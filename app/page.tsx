'use client';
import { useEffect,useState,useRef,useCallback,useMemo } from 'react';
import { Radar,RefreshCw,Search,Star,CheckCheck,ArrowUpRight,Briefcase,MapPin,Building2,Layers,ListChecks,X,FileText } from 'lucide-react';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { Sidebar,SidebarProvider } from '@/components/ui/sidebar';
import { Pagination,PaginationContent,PaginationItem } from '@/components/ui/pagination';
import { Empty,EmptyHeader,EmptyTitle,EmptyDescription } from '@/components/ui/empty';
import { useJobTools } from '@/lib/webmcp';
import { METROS,CITIES } from '@/lib/us-locations';
import { SCOPES,inScope,estimateTime } from '@/lib/update-scope';
import { LEVEL_FILTERS,VISA_FILTERS,VISA_BLOCKED } from '@/lib/job-signals';
// 「全部已归类职业」排除「其他」：来源里有不少零售、餐饮、医疗企业，门店岗位全落在「其他」里
const roles=['全部职业','全部已归类职业','软件工程','AI / 机器学习','数据分析','产品经理','设计','安全','市场 / 运营','其他'];
const SYSTEMS:Record<string,string>={workday:'Workday 企业招聘系统',greenhouse:'Greenhouse 招聘平台',ashby:'Ashby 招聘平台',lever:'Lever 招聘平台',smartrecruiters:'SmartRecruiters 招聘平台'};
const systemName=(s:any)=>SYSTEMS[s?.type]||'公司自建招聘系统';
const GROUPS=[{id:'all',name:'全部来源',icon:Layers},{id:'company',name:'公司自建招聘系统',icon:Building2},{id:'platform',name:'招聘平台托管职位',icon:Briefcase}];
function Picker({value,onChange,items,label}:any){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue>{items.find((x:any)=>typeof x==='string'?x===value:x.value===value)?.label||value}</SelectValue></SelectTrigger><SelectContent>{items.map((x:any)=><SelectItem key={x.value||x} value={x.value||x}>{x.label||x}</SelectItem>)}</SelectContent></Select>}
/** 可搜索的下拉选择，用于城市与公司这类上百项的列表。 */
function Finder({value,onChange,items,label,placeholder}:any){
 const [open,setOpen]=useState(false),[text,setText]=useState('');
 const current=items.find((x:any)=>x.value===value);
 const needle=text.trim().toLowerCase();
 const list=useMemo(()=>items.filter((x:any)=>!needle||(x.label+' '+(x.keywords||'')).toLowerCase().includes(needle)).slice(0,80),[items,needle]);
 return <div className="finder">
  <input aria-label={label} placeholder={current?current.label:placeholder} value={open?text:(current?.label||'')}
   onFocus={()=>{setOpen(true);setText('')}} onBlur={()=>setTimeout(()=>setOpen(false),160)} onChange={e=>setText(e.target.value)}/>
  {value&&<button type="button" aria-label={`清除${label}`} className="clear" onMouseDown={e=>{e.preventDefault();onChange('')}}><X size={14}/></button>}
  {open&&<ul role="listbox">{list.map((x:any)=><li key={x.value||'all'} role="option" aria-selected={x.value===value}
    onMouseDown={e=>{e.preventDefault();onChange(x.value);setOpen(false);(e.currentTarget as HTMLElement).blur()}}>{x.label}{x.count!==undefined&&<span>{x.count}</span>}</li>)}
   {!list.length&&<li className="none">没有匹配项</li>}</ul>}
 </div>;
}
export default function Home(){
 const [data,setData]=useState<any>({jobs:[],sources:[],total:0,stats:{},metroCounts:{},cityCounts:{}}),[role,setRole]=useState('全部职业'),[kind,setKind]=useState('全部类型'),[level,setLevel]=useState('全部级别'),[visa,setVisa]=useState('全部签证情况'),[view,setView]=useState('全部岗位'),[query,setQuery]=useState(''),[group,setGroup]=useState('all'),[company,setCompany]=useState(''),[metro,setMetro]=useState(''),[city,setCity]=useState(''),[scope,setScope]=useState('stale'),[directory,setDirectory]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('正在读取岗位…'),[page,setPage]=useState(1),[loading,setLoading]=useState(false),[pending,setPending]=useState<string[]>([]);
 const running=useRef(false),alive=useRef(true),sequence=useRef(0),filterRef=useRef(''),scopeRef=useRef(scope),groupRef=useRef(group);filterRef.current=new URLSearchParams({q:query,role,kind,level,visa,view,group,company,metro,city,page:String(page)}).toString();scopeRef.current=scope;groupRef.current=group;
 // 岗位列表是一条查询，随便翻页筛选都很快；统计、来源状态和地区分面要扫全表，单独低频获取。
 const loadJobs=useCallback(async()=>{const seq=++sequence.current;const r=await fetch('/api/jobs?'+filterRef.current);if(!r.ok)throw Error('读取失败，请稍后重试');const d:any=await r.json();if(alive.current&&seq===sequence.current)setData((prev:any)=>({...prev,...d}));return d},[]);
 const loadOverview=useCallback(async(fresh=false)=>{const r=await fetch('/api/overview?'+filterRef.current+(fresh?'&fresh=1':''));if(!r.ok)throw Error('读取统计失败，请稍后重试');const d:any=await r.json();let merged:any=null;setData((prev:any)=>merged={...prev,...d});return merged},[]);
 useJobTools(loadJobs,setQuery);
 const refresh=useCallback(async(pick=scopeRef.current)=>{if(running.current)return;running.current=true;setBusy(true);let done=0,failed=0;
  try{const d=await loadOverview(true);
   const queue=inScope(d,pick,groupRef.current).sort((a:any,b:any)=>(b.status==='syncing'?1:0)-(a.status==='syncing'?1:0)||(b.markedCount?1:0)-(a.markedCount?1:0)||(b.tier==='major'?1:0)-(a.tier==='major'?1:0)||Date.parse(a.last_success||0)-Date.parse(b.last_success||0));
   const planned=queue.length;
   if(!planned){setMessage(`「${SCOPES.find(x=>x.value===pick)?.label}」范围内没有需要更新的来源 · 6 小时内更新过的会自动跳过，可选“全部来源”强制重跑`);return}
   await Promise.all(Array.from({length:8},async()=>{while(queue.length&&alive.current){const s=queue.shift();let complete=false;
    while(!complete&&alive.current){try{
     const r=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:s.id,pages:6})});const result:any=await r.json();
     if(!r.ok)throw Error(result.error||'更新失败');
     if(result.busy){await new Promise(resolve=>setTimeout(resolve,1200));continue}
     complete=result.done===true;
     if(alive.current)setMessage(`已完成 ${done}/${planned} 家 · ${s.name} ${complete?'更新完成':`已检查 ${result.offset} / ${result.total} 条`}`);
     if(complete){done++;if(done%10===0){await loadJobs().catch(()=>{});await loadOverview(true).catch(()=>{})}}
    }catch{failed++;done++;complete=true}}}}));
   await Promise.all([loadJobs().catch(()=>{}),loadOverview(true).catch(()=>{})]);
   if(alive.current)setMessage(failed?`更新结束，${planned} 家中 ${failed} 个来源失败，可再次更新继续；旧岗位与标记已保留。`:`「${SCOPES.find(x=>x.value===pick)?.label}」更新结束，共 ${planned} 家 · 请在来源目录查看完整性与各公司收录范围`);
  }catch(e:any){if(alive.current)setMessage(e.message)}finally{running.current=false;if(alive.current)setBusy(false)}},[loadJobs,loadOverview]);
 useEffect(()=>{alive.current=true;refresh();const t=setInterval(()=>refresh(),15*60*1000);return()=>{alive.current=false;clearInterval(t)}},[refresh]);
 useEffect(()=>{setLoading(true);const t=setTimeout(()=>loadJobs().catch(e=>setMessage(e.message)).finally(()=>setLoading(false)),200);return()=>clearTimeout(t)},[query,role,kind,level,visa,view,group,company,metro,city,page,loadJobs]);
 useEffect(()=>{const t=setTimeout(()=>loadOverview().catch(()=>{}),600);return()=>clearTimeout(t)},[query,role,kind,level,visa,view,group,company,metro,city,loadOverview]);
 function choose(setter:any,value:any){setter(value);setPage(1)}
 // 标记先在本地生效再发请求：写库只要十几毫秒，但重新拉一次列表和统计要一秒多，等它变色就成了卡顿。
 function applyMark(id:string,field:string,on:boolean){setData((prev:any)=>{
  const hidden=(field==='starred'&&view==='重点岗位')||(field==='applied'&&view==='已投递');
  const jobs=hidden&&!on?prev.jobs.filter((x:any)=>x.id!==id):prev.jobs.map((x:any)=>x.id===id?{...x,[field]:on?1:0}:x);
  const stats={...prev.stats,[field]:Math.max(0,(prev.stats?.[field]||0)+(on?1:-1))};
  return {...prev,jobs,stats,total:hidden&&!on?Math.max(0,prev.total-1):prev.total};
 })}
 async function mark(j:any,field:string){
  const key=j.id+field;if(pending.includes(key))return;
  const on=!j[field];setPending(x=>[...x,key]);applyMark(j.id,field,on);
  try{const r=await fetch('/api/jobs',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:j.id,field,value:on})});if(!r.ok)throw Error('保存失败，标记已还原');}
  catch(e:any){applyMark(j.id,field,!on);await loadJobs().catch(()=>{});setMessage(e.message)}
  finally{setPending(x=>x.filter(k=>k!==key))}
 }
 const stats=data.stats,metroCounts=data.metroCounts||{},cityCounts=data.cityCounts||{};
 const planned=inScope(data,scope,group),plannedCount=planned.length,plannedTime=estimateTime(planned);
 const companies=data.sources.filter((s:any)=>s.group==='company'),platforms=data.sources.filter((s:any)=>s.group==='platform');
 const sources=data.sources.filter((s:any)=>(group==='all'||s.group===group)&&(!company||s.id===company)&&(!directory||s.name.toLowerCase().includes(query.toLowerCase())));
 const metroItems=[{value:'',label:'全部美国地区'},{value:'remote',label:`远程（美国） · ${metroCounts.remote||0}`},...METROS.filter(m=>metroCounts[m.id]||m.id===metro).sort((a,b)=>(metroCounts[b.id]||0)-(metroCounts[a.id]||0)).map(m=>({value:m.id,label:`${m.name} · ${metroCounts[m.id]||0}`}))];
 const cityItems=useMemo(()=>[{value:'',label:'全部城市'},...CITIES.filter(c=>cityCounts[c.id]||c.id===city).sort((a,b)=>(cityCounts[b.id]||0)-(cityCounts[a.id]||0)).map(c=>({value:c.id,label:`${c.zh} ${c.name}, ${c.state}`,keywords:c.name+' '+c.id,count:cityCounts[c.id]||0}))],[cityCounts,city]);
 const companyItems=useMemo(()=>[{value:'',label:'全部公司'},...data.sources.filter((s:any)=>group==='all'||s.group===group).map((s:any)=>({value:s.id,label:s.name,keywords:s.id+' '+systemName(s),count:s.jobCount}))],[data.sources,group]);
 const locationNote=[metroItems.find(m=>m.value===metro)?.label,cityItems.find(c=>c.value===city)?.label].filter(Boolean).join(' · ');
 return <div className="shell"><header><div className="brand"><Radar size={30}/><b>职达<span> / RADAR</span></b></div><span className="header-note">美国科技岗位 · 求职工作台</span><a className="header-note backlink" href="/resume"><FileText size={15}/> 简历工作台</a><div className="profile">我的求职空间</div></header><SidebarProvider className="workspace"><Sidebar collapsible="none" className="rail"><div className="eyebrow">WORKSPACE</div><h2>机会，持续更新。</h2><p className="muted">从发现到投递，在这里跟进。</p><nav>{['全部岗位','新发现','重点岗位','已投递'].map((v,i)=><button className={!directory&&view===v?'nav active':'nav'} onClick={()=>{choose(setView,v);setDirectory(false)}} key={v}>{[<Briefcase key="b" size={18}/>,<Radar key="r" size={18}/>,<Star key="s" size={18}/>,<CheckCheck key="c" size={18}/>][i]}{v}<span>{[stats.total,stats.fresh,stats.starred,stats.applied][i]||0}</span></button>)}</nav><div className="eyebrow">来源分类</div><nav className="groupnav">{GROUPS.map(x=><button key={x.id} className={group===x.id&&!directory?'nav active':'nav'} onClick={()=>{choose(setGroup,x.id);setCompany('');setDirectory(false)}}><x.icon size={18}/>{x.name}<span>{x.id==='all'?data.sources.length:x.id==='company'?companies.length:platforms.length}</span></button>)}<button className={directory?'nav active':'nav'} onClick={()=>{setDirectory(!directory);setQuery('')}}><ListChecks size={18}/>来源目录与状态</button></nav><div className="sourcebox"><p><i className="dot"/>{data.sources.filter((s:any)=>s.status==='ok').length} / {data.sources.length} 来源完整更新</p><small>打开时更新最近 6 小时未成功的来源；页面开启期间每 15 分钟再次检查。关闭页面暂停收集，重新打开可继续未完成的分页。</small></div></Sidebar><main><div className="heading"><div><div className="eyebrow">YOUR NEXT CHAPTER</div><h1>{directory?'来源目录':group==='company'?'公司自建招聘系统':group==='platform'?'招聘平台托管职位':view}</h1><p className="muted">{group==='company'?`${companies.length} 家公司自己的招聘系统：Workday 企业站与自建站，按公司官方接口直接收录。`:group==='platform'?`${platforms.length} 家公司托管在 Greenhouse / Ashby / Lever / SmartRecruiters 的官方招聘板。`:'寻找下一站，让每一次申请都有迹可循。'}</p></div><div className="headactions"><Picker label="更新范围" value={scope} onChange={setScope} items={SCOPES.map(x=>({value:x.value,label:`${x.label} · ${inScope(data,x.value,group).length}`}))}/><button className="primary" disabled={busy} onClick={()=>refresh()}><RefreshCw size={17} className={busy?'spin':''}/>{busy?'正在更新':plannedCount?`更新 ${plannedCount} 个来源`:'更新岗位'}</button></div></div><div className="stats"><div><span>全部来源 · 去重后</span><b>{stats.total||0}<small> 个岗位</small></b></div><div><span>我的重点岗位</span><b>{stats.starred||0}<small> 个关注</small></b></div><div><span>已投递简历</span><b>{stats.applied||0}<small> 次申请</small></b></div></div><div role="status" className="sync"><i className="dot"/>{message}</div><div className="scopehint">更新范围：{SCOPES.find(x=>x.value===scope)?.hint}。{plannedCount?`本次 ${plannedCount} 个来源，${plannedTime}（按已收录岗位数估算，未更新过的来源会更久）。`:''}已在更新的来源会从上次停下的分页继续，不会重头再来。</div><div className="filters"><label className="search"><Search size={18}/><input aria-label="搜索岗位、公司或地点" placeholder={directory?'搜索公司名称…':'搜索岗位、公司或地点…'} value={query} onChange={e=>choose(setQuery,e.target.value)}/></label>{!directory&&<><Picker label="职业" value={role} onChange={(v:any)=>choose(setRole,v)} items={roles}/><Picker label="岗位类型" value={kind} onChange={(v:any)=>choose(setKind,v)} items={['全部类型','实习','正式 / 其他']}/><Picker label="级别" value={level} onChange={(v:any)=>choose(setLevel,v)} items={LEVEL_FILTERS}/><Picker label="签证" value={visa} onChange={(v:any)=>choose(setVisa,v)} items={VISA_FILTERS}/></>}</div>
 {!directory&&<div className="filters locations"><Picker label="美国地区" value={metro} onChange={(v:any)=>{choose(setMetro,v);setCity('')}} items={metroItems}/><Finder label="城市" placeholder="搜索城市，如 纽约 / San Jose…" value={city} onChange={(v:any)=>choose(setCity,v)} items={cityItems}/><span className="muted">{locationNote?`当前地区：${locationNote}`:'按州与都会区自动归类，可直接搜索城市'}</span></div>}
 <div className="subfilters"><Finder label="公司" placeholder="搜索公司…" value={company} onChange={(v:any)=>choose(setCompany,v)} items={companyItems}/><span>{group==='company'?`${companies.length} 家公司自建系统 · ${stats.company||0} 个已收录岗位`:group==='platform'?`${platforms.length} 家平台托管来源 · ${stats.platform||0} 个已收录岗位`:`共 ${data.sources.length} 个来源，可在左侧按分类切换`}</span></div>
 {directory?<section className="sourcegrid">{sources.map((s:any)=><article key={s.id} className="sourcecard"><div><h3>{s.name}</h3><span className={'state '+s.status}>{s.status==='ok'?'完整更新':s.status==='partial'?'覆盖不完整':s.status==='syncing'?'分页更新中':s.status==='error'?'更新失败':'尚未更新'}</span></div><p>{systemName(s)}</p><b>{s.jobCount} 个岗位已收录</b><small>{s.scope||'美国岗位'}{s.type==='workday'&&' · 地点按来源筛选项识别'}</small>{s.status==='syncing'&&<small>已检查 {s.cursor} / {s.run_total} 条</small>}{s.warning&&<p className="warning">{s.warning}</p>}{s.error&&<p className="warning">{s.error}</p>}<small>最近完成：{s.last_success?new Date(s.last_success).toLocaleString():'尚无完成记录'}</small><a href={s.careerUrl} target="_blank" rel="noopener noreferrer">打开公司招聘站 <ArrowUpRight size={14}/></a></article>)}</section>:<><div className="listhead"><b>{data.total} 个匹配岗位 {loading?'· 正在筛选…':''}</b><span>{view} · 按首次发现时间排序</span></div><section>{data.jobs.map((j:any)=><article className="job" key={j.id}><div className="monogram">{j.company.slice(0,2).toUpperCase()}</div><div className="jobbody"><div className="company">{j.company}<span>{j.kind}</span>{j.level&&j.level!=='实习'&&j.level!=='未注明'&&<span>{j.level}</span>}{j.visa&&j.visa!=='未提及'&&<span className={VISA_BLOCKED.includes(j.visa)?'visa-no':'visa-ok'} title={j.visa_note||undefined}>{j.visa}</span>}<span>{systemName(data.sources.find((s:any)=>s.id===j.source))}</span>{!j.active&&<span className="closed">来源已移除</span>}</div><h3><a href={j.url} target="_blank" rel="noopener noreferrer">{j.title}</a></h3><div className="meta"><span><MapPin size={14}/>{j.location}</span><span>{j.role}</span><span>发现于 {new Date(j.first_seen).toLocaleDateString()}</span></div><details><summary>岗位摘要</summary>{j.visa_note&&<p className="visanote">签证判断依据：{j.visa_note}</p>}<p className="description">{j.description||'暂未收录描述（Workday 等来源只为已归类职业的非资深岗位补拉详情），请打开公司招聘页面查看完整职责与申请要求。'}</p></details></div><div className="actions"><a className="apply" href={j.url} target="_blank" rel="noopener noreferrer">前往投递 <ArrowUpRight size={16}/></a><div><button disabled={pending.includes(j.id+'starred')} aria-pressed={!!j.starred} onClick={()=>mark(j,'starred')} className={j.starred?'marked':''}><Star size={16}/>{j.starred?'已重点关注':'重点岗位'}</button><button disabled={pending.includes(j.id+'applied')} aria-pressed={!!j.applied} onClick={()=>mark(j,'applied')} className={j.applied?'marked':''}><CheckCheck size={16}/>{j.applied?'已投递':'标记已投递'}</button></div></div></article>)}{!data.jobs.length&&<Empty><EmptyHeader><EmptyTitle>{busy?'正在收集，或暂无匹配岗位':'暂无匹配岗位'}</EmptyTitle><EmptyDescription>可调整地区、职业、公司和关键词，并在来源目录检查更新进度。</EmptyDescription></EmptyHeader></Empty>}</section>{data.total>30&&<Pagination className="pagination"><PaginationContent><PaginationItem><button disabled={page===1} onClick={()=>setPage(page-1)}>上一页</button></PaginationItem><PaginationItem><span>{page} / {Math.ceil(data.total/30)}</span></PaginationItem><PaginationItem><button disabled={page*30>=data.total} onClick={()=>setPage(page+1)}>下一页</button></PaginationItem></PaginationContent></Pagination>}</>}
 <footer>已接入来源不代表全网覆盖。地区按岗位地点文本识别，仅写 Remote 或多地点的记录可能归入“远程”或“其他美国地点”。新发现按首次收录时间计算；级别按标题、签证按岗位描述规则识别，可能有误，鼠标悬停签证标签或展开岗位摘要可看判断依据；岗位要求、签证支持及开放状态以公司官网为准。</footer></main></SidebarProvider></div>
}
