import {checkedVerifier} from './verify-conformance-regressions.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import './hash.js';
import {validateDeploymentContractIdentities} from './deployment-contract-identities.mjs';
import {evidenceFingerprint,readExecutionReceipts,aggregateExecutedEvidence,requireBrowserScope,sha as evidenceSha} from './verification-evidence.mjs';

const hash=globalThis.closedLoopHash;
export const manifestName='closed-loop-deployment-manifest.json';
export const runtimePaths=['index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','TEST_PROJECT.json','.nojekyll'];
export const foundationProofSteps=[
  'Syntax','Schema, ownership, and single-architecture proof','Deployment manifest, build identity, and reproducibility',
  'Complete 30-stage canonical data-route closure','Contract-profile migration','Stage 01 agent response contract alignment',
  'Stage 01 raw intake and semantic accounting','Stage 02 bounded search and Stage 03 omission challenge',
  'Stage 04 obligation accounting and prompt completeness','Test IR validation, security, and deterministic runtime',
  'Raw-first ingestion and negative cases','Preserve foundation proof'
];
export const workflowGateProofSteps=[
  'Download foundation proof','Validate foundation ingestion receipt','Download complete deferred matrix receipt',
  'Validate complete deferred matrix receipt','Validate current registry receipt','Cross-stage contract gates','Physical iPhone release-tag governance',
  'Workflow and gates','Prompt semantics and leakage','Preserve workflow gate proof'
];
export const testCheckProofSteps=[
  'Require successful foundation job','Require successful workflow gate job','Require successful deferred matrix job','Require successful conformance groups',
  'Download workflow gate proof','Validate workflow gate ingestion receipt','Download complete conformance group reports',
  'Download complete conformance execution receipts','Validate complete conformance handoff','Verified artifact reuse checks',
  'Require deferred matrix proof or verified artifact reuse','Download complete deferred matrix receipt','Validate complete deferred matrix receipt',
  'Full cycle and terminal boundary','Complete current non-browser assertion evidence','Stale project navigation and draft preservation',
  'Verification routing and capability evidence','Startup and scrolling at phone and desktop sizes',
  'Acceptance viewport regression and targeted layout fault','Build static application for operator verification','Local Chromium supporting paths','Validate local supporting browser receipts',
  'Preserve test checks proof'
];
export const operatorJourneyProofSteps=[
  'Require successful foundation job','Download foundation proof','Validate foundation ingestion receipt','Build independent local journey runtime','Verify prepared runtime source and bytes',
  'Complete local operator journey','Validate complete local operator receipt','Preserve complete operator journey evidence','Preserve complete local operator receipt'
];
export const fullTestSteps=[
  'Require successful foundation job','Require successful workflow gate job','Require successful deferred matrix job','Require successful conformance groups',
  'Require successful test checks job','Require successful operator journey job','Download test checks proof','Verify prepared runtime source and bytes',
  'Validate prepared local browser receipts','Download complete local operator receipt','Validate complete local browser receipt set',
  'Collect current executed assertion evidence','Seal verified deployment artifact','Preserve verified site for merge and live verification'
];
export const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const requireValue=(condition,message)=>{if(!condition)throw new Error(message);};
function workflowJob(workflow,name){
  const marker='\n  '+name+':\n',start=workflow.indexOf(marker);
  requireValue(start>=0&&workflow.indexOf(marker,start+marker.length)<0,'Required '+name+' proof job is absent or duplicated.');
  const following=workflow.slice(start+marker.length),end=following.search(/\n  [a-z][\w-]*:\n/);
  return end<0?following:following.slice(0,end);
}
export const preloadedWorkflowJobs=['foundation','deferred-matrix','workflow-gates','conformance','test-checks','operator-journey','test','publish-status'];
export function assertWorkflowPreloadBoundaries(workflow){
  const preloadedJobs=preloadedWorkflowJobs;
  const expected='--import ${{ github.workspace }}/verification-evidence-preload.mjs',uploads=[];
  for(const name of preloadedJobs){
    const job=workflowJob(workflow,name),environment=job.split('    env:\n')[1]?.split(/\n    [a-z][\w-]*:/)[0];
    requireValue(/^      NODE_OPTIONS: (.*)$/m.exec(environment||'')?.[1]===expected,'Required repository producer job preload must remain enabled: '+name);
  }
  for(const jobMatch of workflow.slice(workflow.indexOf('\njobs:\n')).matchAll(/^  ([a-z][\w-]*):\n/gm)){
    const job=jobMatch[1],block=workflowJob(workflow,job);
    for(const match of block.matchAll(/^      - [\s\S]*?(?=^      - |(?![\s\S]))/gm)){
      const step=match[0],name=/^      - name: (.*)$/m.exec(step)?.[1]||'unnamed action';
      const nodeOptions=/^          NODE_OPTIONS: (.*)$/m.exec(step)?.[1];
      if(/^(?:      - |        )uses: actions\/upload-artifact@/m.test(step)){
        requireValue(nodeOptions==="''"||nodeOptions==='""','Artifact upload action must clear the repository preload before checkout: '+job+'/'+name);
        uploads.push({job,name,inheritedNodeOptions:preloadedJobs.includes(job)?expected:'',nodeOptions:''});
      }else if(preloadedJobs.includes(job)&&/^        run:/m.test(step)){
        requireValue(nodeOptions===undefined,'Repository producer step must retain its job preload: '+job+'/'+name);
        requireValue(!/^          CLOSED_LOOP_VERIFICATION_(?:SOURCE_ROOT|RECEIPTS):/m.test(step),'Repository proof step must retain its current source and receipt environment: '+job+'/'+name);
      }
    }
  }
  requireValue(uploads.length>0,'Required artifact upload actions are absent.');
  return uploads;
}
function workflowStep(job,name){
  const marker='      - name: '+name+'\n',at=job.indexOf(marker);
  requireValue(at>=0&&job.indexOf(marker,at+marker.length)<0,'Required dedicated journey workflow step is absent or duplicated: '+name);
  const rest=job.slice(at+marker.length),end=rest.search(/\n      - /);
  return marker+(end<0?rest:rest.slice(0,end)+'\n');
}
function assertDedicatedJourneyWorkflow(workflow){
  const checks=workflowJob(workflow,'test-checks'),operator=workflowJob(workflow,'operator-journey'),final=workflowJob(workflow,'test'),live=workflowJob(workflow,'verify-live'),deployed=workflowJob(workflow,'deployed-operator-journey'),reverified=workflowJob(workflow,'reverified-operator-journey'),publish=workflowJob(workflow,'publish-status');
  requireValue(operator.includes('    needs: foundation\n')&&final.includes('    needs: [foundation, deferred-matrix, workflow-gates, conformance, test-checks, operator-journey]\n')&&/^    if: always\(\)$/m.test(operator)&&/^    if: always\(\)$/m.test(final),'Dedicated LOCAL journey and final required test must fail on failed or skipped prerequisites.');
  for(const [block,job,label]of [[operator,'foundation','foundation job'],...['foundation','workflow-gates','deferred-matrix','conformance','test-checks','operator-journey'].map((job,index)=>[final,job,['foundation job','workflow gate job','deferred matrix job','conformance groups','test checks job','operator journey job'][index]])]){
    const step=workflowStep(block,'Require successful '+label);
    requireValue(step.includes('        run: test "${{ needs.'+job+'.result }}" = "success"\n')&&!/^        if:/m.test(step)&&block.indexOf(step)<block.indexOf('      - uses: actions/checkout@'),'Required dedicated journey prerequisite must be checked before checkout: '+job);
  }
  for(const [name,block]of [['test-checks',checks],['operator-journey',operator],['test',final],['deployed-operator-journey',deployed],['reverified-operator-journey',reverified]]){
    requireValue(block.includes('      CLOSED_LOOP_VERIFICATION_SOURCE_ROOT: ${{ github.workspace }}\n')&&block.includes('      CLOSED_LOOP_VERIFICATION_RECEIPTS: ${{ github.workspace }}/.verification-receipts\n'),'Dedicated proof jobs require current checkout source and receipt environments: '+name);
  }
  const suffix='-${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}',journey='verify-complete-operator-journey.mjs';
  for(const [block,scope,label,artifact]of [[operator,'LOCAL','local','operator-journey-receipt'],[deployed,'DEPLOYED','deployed','deployed-operator-journey-receipt'],[reverified,'DEPLOYED','reverified','reverified-operator-journey-receipt']]){
    requireValue(/^    timeout-minutes: 360$/m.test(block),'Dedicated journey job must retain its360-minute cap.');
    const execution=workflowStep(block,'Complete '+label+' operator journey');
    requireValue(execution.includes('          set -euo pipefail\n')&&execution.includes('timeout --signal=TERM --kill-after=10s "$budget" node collect-verification-evidence.mjs --browser-suite="$script" --browser-scope="$CLOSED_LOOP_BROWSER_SCOPE" 2>&1 | tee "/tmp/${script}.log"\n')&&(execution.match(/^          run_browser_verifier verify-complete-operator-journey\.mjs 330m$/gm)||[]).length===1,'Dedicated journey must execute the complete default producer once with its330-minute deadline and retain failures.');
    requireValue(block.includes('CLOSED_LOOP_BROWSER_SCOPE: '+scope+'\n'),'Dedicated journey scope differs from its producer.');
    const validation=workflowStep(block,'Validate complete '+label+' operator receipt'),upload=workflowStep(block,'Preserve complete '+label+' operator receipt');
    requireValue(validation.includes('        run: node collect-verification-evidence.mjs --require-browser-scope='+scope+' --browser-suite-only='+journey+'\n')&&upload.includes('          name: '+artifact+suffix+'\n')&&upload.includes('          path: .verification-receipts/browser/'+scope+'/'+journey+'.json\n')&&upload.includes('          include-hidden-files: true\n')&&upload.includes('          if-no-files-found: error\n'),'Dedicated journey receipt validation and current-attempt artifact are required.');
    requireValue(block.indexOf(execution)<block.indexOf(validation)&&block.indexOf(validation)<block.indexOf(upload),'Dedicated journey receipt must follow execution and validation.');
  }
  requireValue((workflow.match(/^          run_browser_verifier verify-complete-operator-journey\.mjs .*$/gm)||[]).length===3,'Complete journeys must appear only in their three dedicated jobs.');
  for(const block of [checks,live,publish]){
    const suites=[...block.matchAll(/^          run_browser_verifier (verify-[\w-]+\.mjs) \|\| BROWSER_VERIFY_RESULT=1$/gm)].map(match=>match[1]).sort();
    requireValue(JSON.stringify(suites)===JSON.stringify(['verify-browser.mjs','verify-browser-extra.mjs','verify-human-stage-walkthrough.mjs','verify-mobile-stage-action.mjs','verify-mobile-capability-journey.mjs','verify-browser-recovery.mjs'].sort()),'Six supporting browser producers must remain complete outside the dedicated journey jobs.');
  }
  for(const block of [final]){
    const downloaded=workflowStep(block,'Download test checks proof'),prepared=workflowStep(block,'Verify prepared runtime source and bytes');
    requireValue(downloaded.includes('          name: test-checks-proof'+suffix+'\n')&&downloaded.includes('          path: .\n')&&prepared.includes('        run: node verified-site.mjs verify-prepared\n')&&block.indexOf(downloaded)<block.indexOf(prepared),'Downloaded preparation must bind current attempt and reproduce current runtime bytes.');
    const partial=workflowStep(block,'Validate prepared local browser receipts');
    requireValue(partial.includes('node collect-verification-evidence.mjs --require-browser-scope=LOCAL --exclude-browser-suite='+journey+'\n')&&block.indexOf(prepared)<block.indexOf(partial),'Prepared supporting receipts must be validated after runtime authentication.');
  }
  const foundationDownload=workflowStep(operator,'Download foundation proof'),ingestion=workflowStep(operator,'Validate foundation ingestion receipt');
  const independentBuild=workflowStep(operator,'Build independent local journey runtime'),independentPrepared=workflowStep(operator,'Verify prepared runtime source and bytes');
  const freshCondition="        if: steps.reuse.outputs.reused != 'true'\n";
  requireValue(!/^    continue-on-error:/m.test(operator),'Independent LOCAL journey job must retain failure propagation.');
  for(const step of [foundationDownload,ingestion,independentBuild,independentPrepared]){
    requireValue(step.includes(freshCondition)&&(step.match(/^        if:/gm)||[]).length===1&&!/^        (?:continue-on-error|env):/m.test(step),'Fresh LOCAL journey preparation must execute with inherited source identity and failure propagation.');
  }
  requireValue(foundationDownload.includes('          name: foundation-proof'+suffix+'\n')&&foundationDownload.includes('          path: .\n')&&!/^          (?:run-id|github-token|artifact-ids|pattern):/m.test(foundationDownload),'Independent journey foundation artifact must bind this SHA, run, and current attempt without alternate scope.');
  requireValue(ingestion.includes('        run: node collect-verification-evidence.mjs --export-owner=verify-ingestion.mjs\n'),'Independent journey must validate the complete current foundation ingestion receipt.');
  requireValue(independentBuild.includes('        run: node build-static-site.mjs --out _site --source-commit "$GITHUB_SHA" --workflow-run "$GITHUB_RUN_ID"\n'),'Independent journey build command must bind exact current source, run, and foundation fixture.');
  requireValue(independentPrepared.includes('        run: node verified-site.mjs verify-prepared\n'),'Independent journey prepared validation must reproduce current runtime bytes.');
  const preparation=[foundationDownload,ingestion,independentBuild,independentPrepared,workflowStep(operator,'Complete local operator journey')];
  requireValue(preparation.every((step,index)=>index===0||operator.indexOf(preparation[index-1])<operator.indexOf(step)),'Independent journey foundation validation, build, and prepared-byte check must precede execution in order.');
  const download=workflowStep(final,'Download complete local operator receipt'),join=workflowStep(final,'Validate complete local browser receipt set'),seal=workflowStep(final,'Seal verified deployment artifact');
  requireValue(download.includes('          name: operator-journey-receipt'+suffix+'\n')&&download.includes('          path: .verification-receipts/browser/LOCAL\n')&&join.includes('        run: node collect-verification-evidence.mjs --require-browser-scope=LOCAL\n')&&!/^        if:/m.test(join)&&final.indexOf(download)<final.indexOf(join)&&final.indexOf(join)<final.indexOf(seal),'Final seal requires the current-attempt journey receipt and strict complete LOCAL join.');
  requireValue(deployed.includes('    needs: [test, deploy, verify-live]\n')&&deployed.includes("    if: github.event_name == 'push' && github.ref == 'refs/heads/main'\n")&&reverified.includes('    needs: test\n')&&reverified.includes("    if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'\n"),'Deployed journey dependencies and authenticated event scopes must remain intact.');
  requireValue(publish.includes('    needs: [test, deploy, verify-live, deployed-operator-journey, reverified-operator-journey]\n')&&publish.includes("needs.deployed-operator-journey.result == 'success'")&&publish.includes("needs.reverified-operator-journey.result == 'success'"),'Publication must require the corresponding successful dedicated journey job.');
  requireValue(publish.slice(publish.indexOf('    if:'),publish.indexOf('    needs:'))==="    if: >-\n      always() && github.ref == 'refs/heads/main' &&\n      ((github.event_name == 'push' && needs.test.result == 'success' && needs.deploy.result == 'success' && needs.verify-live.result == 'success' && needs.deployed-operator-journey.result == 'success') ||\n       (github.event_name == 'workflow_dispatch' && needs.test.result == 'success' && needs.reverified-operator-journey.result == 'success'))\n",'Publication condition must authenticate all required producer outcomes.');
  for(const [label,event,artifact]of [['deployed','push','deployed-operator-journey-receipt'],['reverified','workflow_dispatch','reverified-operator-journey-receipt']]){
    const step=workflowStep(publish,'Download complete '+label+' operator receipt');
    requireValue(step.includes("        if: github.event_name == '"+event+"'\n")&&step.includes('          name: '+artifact+suffix+'\n')&&step.includes('          path: .verification-receipts/browser/DEPLOYED\n'),'Publication must download its current-attempt DEPLOYED journey receipt.');
  }
  const reconciliation=workflowStep(publish,'Reconcile local and deployed current assertion receipts');
  requireValue(reconciliation.includes('          node collect-verification-evidence.mjs --require-browser-scope=LOCAL\n')&&reconciliation.includes('          node collect-verification-evidence.mjs --require-browser-scope=DEPLOYED\n')&&publish.indexOf(reconciliation)<publish.indexOf('      - name: Build acceptance artifact from executed proof jobs\n'),'Publication must strictly join both complete browser scopes before building acceptance.');
}
export function assertLifecycleWorkflowCommand(workflow){
  assertWorkflowPreloadBoundaries(workflow);
  const foundation=workflowJob(workflow,'foundation'),deferredJob=workflowJob(workflow,'deferred-matrix'),workflowGates=workflowJob(workflow,'workflow-gates'),conformanceJob=workflowJob(workflow,'conformance'),protectedTest=workflowJob(workflow,'test-checks'),finalTest=workflowJob(workflow,'test');
  requireValue(deferredJob.includes('    needs: foundation\n')&&workflowGates.includes('    needs: [foundation, deferred-matrix]\n')&&conformanceJob.includes('    needs: foundation\n')&&protectedTest.includes('    needs: [foundation, deferred-matrix, workflow-gates, conformance]\n'),'Required proof phase dependencies must join complete deferred, workflow, and parallel conformance proof before browsers.');
  let previous=-1;
  for(const name of foundationProofSteps){const marker='      - name: '+name+'\n',at=foundation.indexOf(marker);requireValue(at>previous&&foundation.indexOf(marker,at+marker.length)<0,'Required foundation proof order is absent, duplicated, or changed: '+name);previous=at;}
  requireValue(foundation.includes('          node verify-contract-closure.mjs\n')&&foundation.includes('          node verify-stage-operation-registry.mjs\n'),'Required authoritative registry proofs are absent.');
  requireValue(foundation.includes('          node verify-semantic-review-acceptance.mjs\n          node verify-stage03-agent-protocol.mjs\n'),'Required Stage 02 bounded-search and Stage 03 omission/response proofs are absent.');
  for(const owner of ['verify-stage-contract-closure.mjs','verify-file-first-response.mjs','verify-response-authority-integrity.mjs','verify-returned-slot-authority.mjs'])requireValue((foundation.match(new RegExp('^          node '+owner.replaceAll('.','\\.')+'$','gm'))||[]).length===1,'Required foundation owner must execute once before later phases: '+owner);
  requireValue(workflowGates.includes('        run: node collect-verification-evidence.mjs --export-owner=verify-stage-operation-registry.mjs\n')&&workflowGates.indexOf('--export-owner=verify-stage-operation-registry.mjs')<workflowGates.indexOf('node verify-v3-contract.mjs'),'Required current registry receipt must precede its contract consumer.');
  for(const owner of ['verify-response-authority-integrity.mjs','verify-returned-slot-authority.mjs'])requireValue(conformanceJob.includes('          node collect-verification-evidence.mjs --export-owner='+owner+'\n')&&conformanceJob.indexOf('--export-owner='+owner)<conformanceJob.indexOf('      - name: Execute complete conformance group\n'),'Required current authority receipt must precede its conformance consumer: '+owner);
  requireValue(deferredJob.includes('node verify-due-stage-timing.mjs > /tmp/deferred-stage-matrix.json')&&deferredJob.includes('node verify-deferred-proof-handoff.mjs')&&deferredJob.includes('path: .verification-receipts/verify-due-stage-timing.mjs.json'),'Required complete deferred matrix execution and receipt are absent.');
  requireValue(protectedTest.includes('name: Download complete deferred matrix receipt')&&protectedTest.includes('name: Validate complete deferred matrix receipt')&&protectedTest.includes('node verify-deferred-proof-handoff.mjs'),'Required deferred matrix proof dependency and handoff are absent.');
  requireValue(/^    if: always\(\)$/m.test(protectedTest),'A failed deferred matrix must fail the required test job, not skip it.');
  for(const [job,label]of [['foundation','foundation job'],['deferred-matrix','deferred matrix job'],['workflow-gates','workflow gate job'],['conformance','conformance groups']]){
    const gate='      - name: Require successful '+label+'\n        run: test "${{ needs.'+job+'.result }}" = "success"\n';
    requireValue(protectedTest.includes(gate)&&protectedTest.indexOf(gate)<protectedTest.indexOf('      - uses: actions/checkout@'),'A failed '+(job==='deferred-matrix'?'deferred matrix':job==='conformance'?'conformance group':job)+' must fail the required test job.');
  }
  requireValue(conformanceJob.includes('group: [core, history, creation, counterpart]')&&conformanceJob.includes('fail-fast: false')&&conformanceJob.includes('node verify-conformance-regressions.mjs --group=${{ matrix.group }} > /tmp/conformance-regressions.json')&&conformanceJob.includes('name: Preserve complete conformance group report')&&conformanceJob.includes('name: Preserve conformance execution receipts'),'Required complete conformance group execution or artifacts are absent.');
  const ingestionProducer='          node verify-ingestion.mjs\n',ingestionExport='        run: node collect-verification-evidence.mjs --export-owner=verify-ingestion.mjs\n';
  requireValue(foundation.split(ingestionProducer).length===2&&(workflow.match(/^\s*node verify-ingestion\.mjs(?:\s|$)/gm)||[]).length===1,'Required ingestion proof must execute its complete producer once in the foundation phase.');
  requireValue(conformanceJob.indexOf(ingestionExport)<conformanceJob.indexOf('      - name: Execute complete conformance group\n'),'Required current ingestion receipt must be produced before the core evidence consumer.');
  const prerequisiteArtifactName=artifact=>artifact+'-${{ github.sha }}-${{ github.run_id }}'+(artifact==='foundation-proof'?'-${{ github.run_attempt }}':'');
  for(const [name,job,artifact]of [['deferred-matrix',deferredJob,'foundation-proof'],['workflow-gates',workflowGates,'foundation-proof'],['conformance',conformanceJob,'foundation-proof'],['test-checks',protectedTest,'workflow-gate-proof']]){
    requireValue(job.includes('          name: '+prerequisiteArtifactName(artifact)+'\n')&&job.split(ingestionExport).length===2,'Required current ingestion receipt must be transferred and validated before '+name+' consumers.');
    if(artifact==='foundation-proof'){
      const download=workflowStep(job,'Download foundation proof'),validation=workflowStep(job,'Validate foundation ingestion receipt');
      const execute="        if: steps.reuse.outputs.reused != 'true'\n";
      requireValue(download.includes('          name: '+prerequisiteArtifactName(artifact)+'\n')&&download.includes('          path: .\n')&&download.includes(execute)&&(download.match(/^        if:/gm)||[]).length===1&&!/^          (?:run-id|github-token|artifact-ids|pattern):/m.test(download),'Required foundation receipt transfer must use this SHA, run, and attempt without an alternate artifact scope.');
      requireValue(validation.includes(execute)&&(validation.match(/^        if:/gm)||[]).length===1&&validation.includes(ingestionExport)&&job.indexOf(download)<job.indexOf(validation),'Required foundation receipt validation must follow its unconditional fresh-proof transfer.');
    }
  }
  requireValue(protectedTest.includes('name: Download complete conformance group reports')&&protectedTest.includes('name: Download complete conformance execution receipts')&&protectedTest.includes('node verify-conformance-handoff.mjs'),'Required conformance group proof handoff is absent.');
  for(const [job,artifact]of [[foundation,'foundation-proof'],[workflowGates,'workflow-gate-proof']])requireValue(job.includes('          name: '+prerequisiteArtifactName(artifact)+'\n')&&job.includes('            .verification-receipts/\n            TEST_PROJECT.json\n')&&job.includes('          include-hidden-files: true\n'),'Required complete prerequisite proof artifact is absent.');
  const collect='      - name: Complete current non-browser assertion evidence\n',collectAt=protectedTest.indexOf(collect),browserAt=protectedTest.indexOf('      - name: Stale project navigation and draft preservation\n');
  requireValue(collectAt>=0&&collectAt<browserAt&&(protectedTest.match(/^        run: node collect-verification-evidence\.mjs$/gm)||[]).length===1&&!protectedTest.includes('collect-verification-evidence.mjs --run-missing')&&finalTest.includes('      - name: Collect current executed assertion evidence\n        run: node collect-verification-evidence.mjs\n'),'Missing non-browser proof must finish before Chromium; final aggregation must not execute producers.');
  // Below, validate the original cross-phase command invariants over the actual
  // dependency-ordered source while keeping each producer in its owning job.
  const testJob=foundation+workflowGates+protectedTest;
  const heading='      - name: Workflow and gates\n',at=testJob.indexOf(heading);
  requireValue(at>=0&&testJob.indexOf(heading,at+heading.length)<0,'Required workflow gate step is absent or duplicated.');
  const migrationHeading='      - name: Contract-profile migration\n',migrationAt=testJob.indexOf(migrationHeading);
  requireValue(migrationAt>=0&&migrationAt<at,'Registry and migration proof step is absent or late.');
  const migrationRemainder=testJob.slice(migrationAt+migrationHeading.length),migrationNext=migrationRemainder.search(/\n      - /),migration=migrationNext<0?migrationRemainder:migrationRemainder.slice(0,migrationNext);
  requireValue((testJob.match(/^          node verify-contract-closure\.mjs$/gm)||[]).length===1&&
    foundation.indexOf('node verify-contract-closure.mjs')<foundation.indexOf('node verify-v3-migration.mjs')&&
    migration.includes('node verify-v3-migration.mjs')&&
    workflowGates.includes('node verify-v3-contract.mjs'),'Contract-closure must execute once before migration and v3 contract checks.');
  requireValue(!/^          node verify-infrastructure-route-closure\.mjs$/m.test(testJob),'Infrastructure route must execute after ingestion and lifecycle through the v3 gate.');
  const remainder=testJob.slice(at+heading.length),next=remainder.search(/\n      - /),gate=next<0?remainder:remainder.slice(0,next);
  requireValue((testJob.match(/^          node verify-verification-routing\.mjs$/gm)||[]).length===1&&gate.includes('          node verify-verification-routing.mjs\n'),'Required non-browser routing proof must execute once in the Workflow gate before strict collection and Chromium.');
  requireValue((testJob.match(/^          node verify-proposal-acceptance-memory\.mjs$/gm)||[]).length===1&&gate.includes('          node verify-proposal-acceptance-memory.mjs\n'),'Required acceptance memory proof must execute once in the Workflow gate after ingestion.');
  const promptHeading='      - name: Prompt semantics and leakage\n',fullHeading='      - name: Full cycle and terminal boundary\n';
  const promptAt=testJob.indexOf(promptHeading),fullAt=testJob.indexOf(fullHeading);
  requireValue(promptAt>at&&fullAt>promptAt&&testJob.indexOf(fullHeading,fullAt+fullHeading.length)<0,'Required gate, prompt, and full-cycle proof steps must run in specification order.');
  const promptRemainder=testJob.slice(promptAt+promptHeading.length),promptNext=promptRemainder.search(/\n      - /),prompt=promptNext<0?promptRemainder:promptRemainder.slice(0,promptNext);
  for(const owner of ['verify-all-stage-prompts.mjs','verify-stage-context-boundary.mjs','verify-handoff-metadata-boundary.mjs','verify-handoff-disclosure.mjs','verify-stage-prompts-complete.mjs','verify-user-prompt-invariants.mjs']){
    const line='          node '+owner+'\n';
    requireValue(testJob.split(line).length===2&&prompt.includes(line),'Required broad prompt and disclosure proof must execute once after workflow gates: '+owner);
  }
  const stage04Heading='      - name: Stage 04 obligation accounting and prompt completeness\n',stage04At=foundation.indexOf(stage04Heading),stage04Remainder=foundation.slice(stage04At+stage04Heading.length),stage04Next=stage04Remainder.search(/\n      - /),stage04=stage04Next<0?stage04Remainder:stage04Remainder.slice(0,stage04Next);
  requireValue(stage04.includes('          node verify-zero-loss-accounting.mjs\n'),'Required Stage 04 obligation accounting proof must precede Test IR and ingestion.');
  const fullRemainder=testJob.slice(fullAt+fullHeading.length),fullNext=fullRemainder.search(/\n      - /),full=fullNext<0?fullRemainder:fullRemainder.slice(0,fullNext);
  requireValue((testJob.match(/^          node verify-full-cycle\.mjs \| tee \/tmp\/full-cycle-proof\.json$/gm)||[]).length===1&&
    (full.match(/^          node verify-full-cycle\.mjs \| tee \/tmp\/full-cycle-proof\.json$/gm)||[]).length===1&&
    (testJob.match(/^          node verify-stage30-terminal-mobile-boundary\.mjs$/gm)||[]).length===1&&
    (full.match(/^          node verify-stage30-terminal-mobile-boundary\.mjs$/gm)||[]).length===1&&
    full.indexOf('node verify-full-cycle.mjs')<full.indexOf('node verify-stage30-terminal-mobile-boundary.mjs'),'Full-cycle and Stage 30 terminal proofs must each execute once after prompt semantics.');
  const quarantineOwner='          node test-quarantine-ui-export-owner.mjs\n';
  requireValue((workflow.match(/^\s*node test-quarantine-ui-export-owner\.mjs(?:\s|$)/gm)||[]).length===1&&full.includes(quarantineOwner)&&
    full.indexOf(quarantineOwner)<full.indexOf('          node verify-full-cycle.mjs | tee /tmp/full-cycle-proof.json\n')&&
    protectedTest.indexOf(quarantineOwner)>protectedTest.indexOf('        run: node verify-conformance-handoff.mjs\n')&&protectedTest.indexOf(quarantineOwner)<collectAt,
    'Required quarantine UI export owner must execute once after complete conformance handoff and before full-cycle proof and strict collection.');
  const lifecycle='          node verify-project-lifecycle.mjs',definition='          node verify-v3-definition-of-done.mjs';
  const external='          node verify-external-result-determination.mjs';
  const stage01='          node verify-stage01-intake-closure.mjs',preflight='          node verify-independent-preflight.mjs',receiptControls='          node verify-definition-of-done.mjs --owner-receipt-controls',done='          node verify-definition-of-done.mjs\n';
  requireValue((testJob.match(/^          node verify-stage01-intake-closure\.mjs$/gm)||[]).length===1&&
    testJob.indexOf(stage01)<at&&
    (testJob.match(/^          node verify-independent-preflight\.mjs$/gm)||[]).length===1&&
    (gate.match(/^          node verify-independent-preflight\.mjs$/gm)||[]).length===1&&
    (testJob.match(/^          node verify-definition-of-done\.mjs --owner-receipt-controls$/gm)||[]).length===1&&
    (gate.match(/^          node verify-definition-of-done\.mjs --owner-receipt-controls$/gm)||[]).length===1&&
    gate.indexOf(preflight)<gate.indexOf(receiptControls)&&gate.indexOf(receiptControls)<gate.indexOf(done)&&
    gate.indexOf(done)<gate.indexOf(definition),'Required Stage 01/09 direct owner receipts and DOD receipt controls must execute once before definition of done in the Workflow gate.');
  requireValue((testJob.match(/^          node verify-external-result-determination\.mjs$/gm)||[]).length===1&&
    (gate.match(/^          node verify-external-result-determination\.mjs$/gm)||[]).length===1&&
    gate.indexOf('          node verify-complete.mjs')<gate.indexOf(external)&&
    gate.indexOf(external)<gate.indexOf('          node verify-definition-of-done.mjs'),'Required external-result determination proof must execute once before definition of done in the Workflow gate.');
  requireValue((testJob.match(/^          node verify-project-lifecycle\.mjs$/gm)||[]).length===1&&
    (gate.match(/^          node verify-project-lifecycle\.mjs$/gm)||[]).length===1&&
    (gate.match(/^          node verify-v3-definition-of-done\.mjs$/gm)||[]).length===1&&
    gate.indexOf(lifecycle)<gate.indexOf(definition),'Required project lifecycle proof must execute exactly once before v3 definition of done in the Workflow gate.');
  assertDedicatedJourneyWorkflow(workflow);
}
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const writeJson=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
function currentProofFiles(directory){const result=[];for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(entry.isFile()&&entry.name.endsWith('.json'))result.push(entry.name);else if(entry.isDirectory()&&['browser','LOCAL','DEPLOYED'].includes(entry.name))for(const name of currentProofFiles(path.join(directory,entry.name)))result.push(entry.name+'/'+name);}return result.sort();}
export function executedProofFileHashes(directory){const files=currentProofFiles(directory);return Object.fromEntries(files.map(name=>{requireValue(/^(?:[\w.-]+\.json|browser\/(?:LOCAL|DEPLOYED)\/[\w.-]+\.json)$/.test(name)&&fs.lstatSync(path.join(directory,name)).isFile(),'Invalid executed proof file');return [name,digest(fs.readFileSync(path.join(directory,name)))];}));}
export function promoteExecutedProofs({sourceDirectory,directory,proofFiles,fingerprint,promotion}){
  requireValue(isDeepStrictEqual(executedProofFileHashes(sourceDirectory),proofFiles),'Executed proof file universe or bytes differs from sealed bundle.');
  const proofs=Object.keys(proofFiles).filter(name=>name!=='evidence.json').map(name=>{
    const proof=readJson(path.join(sourceDirectory,name));
    requireValue(proof.fingerprint?.sourceInputsSha256===fingerprint.sourceInputsSha256,'Executed proof source inputs changed; current full verification is required.');
    return [name,proof];
  });
  // A different installed runtime needs fresh execution. Decide before copying
  // any receipts so the full run starts without partially promoted old proof.
  if(proofs.some(([,proof])=>!isDeepStrictEqual(proof.fingerprint.runtime,fingerprint.runtime)))return false;
  fs.mkdirSync(directory,{recursive:true});
  for(const [name,proof]of proofs){
    delete proof.receiptSha256;proof.promotion=promotion;proof.receiptSha256=evidenceSha(proof);writeJson(path.join(directory,name),proof);
  }
  return true;
}
const collectsExecutedEvidence=cwd=>Boolean(process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS)&&(!process.env.CLOSED_LOOP_VERIFICATION_SOURCE_ROOT||path.resolve(cwd)===path.resolve(process.env.CLOSED_LOOP_VERIFICATION_SOURCE_ROOT));
const git=(cwd,...args)=>execFileSync('git',args,{timeout:30000,killSignal:'SIGKILL',cwd,encoding:'utf8'}).trim();
const artifactName=(run,attempt)=>`verified-site-${run}-${attempt}`;
const output=(name,value)=>{if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`${name}=${value}\n`);};

