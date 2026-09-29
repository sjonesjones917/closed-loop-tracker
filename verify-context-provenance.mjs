import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const {core,engine,copy,runtime,prompts}=projectStoreRuntime({fault:process.argv.includes('--fault=global-prompt-input')?{file:'prompt-engine.js',id:'global-prompt-input',before:"const expected=key==='inputVersion'?inputVersions.get(owner):scope?.[key];",after:'const expected=scope?.[key];'}:process.argv.includes('--fault=global-version')?{file:'workflow-engine.js',id:'global-version',before:'if(permittedVersion)context.job[key]=permittedVersion.version;',after:'if(permittedVersion)context.job[key]=project.job[key];'}:process.argv.includes('--fault=limited-provenance')?{file:'workflow-engine.js',id:'limited-provenance',before:'referencesBlocked(record)',after:'referencesBlocked([record.relationships,record.evidenceRefs,record.sourceRecordIds,record.sourceIds,record.lineage,record.scope])'}:null}),cases=[];
const provenanceFields=['sourceProposalId','rawResponseId','acceptedChangeId','sourceAcceptedChangeId','extractionManifestId'];
let pairs=0;
for(const selected of core.STAGES)for(const later of core.STAGES.filter(stage=>stage.number>selected.number)){
 const p=core.createBlankState('CONTEXT-PROVENANCE-UNIT');engine.ensureShape(p);
 const laterRecords=[['responseProposals','proposalId'],['rawResponses','rawResponseId'],['acceptedChanges','changeId'],['extractionManifests','manifestId'],['history','eventId']];
 for(const [family,idField] of laterRecords)p.projectData[family].push(copy({stage:later.number,[idField]:'LATER-'+family}));
 for(const [index,key] of provenanceFields.entries())p.projectData.evidenceRecords.push(copy({id:'EARLIER-SUMMARY-'+index,stage:selected.number,[key]:key==='sourceProposalId'?'LATER-responseProposals':key==='rawResponseId'?'LATER-rawResponses':key==='extractionManifestId'?'LATER-extractionManifests':'LATER-acceptedChanges',fields:{OBSERVATION:'PRIVATE_DERIVED_MATERIAL_'+index}}));
 p.projectData.evidenceRecords.push(copy({id:'EARLIER-SUMMARY-NESTED',stage:selected.number,payload:{source:{eventId:'LATER-history'}},fields:{OBSERVATION:'PRIVATE_DERIVED_NESTED'}}));
 p.projectData.evidenceRecords.push(copy({id:'PERMITTED-EARLIER',stage:selected.number,fields:{OBSERVATION:'Permitted earlier material remains available.'}}));
 const before=JSON.stringify(p),context=engine.stageContext(p,selected.number),text=JSON.stringify(context);
 assert.equal(text.includes('PRIVATE_DERIVED_'),false,'PROVENANCE_CONTEXT_ORACLE: subsequent-stage material escaped through an earlier summary or its provenance');
 assert.ok(text.includes('Permitted earlier material remains available.'));assert.equal(JSON.stringify(p),before);pairs++;
}
cases.push({name:'Declared production provenance and nested summary sources exclude later material for every applicable stage pair',result:'PASS',stages:core.STAGES.length,orderedPairs:pairs,provenanceFields});
const versions=[['sources','CURRENT_SOURCE_SET_VERSION','SOURCE-SET','sourceSetVersion'],['research','CURRENT_RESEARCH_VERSION','RESEARCH','researchVersion'],['requirements','CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS','requirementsVersion'],['tests','CURRENT_TEST_SUITE_VERSION','TEST-SUITE','testSuiteVersion'],['instructions','CURRENT_INSTRUCTION_VERSION','INSTRUCTION','instructionVersion']];
let versionCases=0;
for(const [family,pointer,kind,dimension] of versions)for(const selected of core.STAGES){
 const owningStage=Number(runtime.closedLoopWorkflowSchema.RECORD_SCHEMAS[family].stage);
 if(selected.number<owningStage)continue;
 const later=core.STAGES.find(stage=>stage.number>selected.number);if(!later)continue;
 const p=core.createBlankState('CONTEXT-VERSION-UNIT');engine.ensureShape(p);const earlierVersion=kind+'-v001',laterVersion=kind+'-v002';p.job[pointer]=laterVersion;
 p.projectData.acceptedChanges.push(copy({stage:later.number,changeId:'LATER-CORRECTION'}));
 p.projectData.artifactVersions.push(copy({stage:owningStage,kind,versionId:'EARLIER-VERSION',version:earlierVersion}),copy({stage:owningStage,kind,versionId:'LATER-VERSION',version:laterVersion,acceptedChangeId:'LATER-CORRECTION'}));
 p.projectData[family].push(copy({id:'EARLIER-CURRENT-RECORD',stage:owningStage,scope:{...engine.currentScope(p),[dimension]:earlierVersion},fields:{SUMMARY:'Permitted current-stage material'}}),copy({id:'LATER-CORRECTED-RECORD',stage:later.number,scope:{...engine.currentScope(p),[dimension]:laterVersion},fields:{SUMMARY:'LATER_VERSION_PRIVATE'}}));
 const context=engine.stageContext(p,selected.number);assert.equal(context.job[pointer],earlierVersion,'GOVERNING_VERSION_CONTEXT_ORACLE: earlier context inherited a later correction version');assert.ok(engine.recordsForCurrentScope(context,family).some(record=>record.id==='EARLIER-CURRENT-RECORD'),'GOVERNING_VERSION_RECORD_ORACLE: compatible earlier material disappeared under a later version pointer');assert.equal(JSON.stringify(context).includes('LATER_VERSION_PRIVATE'),false);versionCases++;
}
cases.push({name:'Selected contexts recover permitted governing versions and matching records after later corrections',result:'PASS',versionCases});
const schema=runtime.closedLoopWorkflowSchema,owner=Number(schema.RECORD_SCHEMAS.sources.stage),reader=core.STAGES.flatMap(stage=>schema.STAGE_CONTRACTS[stage.number].operations.map(operation=>({stage:stage.number,operation}))).find(item=>item.stage>owner&&schema.operationContract(item.stage,item.operation).readCollections.includes('sources'));
assert.ok(reader);const inputProject=core.createBlankState('CONTEXT-INPUT-CONTINUATION');engine.ensureShape(inputProject);inputProject.job.EXACT_USER_OBJECTIVE_VERBATIM='Retain valid authorized context.';engine.recordHumanInputVersion(inputProject,['EXACT_USER_OBJECTIVE_VERBATIM']);inputProject.projectData.sources.push(copy({id:'VALID-UPSTREAM-SOURCE',stage:owner,scope:engine.currentScope(inputProject),fields:{TITLE:'VALID_UPSTREAM_TITLE',SOURCE_ID:'VALID-UPSTREAM-SOURCE'}}));
const contextText=()=>prompts.contextFor(reader.stage,inputProject,reader.operation,prompts.scopeFor(reader.stage,inputProject));assert.ok(contextText().includes('VALID_UPSTREAM_TITLE'),'The positive context fixture must expose its permitted source before clarification');
inputProject.projectData.userEntered.clarifications.push(copy({stage:reader.stage,operation:reader.operation,answer:'A current-stage clarification.'}));engine.recordHumanInputVersion(inputProject,['CLARIFICATION']);
assert.ok(contextText().includes('VALID_UPSTREAM_TITLE'),'PROMPT_PREREQUISITE_SCOPE_ORACLE: a later clarification removed permitted upstream source material from the generated handoff');cases.push({name:'Generated agent-facing context retains compatible prerequisite material after a scoped clarification',result:'PASS',selectedStage:reader.stage,operation:reader.operation,sourceStage:owner});
console.log(JSON.stringify({synthetic:true,actualBrowser:false,scope:'Context-projection unit states; not complete operator or external-output evidence',cases},null,2));
