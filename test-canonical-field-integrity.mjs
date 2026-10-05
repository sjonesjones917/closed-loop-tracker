import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {SPECIFICATION_JOB_FIELDS} from './test-specification-field-registry.mjs';

// Section 15 supplies the Job universe; each stage's authoritative field owner
// supplies its type. Wrong-type outcomes are literal, not validator-generated.
// This exercises the production store through a declared transaction adapter.
// It does not establish field provenance, stage completion, or browser behavior.
export async function verifyCanonicalFieldIntegrity({sourceOverrides={}}={}){
 const r=projectStoreRuntime({sourceOverrides}),{store,engine,copy}=r,schema=r.runtime.closedLoopWorkflowSchema;
 let saved=await store.createProject({commandId:'SYNTHETIC-CANONICAL-FIELD-INTEGRITY'});
 const wrong={STRING:{wrong:'object'},INTEGER:['1'],NUMBER:{wrong:'number'},BOOLEAN:'false',REFERENCE:{wrong:'reference'},STRING_ARRAY:{wrong:'array'},REFERENCE_ARRAY:{wrong:'array'},OBJECT:['wrong'],OBJECT_ARRAY:{wrong:'array'}};
 const negatives=[],check=(candidate,path,oracle)=>{const checked=store.validateProjectIntegrity(candidate,{verifyDerived:false});assert.equal(checked.valid,false,oracle+': '+path);assert(checked.issues.some(message=>message.includes(path)&&message.includes('Expected')),'CANONICAL_FIELD_DIAGNOSTIC_ORACLE: '+path);negatives.push(path);};
 assert.equal(store.validateProjectIntegrity(saved).valid,true,'CANONICAL_FIELD_BLANK_CONTROL_ORACLE');
 assert.equal(SPECIFICATION_JOB_FIELDS.length,44);
 for(const [name]of SPECIFICATION_JOB_FIELDS){const definition=schema.JOB_FIELDS[name];assert(definition,'Missing independently specified Job field '+name);assert(Object.hasOwn(wrong,definition.valueType),'Unsupported explicit wrong-type fixture '+definition.valueType);const candidate=copy(saved);candidate.job[name]=copy(wrong[definition.valueType]);check(candidate,'/job/'+name,'CANONICAL_JOB_FIELD_TYPE_ORACLE');}
 let stageFields=0;const partitions=['agentData','humanData','acceptedData','derivedData'];
 for(let stage=1;stage<=30;stage++)for(const [name,definition]of Object.entries(schema.STAGE_FIELDS[stage])){stageFields++;assert(Object.hasOwn(wrong,definition.valueType),'Unsupported explicit wrong-type fixture '+definition.valueType);for(const carrier of partitions){const candidate=copy(saved);candidate.stages[stage][carrier][name]=copy(wrong[definition.valueType]);check(candidate,`/stages/${stage}/${carrier}/${name}`,'CANONICAL_STAGE_FIELD_TYPE_ORACLE');}}
 // Missing future-stage values are not required merely to save a project.
 const partial=copy(saved);for(const name of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'])delete partial.job[name];
 partial.job.DESIRED_SOURCE_COUNT=null;partial.job.REQUIRED_OUTPUT_FORMAT=null;
 partial.job.EXACT_USER_OBJECTIVE_VERBATIM='<value>';partial.job.EXPLICIT_USER_REQUIREMENTS='x'.repeat(200001);
 const producerIssues=[];r.ingestion.validateValue(schema.STAGE_FIELDS[1].ASSUMPTIONS,'<value>','/stageData/ASSUMPTIONS',producerIssues);assert(producerIssues.some(issue=>issue.code==='PLACEHOLDER_VALUE'),'CANONICAL_FIELD_PRODUCER_PLACEHOLDER_ORACLE');
 partial.vendorExtension=copy({opaque:{CURRENT_STAGE:['vendor literal'],unknown:null}});partial.stages[30].humanData.vendorExtension=copy({opaque:['retained']});
 assert.equal(store.validateProjectIntegrity(partial,{verifyDerived:false}).valid,true,'CANONICAL_FIELD_PARTIAL_CONTROL_ORACLE');
 saved=await store.writeProject(partial,{expectedProjectRevision:saved.revision});
 const baseline=await store.readProject(saved.job.JOB_ID),history=await store.historyList(saved.job.JOB_ID),writeCases=[];
 const cases=[['job','EXACT_USER_OBJECTIVE_VERBATIM',{opaque:'wrong object'}],['job','DESIRED_SOURCE_COUNT',['3']],['job','EXACT_USER_OBJECTIVE_VERBATIM',{toString:null,valueOf:null}],['job','JOB_ID',{toString:null,valueOf:null}],['job','JOB_OWNER',['wrong owner']],['job','ASSUMPTIONS',{wrong:'claim'}],['stage','agentData','ASSUMPTIONS',{wrong:'claim'}],['stage','humanData','JOB_TITLE',['wrong title']],['stage','acceptedData','ASSUMPTIONS',{wrong:'claim'}],['stage','derivedData','STATUS_EVIDENCE',['wrong evidence']]];
 for(const [kind,a,b,c]of cases){const candidate=copy(saved);const path=kind==='job'?'/job/'+a:'/stages/1/'+a+'/'+b;if(kind==='job')candidate.job[a]=copy(b);else candidate.stages[1][a][b]=copy(c);
  await assert.rejects(store.writeProject(candidate,{expectedProjectRevision:saved.revision}),error=>error.code==='PROJECT_INTEGRITY_FAILED'&&error.message.includes(path),'CANONICAL_FIELD_WRITE_ORACLE: '+path);
  assert.deepEqual(await store.readProject(saved.job.JOB_ID),baseline,'CANONICAL_FIELD_ATOMIC_STATE_ORACLE');assert.deepEqual(await store.historyList(saved.job.JOB_ID),history,'CANONICAL_FIELD_ATOMIC_HISTORY_ORACLE');writeCases.push(path);
 }
 const bytes=await store.exportPackage(saved.job.JOB_ID),destination=projectStoreRuntime({sourceOverrides}),restored=await destination.store.importPackage(bytes),reloaded=await destination.store.readProject(restored.job.JOB_ID);
 assert.deepEqual(JSON.parse(JSON.stringify(reloaded.vendorExtension)),{opaque:{CURRENT_STAGE:['vendor literal'],unknown:null}},'CANONICAL_FIELD_EXTENSION_PRESERVATION_ORACLE');
 assert.deepEqual(JSON.parse(JSON.stringify(reloaded.stages[30].humanData.vendorExtension)),{opaque:['retained']},'CANONICAL_FIELD_STAGE_EXTENSION_ORACLE');assert.equal(reloaded.job.DESIRED_SOURCE_COUNT,null);assert.equal(reloaded.job.REQUIRED_OUTPUT_FORMAT,null);assert.equal(reloaded.job.EXACT_USER_OBJECTIVE_VERBATIM,'<value>','CANONICAL_FIELD_VERBATIM_HUMAN_ORACLE');assert.equal(reloaded.job.EXPLICIT_USER_REQUIREMENTS,'x'.repeat(200001),'CANONICAL_FIELD_PERSISTED_TEXT_LIMIT_ORACLE');
 return {status:'PASS',jobFields:44,stages:30,stageFields,partitions,negativeCases:negatives,writeCases,validBlankAndPartial:true,nullableControls:2,verbatimHumanPlaceholderPreserved:true,largeHumanInputPreserved:true,producerPlaceholderStillRejected:true,absentFutureValuesPreserved:true,unknownExtensionsPreserved:true,writeRejectionPreservesStateAndHistory:true,actualExportImportReload:true,synthetic:true,actualBrowser:false,scopeLimit:'Known present canonical scalar fields only; provenance, required-at-stage completion, retained opaque archives and genuine human authority are separate obligations.'};
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1])console.log(JSON.stringify(await verifyCanonicalFieldIntegrity({sourceOverrides:process.env.CANONICAL_FIELD_STORE_SOURCE?{'project-store.js':fs.readFileSync(process.env.CANONICAL_FIELD_STORE_SOURCE,'utf8')}:{}})));