export function validateSite(directory){
  const names=fs.readdirSync(directory).sort();
  requireValue(JSON.stringify(names)===JSON.stringify([...runtimePaths,manifestName].sort()),'Verified artifact contains missing or unexpected files.');
  for(const name of names)requireValue(fs.lstatSync(path.join(directory,name)).isFile(),'Verified artifact must contain regular files only.');
  const manifest=readJson(path.join(directory,manifestName)),unsigned={...manifest};delete unsigned.manifestDigest;
  requireValue(manifest.schema==='closed-loop-deployment-manifest/1','Invalid deployment manifest schema.');
  requireValue(manifest.manifestDigest?.hashAlgorithm==='SHA-256'&&manifest.manifestDigest.digest===hash.sha256Value(unsigned),'Deployment manifest digest mismatch.');
  requireValue(manifest.canonicalOrigin==='https://sjonesjones917.github.io'&&manifest.canonicalHost==='sjonesjones917.github.io'&&manifest.canonicalBasePath==='/closed-loop-tracker/'&&manifest.deploymentEnvironment==='github-pages','Wrong deployment origin or environment.');
  requireValue(manifest.noCrossOriginRedirect===true&&manifest.permittedRuntimeOrigin==='SAME_ORIGIN_ONLY','Invalid deployment origin policy.');
  requireValue(Array.isArray(manifest.runtimeResources)&&JSON.stringify(manifest.runtimeResources.map(r=>r.path).sort())===JSON.stringify([...runtimePaths].sort()),'Incomplete or duplicate runtime resource graph.');
  for(const resource of manifest.runtimeResources){
    const bytes=fs.readFileSync(path.join(directory,resource.path));
    requireValue(resource.hashAlgorithm==='SHA-256'&&resource.digest===digest(bytes)&&resource.byteSize===bytes.length&&resource.buildIdentity===manifest.buildIdentity,`Changed verified runtime file: ${resource.path}`);
  }
  validateDeploymentContractIdentities(manifest,directory);
  return manifest;
}

