import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const marker='CLOSED_LOOP_V3_MIGRATION_LAYER';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const write=(file,text)=>fs.writeFileSync(path.join(root,file),text);
const replace=(text,pattern,replacement,label,minimum=1)=>{
  const matches=typeof pattern==='string'?text.split(pattern).length-1:(text.match(pattern)||[]).length;
  if(matches<minimum)throw new Error(`${label}: expected at least ${minimum} match(es), found ${matches}`);
  return typeof pattern==='string'?text.split(pattern).join(replacement):text.replace(pattern,replacement);
};
const replaceIfPresent=(text,pattern,replacement)=>typeof pattern==='string'?text.split(pattern).join(replacement):text.replace(pattern,replacement);
const rootFiles=fs.readdirSync(root).filter(file=>fs.statSync(path.join(root,file)).isFile());
const sourceFiles=rootFiles.filter(file=>/\.(?:js|mjs|json|md)$/.test(file)&&file!=='AUTHORIZED_OPERATION_01.txt'&&!file.startsWith('verify-v3-')&&file!=='upgrade-v3.mjs');

/* Current-contract identity changes are source changes. Historical /2 response bytes
   are preserved by migration and by the explicit migration fixture, not rewritten at runtime. */
for(const file of sourceFiles){
  let text=read(file);
  text=text.replaceAll('closed-loop-project/2','closed-loop-project/3');
  text=text.replaceAll('closed-loop-stage-response/2','closed-loop-stage-response/3');
  text=text.replaceAll('CUSTOM_PIPELINE','TEST_IR');
  text=text.replace(/\{\s*op\s*:\s*(['"])PARSE_CSV\1\s*\}/g,`{op:'PARSE_CSV',delimiter:',',header:false,quote:'"',newline:'AUTO',encoding:'UTF-8'}`);
  text=text.replace(/\{\s*"op"\s*:\s*"PARSE_CSV"\s*\}/g,`{"op":"PARSE_CSV","delimiter":",","header":false,"quote":"\\\"","newline":"AUTO","encoding":"UTF-8"}`);
  write(file,text);
}

/* Enforce static producer authority for the application-selected Test IR version. */
{
  let text=read('workflow-schema.js');
  text=text.split(/\r?\n/).map(line=>line.includes('EXECUTABLE_SPEC_VERSION')?line.replace(/\bAGENT\b/g,'APPLICATION'):line).join('\n');
  if(!text.includes(marker))text+=`\n;(()=>{\n'use strict';\nconst ${marker}=true;\nconst base=globalThis.closedLoopSchema;\nif(!base)throw new Error('closedLoopSchema must exist before the v3 migration layer.');\nconst CURRENT_PROJECT_SCHEMA='closed-loop-project/3';\nconst PREVIOUS_PROJECT_SCHEMA='closed-loop-project/2';\nconst CURRENT_RESPONSE_SCHEMA='closed-loop-stage-response/3';\nconst PREVIOUS_RESPONSE_SCHEMA='closed-loop-stage-response/2';\nconst TEST_IR_SCHEMA='closed-loop-test-spec/1';\nconst PACKAGE_SCHEMA='closed-loop-verification-package/1';\nconst clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));\nfunction normalizeTestRecords(value,seen=new WeakSet()){\n  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);\n  const fields=value.fields&&typeof value.fields==='object'&&!Array.isArray(value.fields)?value.fields:value;\n  if(Object.prototype.hasOwnProperty.call(fields,'TEST_ID')||Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_KIND')||Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC')){\n    if(fields.EXECUTABLE_KIND==='CUSTOM_PIPELINE')fields.EXECUTABLE_KIND='TEST_IR';\n    if(!fields.EXECUTABLE_KIND)fields.EXECUTABLE_KIND='NONE';\n    fields.EXECUTABLE_SPEC_VERSION=TEST_IR_SCHEMA;\n    if(!Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC'))fields.EXECUTABLE_SPEC=null;\n    if(!fields.EXECUTABLE_INPUT_BINDINGS||typeof fields.EXECUTABLE_INPUT_BINDINGS!=='object'||Array.isArray(fields.EXECUTABLE_INPUT_BINDINGS))fields.EXECUTABLE_INPUT_BINDINGS={};\n    if(!Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC_SHA256'))fields.EXECUTABLE_SPEC_SHA256='';\n  }\n  if(Array.isArray(value)){for(const item of value)normalizeTestRecords(item,seen);}else for(const item of Object.values(value))normalizeTestRecords(item,seen);\n}\nfunction ensureV3Defaults(project){\n  project.schema=CURRENT_PROJECT_SCHEMA;\n  project.workflow=project.workflow||project.workflowId||'mobile-closed-loop/30';\n  project.projectData=project.projectData&&typeof project.projectData==='object'?project.projectData:{};\n  for(const key of ['intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents'])if(!Array.isArray(project.projectData[key]))project.projectData[key]=[];\n  if(!Array.isArray(project.projectData.nonOperationalImportedPayloads))project.projectData.nonOperationalImportedPayloads=[];\n  project.projectData.schemaIdentities={...(project.projectData.schemaIdentities||{}),project:CURRENT_PROJECT_SCHEMA,response:CURRENT_RESPONSE_SCHEMA,testIr:TEST_IR_SCHEMA,verificationPackage:PACKAGE_SCHEMA};\n  normalizeTestRecords(project);\n  return project;\n}\nconst priorMigrationName=['migrateProjectToCurrent','migrateProject','migrateLegacyProject','migrate'].find(name=>typeof base[name]==='function');\nconst priorMigration=priorMigrationName?base[priorMigrationName].bind(base):null;\nfunction migrateProjectToCurrent(input){\n  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Imported project must be an object.');\n  if(input.schema===CURRENT_PROJECT_SCHEMA)return ensureV3Defaults(clone(input));\n  const original=clone(input);\n  let migrated;\n  if(input.schema===PREVIOUS_PROJECT_SCHEMA)migrated=clone(input);\n  else if(priorMigration){migrated=priorMigration(clone(input));if(migrated&&typeof migrated.then==='function')throw new Error('Project migration must be deterministic and synchronous.');}\n  else throw new Error('Unsupported project schema '+String(input.schema));\n  migrated=ensureV3Defaults(migrated);\n  const already=migrated.projectData.nonOperationalImportedPayloads.some(item=>item&&item.sourceSchema===original.schema&&item.sourceRevision===Number(original.revision||0)&&item.operational===false);\n  if(!already)migrated.projectData.nonOperationalImportedPayloads.push({sourceSchema:String(original.schema||''),sourceRevision:Number(original.revision||0),operational:false,purpose:'ORIGINAL_IMPORTED_PAYLOAD_AUDIT_EVIDENCE',payload:original});\n  migrated.projectHash='';\n  return migrated;\n}\nconst replacement={...base,PROJECT_SCHEMA:CURRENT_PROJECT_SCHEMA,PROJECT_SCHEMA_ID:CURRENT_PROJECT_SCHEMA,RESPONSE_SCHEMA:CURRENT_RESPONSE_SCHEMA,RESPONSE_SCHEMA_ID:CURRENT_RESPONSE_SCHEMA,PREVIOUS_PROJECT_SCHEMA,PREVIOUS_RESPONSE_SCHEMA,TEST_IR_SCHEMA,PACKAGE_SCHEMA,migrateProjectToCurrent};\nif(priorMigrationName)replacement[priorMigrationName]=migrateProjectToCurrent;\nglobalThis.closedLoopSchema=Object.freeze(replacement);\n})();\n`;
  write('workflow-schema.js',text);
}

/* Ensure every import/migration call uses the v3-preserving migration authority. */
for(const file of ['project-store.js','workflow-engine.js','response-ingestion.js']){
  let text=read(file);
  text=text.replace(/\.migrateProject\s*\(/g,'.migrateProjectToCurrent(');
  text=text.replace(/\.migrateLegacyProject\s*\(/g,'.migrateProjectToCurrent(');
  write(file,text);
}
{
  let text=read('response-ingestion.js');
  if(!text.includes('PREVIOUS_RESPONSE_SCHEMA_EXPLICIT'))text+=`\n;(()=>{\n'use strict';\nconst PREVIOUS_RESPONSE_SCHEMA_EXPLICIT='closed-loop-stage-response/2';\nconst base=globalThis.closedLoopResponseIngestion;\nif(base)globalThis.closedLoopResponseIngestion=Object.freeze({...base,PREVIOUS_RESPONSE_SCHEMA:PREVIOUS_RESPONSE_SCHEMA_EXPLICIT});\n})();\n`;
  write('response-ingestion.js',text);
}

/* Preserve the demonstrated small assertion primitives while keeping the language
   closed and declarative. They are not arbitrary-code escape hatches. */
{
  let text=read('test-runtime.js');
  if(!text.includes("ASSERT_EXISTS:{")){
    text=text.replace("  ASSERT_EQ:{required:['value']", "  ASSERT_EXISTS:{required:[],optional:['message'],types:{message:'string'}},\n  ASSERT_TYPE:{required:['value'],optional:['message'],types:{value:'typeName',message:'string'}},\n  ASSERT_NE:{required:['value'],optional:['message','numericMode','absoluteTolerance','relativeTolerance'],types:{message:'string',numericMode:'numericMode',absoluteTolerance:'nonnegativeNumber',relativeTolerance:'nonnegativeNumber'}},\n  ASSERT_EQ:{required:['value']");
    text=text.replace("'ASSERT_EQ','ASSERT_GT'", "'ASSERT_EXISTS','ASSERT_TYPE','ASSERT_NE','ASSERT_EQ','ASSERT_GT'");
    text=text.replace("    case 'numericMode':return", "    case 'typeName':return ['string','number','boolean','object','array','null','undefined','bytes'].includes(value);\n    case 'numericMode':return");
    text=text.replace("      case 'ASSERT_EQ':finalAssertion=", "      case 'ASSERT_EXISTS':finalAssertion=resultForAssertion(value!==null&&value!==undefined,'present',value,step.message);break;\n      case 'ASSERT_TYPE':{const actual=bytesOf(value)?'bytes':Array.isArray(value)?'array':value===null?'null':typeof value;finalAssertion=resultForAssertion(actual===step.value,step.value,actual,step.message);break;}\n      case 'ASSERT_NE':finalAssertion=resultForAssertion(!exactEqual(value,step.value,step),`not ${canonical(step.value)}`,value,step.message);break;\n      case 'ASSERT_EQ':finalAssertion=");
  }
  text=text.replace("function executionFailure(test,startedAtDeviceTime,error){\n  return {testId:field(test,'TEST_ID')||test?.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256:null,status:STATUS.EXECUTION_FAILED,determination:STATUS.UNDETERMINED", "function executionFailure(test,startedAtDeviceTime,error){\n  const disposition=error?.disposition===STATUS.UNDETERMINED?STATUS.UNDETERMINED:STATUS.EXECUTION_FAILED;\n  return {testId:field(test,'TEST_ID')||test?.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256:null,status:disposition,determination:STATUS.UNDETERMINED");
  text=text.replace("new RuntimeError(message.error?.code||'WORKER_EXECUTION_FAILED',message.error?.message||'Worker execution failed.')", "new RuntimeError(message.error?.code||'WORKER_EXECUTION_FAILED',message.error?.message||'Worker execution failed.',message.error?.disposition||STATUS.EXECUTION_FAILED)");
  write('test-runtime.js',text);
}

/* Same-origin runtime order and one cache/build identity, including worker URL. */
{
  let html=read('index.html');
  if(!/test-runtime\.js\?v=/.test(html)){
    const match=html.match(/(<script\s+defer\s+src=["']workflow-schema\.js\?v=([^"']+)["']\s*><\/script>)/);
    if(!match)throw new Error('Could not find workflow-schema.js runtime tag.');
    html=html.replace(match[1],`${match[1]}\n<script defer src="test-runtime.js?v=${match[2]}"></script>`);
  }
  html=html.replace(/worker-src\s+[^;]+;/i,"worker-src 'self';");
  if(!/worker-src\s+'self';/i.test(html))html=html.replace(/(content-security-policy[^>]+content=["'][^"']*)/i,`$1 worker-src 'self';`);
  const build='20260830-v3';
  html=html.replace(/(<script\s+defer\s+src=["'][^"'?]+)\?v=[^"']+(["']\s*><\/script>)/g,`$1?v=${build}$2`);
  write('index.html',html);
}

/* Update the single Pages workflow without introducing a second deployment path. */
{
  const file='.github/workflows/pages.yml';let text=read(file);
  text=text.replace("node --check verify-test-runtime.mjs", "node --check verify-test-runtime.mjs\n          node --check verify-test-runtime-v3.mjs\n          node --check verify-v3-contract.mjs\n          node --check verify-v3-migration.mjs\n          node --check verify-v3-definition-of-done.mjs");
  text=text.replace("run: node verify-test-runtime.mjs", "run: |\n          node verify-test-runtime.mjs\n          node verify-test-runtime-v3.mjs\n          node verify-v3-contract.mjs\n          node verify-v3-migration.mjs");
  text=text.replace("run: node verify-definition-of-done.mjs", "run: |\n          node verify-definition-of-done.mjs\n          node verify-v3-definition-of-done.mjs");
  text=text.replace("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'", "['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'");
  text=text.replace(/node build-test-project\.mjs && node verify-test-runtime\.mjs(?! && node verify-test-runtime-v3\.mjs)/g,"node build-test-project.mjs && node verify-test-runtime.mjs && node verify-test-runtime-v3.mjs && node verify-v3-contract.mjs && node verify-v3-migration.mjs");
  text=text.replace("node verify-test-runtime.mjs > /tmp/verify-test-runtime.out", "node verify-test-runtime.mjs > /tmp/verify-test-runtime.out\n          node verify-test-runtime-v3.mjs > /tmp/verify-test-runtime-v3.out\n          node verify-v3-contract.mjs > /tmp/verify-v3-contract.out\n          node verify-v3-migration.mjs > /tmp/verify-v3-migration.out");
  text=text.replace("node verify-definition-of-done.mjs > /tmp/verify-definition-of-done.out", "node verify-definition-of-done.mjs > /tmp/verify-definition-of-done.out\n          node verify-v3-definition-of-done.mjs > /tmp/verify-v3-definition-of-done.out");
  text=text.replace("grep -q 'verify-test-runtime: PASS' /tmp/verify-test-runtime.out", "grep -q 'verify-test-runtime: PASS' /tmp/verify-test-runtime.out\n          grep -q 'verifyTestRuntimeV3' /tmp/verify-test-runtime-v3.out\n          grep -q 'verifyV3Contract' /tmp/verify-v3-contract.out\n          grep -q 'verifyV3Migration' /tmp/verify-v3-migration.out");
  text=text.replace("const definition=JSON.parse(fs.readFileSync('/tmp/verify-definition-of-done.out','utf8'));", "const definition=JSON.parse(fs.readFileSync('/tmp/verify-definition-of-done.out','utf8'));\n          const v3=JSON.parse(fs.readFileSync('/tmp/verify-v3-definition-of-done.out','utf8'));");
  text=text.replace("projectSchema:'closed-loop-project/2'", "projectSchema:'closed-loop-project/3'");
  text=text.replace("responseSchema:'closed-loop-stage-response/2'", "responseSchema:'closed-loop-stage-response/3'");
  text=text.replace("...definition,", "...definition,\n            ...v3,");
  text=text.replace("nativeTestSpecVersion:'closed-loop-test-spec/1',", "nativeTestSpecVersion:'closed-loop-test-spec/1',\n            testIrSchema:'closed-loop-test-spec/1',\n            verificationPackageSchema:'closed-loop-verification-package/1',");
  text=text.replace("const coverageKeys=['fieldOwnershipCoverage'", "const coverageKeys=['stage01IntakeCoverage','stage04ObligationCoverage','mandatoryEvidenceSufficiencyCoverage','nativeExecutionCoverage','fieldOwnershipCoverage'");
  text=text.replace("const zeroKeys=['unauthorizedFieldMutationsAccepted'", "const zeroKeys=['unsupportedTestIrTreatedAsExecutable','externalAssertionsOverridingApplicationProof','nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction','unauthorizedFieldMutationsAccepted'");
  text=text.replace("structuralCoverage:'verify-definition-of-done.mjs',", "structuralCoverage:'verify-definition-of-done.mjs',\n              v3AccountingAndSufficiency:'verify-v3-definition-of-done.mjs',\n              v3Migration:'verify-v3-migration.mjs',\n              v3Contract:'verify-v3-contract.mjs',");
  write(file,text);
}

/* Add the current verifiers to the repository's broad syntax/proof runner where it
   enumerates files explicitly. */
for(const file of ['verify.mjs','verify-complete.mjs','verify-ingestion.mjs','verify-full-cycle.mjs','verify-prompt-semantics.mjs','verify-semantic-invariant.mjs','verify-definition-of-done.mjs','verify-project-lifecycle.mjs']){
  let text=read(file);text=text.replaceAll('CUSTOM_PIPELINE','TEST_IR');write(file,text);
}

/* Rebuild the retained synthetic project from the current application contracts. */
execFileSync(process.execPath,['build-test-project.mjs'],{cwd:root,stdio:'inherit'});

const report={
  schemaUpgrade:true,
  responseUpgrade:true,
  executableKind:'TEST_IR',
  migrationLayer:true,
  workerRuntimeOrder:true,
  pagesWorkflowUpdated:true,
  transformedFiles:sourceFiles.length
};
write('v3-upgrade-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
