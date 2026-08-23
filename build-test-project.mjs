import fs from 'node:fs';

const appPath='app.js';

const recordsFunction=`function records(){const d=current.projectData,full=d.fullProject||{},groups=[['Original user-entered data',d.userEntered],['Supporting control records',current.appendices],['Stage records',d.stageRecords],['Generated instructions',d.generatedPrompts],['Generated outputs',d.generatedOutputs],['Output receipts',d.outputReceipts],['Sources',d.sources],['Source conflicts',d.sourceConflicts],['Research',d.research],['Candidate requirements',d.candidateRequirements],['Requirements',d.requirements],['Tests',d.tests],['Failure tests',d.failureTests],['Production instructions',d.instructions],['Instruction reviews',d.preflightRecords],['Fresh contexts',d.freshContexts],['Candidate freezes',d.candidateFreezes],['Iterations',d.iterations],['Run records',d.runs],['Verification records',d.verification],['Cross-run comparisons',d.comparisons],['Defects',d.defects],['Root causes',d.rootCauses],['Regressions',d.regressions],['Changes',d.changes],['Blockers',d.blockers],['Baselines',d.baselines],['Products',d.products],['Deterministic verification',d.deterministicResults],['Independent meaning review',d.meaningResults],['Adversarial review',d.adversarialResults],['Representation inspections',d.representationInspections],['Process reviews',d.processAudits],['Product reviews',d.productAudits],['Independent reviews',d.reviews],['Release records',d.releaseRecords],['Artifact identity records',d.artifactIdentities],['Evidence chains',d.evidenceChains],['Permanent registry',d.permanentRegistry],['New-job initialization',current.appendices.E.records],['History',d.history],['Candidate freeze',full.candidateFreeze],['Convergence',full.convergence],['Unchanged confirmation',full.confirmation],['Production baseline',full.baseline],['Finished product',full.product],['Deterministic product results',full.deterministicResults],['Independent meaning results',full.meaningResults],['Adversarial results',full.adversarialResults],['Final representation',full.representation],['Process and product reconciliation',full.reconciliation],['Release gate',full.releaseGate],['Artifact identity',full.artifactIdentity],['Complete stored project (advanced)',full],['Recovered original projects',d.recoveredProjects]];return \`<div class="panel"><h2 class="section-title">Complete project record</h2><p class="section-intro">All user-entered data, generated instructions, generated outputs, stage records, runs, evidence, decisions, release records, and retained failures are available here.</p><div class="record-stack">\${groups.filter(([,v])=>v&&(!(Array.isArray(v))||v.length)&&(!(typeof v==='object'&&!Array.isArray(v))||Object.keys(v).length)).map(([n,v])=>details(n,v)).join('')}</div></div>\`;}`;

function cleanGeneratedController(source,{removeStructuredPrelude=false}={}){
  if(removeStructuredPrelude)source=source.replace(/const stageRecordText=[\s\S]*?(?=function save\(\)\{)/m,'');

  const helperStart='function syncStageRecordFromForm(n){';
  const preserveStart='async function preserveStage(n,prompt){';
  const first=source.indexOf(helperStart);
  const preserve=first>=0?source.indexOf(preserveStart,first):-1;
  if(first>=0&&preserve>first){
    const section=source.slice(first,preserve);
    const second=section.indexOf(helperStart,helperStart.length);
    if(second>=0)source=source.slice(0,first)+section.slice(0,second)+source.slice(preserve);
  }

  const recordsStart=source.indexOf('function records(){');
  const filesStart=recordsStart>=0?source.indexOf('function files(){',recordsStart):-1;
  if(recordsStart>=0&&filesStart>recordsStart)source=source.slice(0,recordsStart)+recordsFunction+'\n'+source.slice(filesStart);

  return source;
}

let app=fs.readFileSync(appPath,'utf8');
fs.writeFileSync(appPath,cleanGeneratedController(app,{removeStructuredPrelude:true}));
await import(`./build-test-project-impl.mjs?run=${Date.now()}`);
app=cleanGeneratedController(fs.readFileSync(appPath,'utf8'));
fs.writeFileSync(appPath,app);

for(const name of ['syncStageRecordFromForm','savePromptRecord','recordOutputRecord','records']){
  const count=(app.match(new RegExp(`(?:function|async function) ${name}\\(`,'g'))||[]).length;
  if(count!==1)throw new Error(`Expected one ${name} declaration, found ${count}.`);
}
for(const label of ['Baselines','Products','Deterministic verification','Independent meaning review','Adversarial review','Representation inspections','Process reviews','Product reviews','Artifact identity records']){
  const count=(app.match(new RegExp(`\\['${label.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}'`,'g'))||[]).length;
  if(count!==1)throw new Error(`Records group ${label} appears ${count} times.`);
}
