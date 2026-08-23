(async()=>{
  try{
    if(typeof DecompressionStream!=="function")throw new Error("This browser does not support the required gzip decompression API.");
    const cacheKey="2026-08-23-integrated-workbook-appendix-fix";
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

/*
  Appendix A-F are cross-cutting controls of the one 30-stage workbook, not six
  additional workflows. This adapter keeps every appendix record and action in
  the existing application state while removing the duplicate checklist-first
  surface that made the appendices look like a second application.
*/
(()=>{
  const APPLICABILITY={
    A:new Set([9,10,11,12,17,19,21,23,24]),
    B:new Set(Array.from({length:30},(_,i)=>i+1)),
    C:new Set(Array.from({length:30},(_,i)=>i+1)),
    D:new Set([25,26,27,28,29,30]),
    E:new Set([1]),
    F:new Set(Array.from({length:30},(_,i)=>i+1))
  };
  const LABELS={
    A:'Fresh independent context',
    B:'Blocker',
    C:'Material change / invalidation',
    D:'Final release control',
    E:'New-job reset',
    F:'Agent-output receipt'
  };
  const ACTION_LABELS={
    A:'Record fresh context',B:'Open blocker',C:'Record material change',
    D:'Review release control',E:'Review new-job reset',F:'Record agent output'
  };
  const APPENDIX_HEADING=/^APPENDIX\s+([A-F])\b/i;
  let scheduled=false;

  function stageNumber(){
    const text=document.body.innerText||'';
    const active=[...document.querySelectorAll('button,[role="button"],a')]
      .find(el=>el.getAttribute('aria-current')==='page'||el.classList.contains('active'));
    const fromActive=active?.textContent?.match(/STAGE\s*0?(\d{1,2})/i);
    if(fromActive)return Number(fromActive[1]);
    const heading=[...document.querySelectorAll('h1,h2,h3,h4')]
      .map(el=>el.textContent||'').find(t=>/STAGE\s*0?\d{1,2}/i.test(t));
    const match=heading?.match(/STAGE\s*0?(\d{1,2})/i)||text.match(/CURRENT_STAGE:\s*STAGE\s*0?(\d{1,2})/i);
    return match?Number(match[1]):null;
  }

  function hideDuplicateAppendixNavigation(){
    document.querySelectorAll('button,a,[role="button"]').forEach(el=>{
      const text=(el.textContent||'').trim();
      if(/^Appendices A[–-]F$/i.test(text)||/^Appendix controls$/i.test(text)){
        el.hidden=true;
        el.setAttribute('aria-hidden','true');
      }
      if(/^[A-F]\s+(FRESH AGENT CONTEXT LAUNCH CHECKLIST|UNIVERSAL BLOCKER RECORD|UNIVERSAL CHANGE AND INVALIDATION LOG|EXACT FINAL RELEASE CHECKLIST|NEW-JOB RESET CHECKLIST|UNIVERSAL AGENT-OUTPUT RECEIPT)$/i.test(text)){
        el.hidden=true;
        el.setAttribute('aria-hidden','true');
      }
    });
  }

  function hideStandaloneAppendixDocument(){
    const headings=[...document.querySelectorAll('h1,h2,h3,h4')].filter(h=>APPENDIX_HEADING.test((h.textContent||'').trim()));
    headings.forEach(h=>{
      let node=h.closest('section,article,.card,.panel,details')||h.parentElement;
      if(node&&node.dataset.appendixReferenceHidden!=='true'){
        node.dataset.appendixReferenceHidden='true';
        node.hidden=true;
      }
    });
  }

  function findExistingControl(letter){
    const selectors=[
      `[data-record-letter="${letter}"]`,
      `[data-appendix="${letter}"]`,
      `[data-appendix-letter="${letter}"]`
    ];
    for(const selector of selectors){
      const match=document.querySelector(selector);
      if(match)return match.closest('details,section,article,.card,.panel,div')||match;
    }
    const all=[...document.querySelectorAll('summary,h1,h2,h3,h4,button,label,strong')];
    const rx=new RegExp(`(?:Appendix\\s+${letter}\\b|^${letter}\\s+)`,'i');
    const label=all.find(el=>rx.test((el.textContent||'').trim()));
    return label?.closest('details,section,article,.card,.panel,div')||null;
  }

  function stageHost(){
    const headings=[...document.querySelectorAll('h1,h2,h3,h4')];
    const h=headings.find(el=>/STAGE\s*0?\d{1,2}/i.test(el.textContent||''));
    return h?.closest('section,article,.card,.panel,main')||document.getElementById('content')||document.querySelector('main');
  }

  function createIntegratedPanel(stage){
    const host=stageHost();
    if(!host||host.querySelector(':scope > [data-integrated-operational-controls="true"]'))return;
    const letters=Object.keys(APPLICABILITY).filter(l=>APPLICABILITY[l].has(stage));
    if(!letters.length)return;
    const panel=document.createElement('section');
    panel.dataset.integratedOperationalControls='true';
    panel.className='card panel operational-controls';
    panel.style.marginTop='1rem';
    const h=document.createElement('h3');
    h.textContent='Operational controls';
    panel.appendChild(h);
    const p=document.createElement('p');
    p.className='muted';
    p.textContent='These are the Appendix A–F controls required by this stage. They create and preserve records in the same job; they are not additional stages.';
    panel.appendChild(p);

    letters.forEach(letter=>{
      const existing=findExistingControl(letter);
      const row=document.createElement('div');
      row.dataset.appendixControl=letter;
      row.style.margin='0.75rem 0';
      const title=document.createElement('strong');
      title.textContent=`${letter} — ${LABELS[letter]}`;
      row.appendChild(title);
      const button=document.createElement('button');
      button.type='button';
      button.textContent=ACTION_LABELS[letter];
      button.style.marginLeft='0.75rem';
      button.addEventListener('click',()=>{
        const target=findExistingControl(letter)||existing;
        if(target){
          target.hidden=false;
          target.removeAttribute('aria-hidden');
          if(target.tagName==='DETAILS')target.open=true;
          target.scrollIntoView({behavior:'smooth',block:'start'});
          const input=target.querySelector('textarea,input,select,button');
          if(input)requestAnimationFrame(()=>input.focus({preventScroll:true}));
        }
      });
      row.appendChild(button);
      panel.appendChild(row);
    });
    host.appendChild(panel);
  }

  function keepAppendixRecordsOperational(){
    document.querySelectorAll('textarea[data-record-letter]').forEach(textarea=>{
      textarea.removeAttribute('readonly');
      textarea.removeAttribute('aria-readonly');
      textarea.title='';
    });
  }

  function refine(){
    scheduled=false;
    hideDuplicateAppendixNavigation();
    hideStandaloneAppendixDocument();
    keepAppendixRecordsOperational();
    const stage=stageNumber();
    if(stage)createIntegratedPanel(stage);
  }
  function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(refine);}}
  new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-current','hidden']});
  queue();
})();
