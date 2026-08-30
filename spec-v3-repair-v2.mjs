import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const filePath=file=>path.join(root,file);
const read=file=>fs.readFileSync(filePath(file),'utf8');
const write=(file,content)=>fs.writeFileSync(filePath(file),content.endsWith('\n')?content:content+'\n');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const replaceOne=(source,from,to,label)=>{
  const count=source.split(from).length-1;
  assert(count===1,'Expected exactly one '+label+'; found '+count+'.');
  return source.replace(from,to);
};

function replaceCurrentVersions(){
  let workbook=read('workbook.js');
  workbook=replaceOne(workbook,"const PROJECT_SCHEMA='closed-loop-project/2';","const PROJECT_SCHEMA='closed-loop-project/3';",'project schema declaration');
  write('workbook.js',workbook);

  let schema=read('workflow-schema.js');
  schema=replaceOne(schema,"const RESPONSE_SCHEMA='closed-loop-stage-response/2';","const RESPONSE_SCHEMA='closed-loop-stage-response/3';",'response schema declaration');
  write('workflow-schema.js',schema);

  const rootFiles=fs.readdirSync(root).filter(file=>/^(README\.md|TEST_PROJECT\.json|build-test-project.*\.mjs|test-fixtures\.mjs|verify.*\.mjs)$/.test(file));
  for(const file of rootFiles){
    let source=read(file);
    source=source.replaceAll('closed-loop-project/2','closed-loop-project/3');
    source=source.replaceAll('closed-loop-stage-response/2','closed-loop-stage-response/3');
    write(file,source);
  }
  for(const file of ['prompt-engine.js','response-ingestion.js','workflow-engine.js','app-core.js','index.html']){
    let source=read(file);
    source=source.replaceAll('closed-loop-stage-response/2','closed-loop-stage-response/3');
    write(file,source);
  }
}

function repairJobOwnership(){
  let source=read('workflow-schema.js');
  source=replaceOne(source,
`const HUMAN_JOB_FIELDS=Object.freeze([
  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',`,
`const HUMAN_JOB_FIELDS=Object.freeze([
  'EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',`,
'legacy HUMAN title/owner partition');
  const applicationMarker='const APPLICATION_JOB_FIELDS=Object.freeze([';
  assert(source.includes(applicationMarker),'Application job partition not found.');
  source=source.replace(applicationMarker,"const HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);\n"+applicationMarker);
  source=replaceOne(source,
`  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});`,
`  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{provenanceRequired:false,nullable:true});
  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});`,
'job field authority branch');
  source=replaceOne(source,
'[...new Set([...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])]',
'[...new Set([...HUMAN_DECISION_JOB_FIELDS,...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])]',
'complete job field union');
  write('workflow-schema.js',source);
}

function replaceArrayAfter(source,startIndex,newLiteral,label){
  const open=source.indexOf('[',startIndex);
  assert(open>=0,'Missing array for '+label+'.');
  let depth=0,quote=null,escape=false,close=-1;
  for(let index=open;index<source.length;index++){
    const character=source[index];
    if(quote){if(escape)escape=false;else if(character==='\\')escape=true;else if(character===quote)quote=null;continue;}
    if(character==='"'||character==="'"){quote=character;continue;}
    if(character==='[')depth++;
    else if(character===']'&&--depth===0){close=index;break;}
  }
  assert(close>open,'Unclosed array for '+label+'.');
  return source.slice(0,open)+newLiteral+source.slice(close+1);
}

