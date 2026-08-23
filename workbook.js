(async()=>{
  const STATE_STORE="mobile-closed-loop-agent";
  const TEST_SPEC_REVISION="app-repair-self-test-20260823-001";
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="human-workbook-20260823-r15";
    const names=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
    const responses=await Promise.all(names.map(name=>fetch(`${name}?${cacheKey}`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const total=parts.reduce((sum,part)=>sum+part.byteLength,0),bytes=new Uint8Array(total);let offset=0;
    for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source=await new Response(stream).text();
    const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
    let runtime;
    try{runtime=await import(url);}finally{URL.revokeObjectURL(url);}
    if(!localStorage.getItem(STATE_STORE)){
      if(typeof runtime.createBlankState!=="function"||typeof runtime.mount!=="function")throw new Error("The core workflow cannot initialize persisted project state.");
      localStorage.setItem(STATE_STORE,JSON.stringify(runtime.createBlankState()));
      runtime.mount();
    }
    const revisionKey="closed-loop-test-project-spec-revision";
    if(localStorage.getItem(revisionKey)!==TEST_SPEC_REVISION){
      try{
        const registryKey="closed-loop-project-registry-v3";
        const registry=JSON.parse(localStorage.getItem(registryKey)||"{}");
        delete registry["test-project"];
        localStorage.setItem(registryKey,JSON.stringify(registry));
      }catch(error){console.warn("Unable to invalidate stale retained test project",error);}
      localStorage.setItem(revisionKey,TEST_SPEC_REVISION);
    }
    dispatchEvent(new Event("closed-loop-core-ready"));
  }catch(error){
    console.error(error);
    const target=document.getElementById("content");
    if(target)target.innerHTML=`<div class="card"><h2>Application runtime failed to load</h2><p>${String(error.message||error)}</p></div>`;
  }
})();
