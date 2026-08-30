import fs from 'node:fs';

{
  const path='prompt-engine.js';
  let text=fs.readFileSync(path,'utf8');
  const anchor='The accepted capture is the durable meaning-preserving handoff to every later stage, so the original intent file must not be repeatedly requested.';
  const required=anchor+' The application already owns JOB_ID and controlled input identity; do not assign, invent, or override them. EXACT_DELIVERABLE_REQUESTED must state the deliverable the human actually intends. Do not silently substitute a different deliverable; any substitute deliverable requires explicit human intent confirmation. Stage 01 is job definition and clarification only. Work only from authorized human job input and accessible supplied human-authority material. Limited intake inspection is Stage 01 job-definition work only when needed to extract human-authority statements relevant to defining the job. Do not classify, validate, rank, establish provenance for, or determine authority/currency/conflicts among supplied materials here; those are later-stage responsibilities.';
  if(text.includes(anchor)){
    const stage1Start=text.indexOf("1:'");
    const stage2Start=text.indexOf("\n2:'",stage1Start);
    const stage1=text.slice(stage1Start,stage2Start);
    if(!stage1.includes('The application already owns JOB_ID')||!stage1.includes('human intent confirmation')||!stage1.includes('job definition and clarification only'))text=text.slice(0,stage1Start)+stage1.replace(anchor,required)+text.slice(stage2Start);
  }
  const stage1Start=text.indexOf("1:'");
  const stage2Start=text.indexOf("\n2:'",stage1Start);
  const stage1=text.slice(stage1Start,stage2Start);
  for(const token of ['The application already owns JOB_ID','EXACT_DELIVERABLE_REQUESTED','human intent confirmation','job definition and clarification only','authorized human job input','Limited intake inspection is Stage 01 job-definition work','Do not classify, validate, rank, establish provenance for, or determine authority/currency/conflicts among supplied materials here'])if(!stage1.includes(token))throw new Error('Stage 01 required semantic boundary was not materialized: '+token);
  fs.writeFileSync(path,text);
}

{
  const path='workflow-schema.js';
  let text=fs.readFileSync(path,'utf8');
  const old="if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1,valueType:name==='INPUT_SET_CONTENTS'?'OBJECT':'STRING'});";
  const current="if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1,valueType:'STRING'});";
  if(text.includes(old))text=text.replace(old,current);
  if(!text.includes(current))throw new Error('INPUT_SET_CONTENTS string contract was not materialized.');
  fs.writeFileSync(path,text);
}

{
  const path='verify-intake-obligation-accounting.mjs';
  let text=fs.readFileSync(path,'utf8');
  const marker="assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Response schema is not /3.');";
  const assertion="assert(schema.JOB_FIELDS.INPUT_SET_CONTENTS.valueType==='STRING','INPUT_SET_CONTENTS must remain the Stage 01 agent-owned string capture contract.');";
  if(text.includes(marker)&&!text.includes(assertion))text=text.replace(marker,marker+'\n'+assertion);
  if(!text.includes(assertion)){
    const insertion="\nif(schema.JOB_FIELDS.INPUT_SET_CONTENTS.valueType!=='STRING')throw new Error('INPUT_SET_CONTENTS must remain the Stage 01 agent-owned string capture contract.');\n";
    const firstImportEnd=text.indexOf('\n\n');
    text=text.slice(0,firstImportEnd+2)+insertion+text.slice(firstImportEnd+2);
  }
  fs.writeFileSync(path,text);
}
