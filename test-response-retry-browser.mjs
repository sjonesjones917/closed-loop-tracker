import assert from 'node:assert/strict';
import {downloadSyntheticHandoff} from './test-browser-handoff-authorization.mjs';
import {readStoreArchive} from './test-zip.mjs';

// Synthetic clarification content; actual operator controls, selected files,
// exported package, IndexedDB commits and reloads. No external actor claim.
export async function verifyResponseRetryBrowser(browser){
 await browser.click('#new-project');
 await browser.fill('[data-job="JOB_TITLE"]','Response retry preservation');
 await browser.fill('[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]','Create a one-page inventory; ask which subject to list.');
 await browser.click('#save-job');
 const files=await downloadSyntheticHandoff(browser,'#next-export-prompt-file',{syntheticProject:true});
 assert.equal(files.length,1);
 const members=readStoreArchive(files[0].bytes),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes));
 const envelope={schema:'closed-loop-stage-response/3',contractProfileId:'closed-loop-completion-profile/1',jobId:manifest.jobId,stage:1,operation:manifest.operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'subject',question:'Which subject should be listed?',whyRequired:'The inventory subject is a human fact.',answerType:'TEXT',affectedStageFields:[],affectedRecords:[],allowedValues:[],blocking:true}],humanAuthorityCandidates:[],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
 const compact=JSON.stringify(envelope)+'\n',expanded=JSON.stringify(envelope,null,2)+'\n';
 const submit=async text=>{await browser.selectFiles('#response-json-file',[{filename:'response.json',bytes:Buffer.from(text)}]);await browser.click('#process-response-file');};
 await submit(compact);assert.equal(await browser.exists('#accept-proposal'),true,'RETRY_BROWSER_VALID_CONTROL_ORACLE');
 const first=await browser.readProject(),proposal=first.projectData.responseProposals.at(-1),receipt=first.projectData.outputReceipts.at(-1);
 assert.ok(receipt?.receiptId,'RETRY_BROWSER_VALID_RECEIPT_CONTROL_ORACLE');
 assert.equal(proposal.status,'PENDING_OPERATOR_REVIEW');assert.equal(first.projectData.humanInputRequests.length,0);
 await submit(expanded);const repeated=await browser.readProject();
 assert.equal(repeated.projectData.responseProposals.length,1,'RETRY_BROWSER_ONE_PROPOSAL_ORACLE');
 assert.equal(repeated.projectData.responseProposals[0].proposalId,proposal.proposalId);
 assert.deepEqual(repeated.projectData.responseProposals,first.projectData.responseProposals,'RETRY_BROWSER_PENDING_PROPOSAL_PRESERVED_ORACLE');
 assert.deepEqual(repeated.projectData.outputReceipts,first.projectData.outputReceipts,'RETRY_BROWSER_PENDING_RECEIPT_PRESERVED_ORACLE');
 assert.equal(repeated.revision,first.revision,'RETRY_BROWSER_PENDING_OPERATIONAL_REVISION_ORACLE');
 assert.equal(repeated.projectData.outputReceipts.length,1);assert.equal(repeated.projectData.outputReceipts[0].receiptId,receipt.receiptId);
 assert.deepEqual(repeated.projectData.rawResponses.map(row=>row.completeRawResponse),[compact,expanded]);
 await browser.click('#accept-proposal');if(await browser.exists('#accept-replacement'))await browser.click('#accept-replacement');
 const accepted=await browser.readProject();
 assert.equal(accepted.projectData.responseProposals[0].status,'QUESTIONS_CREATED','RETRY_BROWSER_ACCEPT_ORIGINAL_ORACLE: an equivalent transfer must not poison the original proposal');
 assert.equal(accepted.projectData.humanInputRequests.length,1);assert.equal(accepted.projectData.acceptedChanges.length,0,'Clarification must not become an accepted data change.');
 assert.notEqual(accepted.stages[1].status,'COMPLETE');
 const acceptedWorkflow=(await browser.readWorkflow([1])).workflow[0];assert.equal(acceptedWorkflow.gate.complete,false,'RETRY_BROWSER_CLARIFICATION_GATE_ORACLE');assert.equal(acceptedWorkflow.action.actionType,'CONTINUE_AGENT_CONVERSATION','RETRY_BROWSER_HUMAN_CONTINUATION_ORACLE');
 await browser.reload();const beforeRetry=await browser.readProject();
 assert.deepEqual(beforeRetry.projectData.humanInputRequests,accepted.projectData.humanInputRequests);assert.deepEqual(beforeRetry.projectData.rawResponses,accepted.projectData.rawResponses);
 await submit(expanded);const afterRetry=await browser.readProject();
 assert.deepEqual(afterRetry.projectData.humanInputRequests,accepted.projectData.humanInputRequests,'RETRY_BROWSER_NO_DUPLICATE_QUESTIONS_ORACLE');
 assert.deepEqual(afterRetry.projectData.responseProposals,accepted.projectData.responseProposals);assert.deepEqual(afterRetry.projectData.outputReceipts,accepted.projectData.outputReceipts);
 assert.equal(afterRetry.projectData.rawResponses.length,3);assert.equal(afterRetry.projectData.rawResponses.at(-1).completeRawResponse,expanded);
 const notices=await browser.evaluate(`[...document.querySelectorAll('.notice')].map(node=>node.textContent).join(String.fromCharCode(10))`);
 assert.match(notices,/This response is already recorded/,'RETRY_BROWSER_VALID_DUPLICATE_FEEDBACK_ORACLE');assert.doesNotMatch(notices,/same rejected response file/);
 const announcement=await browser.evaluate(`document.querySelector('#app-live-status')?.textContent||''`);assert.match(announcement,/response already recorded; follow the current action/,'RETRY_BROWSER_RECORDED_ANNOUNCEMENT_ORACLE');assert.equal(await browser.exists('#accept-proposal'),false);
 assert.equal(afterRetry.projectData.acceptedChanges.length,0);assert.notEqual(afterRetry.stages[1].status,'COMPLETE');
 assert.equal(afterRetry.revision,beforeRetry.revision,'RETRY_BROWSER_ACCEPTED_OPERATIONAL_REVISION_ORACLE');
 const retryWorkflow=(await browser.readWorkflow([1])).workflow[0];assert.equal(retryWorkflow.gate.complete,false,'RETRY_BROWSER_DUPLICATE_GATE_ORACLE');assert.equal(retryWorkflow.action.actionType,'CONTINUE_AGENT_CONVERSATION','RETRY_BROWSER_DUPLICATE_CONTINUATION_ORACLE');
 await browser.reload();const restored=await browser.readProject();assert.deepEqual(restored.projectData.rawResponses,afterRetry.projectData.rawResponses);assert.deepEqual(restored.projectData.humanInputRequests,afterRetry.projectData.humanInputRequests);assert.deepEqual(restored.projectData.responseProposals,afterRetry.projectData.responseProposals,'RETRY_BROWSER_RELOAD_PROPOSAL_ORACLE');assert.deepEqual(restored.projectData.outputReceipts,afterRetry.projectData.outputReceipts,'RETRY_BROWSER_RELOAD_RECEIPT_ORACLE');
 return {responseRetryBrowser:'PASS',synthetic:true,actualBrowser:true,realExternalAgent:false,physicalDevice:false,originalProposalId:proposal.proposalId,receiptId:receipt.receiptId,rawTransfersRetained:3,questionsCreated:1,acceptedDataChanges:0,stageComplete:false,acceptedAfterEquivalentRetry:true,acceptedRetryNotMislabeledRejected:true,reloadPreserved:true};
}
