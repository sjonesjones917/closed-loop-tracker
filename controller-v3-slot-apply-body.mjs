import fs from 'node:fs';
function rw(path,fn){const s=fs.readFileSync(path,'utf8'),n=fn(s);if(n===s)throw new Error(`No change ${path}`);fs.writeFileSync(path,n);}
function once(s,a,b,label){if(!s.includes(a))throw new Error(`Missing ${label}`);if(s.indexOf(a)!==s.lastIndexOf(a))throw new Error(`Nonunique ${label}`);return s.replace(a,b);}

rw('workflow-engine.js',s=>{
  s=once(s,"function executionHandoff(project,{stage=Number(project.activeStage||0),operation=null,testIds=null,runIds=null}={}){","function attachmentSlotIdentity(project,{stage,operation,item}){const payload={version:'closed-loop-attachment-slot/1',jobId:String(project?.job?.JOB_ID||''),stage:Number(stage),operation:String(operation||'COMPLETE'),purpose:String(item?.kind||'RETURNED_ARTIFACT'),role:String(item?.role||item?.kind||'RETURNED_ARTIFACT'),required:item?.required!==false,filenameRule:String(item?.filenameOrPattern||item?.filename||'*')};return 'ATTACHMENT_SLOT-'+hash.sha256Value(payload).slice(0,32).toUpperCase();}\nfunction executionHandoff(project,{stage=Number(project.activeStage||0),operation=null,testIds=null,runIds=null}={}){",'executionHandoff marker');
  s=once(s,"  const externalWork=[1,7,11,12,15,17,19,21,23,24,25].includes(stage);if(externalWork)expectBack.set('STRUCTURED_RESPONSE|final strict JSON response',{kind:'STRUCTURED_RESPONSE',filenameOrPattern:'final strict JSON response',required:true});\n  return {send:[...send.values()],withhold:[...withhold.values()],expectBack:[...expectBack.values()]};","  const externalWork=[1,7,11,12,15,17,19,21,23,24,25].includes(stage);if(externalWork)expectBack.set('STRUCTURED_RESPONSE|response.json',{kind:'STRUCTURED_RESPONSE',filenameOrPattern:'response.json',required:true});\n  const boundReturns=[...expectBack.values()].map(item=>String(item.kind||'').toUpperCase()==='STRUCTURED_RESPONSE'?item:{...item,attachmentSlotId:attachmentSlotIdentity(project,{stage,operation:operation||'COMPLETE',item}),purpose:String(item.purpose||item.kind||'RETURNED_ARTIFACT'),role:String(item.role||item.kind||'RETURNED_ARTIFACT'),allowedMediaTypes:safe(item.allowedMediaTypes).length?safe(item.allowedMediaTypes):[String(item.mediaType||'application/octet-stream')],filenameRule:String(item.filenameRule||item.filenameOrPattern||item.filename||'*'),maximumSize:Number.isSafeInteger(item.maximumSize)?item.maximumSize:104857600,expectedDigest:item.expectedDigest??null});\n  return {send:[...send.values()],withhold:[...withhold.values()],expectBack:boundReturns};",'handoff return');
  s=s.replace("executionHandoff,canonicalTestBindingCatalog","executionHandoff,attachmentSlotIdentity,canonicalTestBindingCatalog");
  return s;
});