export function assertRuntimeEqual(first,second){
  const a=validateSite(first),b=validateSite(second);
  requireValue(a.buildIdentity===b.buildIdentity,'Merged runtime build identity differs from the tested artifact.');
  for(const name of runtimePaths)requireValue(fs.readFileSync(path.join(first,name)).equals(fs.readFileSync(path.join(second,name))),`Merged runtime bytes differ from the tested artifact: ${name}`);
}

export function assertPassedRun(run,jobs,{repository,headSha,workflowId}){
  assertLifecycleWorkflowCommand(fs.readFileSync('.github/workflows/pages.yml','utf8'));
  requireValue(run.event==='pull_request'&&run.status==='completed'&&run.conclusion==='success','PR verification is not successfully completed.');
  requireValue(run.repository?.full_name===repository&&run.head_repository?.full_name===repository&&run.head_sha===headSha,'PR verification repository or head mismatch.');
  requireValue(run.workflow_id===workflowId&&run.path==='.github/workflows/pages.yml','PR verification used a different workflow.');
  const tests=jobs.filter(job=>job.name==='test');
  requireValue(tests.length===1&&tests[0].status==='completed'&&tests[0].conclusion==='success','Required test job has not passed.');
  const deferred=jobs.filter(job=>job.name==='deferred-matrix');
  requireValue(deferred.length===1&&deferred[0].status==='completed'&&deferred[0].conclusion==='success','Required deferred matrix job has not passed.');
  for(const name of ['Execute complete deferred stage matrix','Preserve complete deferred matrix receipt']){
    const matrixSteps=deferred[0].steps.filter(step=>step.name===name);
    requireValue(matrixSteps.length===1&&matrixSteps[0].status==='completed'&&matrixSteps[0].conclusion==='success','Required complete deferred matrix did not pass: '+name);
  }
  for(const group of ['core','history','creation','counterpart']){
    const matches=jobs.filter(job=>job.name==='conformance-'+group);
    requireValue(matches.length===1&&matches[0].status==='completed'&&matches[0].conclusion==='success','Required conformance group job has not passed: '+group);
    for(const name of ['Download foundation proof','Validate foundation ingestion receipt','Validate current authority receipts','Execute complete conformance group','Preserve complete conformance group report','Preserve conformance execution receipts']){
      const steps=matches[0].steps.filter(step=>step.name===name);
      requireValue(steps.length===1&&steps[0].status==='completed'&&steps[0].conclusion==='success','Required conformance group execution or artifact did not pass: '+group+' '+name);
    }
  }
  for(const [jobName,names]of [['foundation',foundationProofSteps],['workflow-gates',workflowGateProofSteps],['test-checks',testCheckProofSteps],['operator-journey',operatorJourneyProofSteps]]){
    const matches=jobs.filter(job=>job.name===jobName);
    requireValue(matches.length===1&&matches[0].status==='completed'&&matches[0].conclusion==='success','Required '+jobName+' proof job has not passed.');
    for(const name of names){const steps=matches[0].steps.filter(step=>step.name===name);requireValue(steps.length===1&&steps[0].status==='completed'&&steps[0].conclusion==='success','Required '+jobName+' proof did not pass: '+name);}
  }
  for(const name of fullTestSteps){
    const steps=tests[0].steps.filter(step=>step.name===name);
    requireValue(steps.length===1&&steps[0].status==='completed'&&steps[0].conclusion==='success',`Required PR verification did not pass: ${name}`);
  }
  // Jobs are returned by the exact attempt endpoint; bind each required result
  // to the queried run/repository/head instead of accepting matching names.
  requireValue(Number.isSafeInteger(run.run_attempt)&&run.run_attempt>0,'PR verification attempt is invalid.');
  for(const job of jobs.filter(job=>['test','test-checks','operator-journey','foundation','workflow-gates','deferred-matrix','conformance-core','conformance-history','conformance-creation','conformance-counterpart'].includes(job.name))){
    requireValue(String(job.run_id)===String(run.id)&&job.head_sha===headSha&&job.run_url===`https://api.github.com/repos/${repository}/actions/runs/${run.id}`&&(job.run_attempt===undefined||job.run_attempt===run.run_attempt),'Required PR verification job belongs to a different run, attempt, repository, or head: '+job.name);
  }
}

