import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash;
let fixtureSequence=0;
function fixture(){const p=core.createBlankState('JOB-STAGE26-'+String(++fixtureSequence).padStart(3,'0'));engine.ensureShape(p);const baseline={id:'BASELINE-1',stage:20,active:true,scope:{},fields:{BASELINE_ID:'BASELINE-1',STATUS:'FROZEN'},BASELINE_ID:'BASELINE-1',STATUS:'FROZEN'},product={id:'PRODUCT-1',stage:21,active:true,scope:{baselineId:'BASELINE-1',productId:'PRODUCT-1'},fields:{PRODUCT_ID:'PRODUCT-1',PRODUCT_VERSION:'PRODUCT-v001',BASELINE_ID:'BASELINE-1',STATUS:'COMPLETED',GENERATED_ARTIFACT_INVENTORY:[artifactFixtureId(engine,p,'ART-A'),artifactFixtureId(engine,p,'ART-B')]},PRODUCT_ID:'PRODUCT-1',PRODUCT_VERSION:'PRODUCT-v001',BASELINE_ID:'BASELINE-1',STATUS:'COMPLETED',GENERATED_ARTIFACT_INVENTORY:[artifactFixtureId(engine,p,'ART-A'),artifactFixtureId(engine,p,'ART-B')]};p.projectData.baselines.push(baseline);p.projectData.products.push(product);p.job.CURRENT_BASELINE_ID='BASELINE-1';p.job.CURRENT_PRODUCT_ID='PRODUCT-1';p.job.CURRENT_PRODUCT_VERSION='PRODUCT-v001';for(const [id,text] of [[artifactFixtureId(engine,p,'ART-A'),'A'],[artifactFixtureId(engine,p,'ART-B'),'B']])engine.registerArtifactBytes(p,{stage:21,artifactId:id,filename:id+'.pdf',byteSize:text.length,sha256:hash.sha256Text(text),lineage:{productId:'PRODUCT-1',transformationIds:['TRANSFORM-'+id],packageMembership:{package:'delivery'},viewerRequirements:['PDF']}});for(let stage=1;stage<=24;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}return p;}
function decision(p,ids){return engine.recordRegisteredHumanDecision(p,{stage:25,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value([...ids].sort()),value:[...ids].sort(),operatorLabel:'STAGE26'});}
{const p=fixture(),before=p.projectData.deliveryCandidateSets.length;assert.throws(()=>engine.freezeDeliveryCandidate(p,{artifactIds:[artifactFixtureId(engine,p,'ART-A'),artifactFixtureId(engine,p,'ART-B')]}),/human decision|required/i);assert.equal(p.projectData.deliveryCandidateSets.length,before);assert.equal(p.job.CURRENT_DELIVERY_CANDIDATE_SET_ID,null);}
{const p=fixture(),before=p.projectData.deliveryCandidateSets.length;assert.throws(()=>engine.freezeDeliveryCandidate(p,{artifactIds:[artifactFixtureId(engine,p,'ART-A')]}),/exact current finished-product artifact set/);assert.equal(p.projectData.deliveryCandidateSets.length,before);assert.equal(p.job.CURRENT_DELIVERY_CANDIDATE_SET_ID,null);}
{const p=fixture(),d=decision(p,[artifactFixtureId(engine,p,'ART-A')]),before=p.projectData.deliveryCandidateSets.length;p.stages[24].status='COMPLETE';assert.throws(()=>engine.freezeDeliveryCandidate(p,{artifactIds:[artifactFixtureId(engine,p,'ART-A'),artifactFixtureId(engine,p,'ART-B')],selectionDecisionId:engine.recordId(d,'humanDecisions')}),/exact selected artifact set/);assert.equal(p.projectData.deliveryCandidateSets.length,before);assert.equal(p.job.CURRENT_DELIVERY_CANDIDATE_SET_ID,null);}
{const p=fixture(),ids=[artifactFixtureId(engine,p,'ART-A'),artifactFixtureId(engine,p,'ART-B')],d=decision(p,ids);p.stages[24].status='COMPLETE';const candidate=engine.freezeDeliveryCandidate(p,{artifactIds:ids,selectionDecisionId:engine.recordId(d,'humanDecisions')});assert.equal(p.job.CURRENT_DELIVERY_CANDIDATE_SET_ID,engine.recordId(candidate,'deliveryCandidateSets'));p.stages[24].status='COMPLETE';assert.equal(engine.freezeDeliveryCandidate(p,{artifactIds:ids,selectionDecisionId:engine.recordId(d,'humanDecisions')}),candidate);const artifact=p.projectData.artifacts.find(x=>x.id===artifactFixtureId(engine,p,'ART-A')),filename=artifact.FILENAME;artifact.FILENAME=artifact.fields.FILENAME='renamed.pdf';assert.equal(engine.deliveryCandidateClosure(p).complete,false);artifact.FILENAME=artifact.fields.FILENAME=filename;assert.equal(engine.deliveryCandidateClosure(p).complete,true);const sha=artifact.SHA256;artifact.SHA256=artifact.fields.SHA256='0'.repeat(64);assert.equal(engine.deliveryCandidateClosure(p).complete,false);artifact.SHA256=artifact.fields.SHA256=sha;assert.equal(engine.deliveryCandidateClosure(p).complete,true);}
// Frozen candidate field contents. The invalidation cases below prove that a change makes the candidate stale;
// these prove the frozen record itself carries the exact transformation, package, viewer and lineage values, so a
// dedicated field that is silently emptied (while the raw lineage still changes the digest) is caught as well.
const frozenFieldCases=[];
{
 const p=fixture(),ids=[artifactFixtureId(engine,p,'ART-A'),artifactFixtureId(engine,p,'ART-B')].sort(),d=decision(p,ids);p.stages[24].status='COMPLETE';
 const candidate=engine.freezeDeliveryCandidate(p,{artifactIds:ids,selectionDecisionId:engine.recordId(d,'humanDecisions')}),field=name=>engine.recordValue(candidate,name);
 const lineage=id=>({productId:'PRODUCT-1',transformationIds:['TRANSFORM-'+id],packageMembership:{package:'delivery'},viewerRequirements:['PDF']});
 assert.deepEqual(field('TRANSFORMATION_RECORD_IDS'),ids.map(id=>'TRANSFORM-'+id),'FROZEN_TRANSFORMATION_RECORDS_ORACLE');frozenFieldCases.push('frozen-set-contains-transformation-records');
 assert.deepEqual(field('PACKAGE_MEMBERSHIP'),ids.map(id=>({artifactId:id,membership:{package:'delivery'}})),'FROZEN_PACKAGE_MEMBERSHIP_ORACLE');frozenFieldCases.push('frozen-set-contains-package-membership');
 assert.deepEqual(field('VIEWER_REQUIREMENTS'),ids.map(()=>'PDF'),'FROZEN_VIEWER_REQUIREMENTS_ORACLE');frozenFieldCases.push('frozen-set-contains-viewer-requirements');
 const productLineage=field('PRODUCT_LINEAGE');
 assert.deepEqual([productLineage.productId,productLineage.productVersion,productLineage.baselineId],['PRODUCT-1','PRODUCT-v001','BASELINE-1'],'FROZEN_PRODUCT_LINEAGE_IDENTITY_ORACLE');
 assert.deepEqual(productLineage.artifacts.map(row=>row.lineage),ids.map(lineage),'FROZEN_PRODUCT_LINEAGE_ARTIFACTS_ORACLE');frozenFieldCases.push('frozen-set-contains-product-lineage');
}
// Frozen-set invalidation mutations. The closure recomputes the set from live
// canonical records, so each change below must make the exact frozen candidate
// stale with the identity-differs reason, and restoring it must make it current.
const INVALIDATION_REASON='Frozen delivery candidate identity differs from live canonical dependencies.';
const invalidationCases=[];
function invalidationCase(name,mutate){
 const p=fixture(),ids=[artifactFixtureId(engine,p,'ART-A'),artifactFixtureId(engine,p,'ART-B')],d=decision(p,ids);p.stages[24].status='COMPLETE';
 engine.freezeDeliveryCandidate(p,{artifactIds:ids,selectionDecisionId:engine.recordId(d,'humanDecisions')});
 const artifact=p.projectData.artifacts.find(x=>x.id===ids[0]),notes=artifact.fields.NOTES,byteSize=artifact.fields.BYTE_SIZE,filename=artifact.fields.FILENAME,sha256=artifact.fields.SHA256;
 assert.equal(engine.deliveryCandidateClosure(p).complete,true,name+' frozen candidate starts current');
 const setNotes=change=>{const lineage=JSON.parse(notes);change(lineage);artifact.fields.NOTES=artifact.NOTES=JSON.stringify(lineage);};
 mutate({setNotes,artifact});
 const stale=engine.deliveryCandidateClosure(p);
 assert.equal(stale.complete,false,name+' must invalidate the frozen candidate');
 assert(stale.reasons.includes(INVALIDATION_REASON),name+' must fail with the identity-differs reason: '+JSON.stringify(stale.reasons));
 artifact.fields.NOTES=artifact.NOTES=notes;artifact.fields.BYTE_SIZE=artifact.BYTE_SIZE=byteSize;artifact.fields.FILENAME=artifact.FILENAME=filename;artifact.fields.SHA256=artifact.SHA256=sha256;
 assert.equal(engine.deliveryCandidateClosure(p).complete,true,name+' restored candidate is current again');
 invalidationCases.push(name);
}
invalidationCase('changed-transformation',({setNotes})=>setNotes(lineage=>{lineage.transformationIds=['TRANSFORM-CHANGED'];}));
invalidationCase('changed-package-membership',({setNotes})=>setNotes(lineage=>{lineage.packageMembership={package:'other'};}));
invalidationCase('changed-viewer-requirement',({setNotes})=>setNotes(lineage=>{lineage.viewerRequirements=['OTHER'];}));
invalidationCase('changed-product-lineage-field',({setNotes})=>setNotes(lineage=>{lineage.unrelatedLineageField='changed';}));
invalidationCase('changed-byte-size',({artifact})=>{artifact.fields.BYTE_SIZE=artifact.BYTE_SIZE=Number(artifact.fields.BYTE_SIZE)+1;});
invalidationCase('changed-filename',({artifact})=>{artifact.fields.FILENAME=artifact.FILENAME='renamed-by-mutation.pdf';});
invalidationCase('changed-sha256',({artifact})=>{artifact.fields.SHA256=artifact.SHA256='0'.repeat(64);});
assert(!/stage===25[^]*registerStageFiles/.test(fs.readFileSync('app-core.js','utf8')),'Stage 25 must use stored product bytes rather than source-file reselection.');
console.log(JSON.stringify({controllerStage:'26',applicationStage:'25',deliveryCandidateFreeze:'PASS',isolatedDisposableProjects:true,mutationSensitive:true,intentionalInvalidFixturesRejected:['missing-human-selection','incomplete-artifact-set','decision-bound-to-wrong-artifact-set'],deliveryCandidateInvalidationCases:invalidationCases,deliveryCandidateFrozenFieldCases:frozenFieldCases}));
