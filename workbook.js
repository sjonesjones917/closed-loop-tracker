(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="2026-08-23-contextual-workbook-controls-4";
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

    const legacyNav=/^(?:Appendices A[–-]F|Control records)$/i;
    const legacyAppendix=/^[A-F]\s+(?:FRESH AGENT CONTEXT LAUNCH CHECKLIST|UNIVERSAL BLOCKER RECORD|UNIVERSAL CHANGE AND INVALIDATION LOG|EXACT FINAL RELEASE CHECKLIST|NEW-JOB RESET CHECKLIST|UNIVERSAL AGENT-OUTPUT RECEIPT)$/i;
    const legacyHeading=/^APPENDIX\s+[A-F]\s*[-–]/i;
    let queued=false;

    function keepSingleWorkbookSurface(){
      queued=false;
      document.querySelectorAll('button,a,[role="button"]').forEach(el=>{
        const label=(el.textContent||'').trim();
        if(legacyNav.test(label)||legacyAppendix.test(label)){
          el.hidden=true;
          el.setAttribute('aria-hidden','true');
          el.tabIndex=-1;
        }
      });
      const content=document.getElementById('content');
      const legacyView=content&&[...content.querySelectorAll('h1,h2,h3,h4')].some(el=>legacyHeading.test((el.textContent||'').trim()));
      if(legacyView){
        const workbook=[...document.querySelectorAll('button,a,[role="button"]')].find(el=>/^30[–-]stage workbook$/i.test((el.textContent||'').trim()));
        if(workbook&&!workbook.hidden)workbook.click();
      }
    }
    function schedule(){if(!queued){queued=true;requestAnimationFrame(keepSingleWorkbookSurface);}}
    new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
    schedule();
  }catch(error){
    console.error(error);
    const target=document.getElementById("content");
    if(target)target.textContent=`Application runtime failed to load: ${error.message}`;
  }
})();