export function assertReceipt(receipt,manifest,{run,repository,headSha,sourceCommit,sourceTree,workflowDigest}){
  requireValue(receipt.schema==='closed-loop-verified-site/1'&&receipt.repository===repository,'Verified artifact receipt identity mismatch.');
  requireValue(String(receipt.runId)===String(run.id)&&Number(receipt.runAttempt)===run.run_attempt&&receipt.headSha===headSha&&receipt.event==='pull_request','Verified artifact receipt does not belong to the passing PR attempt.');
  requireValue(receipt.sourceCommit===sourceCommit&&receipt.sourceTree===sourceTree,'Verified artifact source tree mismatch.');
  requireValue(manifest.sourceCommit===sourceCommit&&String(manifest.workflowRunIdentity)===String(run.id),'Artifact manifest does not belong to the passing PR run.');
  requireValue(manifest.workflowFileSha256===workflowDigest&&receipt.workflowFileSha256===workflowDigest,'Verified workflow differs from the merged workflow.');
  requireValue(receipt.manifestDigest===manifest.manifestDigest.digest&&receipt.buildIdentity===manifest.buildIdentity,'Verified artifact receipt manifest mismatch.');
}

function assertCleanSource(cwd){
  const changes=git(cwd,'diff','--name-only','HEAD','--').split('\n').filter(Boolean);
  requireValue(changes.every(name=>name==='TEST_PROJECT.json'),'Verification left tracked source changes outside the generated retained fixture.');
}

