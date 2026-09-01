import fs from 'node:fs';
import vm from 'node:vm';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};

// These counts describe the repository's deliberately composed loading phases.
// They are not permission to append another late wrapper: any new global export
// must be integrated into an existing owning phase and this contract reviewed.
const contracts=Object.freeze([
  Object.freeze({file:'workflow-engine.js',globalName:'closedLoopWorkflowEngine',assignments:2,classification:'base authority plus the integrated /3 completion amendment'}),
  Object.freeze({file:'workflow-schema.js',globalName:'closedLoopWorkflowSchema',assignments:4,classification:'base schema, deterministic legacy migration composition, and the integrated /3 schema composition'}),
  Object.freeze({file:'response-ingestion.js',globalName:'closedLoopResponseIngestion',assignments:2,classification:'base ingestion authority plus its pre-existing historical-schema constant composition'}),
  Object.freeze({file:'project-store.js',globalName:'closedLoopProjectStore',assignments:1,classification:'single integrated project-store authority'}),
  Object.freeze({file:'prompt-engine.js',globalName:'closedLoopPromptEngine',assignments:1,classification:'single prompt authority'})
]);

function auditSource(source,contract){
  const escaped=contract.globalName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const assignmentPattern=new RegExp(`globalThis\\.${escaped}\\s*=`, 'g');
  const assignments=[...source.matchAll(assignmentPattern)];
  assert(assignments.length===contract.assignments,`${contract.file} has ${assignments.length} global authority exports; expected exactly ${contract.assignments} (${contract.classification}). Fold new behavior into the owning export instead of appending a post-export wrapper.`);
  const propertyMutationPattern=new RegExp(`(?:globalThis\\.)?${escaped}\\s*\\.[A-Za-z_$][A-Za-z0-9_$]*\\s*=`, 'g');
  assert(!propertyMutationPattern.test(source),`${contract.file} mutates the exported runtime authority in place.`);
  const assignMutationPattern=new RegExp(`Object\\.assign\\s*\\(\\s*(?:globalThis\\.)?${escaped}\\b`, 'g');
  assert(!assignMutationPattern.test(source),`${contract.file} uses Object.assign to monkey-patch the exported runtime authority.`);
  assert(!/MutationObserver\s*\(/.test(source),`${contract.file} contains a MutationObserver runtime patch.`);
  return {file:contract.file,globalName:contract.globalName,assignmentCount:assignments.length,classification:contract.classification};
}

const results=contracts.map(contract=>auditSource(fs.readFileSync(contract.file,'utf8'),contract));

const engineContract=contracts[0],engineSource=fs.readFileSync(engineContract.file,'utf8');
const injectedLatePatch=`\n;(()=>{globalThis.${engineContract.globalName}=Object.freeze({...globalThis.${engineContract.globalName},latePatch:true});})();\n`;
let rejectedInjectedPatch=false;
try{auditSource(engineSource+injectedLatePatch,engineContract);}catch(error){rejectedInjectedPatch=/global authority exports/.test(String(error?.message||error));}
assert(rejectedInjectedPatch,'The architecture guard did not reject a simulated post-final-export monkey patch.');

const promptSource=fs.readFileSync('prompt-engine.js','utf8');
assert(!/\bwrapPrompt\s*\(/.test(promptSource),'prompt-engine.js still has a runtime prompt wrapper.');
assert((promptSource.match(/core\.buildStagePrompt\s*=\s*build\s*;/g)||[]).length===1,'The single core prompt entry point is not bound exactly once to the final prompt authority.');

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
for(const contract of contracts){
  const authority=globalThis[contract.globalName];
  assert(authority&&typeof authority==='object',`${contract.globalName} did not load as one runtime authority.`);
  assert(Object.isFrozen(authority),`${contract.globalName} is not frozen after its final composition phase.`);
}
assert(globalThis.closedLoopCore.buildStagePrompt===globalThis.closedLoopPromptEngine.build,'The workbook prompt entry point and prompt-engine export are not the same final authority.');
assert(typeof globalThis.closedLoopWorkflowEngine.recordDisclosureAuthorization==='function','Disclosure authorization was not folded into the final workflow-engine authority.');
assert(typeof globalThis.closedLoopProjectStore.migrateProjectToCurrent==='function','Project migration was not folded into the final project-store authority.');

console.log(JSON.stringify({singleRuntimeAuthority:'PASS',postFinalExportMutationRejected:true,runtimePromptWrapperCount:0,frozenRuntimeAuthorities:true,sharedPromptEntryPoint:true,authorities:results}));
