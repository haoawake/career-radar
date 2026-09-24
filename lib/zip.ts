// 最小 ZIP 写入器：.docx 就是一包 XML 的 ZIP，而 Workers 运行时没有打包库，
// 这里只用「存储」方式（不压缩）写入，Word、Pages、Google Docs 与各家 ATS 都能正常打开。
const TABLE=(()=>{const t=new Uint32Array(256);
 for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[i]=c>>>0}
 return t})();
export function crc32(buf:Uint8Array){
 let c=0xFFFFFFFF;
 for(let i=0;i<buf.length;i++)c=TABLE[(c^buf[i])&0xFF]^(c>>>8);
 return (c^0xFFFFFFFF)>>>0;
}
export type ZipEntry={name:string;data:Uint8Array};
/** 打成 ZIP。时间戳固定，保证同样的内容每次导出字节一致，便于比对。 */
export function zip(entries:ZipEntry[]):Uint8Array{
 const enc=new TextEncoder();
 const locals:Uint8Array[]=[],centrals:Uint8Array[]=[];
 let offset=0;
 for(const e of entries){
  const name=enc.encode(e.name),sum=crc32(e.data),size=e.data.length;
  const local=new Uint8Array(30+name.length+size);
  const lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);   // 本地文件头签名
  lv.setUint16(4,20,true);           // 解压所需版本
  lv.setUint16(6,0,true);            // 标志位
  lv.setUint16(8,0,true);            // 压缩方式：存储
  lv.setUint16(10,0,true);lv.setUint16(12,0x21,true);// 固定的 MS-DOS 时间与日期（1980-01-01）
  lv.setUint32(14,sum,true);
  lv.setUint32(18,size,true);        // 压缩后大小
  lv.setUint32(22,size,true);        // 原始大小
  lv.setUint16(26,name.length,true);
  lv.setUint16(28,0,true);           // 扩展字段长度
  local.set(name,30);local.set(e.data,30+name.length);
  locals.push(local);

  const central=new Uint8Array(46+name.length);
  const cv=new DataView(central.buffer);
  cv.setUint32(0,0x02014b50,true);   // 中央目录签名
  cv.setUint16(4,20,true);cv.setUint16(6,20,true);
  cv.setUint16(8,0,true);cv.setUint16(10,0,true);
  cv.setUint16(12,0,true);cv.setUint16(14,0x21,true);
  cv.setUint32(16,sum,true);cv.setUint32(20,size,true);cv.setUint32(24,size,true);
  cv.setUint16(28,name.length,true);
  cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);
  cv.setUint16(36,0,true);cv.setUint32(38,0,true);
  cv.setUint32(42,offset,true);      // 本地文件头位置
  central.set(name,46);
  centrals.push(central);
  offset+=local.length;
 }
 const centralSize=centrals.reduce((n,c)=>n+c.length,0);
 const end=new Uint8Array(22);
 const ev=new DataView(end.buffer);
 ev.setUint32(0,0x06054b50,true);    // 中央目录结束记录
 ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);
 ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
 ev.setUint16(20,0,true);
 const total=offset+centralSize+22,out=new Uint8Array(total);
 let at=0;
 for(const b of locals){out.set(b,at);at+=b.length}
 for(const b of centrals){out.set(b,at);at+=b.length}
 out.set(end,at);
 return out;
}