async function build(cwd,directory,commit,run){
  (await checkedVerifier(process.execPath,['build-static-site.mjs','--out',directory,'--source-commit',commit,'--workflow-run',String(run)],{cwd,stdio:'pipe'}));
}

export async function promoteSite({cwd,verifiedDirectory,outputDirectory,commit,runId}){
  // Only the deterministic retained fixture is generated by the tests. All
  // other runtime input must come from the matching, checked-out main tree.
  validateSite(verifiedDirectory);
  assertCleanSource(cwd);
  const fixture=path.join(cwd,'TEST_PROJECT.json'),originalFixture=fs.readFileSync(fixture);
  const rebuilt=fs.mkdtempSync(path.join(cwd,'.verified-rebuild-'));
  let promoted=false;
  try{
    fs.copyFileSync(path.join(verifiedDirectory,'TEST_PROJECT.json'),fixture);
    (await build(cwd,rebuilt,commit,runId));
    assertRuntimeEqual(verifiedDirectory,rebuilt);
    fs.rmSync(outputDirectory,{recursive:true,force:true});
    fs.cpSync(verifiedDirectory,outputDirectory,{recursive:true});
    // Preserve every tested runtime byte. Only deployment provenance changes:
    // main commit/run identity, declared toolchain, and the manifest digest.
    fs.copyFileSync(path.join(rebuilt,manifestName),path.join(outputDirectory,manifestName));
    validateSite(outputDirectory);
    promoted=true;
  }finally{
    if(!promoted)fs.writeFileSync(fixture,originalFixture);
    fs.rmSync(rebuilt,{recursive:true,force:true});
  }
}

