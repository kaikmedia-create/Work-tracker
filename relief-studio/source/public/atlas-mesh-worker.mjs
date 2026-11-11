import './core.js?hybrid=1';
import './architecture.js?hybrid=1';
import {model3mf} from './official-export.mjs';
import {buildSurface} from './surface-build.mjs';
const RS=globalThis.RS;
self.onmessage=async function(event){const {id,data,settings}=event.data;try{if(event.data.exportType){const {mesh,type,title}=event.data.exportType;const blob=type==='stl'?new Blob([RS.stl(mesh)],{type:'model/stl'}):model3mf(RS,mesh,title);self.postMessage({id,blob});return;}RS.meshProgress=progress=>self.postMessage({id,progress});const result=await buildSurface(RS,data,settings,{server:!!event.data.server});const transfer=[result.vertices.buffer,result.indices.buffer,result.classes.buffer];if(!result.officialAudit&&result.indices.length>24000){const p=result.preview=RS.previewSurface(result);transfer.push(p.vertices.buffer,p.indices.buffer,p.classes.buffer);}self.postMessage({id,result},transfer);}catch(e){self.postMessage({id,error:e.message,code:e.code||'GEOMETRY_ERROR',stack:e.stack||'',diagnostics:e.diagnostics||null});}finally{delete RS.meshProgress;}};
