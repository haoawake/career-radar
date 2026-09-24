// 生成 .docx。排版走的是和预览同一套 renderItem() 规则，字体、字号、页边距与
// globals.css 里的 .sheet.t-* 一一对应，选了哪套模板导出的 Word 就是哪套。
// 单栏、无表格、无文本框，方便 Workday / Greenhouse 这类 ATS 正确解析。
import { zip } from './zip';
import { KIND,tidy,type ResumeData } from './resume-types';
import { renderItem,hasContent } from './resume-render';

const esc=(s:string)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
type Paper='letter'|'a4';
// 长度单位是 twip（1/1440 英寸）；字号是半磅；字距是 1/20 磅；行距 240 为单倍
const PAGE={letter:{w:12240,h:15840},a4:{w:11906,h:16838}};
const INK='111418',SOFT='5B666E',RULE='D3DADE',ACCENT='00695C';
type Theme={font:string;serif:boolean;base:number;name:number;head:number;small:number;
 margin:number;line:number;nameSpacing:number;headSpacing:number;left:boolean;accentHead:boolean};
const THEME:Record<string,Theme>={
 classic:{font:'Georgia',serif:true,base:20,name:39,head:16,small:18,margin:1037,line:336,nameSpacing:35,headSpacing:21,left:false,accentHead:false},
 modern:{font:'Calibri',serif:false,base:21,name:43,head:17,small:18,margin:1037,line:331,nameSpacing:4,headSpacing:19,left:true,accentHead:true},
 compact:{font:'Calibri',serif:false,base:20,name:35,head:16,small:17,margin:792,line:312,nameSpacing:19,headSpacing:19,left:false,accentHead:false},
};
const themeOf=(t?:string):Theme=>THEME[t||'classic']||THEME.classic;

type RunOpts={b?:boolean;i?:boolean;sz?:number;color?:string;caps?:boolean;spacing?:number};
const run=(text:string,o:RunOpts={})=>{
 const props=[o.b?'<w:b/>':'',o.i?'<w:i/>':'',o.caps?'<w:caps/>':'',
  o.spacing?`<w:spacing w:val="${o.spacing}"/>`:'',
  o.color?`<w:color w:val="${o.color}"/>`:'',
  o.sz?`<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`:''].join('');
 // 保留空格，并把换行拆成 <w:br/>
 const parts=String(text??'').split('\n').map(t=>`<w:t xml:space="preserve">${esc(t)}</w:t>`).join('<w:br/>');
 return `<w:r>${props?`<w:rPr>${props}</w:rPr>`:''}${parts}</w:r>`;
};
const TAB='<w:r><w:tab/></w:r>';
type ParaOpts={align?:'center'|'left';space?:number;before?:number;tabRight?:number;borderColor?:string;
 indent?:number;hanging?:number;keepNext?:boolean;line?:number};
const para=(runs:string,o:ParaOpts={})=>{
 const props=[
  o.align?`<w:jc w:val="${o.align}"/>`:'',
  o.tabRight?`<w:tabs><w:tab w:val="right" w:pos="${o.tabRight}"/></w:tabs>`:'',
  o.indent||o.hanging?`<w:ind${o.indent?` w:left="${o.indent}"`:''}${o.hanging?` w:hanging="${o.hanging}"`:''}/>`:'',
  o.borderColor?`<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="3" w:color="${o.borderColor}"/></w:pBdr>`:'',
  o.keepNext?'<w:keepNext/>':'',
  `<w:spacing w:before="${o.before??0}" w:after="${o.space??0}" w:line="${o.line??264}" w:lineRule="auto"/>`,
 ].join('');
 return `<w:p><w:pPr>${props}</w:pPr>${runs}</w:p>`;
};

