(()=>{
'use strict';
const REV='closed-loop-authority-20260824-r1';
const STORE='closed-loop-reliability-projects-v3';
const core=globalThis.closedLoopCore;
const safe=v=>Array.isArray(v)?v:[];
const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const label=k=>k.toLowerCase().replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const sourceValue=(r,k)=>text(r?.[k]??r?.fields?.[k]);
const exactForbiddenReference=/(?:sjonesjones917\/closed-loop-tracker|sjonesjones917\.github\.io\/closed-loop-tracker|(?:^|[\/\\])(?:TEST_PROJECT\.json|index\.html|app\.js|app-core\.js|workbook\.js|prompt-engine\.js|integrity-guard\.js|authority-guard\.js)(?:$|[?#]))/i;
function readProjects(){try{const v=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(v)?v:[];}catch{return [];}}
function selectedIndex(){const n=Number(document.querySelector('#project-picker')?.value);return Number.isInteger(n)&&n>=0?n:0;}
function currentProject(){const list=readProjects();return list[selectedIndex()]||list[0]||null;}
function validExternalSource(record){
  if(!record)return false;
  const cls=upper(sourceValue(record,'SOURCE_CLASS'));
  const independent=upper(sourceValue(record,'INDEPENDENT_EXTERNAL_AUTHORITY'));
  const relation=upper(sourceValue(record,'TARGET_PRODUCT_RELATIONSHIP'));
  const ref=[sourceValue(record,'REFERENCE'),sourceValue(record,'PUBLICATION_ORIGIN'),sourceValue(record,'ORIGIN')].join(' ');
  return cls==='EXTERNAL GOVERNING SOURCE'&&independent==='TRUE'&&relation==='INDEPENDENT EXTERNAL AUTHORITY'&&!exactForbiddenReference.test(ref);
}
function sourceById(id){return safe(currentProject()?.projectData?.sources).find(r=>text(r.id||sourceValue(r,'SOURCE_ID'))===text(id));}
function field(collection,name){return document.querySelector(`[data-record-collection="${collection}"][data-record-field="${name}"]`);}
function value(collection,name){return text(field(collection,name)?.value);}
function addField(form,collection,name,kind='input',options=[]){
  if(field(collection,name))return;
  const wrap=document.createElement('div');wrap.className='field full authority-added-field';
  const lab=document.createElement('label');lab.textContent=label(name);wrap.append(lab);
  let control;
  if(kind==='select'){
    control=document.createElement('select');
    for(const option of options){const el=document.createElement('option');el.value=option;el.textContent=option;control.append(el);}
  }else if(kind==='textarea')control=document.createElement('textarea');
  else control=document.createElement('input');
  control.dataset.recordCollection=collection;control.dataset.recordField=name;control.autocomplete='off';wrap.append(control);form.append(wrap);
}
const additions={
  sources:[
    ['SOURCE_CLASS','select',['UNKNOWN','EXTERNAL GOVERNING SOURCE']],
    ['TITLE','input'],['ISSUING_ORGANIZATION_OR_AUTHOR','input'],['PUBLICATION_ORIGIN','input'],
    ['PUBLICATION_OR_UPDATE_DATE','input'],['RETRIEVAL_DATE','input'],['RELEVANCE','textarea'],
    ['APPLICABLE_PORTIONS','textarea'],['SUPERSESSION_STATUS','input'],
    ['INDEPENDENT_EXTERNAL_AUTHORITY','select',['UNKNOWN','TRUE','FALSE']],
    ['TARGET_PRODUCT_RELATIONSHIP','select',['UNKNOWN','INDEPENDENT EXTERNAL AUTHORITY','TARGET PRODUCT','CURRENT APPLICATION','REPOSITORY / IMPLEMENTATION','PROJECT ARTIFACT','USER JOB INPUT','SUPPLIED MATERIAL']]
  ],
  sourceConflicts:[['CONFLICTING_PROPOSITION','textarea'],['SOURCE_A_AUTHORITY','input'],['SOURCE_B_AUTHORITY','input'],['CONTROLLING_SOURCE_OBJECTIVELY_ESTABLISHED','select',['UNKNOWN','TRUE','FALSE']]],
  research:[['OPTIONAL_PRACTICES','textarea'],['EXAMPLES','textarea'],['FINDING_CLASSIFICATION','input'],['CANDIDATE_REQUIREMENT_IDS','textarea']],
  requirements:[['USER_INPUT_RELATIONSHIP','textarea']],
  defects:[['DATE','input'],['JOB_ID','input'],['ITERATION_ID','input'],['REG_ID','input'],['ROOT_CAUSE_CATEGORY','input'],['ROOT_CAUSE','textarea'],['CORRECTION','textarea'],['CHANGED_ARTIFACTS','textarea'],['VERIFICATION_RESULT','input'],['RELATIONSHIPS','textarea']],
  regressions:[['PERMANENT_TEST_LOCATION','input'],['RETIREMENT_AUTHORITY','textarea']]
};
function enhanceForms(){
  for(const [collection,defs] of Object.entries(additions)){
    const first=document.querySelector(`[data-record-collection="${collection}"]`);if(!first)continue;
    const form=first.closest('.structured-record-form');if(!form)continue;
    for(const [name,kind,options] of defs)addField(form,collection,name,kind,options||[]);
    if(collection==='sources'){
      const body=form.closest('.record-body');
      if(body&&!body.querySelector('.external-source-boundary')){
        const note=document.createElement('div');note.className='notice external-source-boundary';note.innerHTML='<strong>External governing sources only.</strong> Stage 02 records independent external authority. User Job Input and Supplied Material keep their original roles. The target product, this application, this repository, its files/UI/data/tests, prior versions, screenshots, and project-generated artifacts cannot receive a SOURCE_ID or establish what the target product ought to do.';
        body.insertBefore(note,form);
      }
    }
  }
}
function preserveRejectedSource(reason,event){
  event.preventDefault();event.stopImmediatePropagation();
  const list=readProjects(),index=selectedIndex(),project=list[index]||list[0];
  if(project){
    const data=project.projectData||(project.projectData={}),history=data.history||(data.history=[]),id=value('sources','SOURCE_ID');
    history.push({eventId:`EVENT-${Date.now()}`,createdAt:new Date().toISOString(),stage:2,type:'SOURCE_CLASSIFICATION_REJECTED',attemptedIdentifier:id||'UNKNOWN',reason});
    localStorage.setItem(STORE,JSON.stringify(list));
  }
  const note=document.querySelector('.external-source-boundary');if(note)note.innerHTML=`<strong>Source not accepted.</strong> ${reason}`;
  console.warn(`Stage 02 source rejected: ${reason}`);
}
function validateSourceDraft(event){
  const baseRequired=['SOURCE_ID','TYPE','ORIGIN','REFERENCE','INSPECTION_STATE','CURRENCY_STATE','CONTROLLING_STATUS'];
  if(baseRequired.some(name=>!value('sources',name)))return;
  const cls=upper(value('sources','SOURCE_CLASS'));
  const independent=upper(value('sources','INDEPENDENT_EXTERNAL_AUTHORITY'));
  const relation=upper(value('sources','TARGET_PRODUCT_RELATIONSHIP'));
  const ref=[value('sources','REFERENCE'),value('sources','PUBLICATION_ORIGIN'),value('sources','ORIGIN')].join(' ');
  if(cls!=='EXTERNAL GOVERNING SOURCE')return preserveRejectedSource('SOURCE_ID records are only for independent External Governing Sources. User Job Input and Supplied Material must retain their own roles.',event);
  if(independent!=='TRUE'||relation!=='INDEPENDENT EXTERNAL AUTHORITY')return preserveRejectedSource('The source was not affirmatively established as independent external authority outside the target product and project.',event);
  if(exactForbiddenReference.test(ref))return preserveRejectedSource('Circular authority is prohibited: the current application, repository, implementation files, retained project, and target-product artifacts cannot be Stage 02 governing sources.',event);
}
function validateDownstreamSourceLink(collection,event){
  const id=value(collection,'SOURCE_ID');if(!id)return;
  const record=sourceById(id);
  if(!validExternalSource(record)){event.preventDefault();event.stopImmediatePropagation();alert(`${collection==='requirements'?'Requirement':'Research'} source rejected. SOURCE_ID must resolve to a valid independent External Governing Source established in Stage 02.`);}
}
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-add-record]');if(!button)return;
  const collection=button.dataset.addRecord;
  if(collection==='sources')validateSourceDraft(event);
  else if(collection==='research'||collection==='candidateRequirements'||collection==='requirements')validateDownstreamSourceLink(collection,event);
},true);
function wrapPromptEngine(){
  if(!core||typeof core.buildStagePrompt!=='function'||core.buildStagePrompt.__authorityGuard)return;
  const original=core.buildStagePrompt;
  function wrapped(stage,state){
    let prompt=original(stage,state);
    prompt=prompt.replace('KNOWN GOVERNING SOURCES:\n','USER-SUPPLIED KNOWN AUTHORITY CLAIMS (not automatically independent external authority):\n');
    if(Number(stage?.number)===2){
      const marker='STAGE-SPECIFIC TASK\n',end='\n\nCURRENT STAGE RECORD';
      const start=prompt.indexOf(marker),finish=prompt.indexOf(end,start+marker.length);
      const task='Build SOURCE-SET-vN exclusively from independent External Governing Sources outside the project and outside the target product. Research source identity, provenance, currency, relevance, authority, and applicable portions before relying on it. User Job Input controls scope and intent but is not automatically an independent external authority. Supplied Material must retain its actual role and may receive a SOURCE_ID only if it is independently authoritative in its own right and is external to the target product. Categorically exclude the target product, this operating application, this repository, its source code/UI/schema/data/tests/screenshots, previous target versions, prior generated targets, project outputs, generated prompts/instructions, and existing project records. For every accepted source record SOURCE_CLASS=EXTERNAL GOVERNING SOURCE, INDEPENDENT_EXTERNAL_AUTHORITY=TRUE, and TARGET_PRODUCT_RELATIONSHIP=INDEPENDENT EXTERNAL AUTHORITY. Assign stable SOURCE_ID values, establish the explicit authority hierarchy, and create source-conflict records. Never silently resolve an unsupported authority conflict. Do not perform Stage 03 requirements research and do not derive or fabricate requirements.';
      if(start>=0&&finish>start)prompt=prompt.slice(0,start+marker.length)+task+prompt.slice(finish);
      prompt=prompt.replace('AUTHORIZED INPUTS FOR THIS STAGE\n','SOURCE AUTHORITY BOUNDARY\nPrior-stage records, User Job Input, Supplied Material, and project artifacts are context only; their presence does not make them Stage 02 governing sources.\n\nAUTHORIZED INPUTS FOR THIS STAGE\n');
    }
    if(Number(stage?.number)===3)prompt=prompt.replace('STAGE-SPECIFIC TASK\n','STAGE-SPECIFIC TASK\nResearch only SOURCE_ID records legitimately established as independent External Governing Sources in Stage 02. Do not research the target product, operating application, repository, prior implementation, or project-generated artifacts as requirement authority.\n\n');
    return prompt;
  }
  wrapped.__authorityGuard=REV;core.buildStagePrompt=wrapped;
}
globalThis.closedLoopAuthorityGuard={revision:REV,validExternalSource};
wrapPromptEngine();enhanceForms();
new MutationObserver(()=>enhanceForms()).observe(document.documentElement,{childList:true,subtree:true});
})();