export async function verifyPreparedSite({cwd,directory,context}){
  assertCleanSource(cwd);
  const manifest=validateSite(directory);
  requireValue(manifest.sourceCommit===context.commit&&String(manifest.workflowRunIdentity)===String(context.runId),'Site does not belong to this verification run.');
  requireValue(manifest.workflowFileSha256===digest(fs.readFileSync(path.join(cwd,'.github/workflows/pages.yml'))),'Prepared site workflow differs from the current checkout.');
  const rebuilt=fs.mkdtempSync(path.join(cwd,'.verified-seal-'));
  try{
    (await build(cwd,rebuilt,context.commit,context.runId));
    assertRuntimeEqual(directory,rebuilt);
    requireValue(fs.readFileSync(path.join(directory,manifestName)).equals(fs.readFileSync(path.join(rebuilt,manifestName))),'Verified deployment manifest is not reproducible.');
  }finally{fs.rmSync(rebuilt,{recursive:true,force:true});}
  return manifest;
}

export async function sealSite({cwd,directory,bundleDirectory,context}){
  const manifest=await verifyPreparedSite({cwd,directory,context});
  fs.rmSync(bundleDirectory,{recursive:true,force:true});
  fs.mkdirSync(bundleDirectory,{recursive:true});
  fs.cpSync(directory,path.join(bundleDirectory,'site'),{recursive:true});
  let executedEvidence;
  if(collectsExecutedEvidence(cwd)){
    const fingerprint=evidenceFingerprint(cwd),receipts=readExecutionReceipts(process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,fingerprint);
    requireBrowserScope(receipts,fingerprint,{scope:'LOCAL',manifest});
    const evidence=aggregateExecutedEvidence(receipts,fingerprint);
    requireValue([...receipts.keys()].filter(key=>!key.startsWith('browser/')).length===Object.keys((await import('./verification-evidence-catalog.mjs')).verificationCatalog).length,'Required executed assertion receipt is absent at artifact seal.');
    fs.cpSync(process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,path.join(bundleDirectory,'proofs'),{recursive:true});
    const proofFiles=executedProofFileHashes(path.join(bundleDirectory,'proofs'));
    executedEvidence={schema:evidence.schema,sourceCommit:context.commit,sourceInputsSha256:fingerprint.sourceInputsSha256,receiptCount:receipts.size,proofFiles,proofBundleSha256:evidenceSha(proofFiles)};
  }
  const receipt={schema:'closed-loop-verified-site/1',repository:context.repository,event:context.event,
    sourceCommit:context.commit,sourceTree:git(cwd,'rev-parse','HEAD^{tree}'),headSha:context.headSha,
    runId:String(context.runId),runAttempt:context.runAttempt,workflowFileSha256:manifest.workflowFileSha256,
    manifestDigest:manifest.manifestDigest.digest,buildIdentity:manifest.buildIdentity,
    ...(context.reusedFrom?{reusedFrom:context.reusedFrom}:{}),...(executedEvidence?{executedEvidence}:{})};
  writeJson(path.join(bundleDirectory,'receipt.json'),receipt);
  return receipt;
}