function repairTestContract(){
  let source=read('workflow-schema.js');
  const ownershipStart=source.indexOf('  "tests": {'),ownershipEnd=source.indexOf('  "failureTests": {',ownershipStart);
  assert(ownershipStart>=0&&ownershipEnd>ownershipStart,'Tests ownership block not found.');
  let block=source.slice(ownershipStart,ownershipEnd);
  block=block.replace(/\n\s*"EXECUTABLE_SPEC_VERSION",?/,'');
  const applicationIndex=block.indexOf('"application": [');
  assert(applicationIndex>=0,'Tests application ownership partition not found.');
  if(!block.slice(applicationIndex).includes('"EXECUTABLE_SPEC_VERSION"')){
    block=block.replace(/("application"\s*:\s*\[\s*"TEST_ID",)/,'$1\n      "EXECUTABLE_SPEC_VERSION",');
  }
  source=source.slice(0,ownershipStart)+block+source.slice(ownershipEnd);

  const kindIndex=source.indexOf('EXECUTABLE_KIND',ownershipEnd);
  assert(kindIndex>=0,'EXECUTABLE_KIND field definition not found.');
  const enumIndex=source.indexOf('enumValues',kindIndex);
  assert(enumIndex>=0&&enumIndex-kindIndex<1200,'EXECUTABLE_KIND enum not found near its definition.');
  source=replaceArrayAfter(source,enumIndex,"['NONE','TEST_IR']",'EXECUTABLE_KIND enum');
  write('workflow-schema.js',source);

  for(const file of ['workflow-engine.js','prompt-engine.js','response-ingestion.js','app-core.js']){
    let text=read(file);
    text=text.replace(/(EXECUTABLE_KIND\s*[:=]\s*["'])CLOSED_LOOP_TEST_IR(["'])/g,'$1TEST_IR$2');
    text=text.replace(/(["']EXECUTABLE_KIND["']\s*:\s*["'])CLOSED_LOOP_TEST_IR(["'])/g,'$1TEST_IR$2');
    write(file,text);
  }
  for(const file of fs.readdirSync(root).filter(file=>/^(TEST_PROJECT\.json|build-test-project.*\.mjs|test-fixtures\.mjs|verify.*\.mjs)$/.test(file))){
    let text=read(file);
    text=text.replace(/(EXECUTABLE_KIND["']?\s*[:=]\s*["'])CLOSED_LOOP_TEST_IR(["'])/g,'$1TEST_IR$2');
    text=text.replace(/(["']EXECUTABLE_KIND["']\s*:\s*["'])CLOSED_LOOP_TEST_IR(["'])/g,'$1TEST_IR$2');
    write(file,text);
  }
}

function containingFunction(source,needleIndex){
  const candidates=[];
  const patterns=[
    /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>\s*\{/g
  ];
  for(const pattern of patterns){
    let match;
    while((match=pattern.exec(source))&&match.index<needleIndex){
      const open=source.indexOf('{',match.index);let depth=0,quote=null,escape=false,close=-1;
      for(let index=open;index<source.length;index++){
        const character=source[index];
        if(quote){if(escape)escape=false;else if(character==='\\')escape=true;else if(character===quote)quote=null;continue;}
        if(character==='"'||character==="'"||character==='`'){quote=character;continue;}
        if(character==='{')depth++;
        else if(character==='}'&&--depth===0){close=index+1;break;}
      }
      if(close>needleIndex){
        const rawArgs=match[2]||'';
        candidates.push({name:match[1],args:rawArgs.split(',').map(value=>value.trim()).filter(Boolean),bodyStart:open+1,close});
      }
    }
  }
  return candidates.sort((left,right)=>(left.close-left.bodyStart)-(right.close-right.bodyStart))[0]||null;
}

function addV2Migration(){
  const candidateFiles=['project-store.js','workflow-engine.js','workbook.js'];
  let targetFile=null,source=null,needleIndex=-1,fn=null;
  for(const file of candidateFiles){
    const text=read(file),index=text.indexOf('human-project/30');
    if(index<0)continue;
    const candidate=containingFunction(text,index);
    if(candidate){targetFile=file;source=text;needleIndex=index;fn=candidate;break;}
  }
  assert(targetFile&&fn&&fn.args.length,'Could not locate the existing legacy migration function.');
  const argument=fn.args[0].replace(/=.*/,'').trim();
  const helper=`
function migrateClosedLoopProjectV2ToV3(inputProject){
  const deepClone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
  const original=deepClone(inputProject),migrated=deepClone(inputProject);
  migrated.schema='closed-loop-project/3';
  migrated.workflowId='mobile-closed-loop/30';
  const projectData=migrated.projectData||(migrated.projectData={});
  const migrationId='MIGRATION-V2-V3-'+String(migrated.job?.JOB_ID||migrated.jobId||'PROJECT');
  const historicalize=value=>Array.isArray(value)?value.map(item=>{
    if(!item||typeof item!=='object')return item;
    const responseSchema=String(item.schema||item.envelope?.schema||item.responseSchema||'');
    if(responseSchema!=='closed-loop-stage-response/2')return item;
    return {...item,historicalOnly:true,invalidatedBy:item.invalidatedBy||migrationId,status:item.status==='PENDING'?'STALE':item.status};
  }):value;
  for(const key of ['generatedPrompts','pendingProposals','responseProposals','proposalHistory'])projectData[key]=historicalize(projectData[key]);
  const visit=value=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){for(const item of value)visit(item);return;}
    if(Object.prototype.hasOwnProperty.call(value,'EXECUTABLE_KIND')){
      if(value.EXECUTABLE_KIND==='CLOSED_LOOP_TEST_IR')value.EXECUTABLE_KIND='TEST_IR';
      if(value.EXECUTABLE_KIND==='CUSTOM_PIPELINE'){
        value.EXECUTABLE_KIND='NONE';
        value.STATUS='BLOCKED';
        value.MIGRATION_BLOCKING_REASON='Legacy CUSTOM_PIPELINE is not executable under closed-loop-test-spec/1.';
      }
    }
    if(Object.prototype.hasOwnProperty.call(value,'EXECUTABLE_SPEC'))value.EXECUTABLE_SPEC_VERSION='closed-loop-test-spec/1';
    for(const child of Object.values(value))visit(child);
  };
  visit(migrated);
  projectData.migrationHistory=[...(Array.isArray(projectData.migrationHistory)?projectData.migrationHistory:[]),{
    migrationId,fromSchema:'closed-loop-project/2',toSchema:'closed-loop-project/3',historicalOnly:true,
    originalImportedPayload:original,preservedRawResponses:Array.isArray(projectData.rawResponses)?projectData.rawResponses.length:0,
    preservedReceipts:Array.isArray(projectData.receipts)?projectData.receipts.length:0
  }];
  return migrated;
}
`;
  const strictIndex=source.indexOf("'use strict'");
  const insertionPoint=strictIndex>=0?source.indexOf('\n',strictIndex)+1:0;
  source=source.slice(0,insertionPoint)+helper+source.slice(insertionPoint);
  const shiftedNeedle=source.indexOf('human-project/30'),shiftedFn=containingFunction(source,shiftedNeedle);
  assert(shiftedFn&&shiftedFn.args.length,'Migration function could not be relocated after helper insertion.');
  const shiftedArgument=shiftedFn.args[0].replace(/=.*/,'').trim();
  const branch=`
  if(${shiftedArgument}&&typeof ${shiftedArgument}==='object'){
    if(${shiftedArgument}.schema==='closed-loop-project/2')return migrateClosedLoopProjectV2ToV3(${shiftedArgument});
    if(${shiftedArgument}.project?.schema==='closed-loop-project/2')return {...${shiftedArgument},project:migrateClosedLoopProjectV2ToV3(${shiftedArgument}.project)};
  }
`;
  source=source.slice(0,shiftedFn.bodyStart)+branch+source.slice(shiftedFn.bodyStart);
  write(targetFile,source);
}

function installExactRuntime(){
  write('test-runtime.js',read('spec-v3-runtime.js'));
  write('test-worker.js',read('spec-v3-worker.js'));
  write('verify-v3-contract.mjs',read('spec-v3-verifier.mjs'));
  write('verify-test-runtime.mjs',"await import('./verify-v3-contract.mjs');\nconsole.log('verify-test-runtime: PASS');\n");
}

function updateStaticGraph(){
  let html=read('index.html');
  const schemaTag=html.match(/<script\s+defer\s+src="workflow-schema\.js\?v=([^"]+)"\s*><\/script>/);
  assert(schemaTag,'workflow-schema.js direct script tag not found.');
  if(!/<script\s+defer\s+src="test-runtime\.js\?v=/.test(html))html=html.replace(schemaTag[0],schemaTag[0]+'\n<script defer src="test-runtime.js?v='+schemaTag[1]+'"></script>');
  if(!/worker-src\s+'self'/.test(html)){
    const meta=html.match(/(<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]+content=["'])([^"']*)(["'][^>]*>)/i);
    if(meta)html=html.replace(meta[0],meta[1]+meta[2].replace(/;?\s*$/,';')+" worker-src 'self';"+meta[3]);
    else html=html.replace(/(connect-src\s+[^;]+;)/i,"$1 worker-src 'self';");
  }
  write('index.html',html);

  for(const file of fs.readdirSync(root).filter(file=>file.endsWith('.mjs'))){
    let source=read(file);
    source=source.replace(/(['"]workflow-schema\.js['"]\s*,\s*)(['"]workflow-engine\.js['"])/g,"$1'test-runtime.js',$2");
    write(file,source);
  }
}

function updateDocumentation(){
  let readme=read('README.md');
  readme=readme.replaceAll('closed-loop-project/2','closed-loop-project/3').replaceAll('closed-loop-stage-response/2','closed-loop-stage-response/3');
  readme=readme.replace('The deterministic legacy migration is `human-project/30` → `closed-loop-project/3`.','The deterministic migration chain is `human-project/30` → `closed-loop-project/2` → `closed-loop-project/3`; old `/2` responses remain historical and cannot control a current `/3` prompt.');
  if(!readme.includes('| Deterministic Test IR registry'))readme=readme.replace('| Canonical serialization and SHA-256 | `hash.js` |','| Canonical serialization and SHA-256 | `hash.js` |\n| Deterministic Test IR registry, validation, limits, and worker coordination | `test-runtime.js` |\n| Isolated deterministic execution | `test-worker.js` |');
  write('README.md',readme);
}

function updatePagesWorkflow(){
  let source=read('.github/workflows/pages.yml');
  source=source.replaceAll("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']","['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']");
  if(!source.includes('node --check verify-v3-contract.mjs'))source=source.replace('          node --check verify-test-runtime.mjs','          node --check verify-test-runtime.mjs\n          node --check verify-v3-contract.mjs');
  if(!source.includes('Verify controlling /3 contract'))source=source.replace('      - name: Verify generic deterministic Test IR runtime\n        run: node verify-test-runtime.mjs','      - name: Verify controlling /3 contract, ownership, migration, and Test IR security\n        run: node verify-v3-contract.mjs\n      - name: Verify generic deterministic Test IR runtime\n        run: node verify-test-runtime.mjs');
  source=source.replace(/node build-test-project\.mjs && node verify-test-runtime\.mjs/g,'node build-test-project.mjs && node verify-v3-contract.mjs && node verify-test-runtime.mjs');
  if(!source.includes('node verify-v3-contract.mjs > /tmp/verify-v3-contract.out'))source=source.replace('          node verify-test-runtime.mjs > /tmp/verify-test-runtime.out','          node verify-v3-contract.mjs > /tmp/verify-v3-contract.out\n          node verify-test-runtime.mjs > /tmp/verify-test-runtime.out');
  source=source.replaceAll("projectSchema:'closed-loop-project/2'","projectSchema:'closed-loop-project/3'").replaceAll("responseSchema:'closed-loop-stage-response/2'","responseSchema:'closed-loop-stage-response/3'");
  if(!source.includes("const v3=JSON.parse(fs.readFileSync('/tmp/verify-v3-contract.out'"))source=source.replace("const definition=JSON.parse(fs.readFileSync('/tmp/verify-definition-of-done.out','utf8'));","const definition=JSON.parse(fs.readFileSync('/tmp/verify-definition-of-done.out','utf8'));\n          const v3=JSON.parse(fs.readFileSync('/tmp/verify-v3-contract.out','utf8').trim().split(/\\r?\\n/).at(-1));");
  if(!source.includes('            ...v3,'))source=source.replace('            ...definition,','            ...definition,\n            ...v3,');
  source=source.replace("'mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage'","'mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage','stage01ControlledInputAccounting','stage04ObligationAccounting','mandatoryEvidenceSufficiencyCoverage','nativeExecutionCoverage','testIrSecurityCoverage','migrationCoverage'");
  source=source.replace("'externallySupportedUnestablishedIndependenceTreatedAsProven'","'externallySupportedUnestablishedIndependenceTreatedAsProven','unsupportedTestIrTreatedAsExecutable','nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction'");
  write('.github/workflows/pages.yml',source);
}

function assertGeneratedState(){
  const schema=read('workflow-schema.js');
  assert(read('workbook.js').includes("closed-loop-project/3"),'Project schema update failed.');
  assert(schema.includes("closed-loop-stage-response/3"),'Response schema update failed.');
  assert(read('test-runtime.js').includes("'PARSE_XML'")&&read('test-runtime.js').includes("'SELECT_XML'"),'Required XML primitives are absent.');
  assert(read('project-store.js').includes('migrateClosedLoopProjectV2ToV3')||read('workflow-engine.js').includes('migrateClosedLoopProjectV2ToV3')||read('workbook.js').includes('migrateClosedLoopProjectV2ToV3'),'The /2 → /3 migration was not installed.');
  assert(read('index.html').includes('test-runtime.js?v='),'test-runtime.js is not directly loaded.');
}

replaceCurrentVersions();
repairJobOwnership();
repairTestContract();
addV2Migration();
installExactRuntime();
updateStaticGraph();
updateDocumentation();
updatePagesWorkflow();
assertGeneratedState();
console.log('spec-v3-repair-v2: generated');
