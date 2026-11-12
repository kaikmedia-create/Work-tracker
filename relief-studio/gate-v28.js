/* The original encrypted preview remains intact; add the verified official-source delta. */
(async()=>{
 const button=document.getElementById('submit'),status=document.getElementById('status');button.disabled=true;
 try{
  const {composeGate,baseSHA256}=await import('./source/public/official-gate.mjs?v=28-official-1');
  const response=await fetch('gate-base-v28.js?v=28-official-1',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Vorschau-Datei HTTP '+response.status);
  const base=await response.text();if(base.length>50000)throw Error('Ungültige Vorschau-Datei.');
  const sum=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(base)))].map(v=>v.toString(16).padStart(2,'0')).join('');if(sum!==baseSHA256)throw Error('Prüfsumme der Vorschau stimmt nicht.');
  const script=document.createElement('script');script.textContent=composeGate(base);document.head.append(script);button.disabled=false;
 }catch(e){status.textContent='Vorschau konnte nicht geladen werden: '+e.message+'. Seite erneut öffnen.';}
})();