/** 组装 word/document.xml 的正文。 */
function body(data:ResumeData,paper:Paper,template?:string){
 const r=tidy(data),b=r.basics,out:string[]=[];
 const t=themeOf(template);
 const page=PAGE[paper]??PAGE.letter;
 const tabRight=page.w-t.margin*2;
 const align=t.left?'left':'center';
 const line=t.line;
 const headColor=t.accentHead?ACCENT:INK,headRule=t.accentHead?ACCENT:RULE;
 const heading=(title:string)=>para(run(title,{b:true,sz:t.head,caps:true,color:headColor,spacing:t.headSpacing}),
  {before:300,space:130,borderColor:headRule,keepNext:true,line});

 out.push(para(run(b.name||'',{b:true,sz:t.name,spacing:t.nameSpacing}),{align,line:240}));
 if(b.headline)out.push(para(run(b.headline,{sz:t.base,color:SOFT}),{align,before:70,line}));
 const contacts=[b.location,b.phone,b.email].filter(Boolean);
 if(contacts.length)out.push(para(run(contacts.join('  ·  '),{sz:t.small,color:SOFT}),{align,before:110,line}));
 if(b.links.length)out.push(para(run(b.links.map(l=>l.label||l.url.replace(/^https?:\/\//,'')).join('  ·  '),
  {sz:t.small,color:SOFT}),{align,before:45,line}));
 if(b.summary){out.push(heading('Summary'));out.push(para(run(b.summary,{sz:t.base}),{space:60,line}))}

 for(const s of r.sections){
  out.push(heading(s.title||KIND[s.type].defaultTitle));
  for(const item of s.items){
   const v=renderItem(item,s.type);
   if(!hasContent(v))continue;
   if(v.skill){
    out.push(para((v.skill.label?run(v.skill.label+'：',{b:true,sz:t.base}):'')+run(v.skill.values,{sz:t.base}),{space:60,line}));
    continue;
   }
   if(v.head.primary||v.head.secondary||v.when){
    const left=(v.head.primary?run(v.head.primary,{b:true,sz:t.base}):'')
     +(v.head.secondary?run((v.head.primary?v.head.separator:'')+v.head.secondary,{sz:t.base,color:SOFT}):'');
    const right=v.when?TAB+run(v.when,{sz:t.small,color:SOFT}):'';
    out.push(para(left+right,{tabRight,before:150,keepNext:true,line}));
   }
   if(v.role)out.push(para(run(v.role,{i:true,sz:t.base}),{keepNext:true,line}));
   if(v.note)out.push(para(run(v.note,{sz:t.base,color:SOFT}),{line}));
   if(v.tags)out.push(para(run(v.tags,{sz:t.small,color:SOFT}),{line}));
   for(const text of v.bullets)
    out.push(para(run('•',{sz:t.base,color:SOFT})+TAB+run(text,{sz:t.base}),{indent:230,hanging:230,line}));
   if(v.link)out.push(para(run(v.link.replace(/^https?:\/\//,''),{sz:t.small,color:SOFT}),{line}));
  }
 }
 const sect=`<w:sectPr><w:pgSz w:w="${page.w}" w:h="${page.h}"/>`
  +`<w:pgMar w:top="${t.margin}" w:right="${t.margin}" w:bottom="${t.margin}" w:left="${t.margin}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
 return out.join('')+sect;
}
const XML='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const CONTENT_TYPES=`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
 +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
 +'<Default Extension="xml" ContentType="application/xml"/>'
 +'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
 +'<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
 +'</Types>';
const RELS=`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
 +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
 +'</Relationships>';
const DOC_RELS=`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
 +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
 +'</Relationships>';
/** 默认字体与段落间距按模板生成；中文回退到微软雅黑，衬线模板回退到宋体。 */
const styles=(t:Theme)=>`${XML}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
 +'<w:docDefaults><w:rPrDefault><w:rPr>'
 +`<w:rFonts w:ascii="${t.font}" w:hAnsi="${t.font}" w:cs="${t.font}" w:eastAsia="${t.serif?'SimSun':'Microsoft YaHei'}"/>`
 +`<w:sz w:val="${t.base}"/><w:szCs w:val="${t.base}"/><w:color w:val="${INK}"/>`
 +'</w:rPr></w:rPrDefault>'
 +`<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${t.line}" w:lineRule="auto"/></w:pPr></w:pPrDefault>`
 +'</w:docDefaults>'
 +'<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
 +'</w:styles>';

export function buildDocx(data:ResumeData,paper='letter',template='classic'):Uint8Array{
 const enc=new TextEncoder();
 const document=`${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
  +`<w:body>${body(data,paper==='a4'?'a4':'letter',template)}</w:body></w:document>`;
 return zip([
  {name:'[Content_Types].xml',data:enc.encode(CONTENT_TYPES)},
  {name:'_rels/.rels',data:enc.encode(RELS)},
  {name:'word/_rels/document.xml.rels',data:enc.encode(DOC_RELS)},
  {name:'word/styles.xml',data:enc.encode(styles(themeOf(template)))},
  {name:'word/document.xml',data:enc.encode(document)},
 ]);
}
/** 导出文件名：姓名 + 这份简历的名字，避免几份简历下载下来重名，一眼能看出是投哪个岗位的。 */
export function resumeFileName(data:ResumeData,label:string,ext:string){
 const clean=(v:string)=>v.trim().replace(/[\\/:*?"<>|·]/g,' ').replace(/\s+/g,'_').replace(/^_|_$/g,'');
 const parts=[clean(data.basics.name||''),clean(label||'')].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
 return `${parts.join('_')||'Resume'}.${ext}`;
}
