import fs from 'node:fs';

function replaceExact(path, from, to, expected=1){
  let source=fs.readFileSync(path,'utf8');
  const count=source.split(from).length-1;
  if(count!==expected)throw new Error(`${path}: expected ${expected} occurrence(s) of ${JSON.stringify(from)}; found ${count}.`);
  source=source.split(from).join(to);
  fs.writeFileSync(path,source);
}

// Preserve the already-proven current-main corrections carried by this repair branch.
{
  const path='workflow-engine.js';
  let source=fs.readFileSync(path,'utf8');
  for(const [from,to] of [
    ["CURRENT_SOURCE_SET_VERSION='NOT APPLICABLE'","CURRENT_SOURCE_SET_VERSION=null"],
    ['deliveryRecords:27,deploymentManifests:1','deliveryRecords:30,deploymentManifests:1']
  ]){
    const count=source.split(from).length-1;
    if(count===1)source=source.replace(from,to);
    else if(!source.includes(to))throw new Error(`${path}: neither old nor repaired ratchet target exists for ${from}.`);
  }
  fs.writeFileSync(path,source);
}

// Controlling Stage 01 raw-unit accounting contract.
replaceExact(
  'workflow-engine.js',
  "const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['incorporated into the job definition','retained as context','unresolved human-only','later-resolvable','inapplicable with reason']);",
  "const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);"
);
replaceExact(
  'workflow-engine.js',
  "const disposition=String(unit?.disposition||'').trim().toLowerCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);if(disposition==='inapplicable with reason'&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires an inapplicability reason.`);\n    const statements=safe(unit?.extractedStatements);if(disposition!=='inapplicable with reason'&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;",
  "const disposition=String(unit?.disposition||'').trim().toUpperCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);const noStatementDisposition=['NO_PROJECT_RELEVANT_INFORMATION','INACCESSIBLE_OR_BLOCKED'].includes(disposition);if(noStatementDisposition&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires a reason for ${disposition}.`);if(disposition==='INACCESSIBLE_OR_BLOCKED')reasons.push(`Stage 01 intake unit ${id} is inaccessible or blocked and cannot satisfy Stage 01 completion.`);\n    const statements=safe(unit?.extractedStatements);if(!noStatementDisposition&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;"
);
replaceExact(
  'workflow-engine.js',
  "if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(disposition==='inapplicable with reason'?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);",
  "if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(noStatementDisposition?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);"
);
replaceExact(
  'workflow-engine.js',
  "version:'closed-loop-workflow-engine/1',STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,ACTION_TYPES,",
  "version:'closed-loop-workflow-engine/1',STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,ACTION_TYPES,INTAKE_ACCOUNTING_DISPOSITIONS,"
);

// Publish the exact closed contract through the sole prompt authority.
replaceExact(
  'prompt-engine.js',
  'Classify every APPLICATION INTAKE MANIFEST unit exactly once.',
  'Classify every APPLICATION INTAKE MANIFEST unit exactly once using only these exact dispositions: EXTRACTED_RELEVANT_INFORMATION, RETAINED_AS_CONTEXT, NO_PROJECT_RELEVANT_INFORMATION, UNRESOLVED_HUMAN_AUTHORITY, LATER_RESOLVABLE, INACCESSIBLE_OR_BLOCKED. NO_PROJECT_RELEVANT_INFORMATION and INACCESSIBLE_OR_BLOCKED require an explicit reason; INACCESSIBLE_OR_BLOCKED cannot satisfy Stage 01 completion. Do not emit retired or synonymous disposition text.'
);

// Update controlled synthetic fixtures that encoded the retired vocabulary.
const fixtureFiles=fs.readdirSync('.').filter(name=>/^verify.*\.mjs$/.test(name));
const replacements=[
  ['incorporated into the job definition','EXTRACTED_RELEVANT_INFORMATION'],
  ['retained as context','RETAINED_AS_CONTEXT'],
  ['unresolved human-only','UNRESOLVED_HUMAN_AUTHORITY'],
  ['later-resolvable','LATER_RESOLVABLE'],
  ['inapplicable with reason','NO_PROJECT_RELEVANT_INFORMATION']
];
for(const path of fixtureFiles){
  let source=fs.readFileSync(path,'utf8'),changed=false;
  for(const [from,to] of replacements){
    if(source.includes(from)){source=source.split(from).join(to);changed=true;}
  }
  if(changed)fs.writeFileSync(path,source);
}