function context(){
  const env=process.env,event=env.GITHUB_EVENT_PATH?readJson(env.GITHUB_EVENT_PATH):{};
  requireValue(/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY||'')&&/^[0-9a-f]{40}$/.test(env.GITHUB_SHA||'')&&/^\d+$/.test(env.GITHUB_RUN_ID||''),'GitHub verification context is unavailable.');
  requireValue(git(process.cwd(),'rev-parse','HEAD')===env.GITHUB_SHA,'Checkout does not match the workflow commit.');
  return {repository:env.GITHUB_REPOSITORY,commit:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,
    runAttempt:Number(env.GITHUB_RUN_ATTEMPT||1),event:env.GITHUB_EVENT_NAME,ref:env.GITHUB_REF,
    headSha:event.pull_request?.head?.sha||env.GITHUB_SHA};
}

async function api(context,suffix){
  requireValue(process.env.GH_TOKEN,'GitHub Actions read token is unavailable.');
  const response=await fetch(`https://api.github.com/repos/${context.repository}/${suffix}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});
  requireValue(response.ok,`GitHub verification lookup failed (${response.status}).`);
  return response.json();
}

async function selectCandidate(c){
  requireValue(c.event==='push'&&c.ref==='refs/heads/main','Verification reuse is restricted to a main push.');
  fs.rmSync('.verified-candidate.json',{force:true});
  const current=await api(c,`actions/runs/${c.runId}`);
  const prs=(await api(c,`commits/${c.commit}/pulls?per_page=100`)).filter(pr=>pr.merged_at&&pr.merge_commit_sha===c.commit&&pr.base.ref==='main'&&pr.base.repo.full_name===c.repository&&pr.head.repo?.full_name===c.repository);
  for(const pr of prs){
    const runs=(await api(c,`actions/workflows/${current.workflow_id}/runs?event=pull_request&status=success&head_sha=${pr.head.sha}&per_page=100`)).workflow_runs;
    for(const run of runs){
      const jobs=(await api(c,`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`)).jobs;
      try{assertPassedRun(run,jobs,{repository:c.repository,headSha:pr.head.sha,workflowId:current.workflow_id});}catch{continue;}
      const artifacts=(await api(c,`actions/runs/${run.id}/artifacts?per_page=100`)).artifacts;
      const artifact=artifacts.find(item=>item.name===artifactName(run.id,run.run_attempt)&&!item.expired);
      if(!artifact)continue;
      writeJson('.verified-candidate.json',{runId:run.id,runAttempt:run.run_attempt,headSha:pr.head.sha,workflowId:current.workflow_id,artifactId:artifact.id,artifactName:artifact.name,prNumber:pr.number});
      output('run_id',run.id);output('artifact_id',artifact.id);
      console.log(`Found complete verification for PR #${pr.number}, run ${run.id}. Source and byte equality are still required.`);
      return;
    }
  }
  console.log('No complete reusable PR artifact found. This source requires the full verification job.');
}

