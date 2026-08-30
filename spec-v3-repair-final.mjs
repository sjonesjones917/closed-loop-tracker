import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const write=(file,content)=>fs.writeFileSync(file,content.endsWith('\n')?content:content+'\n');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function replaceRequired(source,pattern,replacement,label){
  const matches=source.match(pattern)||[];
  assert(matches.length===1,'Expected one '+label+'; found '+matches.length+'.');
  return source.replace(pattern,replacement);
}
function matchingClose(source,open,openChar='[',closeChar=']'){
  let depth=0,quote=null,escape=false;
  for(let index=open;index<source.length;index++){
    const character=source[index];
    if(quote){
      if(escape)escape=false;
      else if(character==='\\')escape=true;
      else if(character===quote)quote=null;
      continue;
    }
    if(character==='"'||character==="'"||character==='`'){quote=character;continue;}
    if(character===openChar)depth++;
    else if(character===closeChar&&--depth===0)return index;
  }
  return -1;
}
function arrayRangeAfter(source,index,label){
  const open=source.indexOf('[',index),close=open>=0?matchingClose(source,open): -1;
  assert(open>=0&&close>open,'Cannot locate '+label+' array.');
  return {open,close};
}
function stringMembers(source,range){return [...source.slice(range.open+1,range.close).matchAll(/["']([^"']+)["']/g)].map(match=>match[1]);}
function renderMembers(values,indent='  '){return '[\n'+values.map(value=>indent+"'"+value+"'").join(',\n')+'\n'+indent.slice(0,Math.max(0,indent.length-2))+']';}