const verifier=`import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport vm from 'node:vm';\nimport { webcrypto } from 'node:crypto';\n\nconst context={console,TextEncoder,TextDecoder,URL,URLSearchParams,crypto:webcrypto,dispatchEvent(){},Event:function Event(type){this.type=type}};context.globalThis=context;vm.createContext(context);for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});\nconst engine=context.closedLoopWorkflowEngine,prompt=context.closedLoopPromptEngine,core=context.closedLoopCore;\nconst expected=['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED'];\nassert.deepEqual(Array.from(engine.INTAKE_ACCOUNTING_DISPOSITIONS),expected,'Stage 01 must expose the exact six-value disposition contract.');\nconst p=core.createBlankState('JOB-STAGE01-DISPOSITIONS');engine.ensureShape(p);p.job.EXACT_USER_OBJECTIVE_VERBATIM='Build the requested artifact.';p.job.CURRENT_INPUT_VERSION='INPUT-V1';const manifest=engine.intakeCoverageManifest(p);assert(manifest.unitCount>0,'Fixture must expose at least one raw input unit.');const unit=manifest.units[0];\nfunction capture(disposition,extra={}){return JSON.stringify({inputVersion:'INPUT-V1',units:[{sourceUnitId:unit.sourceUnitId,sourceRawValueSha256:unit.rawValueSha256,disposition,extractedStatements:[{statementKey:'S1',text:'Build the requested artifact.',statementClass:'REQUIREMENT'}],...extra}]});}\nassert.equal(engine.evaluateIntakeAccounting(p,{capture:capture('EXTRACTED_RELEVANT_INFORMATION')}).complete,true);\nassert.equal(engine.evaluateIntakeAccounting(p,{capture:capture('incorporated into the job definition')}).complete,false,'Retired disposition text must be rejected.');\nassert.equal(engine.evaluateIntakeAccounting(p,{capture:capture('NO_PROJECT_RELEVANT_INFORMATION',{reason:'No project-relevant information.',extractedStatements:[]})}).complete,true);\nconst blocked=engine.evaluateIntakeAccounting(p,{capture:capture('INACCESSIBLE_OR_BLOCKED',{reason:'Semantic bytes inaccessible.',extractedStatements:[]})});assert.equal(blocked.complete,false);assert(blocked.reasons.some(x=>/inaccessible or blocked/i.test(x)));\nconst generated=prompt.generate(p,1,'COMPLETE');const body=String(generated?.body||generated?.text||generated?.prompt||generated||'');for(const value of expected)assert(body.includes(value),'Stage 01 prompt must publish '+value);\nconsole.log(JSON.stringify({stage01DispositionContract:'PASS',values:expected.length,legacyRejected:true,inaccessibleBlocks:true}));\n`;
fs.writeFileSync('verify-stage01-disposition-contract.mjs',verifier);

// Make the regression permanent in the complete source proof.
{
  const path='verify-complete.mjs';
  let source=fs.readFileSync(path,'utf8');
  const line="await import('./verify-stage01-disposition-contract.mjs');";
  if(!source.includes(line))source += `\n${line}\n`;
  fs.writeFileSync(path,source);
}

// Remove one-time repair scaffolding before the workflow commits this ratchet step.
{
  const path='.github/workflows/pages.yml';
  let source=fs.readFileSync(path,'utf8');
  source=source.replace('  contents: write\n','  contents: read\n');
  source=source.replace(/\n      - name: Apply one-time due-stage repair\n        if: github\.event_name == 'pull_request' && github\.head_ref == 'repair\/due-stage-proof-20260903-r1'\n        run: \|\n(?:          .*\n)+?(?=\n      - name: Capture exact PR source workspace)/,'\n');
  fs.writeFileSync(path,source);
}
fs.unlinkSync('repair-due-stage.mjs');
console.log(JSON.stringify({ratchetRepair:'STAGE01_CONTROLLING_DISPOSITIONS_APPLIED',scaffoldingRemoved:true}));