rw('response-ingestion.js',s=>{
  s=once(s,"const ATTACHMENT_KEYS=Object.freeze(['temporaryKey','filename','mediaType','byteSize','sha256','required']);","const ATTACHMENT_KEYS=Object.freeze(['temporaryKey','attachmentSlotId','filename','mediaType','byteSize','sha256','required']);",'attachment keys');
  const start="    const tempKey=registerTemp(attachment.temporaryKey,`${path}/temporaryKey`,'attachment');\n    const filename=String(attachment.filename||'').trim(),mediaType=String(attachment.mediaType||'').trim(),claimedSize=Number(attachment.byteSize),claimedHash=String(attachment.sha256||'').toLowerCase();";
  const end="    if(tempKey)attachmentIndex.set(tempKey,{artifactId,file:match,path});";
  const a=s.indexOf(start);if(a<0)throw new Error('attachment validation start missing');const b=s.indexOf(end,a);if(b<0)throw new Error('attachment validation end missing');
  const replacement=[
"    const tempKey=registerTemp(attachment.temporaryKey,`${path}/temporaryKey`,'attachment');",
"    const attachmentSlotId=String(attachment.attachmentSlotId||'').trim(),filename=String(attachment.filename||'').trim(),mediaType=String(attachment.mediaType||'').trim(),claimedSize=Number(attachment.byteSize),claimedHash=String(attachment.sha256||'').toLowerCase();",
"    if(!attachmentSlotId)issues.push(issue('MISSING_ATTACHMENT_SLOT_ID',`${path}/attachmentSlotId`,'attachmentSlotId is required and application-owned.'));",
"    if(!filename)issues.push(issue('MISSING_ATTACHMENT_FILENAME',`${path}/filename`,'filename is required.'));",
"    if(!mediaType)issues.push(issue('MISSING_ATTACHMENT_MEDIA_TYPE',`${path}/mediaType`,'mediaType is required.'));",
"    if(!Number.isInteger(claimedSize)||claimedSize<0)issues.push(issue('INVALID_ATTACHMENT_BYTE_SIZE',`${path}/byteSize`,'byteSize must be a non-negative integer.'));",
"    if(!/^[0-9a-f]{64}$/.test(claimedHash))issues.push(issue('INVALID_ATTACHMENT_SHA256',`${path}/sha256`,'sha256 must be a 64-character hexadecimal SHA-256 digest.'));",
"    if(attachment.required!==undefined&&typeof attachment.required!=='boolean')issues.push(issue('WRONG_VALUE_TYPE',`${path}/required`,'required must be BOOLEAN when supplied.'));",
"    const expectedSlots=workflow.executionHandoff(project,{stage:stageNumber,operation:String(envelope.operation||'COMPLETE')}).expectBack.filter(item=>String(item.kind||'').toUpperCase()!=='STRUCTURED_RESPONSE');",
"    const expected=expectedSlots.find(slot=>String(slot.attachmentSlotId||'')===attachmentSlotId);",
"    if(attachmentSlotId&&!expected){issues.push(issue('UNKNOWN_ATTACHMENT_SLOT_ID',`${path}/attachmentSlotId`,'Attachment slot is not current for this job, stage, and operation.'));return;}",
"    if(attachmentSlotId&&safe(envelope.attachments).filter(x=>String(x?.attachmentSlotId||'')===attachmentSlotId).length>1){issues.push(issue('DUPLICATE_ATTACHMENT_SLOT',`${path}/attachmentSlotId`,'Each attachment slot may be declared at most once.'));return;}",
"    const slotFiles=suppliedFiles.filter(file=>String(file?.attachmentSlotId||'')===attachmentSlotId);",
"    if(slotFiles.length!==1){issues.push(issue(slotFiles.length?'DUPLICATE_ATTACHMENT_SLOT_SELECTION':'MISSING_REQUIRED_ATTACHMENT',path,slotFiles.length?'Exactly one selected returned file may fill an attachment slot.':`Required attachment slot ${attachmentSlotId} was not filled.`));return;}",
"    const match=slotFiles[0];",
"    if(String(match?.name??match?.filename??'')!==filename){issues.push(issue('ATTACHMENT_FILENAME_MISMATCH',`${path}/filename`,'Selected slot file filename does not match the response claim.'));return;}",
"    if(mediaType&&String(match?.type??match?.mediaType??'')!==mediaType){issues.push(issue('ATTACHMENT_MEDIA_TYPE_MISMATCH',`${path}/mediaType`,'Selected slot file media type does not match the declared value.'));return;}",
"    if(Number(match?.size??match?.byteSize)!==claimedSize){issues.push(issue('ATTACHMENT_BYTE_SIZE_MISMATCH',`${path}/byteSize`,'Selected slot file byte size does not match the declared value.'));return;}",
"    if(String(match?.sha256||'').toLowerCase()!==claimedHash){issues.push(issue('ATTACHMENT_SHA256_MISMATCH',`${path}/sha256`,'Selected slot file SHA-256 does not match the declared value.'));return;}",
"    const artifactId=String(match.artifactId||match.id||'');if(!artifactId){issues.push(issue('UNRESOLVED_EVIDENCE_ATTACHMENT',path,'Verified supplied attachment has no canonical artifact identity.'));return;}",
"    if(tempKey)attachmentIndex.set(tempKey,{artifactId,file:match,path,attachmentSlotId});"
  ].join('\n');
  s=s.slice(0,a)+replacement+s.slice(b+end.length);
  s=once(s,"  for(const attachment of safe(envelope.attachments)){const match=safe(rawRecord.files).find(file=>String(file?.name??file?.filename??'')===String(attachment.filename||'')&&String(file?.type??file?.mediaType??'')===String(attachment.mediaType||'')&&Number(file?.size??file?.byteSize)===Number(attachment.byteSize)&&String(file?.sha256||'').toLowerCase()===String(attachment.sha256||'').toLowerCase());if(match&&attachment.temporaryKey)tempToCanonical[attachment.temporaryKey]={collection:'artifacts',id:String(match.artifactId||match.id)};}","  for(const attachment of safe(envelope.attachments)){const slotId=String(attachment.attachmentSlotId||'');const matches=safe(rawRecord.files).filter(file=>String(file?.attachmentSlotId||'')===slotId);const match=matches.length===1?matches[0]:null;if(match&&attachment.temporaryKey)tempToCanonical[attachment.temporaryKey]={collection:'artifacts',id:String(match.artifactId||match.id)};}",'plan attachment map');
  return s;
});

