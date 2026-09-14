import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

let source=fs.readFileSync('verify-full-cycle.mjs','utf8');
const prepare="const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:pr.packageId||null,operationReservationId:pr.operationReservationId||null,challengeNonce:pr.challengeNonce||null}});";
assert.equal(source.split(prepare).length,2);
source=source.replace(prepare,`const files=[];if(stage===21){const content='released-product-bytes',sha256=hash.sha256Text(content);e.attachments=[{temporaryKey:'product-file',filename:'product.bin',mediaType:'application/octet-stream',byteSize:content.length,sha256,required:true}];e.evidence[0].attachmentRef={tempKey:'product-file'};files.push({artifactId:'ARTIFACT-PRODUCT',name:'product.bin',type:'application/octet-stream',size:content.length,sha256,attachmentSlotId:ingestion.attachmentSlotPlan(p,e,pr)[0].attachmentSlotId});}const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:pr.packageId||null,operationReservationId:pr.operationReservationId||null,challengeNonce:pr.challengeNonce||null}});`);
const prior="assert(!engine.gate(21,p).complete,'Stage 21 completed before actual product bytes were persisted.');";
assert.ok(source.includes(prior));source=source.replace(prior,"assert(engine.gate(21,p).complete,'Stage 21 did not complete after its exact returned product file was mapped, verified, and accepted.');");
const script=path.resolve(`.product-attachment-journey-${process.pid}.mjs`);fs.writeFileSync(script,source);
let result;try{result=spawnSync(process.execPath,[script],{encoding:'utf8',maxBuffer:64*1024*1024,env:process.env});}finally{fs.rmSync(script,{force:true});}
if(result.error)throw result.error;console.log(JSON.stringify({productAttachmentJourney:result.status===0?'PASS':'FAIL',basis:'SYNTHETIC_PRODUCTION_LIFECYCLE_WITH_VERIFIED_FILE_METADATA',exitCode:result.status,stdout:result.stdout,stderr:result.stderr}));if(result.status!==0)process.exitCode=1;
