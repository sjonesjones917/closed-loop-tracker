(async()=>{
  const STATE_STORE="mobile-closed-loop-agent";
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="human-workbook-20260823-r14";
    const names=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
    const responses=await Promise.all(names.map(name=>fetch(`${name}?${cacheKey}`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Runtime load failed: HTTP ${response.status}`);
    const parts=await Promise.all(responses.map(response=>response.arrayBuffer()));
    const total=parts.reduce((sum,part)=>sum+part.byteLength,0),bytes=new Uint8Array(total);let offset=0;
    for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source=await new Response(stream).text();
    const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
    try{await import(url);}finally{URL.revokeObjectURL(url);}
    if(!localStorage.getItem(STATE_STORE))throw new Error("The core workflow loaded without establishing project state.");
    dispatchEvent(new Event("closed-loop-core-ready"));
  }catch(error){
    console.error(error);
    const target=document.getElementById("content");
    if(target)target.innerHTML=`<div class="card"><h2>Application runtime failed to load</h2><p>${String(error.message||error)}</p></div>`;
  }
})();
