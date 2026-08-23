const HUMAN_PARTS=["workbook.human.b64.1", "workbook.human.b64.2", "workbook.human.b64.3", "workbook.human.b64.4", "workbook.human.b64.5", "workbook.human.b64.6"];
(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="human-workbook-20260823-r10";
    const responses=await Promise.all(HUMAN_PARTS.map(name=>fetch(`${name}?${cacheKey}`,{cache:"no-store"})));
    for(const response of responses)if(!response.ok)throw new Error(`Application runtime load failed: HTTP ${response.status}`);
    const payload=(await Promise.all(responses.map(response=>response.text()))).join("").trim();
    const binary=atob(payload),bytes=new Uint8Array(binary.length);
    for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
    const source=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
    try{await import(url)}finally{URL.revokeObjectURL(url)}
  }catch(error){
    console.error(error);
    const root=document.getElementById("app");
    if(root)root.innerHTML=`<main class="app-main"><section class="card danger"><h1 class="card-title">The workbook could not load</h1><p>${String(error.message||error)}</p></section></main>`;
  }
})();
