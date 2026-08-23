(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="2026-08-23-integrated-workbook";
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

(()=>{
  const BUTTON_LABELS=new Map([
    ['Create fresh-context launch record','Start fresh context'],
    ['Open blocker','Block stage'],
    ['Record material change','Record change'],
    ['Record agent output receipt','Record agent output']
  ]);
  const SUMMARY_LABELS=new Map([
    ['Universal blocker record','Blocker details'],
    ['Append-only change and invalidation record','Change and invalidation details'],
    ['Universal agent-output receipt','Agent output details'],
    ['Exact artifact identity control','Release identity']
  ]);
  const IMMUTABLE_RECORD_FAMILIES=new Set(['C','D','E']);
  function removeDuplicateNavigation(){
    document.querySelectorAll('button').forEach(button=>{
      const text=button.textContent.trim();
      if(/^Operational controls A[–-]F$/i.test(text)||/^Appendix controls$/i.test(text))button.remove();
    });
  }
  function refineIntegratedControls(){
    removeDuplicateNavigation();
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
    panel.querySelectorAll(':scope > details > summary').forEach(summary=>{
      const next=SUMMARY_LABELS.get(summary.textContent.trim());
      if(next)summary.textContent=next;
    });
    panel.querySelectorAll('textarea[data-record-letter]').forEach(textarea=>{
      if(IMMUTABLE_RECORD_FAMILIES.has(textarea.dataset.recordLetter)){
        textarea.readOnly=true;
        textarea.setAttribute('aria-readonly','true');
        textarea.title='Preserved append-only evidence. Create a new superseding record instead of overwriting history.';
      }
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
