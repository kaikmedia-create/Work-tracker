/** Exact same mesh as preview/STL, with source and print adaptation metadata. */
export function model3mf(R,mesh,title){
 if(!mesh.officialAudit)return R.model3mf(mesh,title);
 const escape=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
 const v=mesh.vertices,t=mesh.indices,enc=new TextEncoder(),parts=[],batch=[];const flush=()=>{if(batch.length){parts.push(enc.encode(batch.join('')));batch.length=0;}};
 const audit={...mesh.officialAudit,placements:mesh.officialPlacement||[],baseAttribution:'Map data © OpenStreetMap contributors / ODbL; Terrain: Mapzen / AWS Terrain Tiles'};
 batch.push('<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="de-DE" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">'+escape(title||'Relief Studio')+'</metadata><metadata name="Description">'+escape(JSON.stringify(audit))+'</metadata><resources><object id="1" type="model"><mesh><vertices>');
 for(let i=0;i<v.length;i+=3){batch.push(`<vertex x="${v[i].toPrecision(9)}" y="${v[i+1].toPrecision(9)}" z="${v[i+2].toPrecision(9)}"/>`);if(batch.length>=2048)flush();}
 batch.push('</vertices><triangles>');for(let i=0;i<t.length;i+=3){batch.push(`<triangle v1="${t[i]}" v2="${t[i+1]}" v3="${t[i+2]}"/>`);if(batch.length>=2048)flush();}batch.push('</triangles></mesh></object></resources><build><item objectid="1"/></build></model>');flush();
 return R.zip({'[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="json" ContentType="application/json"/></Types>','_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>','3D/3dmodel.model':parts,'Metadata/sources.json':JSON.stringify(audit,null,2)});
}
