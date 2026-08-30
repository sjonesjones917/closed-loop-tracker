import fs from 'node:fs';

{
  const path='prompt-engine.js';
  let text=fs.readFileSync(path,'utf8');
  const anchor='The accepted capture is the durable meaning-preserving handoff to every later stage, so the original intent file must not be repeatedly requested.';
  const required=anchor+' The application already owns JOB_ID and controlled input identity; do not assign, invent, or override them. EXACT_DELIVERABLE_REQUESTED must state the deliverable the human actually intends. Do not silently substitute a different deliverable; any substitute deliverable requires explicit human intent confirmation. Stage 01 is job definition and clarification only. Work only from authorized human job input and accessible supplied human-authority material. Inspect accessible supplied materials deeply enough to extract every human-authority statement relevant to defining the job, and do not ask the human to re-enter facts that are already present in those materials; extract, preserve, and reuse those facts instead. Do not enumerate archive entries, internal file counts, directory trees, hashes, workbook rows, or other implementation inventory merely because a supplied artifact is accessible. Do not turn Stage 01 inspection into a Stage 02 archive/file inventory. Limited intake inspection is Stage 01 job-definition work only when needed to extract human-authority statements relevant to defining the job. Do not classify, validate, rank, establish provenance for, or determine authority/currency/conflicts among supplied materials here; those are later-stage responsibilities. Do not block Stage 01 merely because information will be needed by a later stage when that information can be established from supplied material, authorized research, or the later stage. Stage 01 does not require every fact needed to execute later stages; it requires complete human authority for defining the requested outcome. Stage 01 also owns proactive human intake: before finalizing Stage 01, derive from the actual request and accessible supplied materials every foreseeable human-only fact or decision necessary to define the requested outcome. Ask BLOCKING_NOW and ASK_NOW_NONBLOCKING human-only issues now, allow explicit unknown or deferred answers for nonblocking issues, and classify facts resolvable from material, research, or later work as LATER_RESOLVABLE instead of making the human repeat or research them. The generic intake algorithm must derive subject-specific questions from the actual project rather than from hard-coded project-subject branches.';
  if(text.includes(anchor)){
    const stage1Start=text.indexOf("1:'");
    const stage2Start=text.indexOf("\n2:'",stage1Start);
    const stage1=text.slice(stage1Start,stage2Start);
    if(!stage1.includes('Do not enumerate archive entries, internal file counts, directory trees, hashes, workbook rows')||!stage1.includes('do not ask the human to re-enter facts that are already present in those materials')||!stage1.includes('The application already owns JOB_ID')||!stage1.includes('human intent confirmation')||!stage1.includes('job definition and clarification only'))text=text.slice(0,stage1Start)+stage1.replace(anchor,required)+text.slice(stage2Start);
  }
  const stage1Start=text.indexOf("1:'");
  const stage2Start=text.indexOf("\n2:'",stage1Start);
  const stage1=text.slice(stage1Start,stage2Start);
  for(const token of ['The application already owns JOB_ID','EXACT_DELIVERABLE_REQUESTED','human intent confirmation','job definition and clarification only','authorized human job input','do not ask the human to re-enter facts that are already present in those materials','Do not enumerate archive entries, internal file counts, directory trees, hashes, workbook rows','Do not turn Stage 01 inspection into a Stage 02 archive/file inventory','Limited intake inspection is Stage 01 job-definition work','Do not classify, validate, rank, establish provenance for, or determine authority/currency/conflicts among supplied materials here','Do not block Stage 01 merely because information will be needed by a later stage','Stage 01 does not require every fact needed to execute later stages','Stage 01 also owns proactive human intake','BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','hard-coded project-subject branches'])if(!stage1.includes(token))throw new Error('Stage 01 required semantic boundary was not materialized: '+token);
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
  const path='verify-v3-contract.mjs';
  let text=fs.readFileSync(path,'utf8');
  const marker="assert.match(schema,/closed-loop-verification-package\\/1/,'verification-package schema /1 is required');";
  const assertion="assert.match(schema,/if\\(AGENT_JOB_FIELDS\\.includes\\(name\\)\\)return field\\(name,PRODUCER\\.AGENT,\\{requiredAtStage:1,valueType:'STRING'\\}\\);/,'Stage 01 agent job fields, including INPUT_SET_CONTENTS, must remain string-valued');";
  if(text.includes(marker)&&!text.includes(assertion))text=text.replace(marker,marker+'\n'+assertion);
  if(!text.includes(assertion))throw new Error('Could not install permanent INPUT_SET_CONTENTS string-contract regression.');
  fs.writeFileSync(path,text);
}

{
  const path='verify-prompt-semantics.mjs';
  let text=fs.readFileSync(path,'utf8');
  const old=` const required=[\n  'do not ask the human to re-enter facts that are already present in those materials',\n  'Do not block Stage 01 merely because information will be needed by a later',\n  'Stage 01 does not require every fact needed to execute later stages',\n  'A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01',\n  'Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers',\n  'Stage 01 also owns proactive human intake: before finalizing Stage 01, collect the human-specific facts and decisions that are already foreseeable as necessary to achieve the requested outcome',\n  'humanInputRequestContract',\n  'temporaryKey',\n  'whyRequired',\n  'affectedStageFields',\n  'answerType',\n  'allowedValues',\n  'Do not invent requestKey, required, whyNeeded, expectedAnswer'\n ];`;
  const replacement=` const required=[\n  'do not ask the human to re-enter facts that are already present in those materials',\n  'Do not block Stage 01 merely because information will be needed by a later stage',\n  'Stage 01 does not require every fact needed to execute later stages',\n  'derive from the actual request and accessible supplied materials every foreseeable human-only fact or decision necessary to define the requested outcome',\n  'BLOCKING_NOW',\n  'ASK_NOW_NONBLOCKING',\n  'LATER_RESOLVABLE',\n  'generic intake algorithm must derive subject-specific questions from the actual project rather than from hard-coded project-subject branches',\n  'humanInputRequestContract',\n  'temporaryKey',\n  'whyRequired',\n  'affectedStageFields',\n  'answerType',\n  'allowedValues',\n  'Do not invent requestKey, required, whyNeeded, expectedAnswer'\n ];`;
  if(text.includes(old))text=text.replace(old,replacement);
  else if(text.includes('A request such as "prepare a patent application for this project" is sufficient'))throw new Error('Could not replace obsolete subject-specific Stage 01 practical prompt assertions.');
  if(text.includes('Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers'))throw new Error('Subject-specific Stage 01 practical prompt assertion remains.');
  fs.writeFileSync(path,text);
}
