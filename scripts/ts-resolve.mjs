// 让 node --experimental-strip-types 能解析源码里省略扩展名的相对导入（打包器风格）。
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
if(!process.env.TS_RESOLVE_HOOKED){process.env.TS_RESOLVE_HOOKED='1';register('./ts-resolve.mjs',pathToFileURL('./scripts/'))}
export async function resolve(specifier,context,next){
 try{return await next(specifier,context)}catch(e){
  if(!specifier.startsWith('.'))throw e;
  const base=new URL(specifier,context.parentURL);
  for(const ext of ['.ts','.tsx','/index.ts']){const candidate=new URL(base.href+ext);if(fs.existsSync(candidate))return next(specifier+ext,context)}
  throw e;
 }
}