async function reuseCandidate(c){
  requireValue(c.event==='push'&&c.ref==='refs/heads/main','Verification reuse is restricted to a main push.');
  const candidate=readJson('.verified-candidate.json');
  // Recheck the server state after downloading, including the exact attempt.
  const run=await api(c,`actions/runs/${candidate.runId}`);
  requireValue(run.run_attempt===candidate.runAttempt,'PR verification attempt changed during artifact retrieval.');
  const jobs=(await api(c,`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`)).jobs;
  assertPassedRun(run,jobs,{repository:c.repository,headSha:candidate.headSha,workflowId:candidate.workflowId});
  const receipt=readJson('_verified-pr/receipt.json'),manifest=validateSite('_verified-pr/site');
  requireValue(/^[0-9a-f]{40}$/.test(receipt.sourceCommit||''),'Invalid tested source commit.');
  const source=await api(c,`git/commits/${receipt.sourceCommit}`);
  requireValue(source.sha===candidate.headSha||source.parents.some(parent=>parent.sha===candidate.headSha),'Tested source is not the selected PR head or its merge.');
  const mainTree=git(process.cwd(),'rev-parse','HEAD^{tree}');
  if(source.tree.sha!==mainTree){
    console.log('The merged tree differs from the tested PR tree. Full verification is required for the changed source.');
    return;
  }
  assertReceipt(receipt,manifest,{run,repository:c.repository,headSha:candidate.headSha,sourceCommit:source.sha,sourceTree:source.tree.sha,workflowDigest:digest(fs.readFileSync('.github/workflows/pages.yml'))});
  if(collectsExecutedEvidence(process.cwd())){
  requireValue(receipt.executedEvidence?.sourceCommit===source.sha&&receipt.executedEvidence.proofBundleSha256===evidenceSha(receipt.executedEvidence.proofFiles),'Executed proof bundle receipt is absent or inconsistent.');
  // Preserve the original tested revision while explicitly binding identical
  // current inputs to this main promotion. Ordinary receipt readers cannot
  // silently substitute a different head revision.
  const fingerprint=evidenceFingerprint(process.cwd()),proofDirectory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS||'.verification-receipts';
  const promoted=promoteExecutedProofs({sourceDirectory:'_verified-pr/proofs',directory:proofDirectory,proofFiles:receipt.executedEvidence.proofFiles,fingerprint,promotion:{sourceCommit:c.commit,sourceTree:mainTree,verifiedSourceCommit:source.sha,verifiedRunId:String(run.id),verifiedRunAttempt:run.run_attempt,proofBundleSha256:receipt.executedEvidence.proofBundleSha256}});
  if(!promoted){
    console.log('The executed proof runtime differs from the current runtime. Full verification is required.');
    return;
  }
  }
  (await promoteSite({cwd:process.cwd(),verifiedDirectory:path.resolve('_verified-pr/site'),outputDirectory:path.resolve('_site'),commit:c.commit,runId:c.runId}));
  if(collectsExecutedEvidence(process.cwd())){
    const fingerprint=evidenceFingerprint(process.cwd()),receipts=readExecutionReceipts(process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,fingerprint);
    requireBrowserScope(receipts,fingerprint,{scope:'LOCAL',manifest:validateSite('_site')});
  }
  writeJson('.verified-reuse.json',{...candidate,testedCommit:source.sha,sourceTree:mainTree,manifestDigest:manifest.manifestDigest.digest});
  output('reused','true');
  output('run_id',run.id);output('tested_commit',source.sha);
  console.log(`Reused successful PR #${candidate.prNumber}, run ${run.id}: identical Git tree and all ${runtimePaths.length} runtime files. Only deployment manifest provenance was rebound to main.`);
}

async function main(){
  const c=context();
  switch(process.argv[2]){
    case 'select':return selectCandidate(c);
    case 'reuse':return reuseCandidate(c);
    case 'verify-prepared':{
      const manifest=await verifyPreparedSite({cwd:process.cwd(),directory:path.resolve('_site'),context:c});
      console.log(JSON.stringify({preparedRuntimeVerified:true,sourceCommit:manifest.sourceCommit,manifestDigest:manifest.manifestDigest.digest}));return;
    }
    case 'seal':{
      if(fs.existsSync('.verified-reuse.json'))c.reusedFrom=readJson('.verified-reuse.json');
      const receipt=(await sealSite({cwd:process.cwd(),directory:path.resolve('_site'),bundleDirectory:path.resolve('_verified-site'),context:c}));
      output('artifact_name',artifactName(c.runId,c.runAttempt));
      console.log(JSON.stringify({sealed:true,sourceCommit:receipt.sourceCommit,sourceTree:receipt.sourceTree,reusedFrom:receipt.reusedFrom||null}));return;
    }
    default:throw new Error('Expected select, reuse, verify-prepared, or seal.');
  }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await main();
