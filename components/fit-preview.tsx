'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
// 简历纸张是固定的 8.5 或 8.27 英寸宽，容器放不下时整行文字会被裁在右边。
// 把纸张按容器宽度等比缩小，而不是压缩宽度——压宽度会让换行位置变掉，预览就不再等于导出结果了。
export function FitPreview({children}:{children:React.ReactNode}){
 const box=useRef<HTMLDivElement>(null),inner=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({scale:1,w:0,h:0});
 const measure=useCallback(()=>{
  const available=box.current?.clientWidth,sheet=inner.current?.firstElementChild as HTMLElement|undefined;
  if(!available||!sheet)return;
  // transform 不改变布局尺寸，这里读到的始终是纸张的原始大小，不会和缩放互相拉扯
  const w=sheet.offsetWidth,h=sheet.offsetHeight;
  if(!w||!h)return;
  const scale=Math.min(1,available/w);
  setSize(prev=>Math.abs(prev.scale-scale)<0.002&&prev.w===w&&prev.h===h?prev:{scale,w,h});
 },[]);
 useEffect(()=>{
  measure();
  const ro=new ResizeObserver(measure);
  if(box.current)ro.observe(box.current);
  if(inner.current)ro.observe(inner.current);
  return()=>ro.disconnect();
 },[measure,children]);
 const {scale,w,h}=size;
 return <div className="rpreview">
  <div className="fitbox" ref={box}>
   <div className="fit" style={w?{width:w*scale,height:h*scale}:undefined}>
    <div ref={inner} style={{transform:`scale(${scale})`,transformOrigin:'top left',width:w||undefined}}>{children}</div>
   </div>
  </div>
  {scale<0.999?<p className="fitnote">已按窗口宽度缩放至 {Math.round(scale*100)}%，导出与打印仍是原始尺寸</p>:null}
 </div>;
}