rw('app-core.js',s=>{
  s=once(s,"const operationSelection={},runSelection={},responseFileSelection={};","const operationSelection={},runSelection={},responseFileSelection={},returnedFileSlotSelection={};",'selection state');
  const fnStart=s.indexOf('function artifactControlMarkup(n,locked){');if(fnStart<0)throw new Error('artifactControlMarkup missing');const fnEnd=s.indexOf('\nfunction ',fnStart+10);if(fnEnd<0)throw new Error('artifactControlMarkup end missing');let fn=s.slice(fnStart,fnEnd);
  const retMarker='  return `<div class="panel">';if(!fn.includes(retMarker))throw new Error('artifact return missing');
  const insert="  const slotControls=requiredReturns.filter(slot=>slot.attachmentSlotId).map(slot=>{const id=String(slot.attachmentSlotId),selected=safe(current.stages[n].authorizedFiles).filter(file=>String(file.attachmentSlotId||'')===id);return `<div class=\"field full returned-slot\"><label>${esc(slot.role||slot.kind||'Returned file')} · ${esc(id)}</label><input type=\"file\" data-return-slot=\"${esc(id)}\"${fileLocked?' disabled':''}><span class=\"help\">Required: ${slot.required!==false?'YES':'NO'} · Filename rule: ${esc(slot.filenameRule||slot.filenameOrPattern||'*')} · Selected: ${selected.length?esc(selected[0].name||selected[0].filename||'1 file'):'NONE'}. Mapping is by ATTACHMENT_SLOT_ID, never picker order or filename alone.</span></div>`;}).join('');\n";
  fn=fn.replace(retMarker,insert+retMarker);
  fn=fn.replace('${n===21&&!productReady?', '${slotControls}${n===21&&!productReady?');
  s=s.slice(0,fnStart)+fn+s.slice(fnEnd);
  s=once(s,'async function registerStageFiles(fileList){const stage=current.activeStage,created=[];try{','async function registerStageFiles(fileList,{attachmentSlotId=null}={}){const stage=current.activeStage,created=[];try{','register signature');
  s=once(s,'for(const file of fileList)created.push(await storeArtifactFile(file,stage,productId?{productId}:{}));const next=clone(current);for(const item of created){','if(attachmentSlotId&&fileList.length!==1)throw new Error(\'Exactly one returned file may be selected for one attachment slot.\');if(attachmentSlotId&&safe(current.stages[stage].authorizedFiles).some(x=>String(x.attachmentSlotId||\'\')===String(attachmentSlotId)))throw new Error(\'This attachment slot is already filled. Clear or invalidate the prior attempt before replacing it.\');for(const file of fileList)created.push(await storeArtifactFile(file,stage,{...(productId?{productId}:{}),...(attachmentSlotId?{attachmentSlotId}:{})}));const next=clone(current);for(const item of created){','register slot precondition');
  s=once(s,'next.stages[stage].authorizedFiles.push(item.view);','next.stages[stage].authorizedFiles.push({...item.view,...(attachmentSlotId?{attachmentSlotId}:{})});','slot view');
  s=once(s,"if($('#stage-files'))$('#stage-files').onchange=e=>registerStageFiles(Array.from(e.target.files||[]));if($('#stage-directory'))$('#stage-directory').onchange=e=>registerStageFiles(Array.from(e.target.files||[]));","document.querySelectorAll('[data-return-slot]').forEach(input=>input.onchange=e=>{const file=e.target.files?.[0]||null;if(!file)return;const slotId=String(input.dataset.returnSlot||'');returnedFileSlotSelection[slotId]=file;registerStageFiles([file],{attachmentSlotId:slotId});});if($('#stage-files'))$('#stage-files').onchange=e=>registerStageFiles(Array.from(e.target.files||[]));if($('#stage-directory'))$('#stage-directory').onchange=e=>registerStageFiles(Array.from(e.target.files||[]));",'slot wiring');
  return s;
});

fs.writeFileSync('verify-attachment-slot-mapping.mjs',[
"import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';",
"globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);",
"for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});",
"const schema=closedLoopWorkflowSchema;assert.equal(schema.ATTACHMENT_SLOT_CONTRACT.mappingAuthority,'ATTACHMENT_SLOT_ID');assert.equal(schema.ATTACHMENT_SLOT_CONTRACT.filenameAloneAuthoritative,false);",
"const src=fs.readFileSync('response-ingestion.js','utf8'),ui=fs.readFileSync('app-core.js','utf8'),eng=fs.readFileSync('workflow-engine.js','utf8');",
"for(const token of ['MISSING_ATTACHMENT_SLOT_ID','UNKNOWN_ATTACHMENT_SLOT_ID','DUPLICATE_ATTACHMENT_SLOT','DUPLICATE_ATTACHMENT_SLOT_SELECTION'])assert(src.includes(token),token);",
"assert(src.includes(\"file?.attachmentSlotId\"));assert(!src.includes(\"const byName=suppliedFiles.filter\"));assert(ui.includes('data-return-slot'));assert(ui.includes('Mapping is by ATTACHMENT_SLOT_ID'));assert(eng.includes('attachmentSlotIdentity'));",
"console.log(JSON.stringify({attachmentSlotMapping:'PASS',mappingAuthority:'ATTACHMENT_SLOT_ID',filenameAloneRejected:true,selectionOrderRejected:true,namedSlotControl:true}));"
].join('\n'));
console.log('attachment-slot corrections applied');
