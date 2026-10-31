import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createOperatorBrowser} from './operator-browser-driver.mjs';
import {routingFixture,completedReport} from './test-verification-routing-fixtures.mjs';
import {downloadSyntheticHandoff} from './test-browser-handoff-authorization.mjs';

const directory=path.resolve('verification-routing-browser-evidence');
fs.mkdirSync(directory,{recursive:true});
const report={basis:'SYNTHETIC_TEST_AND_EXTERNAL_REPORT_WITH_ACTUAL_BROWSER_CONTROLS_INDEXEDDB_AND_WORKER',complete:false,cases:[]};
const persist=()=>fs.writeFileSync(path.join(directory,'routing.json'),JSON.stringify(report,null,2)+'\n');
for(const [width,height] of [[320,568],[1280,800]]){
 let browser;
 try{
  browser=await createOperatorBrowser({directory:path.join(directory,String(width)),width,height});
  for(const mode of ['EXTERNAL_SYSTEM','APPLICATION_DETERMINISTIC']){
   const fixture=await browser.evaluate(`(async()=>{
    ${routingFixture.toString()}
    const {p,test,product}=routingFixture(${JSON.stringify(mode)}),engine=closedLoopWorkflowEngine,store=closedLoopProjectStore;
    p.activeStage=${mode==='EXTERNAL_SYSTEM'?6:22};p.activeView='Workflow';
    if(${JSON.stringify(mode)}==='APPLICATION_DETERMINISTIC'){
     const blob=new Blob(['Completed synthetic product bytes'],{type:'text/plain'}),sha256=await closedLoopHash.sha256Bytes(blob),artifactId=engine.allocateId(p,'artifacts');
     await store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename:'product.txt',mediaType:'text/plain',expectedSha256:sha256});
     engine.registerArtifactBytes(p,{artifactId,filename:'product.txt',mediaType:'text/plain',byteSize:blob.size,sha256,lineage:{productId:product.id}});
    }
    const saved=await store.writeProject(p,{expectedProjectRevision:0,createOnly:true,incrementRevision:false});
    const url=new URL(location.href);url.searchParams.delete('version');url.searchParams.set('project',saved.job.JOB_ID);url.searchParams.set('stage',String(p.activeStage));return {url:url.href,testId:test.id,jobId:p.job.JOB_ID};
   })()`);
   await browser.openUrl(fixture.url);
   if(mode==='EXTERNAL_SYSTEM'){
    assert.equal(await browser.exists('#download-capability-request'),true,'Blocked external tests must offer registration.');
    const selector=await browser.evaluate(`Array.from(document.querySelector('#capability-test').options,option=>({value:option.value,text:option.textContent}))`);
    assert.equal(selector.length,1);assert.equal(selector[0].value,fixture.testId,'The readiness selector must retain the exact test binding.');
    assert.ok(!selector[0].text.includes(fixture.testId),'CAPABILITY_GUIDANCE_ORACLE: internal test IDs must not appear in the normal selector.');
    assert.match(selector[0].text,/Evidence needed/);
    const [download]=await downloadSyntheticHandoff(browser,'#download-capability-request',{syntheticProject:true}),request=JSON.parse(download.bytes.toString()).reportTemplate;assert.equal(request.request.testId,fixture.testId);assert(Object.values(request.checks).every(check=>check.status==='UNKNOWN'));
    const completed=await browser.evaluate(`(async()=>{${completedReport.toString()}const p=await closedLoopProjectStore.readProject(${JSON.stringify(fixture.jobId)}),test=p.projectData.tests.find(row=>row.id===${JSON.stringify(fixture.testId)});return completedReport(p,test);})()`);
    await browser.selectFiles('#capability-evidence-file',[{filename:'readiness.json',bytes:Buffer.from(JSON.stringify(completed))}]);
    assert.equal(await browser.exists('#capability-confirm'),true,'Uploading the report must display an explicit authorization review.');
    const review=await browser.evaluate(`(()=>{const section=document.querySelector('#external-capability-evidence');return {heading:section.querySelector('.notice strong')?.textContent,body:section.querySelector('.notice')?.textContent,openDetails:section.querySelectorAll('details[open]').length};})()`);
    assert.ok(review.heading&&!review.heading.includes(fixture.testId),'CAPABILITY_REVIEW_ORACLE: review headings must keep internal IDs behind details.');
    assert.equal(review.openDetails,0,'CAPABILITY_DISCLOSURE_ORACLE: the raw report must initially be collapsed.');
    for(const value of [completed.environment,completed.action.target,completed.request.purpose,completed.action.expectedEffect,completed.action.maximumCost,completed.validUntil])assert.ok(review.body.includes(String(value)),'Authorization context must remain visible before confirmation.');
    assert.equal(await browser.evaluate(`document.querySelector('#capability-confirm').checked`),false,'Authorization cannot default to true.');
    await browser.fill('#capability-operator','SYNTHETIC_BROWSER_OPERATOR');await browser.click('#capability-confirm');await browser.click('#register-capability-evidence');
    await browser.reload();
    const ready=await browser.evaluate(`(async()=>{const p=await closedLoopProjectStore.readProject(${JSON.stringify(fixture.jobId)}),item=closedLoopWorkflowEngine.testExecutionPlan(p).items.find(row=>row.testId===${JSON.stringify(fixture.testId)});return {ready:item.capabilityReady,count:p.projectData.externalCapabilities.length,purposes:p.projectData.humanDecisions.map(row=>closedLoopWorkflowEngine.recordValue(row,'PURPOSE'))};})()`);
    assert.equal(ready.ready,true);assert.equal(ready.count,1);assert.equal(ready.purposes.filter(value=>value==='EXTERNAL_ACTION_RISK_AUTHORIZATION').length,1);assert.equal(ready.purposes.filter(value=>value==='DISCLOSURE_AUTHORIZATION').length,1);
   }else{
    assert.equal(await browser.exists('#run-native-tests'),true,'A canonical-only input test must reach the native control.');
    await browser.click('#run-native-tests');await browser.reload();
    const result=await browser.evaluate(`(async()=>{const p=await closedLoopProjectStore.readProject(${JSON.stringify(fixture.jobId)}),row=p.projectData.deterministicResults.find(row=>closedLoopWorkflowEngine.recordValue(row,'TEST_ID')===${JSON.stringify(fixture.testId)});return row?{determination:closedLoopWorkflowEngine.recordValue(row,'APPLICATION_DETERMINATION'),files:JSON.parse(closedLoopWorkflowEngine.recordValue(row,'INPUT_ARTIFACT_IDENTITIES')),observations:p.projectData.observationRecords.length}:null;})()`);
    assert.ok(result,'The worker result must be durably recorded.');assert.equal(result.determination,'SATISFIED');assert.equal(result.files.length,0);assert.ok(result.observations>0);
   }
   const layout=await browser.inspect(mode==='EXTERNAL_SYSTEM'?6:22);assert.equal(browser.exceptions().length,0,'Browser emitted an uncaught exception.');report.cases.push({width,height,mode,result:'PASS',layout,events:[...browser.events]});persist();
  }
 }catch(error){report.cases.push({width,height,result:'FAIL',error:String(error.stack||error)});persist();throw error;}
 finally{await browser?.close();}
}
report.complete=true;persist();console.log(JSON.stringify({verificationRoutingBrowser:'PASS',cases:report.cases.length,basis:report.basis}));
