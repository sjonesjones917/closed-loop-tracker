(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="2026-08-23-contextual-workbook-controls-2";
    const names=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
    const responses=await Promise.all(names.map(name=>fetch(`${name}?${cacheKey}`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const total=parts.reduce((n,part)=>n+part.byteLength,0),bytes=new Uint8Array(total);
    let offset=0;for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source=await new Response(stream).text();
    const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
    try{await import(url);}finally{URL.revokeObjectURL(url);}
  }catch(error){
    console.error(error);
    const target=document.getElementById("content");
    if(target)target.textContent=`Application runtime failed to load: ${error.message}`;
  }
})();

/* Appendices A-F are operational record/control families inside the existing
   30-stage workbook. Never expose them as a second navigation surface. */
(()=>{
  const badNav=/^(?:Appendices A[–-]F|Control records|Appendix controls|[A-F]\s+(?:FRESH AGENT CONTEXT LAUNCH CHECKLIST|UNIVERSAL BLOCKER RECORD|UNIVERSAL CHANGE AND INVALIDATION LOG|EXACT FINAL RELEASE CHECKLIST|NEW-JOB RESET CHECKLIST|UNIVERSAL AGENT-OUTPUT RECEIPT))$/i;
  const appendixHeading=/^APPENDIX\s+[A-F]\b/i;
  let queued=false;
  function clean(){
    queued=false;
    document.querySelectorAll('button,a,[role="button"]').forEach(el=>{
      if(badNav.test((el.textContent||'').trim())){el.hidden=true;el.setAttribute('aria-hidden','true');el.tabIndex=-1;}
    });
    [...document.querySelectorAll('h1,h2,h3,h4')].forEach(h=>{
      if(!appendixHeading.test((h.textContent||'').trim()))return;
      const box=h.closest('section,article,.card,.panel,details')||h.parentElement;
      if(box){box.hidden=true;box.setAttribute('aria-hidden','true');}
    });
    try{if('view' in globalThis&&globalThis.view!=='workbook')globalThis.view='workbook';}catch{}
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(clean);}}
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','aria-current']});
  document.addEventListener('click',e=>{const el=e.target.closest('button,a,[role="button"]');if(el&&badNav.test((el.textContent||'').trim())){e.preventDefault();e.stopImmediatePropagation();clean();}},true);
  schedule();
})();