function updateVersionAuthorities(){
  let workbook=read('workbook.js');
  workbook=replaceRequired(workbook,/const\s+PROJECT_SCHEMA\s*=\s*['"]closed-loop-project\/2['"]\s*;/,"const PROJECT_SCHEMA='closed-loop-project/3';",'project schema declaration');
  write('workbook.js',workbook);

  let schema=read('workflow-schema.js');
  schema=replaceRequired(schema,/const\s+RESPONSE_SCHEMA\s*=\s*['"]closed-loop-stage-response\/2['"]\s*;/,"const RESPONSE_SCHEMA='closed-loop-stage-response/3';",'response schema declaration');
  write('workflow-schema.js',schema);

  const currentFiles=fs.readdirSync('.').filter(file=>/^(README\.md|TEST_PROJECT\.json|build-test-project.*\.mjs|test-fixtures\.mjs|verify.*\.mjs)$/.test(file));
  for(const file of currentFiles){
    let source=read(file);
    source=source.replaceAll('closed-loop-project/2','closed-loop-project/3').replaceAll('closed-loop-stage-response/2','closed-loop-stage-response/3');
    write(file,source);
  }
  for(const file of ['workflow-engine.js','prompt-engine.js','response-ingestion.js','app-core.js','index.html']){
    let source=read(file);
    source=source.replaceAll('closed-loop-stage-response/2','closed-loop-stage-response/3');
    write(file,source);
  }
}

function updateJobOwnership(){
  let source=read('workflow-schema.js');
  const humanIndex=source.indexOf('const HUMAN_JOB_FIELDS');
  assert(humanIndex>=0,'HUMAN_JOB_FIELDS is absent.');
  const humanRange=arrayRangeAfter(source,humanIndex,'HUMAN_JOB_FIELDS');
  const humanMembers=stringMembers(source,humanRange).filter(value=>!['JOB_TITLE','JOB_OWNER'].includes(value));
  source=source.slice(0,humanRange.open)+renderMembers(humanMembers,'  ')+source.slice(humanRange.close+1);

  const decisionName='V3_HUMAN_DECISION_JOB_FIELDS';
  if(!source.includes('const '+decisionName)){
    const marker=source.indexOf('const APPLICATION_JOB_FIELDS');
    assert(marker>=0,'APPLICATION_JOB_FIELDS is absent.');
    source=source.slice(0,marker)+"const "+decisionName+"=Object.freeze(['JOB_TITLE','JOB_OWNER']);\n"+source.slice(marker);
  }
  const humanBranch='if(HUMAN_JOB_FIELDS.includes(name))';
  const branchIndex=source.indexOf(humanBranch);
  assert(branchIndex>=0,'Human job field definition branch is absent.');
  if(!source.slice(Math.max(0,branchIndex-250),branchIndex).includes(decisionName)){
    source=source.slice(0,branchIndex)+"if("+decisionName+".includes(name))return field(name,PRODUCER.HUMAN_DECISION,{provenanceRequired:false,nullable:true});\n  "+source.slice(branchIndex);
  }
  const jobFieldsIndex=source.indexOf('const JOB_FIELDS');
  assert(jobFieldsIndex>=0,'JOB_FIELDS declaration is absent.');
  const jobFieldsTail=source.slice(jobFieldsIndex,jobFieldsIndex+2000);
  if(!jobFieldsTail.includes('...'+decisionName)){
    const absolute=jobFieldsIndex+jobFieldsTail.indexOf('...HUMAN_JOB_FIELDS');
    assert(absolute>=jobFieldsIndex,'JOB_FIELDS does not include HUMAN_JOB_FIELDS.');
    source=source.slice(0,absolute)+'...'+decisionName+',...HUMAN_JOB_FIELDS'+source.slice(absolute+'...HUMAN_JOB_FIELDS'.length);
  }
  write('workflow-schema.js',source);
}

function updateTestOwnershipAndEnum(){
  let source=read('workflow-schema.js');
  const blockStart=source.indexOf('"tests"'),blockEnd=source.indexOf('"failureTests"',blockStart);
  assert(blockStart>=0&&blockEnd>blockStart,'Tests ownership block is absent.');
  let block=source.slice(blockStart,blockEnd);
  for(const partition of ['agent','application']){
    const index=block.indexOf('"'+partition+'"');
    assert(index>=0,'Tests '+partition+' partition is absent.');
    const range=arrayRangeAfter(block,index,'tests '+partition);
    let members=stringMembers(block,range).filter(value=>value!=='EXECUTABLE_SPEC_VERSION');
    if(partition==='application')members.splice(Math.min(1,members.length),0,'EXECUTABLE_SPEC_VERSION');
    block=block.slice(0,range.open)+JSON.stringify([...new Set(members)],null,2)+block.slice(range.close+1);
  }
  source=source.slice(0,blockStart)+block+source.slice(blockEnd);

  const occurrences=[];let cursor=0;
  while((cursor=source.indexOf('EXECUTABLE_KIND',cursor))>=0){
    const enumIndex=source.indexOf('enumValues',cursor);
    if(enumIndex>=0&&enumIndex-cursor<800)occurrences.push({field:cursor,enumIndex,distance:enumIndex-cursor});
    cursor+=15;
  }
  assert(occurrences.length,'EXECUTABLE_KIND enum could not be located.');
  const selected=occurrences.sort((left,right)=>left.distance-right.distance)[0],range=arrayRangeAfter(source,selected.enumIndex,'EXECUTABLE_KIND enum');
  source=source.slice(0,range.open)+"['NONE','TEST_IR']"+source.slice(range.close+1);
  write('workflow-schema.js',source);

  const files=['workflow-engine.js','prompt-engine.js','response-ingestion.js','app-core.js',...fs.readdirSync('.').filter(file=>/^(TEST_PROJECT\.json|build-test-project.*\.mjs|test-fixtures\.mjs|verify.*\.mjs)$/.test(file))];
  for(const file of new Set(files)){
    let text=read(file);
    text=text.replace(/(EXECUTABLE_KIND["']?\s*[:=]\s*["'])CLOSED_LOOP_TEST_IR(["'])/g,'$1TEST_IR$2');
    text=text.replace(/(["']EXECUTABLE_KIND["']\s*:\s*["'])CLOSED_LOOP_TEST_IR(["'])/g,'$1TEST_IR$2');
    write(file,text);
  }
}

function containingFunction(source,needleIndex){
  const ignored=new Set(['if','for','while','switch','catch','with']);
  const patterns=[
    /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>\s*\{/g,
    /(^|[,{;]\s*)([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/gm
  ];
  const found=[];
  for(const pattern of patterns){
    let match;
    while((match=pattern.exec(source))&&match.index<needleIndex){
      const name=pattern===patterns[3]?match[2]:match[1],argsText=pattern===patterns[3]?match[3]:(match[2]||'');
      if(ignored.has(name))continue;
      const open=source.indexOf('{',match.index),close=matchingClose(source,open,'{','}');
      if(close>needleIndex)found.push({name,args:argsText.split(',').map(value=>value.trim()).filter(Boolean),bodyStart:open+1,close});
    }
  }
  return found.sort((left,right)=>(left.close-left.bodyStart)-(right.close-right.bodyStart))[0]||null;
}

function installMigration(){
  const files=['project-store.js','workflow-engine.js','workbook.js'];
  let target=null,source=null,fn=null;
  for(const file of files){
    const candidate=read(file);
    let index=candidate.indexOf('human-project/30');
    let currentFn=index>=0?containingFunction(candidate,index):null;
    if(!currentFn&&index>=0){
      const before=candidate.slice(Math.max(0,index-160),index+40),constant=(before.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*['"]human-project\/30/)||[])[1];
      if(constant){
        let use=candidate.indexOf(constant,index+constant.length);
        while(use>=0&&!currentFn){currentFn=containingFunction(candidate,use);use=candidate.indexOf(constant,use+constant.length);}
      }
    }
    if(currentFn){target=file;source=candidate;fn=currentFn;break;}
  }
  assert(target&&fn&&fn.args.length,'Existing legacy migration function could not be located.');
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
        value.EXECUTABLE_KIND='NONE';value.STATUS='BLOCKED';
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
  const strict=source.indexOf("'use strict'"),insertAt=strict>=0?source.indexOf('\n',strict)+1:0;
  source=source.slice(0,insertAt)+helper+source.slice(insertAt);
  let needle=source.indexOf('human-project/30'),shifted=needle>=0?containingFunction(source,needle):null;
  if(!shifted){
    const name=fn.name,index=source.indexOf('function '+name);
    shifted=index>=0?containingFunction(source,source.indexOf('{',index)+1):null;
  }
  assert(shifted&&shifted.args.length,'Legacy migration function moved outside the parser boundary.');
  const argument=shifted.args[0].replace(/=.*/,'').trim();
  const branch=`
  if(${argument}&&typeof ${argument}==='object'){
    if(${argument}.schema==='closed-loop-project/2')return migrateClosedLoopProjectV2ToV3(${argument});
    if(${argument}.project?.schema==='closed-loop-project/2')return {...${argument},project:migrateClosedLoopProjectV2ToV3(${argument}.project)};
  }
`;
  source=source.slice(0,shifted.bodyStart)+branch+source.slice(shifted.bodyStart);
  write(target,source);
}

function installRuntimeAndProof(){
  write('test-runtime.js',read('/tmp/spec-v3-runtime.js'));
  write('test-worker.js',read('/tmp/spec-v3-worker.js'));
  let verifier=read('/tmp/spec-v3-verifier.mjs');
  verifier=verifier.replace("'project-store.js','app-core.js','index.html','test-worker.js','.github/workflows/pages.yml'","'project-store.js','app-core.js','index.html','test-runtime.js','test-worker.js','.github/workflows/pages.yml'");
  verifier=verifier.replace("assert(!/unsafe-eval|unsafe-inline/.test(sources['index.html']),'CSP opens unsafe script evaluation.');","const scriptPolicy=(sources['index.html'].match(/script-src\\s+([^;]+)/i)||[])[1]||'';\nassert(!/unsafe-eval|unsafe-inline/.test(scriptPolicy),'CSP opens unsafe script evaluation.');");
  write('verify-v3-contract.mjs',verifier);
  write('verify-test-runtime.mjs',"await import('./verify-v3-contract.mjs');\nconsole.log('verify-test-runtime: PASS');\n");

  let runtime=read('test-runtime.js');
  if(!runtime.includes('RUNTIME_SCRIPT_URL'))runtime=runtime.replace("const CAPABILITY_ID='CLOSED_LOOP_TEST_IR';","const CAPABILITY_ID='CLOSED_LOOP_TEST_IR';\nconst RUNTIME_SCRIPT_URL=typeof document!=='undefined'&&document.currentScript?.src?document.currentScript.src:globalThis.location?.href||'';");
  runtime=runtime.replace("const base=typeof document!=='undefined'&&document.currentScript?.src?document.currentScript.src:globalThis.location?.href||'';\n  const url=new URL('test-worker.js',base),token=new URL(base).searchParams.get('v');","const base=RUNTIME_SCRIPT_URL;\n  const url=new URL('test-worker.js',base),token=new URL(base).searchParams.get('v');");
  write('test-runtime.js',runtime);
}

function updateIndex(){
  let html=read('index.html');
  html=html.replace(/\n?<script\s+defer\s+src="test-runtime\.js\?v=[^"]+"\s*><\/script>/g,'');
  const schemaTag=html.match(/<script\s+defer\s+src="workflow-schema\.js\?v=([^"]+)"\s*><\/script>/);
  assert(schemaTag,'workflow-schema direct script tag is absent.');
  html=html.replace(schemaTag[0],schemaTag[0]+'\n<script defer src="test-runtime.js?v='+schemaTag[1]+'"></script>');
  const meta=html.match(/(<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content=")([^"]*)("[^>]*>)/i);
  assert(meta,'Content-Security-Policy meta tag is absent.');
  let policy=meta[2].replace(/\s*worker-src\s+[^;]+;?/gi,' ').trim().replace(/;?$/,';');
  policy+=" worker-src 'self';";
  html=html.replace(meta[0],meta[1]+policy+meta[3]);
  write('index.html',html);

  for(const file of fs.readdirSync('.').filter(file=>file.endsWith('.mjs'))){
    let source=read(file);
    source=source.replace(/(['"]workflow-schema\.js['"]\s*,\s*)(['"]workflow-engine\.js['"])/g,"$1'test-runtime.js',$2");
    write(file,source);
  }
}

function updateDocumentationAndCi(){
  let readme=read('README.md').replaceAll('closed-loop-project/2','closed-loop-project/3').replaceAll('closed-loop-stage-response/2','closed-loop-stage-response/3');
  readme=readme.replace('The deterministic legacy migration is `human-project/30` → `closed-loop-project/3`.','The deterministic migration chain is `human-project/30` → `closed-loop-project/2` → `closed-loop-project/3`; old `/2` responses remain historical and cannot control a current `/3` prompt.');
  if(!readme.includes('| Deterministic Test IR registry'))readme=readme.replace('| Canonical serialization and SHA-256 | `hash.js` |','| Canonical serialization and SHA-256 | `hash.js` |\n| Deterministic Test IR registry, validation, limits, and worker coordination | `test-runtime.js` |\n| Isolated deterministic execution | `test-worker.js` |');
  write('README.md',readme);

  let workflow=read('.github/workflows/pages.yml');
  if(!/^\s*workflow_dispatch:\s*$/m.test(workflow))workflow=workflow.replace(/^on:\s*$/m,'on:\n  workflow_dispatch:');
  workflow=workflow.replace(/\[['"]workbook\.js['"],['"]hash\.js['"],['"]workflow-schema\.js['"],['"]workflow-engine\.js['"],['"]prompt-engine\.js['"],['"]response-ingestion\.js['"],['"]project-store\.js['"],['"]app-core\.js['"]\]/g,"['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']");
  workflow=workflow.replaceAll("projectSchema:'closed-loop-project/2'","projectSchema:'closed-loop-project/3'").replaceAll("responseSchema:'closed-loop-stage-response/2'","responseSchema:'closed-loop-stage-response/3'");
  if(!workflow.includes('node --check verify-v3-contract.mjs'))workflow=workflow.replace('          node --check verify-test-runtime.mjs','          node --check verify-test-runtime.mjs\n          node --check verify-v3-contract.mjs');
  if(!workflow.includes('Verify controlling /3 contract'))workflow=workflow.replace('      - name: Verify generic deterministic Test IR runtime\n        run: node verify-test-runtime.mjs','      - name: Verify controlling /3 contract, ownership, migration, and Test IR security\n        run: node verify-v3-contract.mjs\n      - name: Verify generic deterministic Test IR runtime\n        run: node verify-test-runtime.mjs');
  workflow=workflow.replace(/node build-test-project\.mjs && node verify-test-runtime\.mjs/g,'node build-test-project.mjs && node verify-v3-contract.mjs && node verify-test-runtime.mjs');
  if(!workflow.includes('node verify-v3-contract.mjs > /tmp/verify-v3-contract.out'))workflow=workflow.replace('          node verify-test-runtime.mjs > /tmp/verify-test-runtime.out','          node verify-v3-contract.mjs > /tmp/verify-v3-contract.out\n          node verify-test-runtime.mjs > /tmp/verify-test-runtime.out');
  if(!workflow.includes("const v3=JSON.parse(fs.readFileSync('/tmp/verify-v3-contract.out'"))workflow=workflow.replace("const definition=JSON.parse(fs.readFileSync('/tmp/verify-definition-of-done.out','utf8'));","const definition=JSON.parse(fs.readFileSync('/tmp/verify-definition-of-done.out','utf8'));\n          const v3=JSON.parse(fs.readFileSync('/tmp/verify-v3-contract.out','utf8').trim().split(/\\r?\\n/).at(-1));");
  if(!workflow.includes('            ...v3,'))workflow=workflow.replace('            ...definition,','            ...definition,\n            ...v3,');
  workflow=workflow.replace("'mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage'","'mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage','stage01ControlledInputAccounting','stage04ObligationAccounting','mandatoryEvidenceSufficiencyCoverage','nativeExecutionCoverage','testIrSecurityCoverage','migrationCoverage'");
  workflow=workflow.replace("'externallySupportedUnestablishedIndependenceTreatedAsProven'","'externallySupportedUnestablishedIndependenceTreatedAsProven','unsupportedTestIrTreatedAsExecutable','nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction'");
  write('.github/workflows/pages.yml',workflow);
}

updateVersionAuthorities();
updateJobOwnership();
updateTestOwnershipAndEnum();
installMigration();
installRuntimeAndProof();
updateIndex();
updateDocumentationAndCi();

assert(read('workbook.js').includes("closed-loop-project/3"),'Project schema transformation failed.');
assert(read('workflow-schema.js').includes("closed-loop-stage-response/3"),'Response schema transformation failed.');
assert(read('index.html').includes('test-runtime.js?v='),'Direct Test IR runtime loading is absent.');
assert(read('test-runtime.js').includes("'PARSE_XML'")&&read('test-runtime.js').includes("'SELECT_XML'"),'Required Test IR XML primitives are absent.');
console.log('spec-v3-repair-final: generated');
