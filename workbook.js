(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const names=["workbook.module.gz.1","workbook.module.gz.2","workbook.module.gz.3"];
    const responses=await Promise.all(names.map(name=>fetch(name,{cache:"no-store"})));
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

(()=>{
  const BUTTON_LABELS=new Map([
    ['Create fresh-context launch record','Start fresh context'],
    ['Open blocker','Block stage'],
    ['Record material change','Record change'],
    ['Record agent output receipt','Record agent output']
  ]);
  function refineIntegratedControls(){
    const panel=document.querySelector('[data-integrated-operational-controls="true"]');
    if(!panel||panel.dataset.workflowUiRefined==='true')return;
    panel.dataset.workflowUiRefined='true';
    const heading=panel.querySelector('h3');
    if(heading)heading.textContent='Workflow controls';
    const explanation=panel.querySelector(':scope > p.muted');
    if(explanation)explanation.remove();
    panel.querySelectorAll('button').forEach(button=>{
      const next=BUTTON_LABELS.get(button.textContent.trim());
      if(next)button.textContent=next;
    });
    const recordDetails=[...panel.querySelectorAll(':scope > details')].filter(details=>/^Appendix [A-F]\b/.test(details.querySelector('summary')?.textContent?.trim()||''));
    if(recordDetails.length){
      const evidence=document.createElement('details');
      evidence.dataset.evidenceRecords='true';
      const summary=document.createElement('summary');
      summary.innerHTML='<strong>Evidence records</strong>';
      evidence.appendChild(summary);
      for(const details of recordDetails){
        const text=details.querySelector('summary')?.textContent?.trim()||'';
        const match=text.match(/^Appendix ([A-F])\s+—\s+(.+?)\s+records\s+\((\d+)\)$/);
        if(match)details.querySelector('summary').innerHTML=`<strong>${match[2]}</strong> (${match[3]})`;
        evidence.appendChild(details);
      }
      panel.appendChild(evidence);
    }
  }
  new MutationObserver(refineIntegratedControls).observe(document.documentElement,{subtree:true,childList:true});
  refineIntegratedControls();
})();
