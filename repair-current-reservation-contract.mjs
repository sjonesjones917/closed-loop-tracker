import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const write=(path,text)=>fs.writeFileSync(path,text);
const replaceOnce=(text,from,to,label)=>{
  const count=text.split(from).length-1;
  if(count!==1)throw new Error(`${label}: expected one exact match, found ${count}.`);
  return text.replace(from,to);
};

let schema=read('workflow-schema.js');
schema=replaceOnce(schema,
"reservation:['ACTIVE','ORPHANED','CANCELLED','ACCEPTED','SUPERSEDED']",
"reservation:['RESERVED','EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','ACCEPTED','REJECTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE']",
'reservation state enum');
schema=replaceOnce(schema,
"['OPERATION_RESERVATION_ID','JOB_ID','STAGE','OPERATION','TARGET_SLOT','PACKAGE_ID','PROMPT_ID','SCOPE','EXPECTED_REVISION','CHALLENGE_NONCE','STATUS','OWNING_TAB_INSTANCE','IDEMPOTENCY_KEY','PAYLOAD_HASH']",
"['OPERATION_RESERVATION_ID','JOB_ID','STAGE','OPERATION','TARGET_SLOT','PACKAGE_ID','PROMPT_ID','SCOPE','EXPECTED_REVISION','RESERVATION_REVISION','CHALLENGE_NONCE','STATUS','OWNING_TAB_INSTANCE','IDEMPOTENCY_KEY','PAYLOAD_HASH']",
'operation reservation application fields');
schema=replaceOnce(schema,
"types:{STAGE:{valueType:'INTEGER'},SCOPE:{valueType:'OBJECT'},EXPECTED_REVISION:{valueType:'INTEGER'},STATUS:{enumValues:E.reservation}}",
"types:{STAGE:{valueType:'INTEGER'},SCOPE:{valueType:'OBJECT'},EXPECTED_REVISION:{valueType:'INTEGER'},RESERVATION_REVISION:{valueType:'INTEGER'},STATUS:{enumValues:E.reservation}}",
'operation reservation revision type');
write('workflow-schema.js',schema);

let engine=read('workflow-engine.js');
const start=engine.indexOf('function nonce(){const b=new Uint8Array(16);');
const end=engine.indexOf('function idem(p,o={}){',start);
if(start<0||end<0||end<=start)throw new Error('Could not locate integrated reservation implementation.');
const replacement=`function nonce(){const b=new Uint8Array(16);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');}\nfunction reservationTargetSlot(p,{stage,operation,scope:operationScope={}}={}){\n  ensure(p);const n=Number(stage),op=String(operation||'COMPLETE'),contract=schema.operationContract?.(n,op);if(!contract)throw new Error('Unknown stage-operation combination.');const targetIdentities={};for(const key of safe(contract.scopeRequirements)){if(key==='projectRevision')continue;const value=operationScope?.[key];if(value!==undefined&&value!==null&&value!=='')targetIdentities[key]=value;}return h.sha256Value({contractProfileId:String(p.job?.CONTRACT_PROFILE_ID||schema.CONTRACT_PROFILE_ID||''),jobId:String(p.job?.JOB_ID||''),stage:n,operation:op,targetIdentities});\n}\nconst RESERVATION_PRESERVING_STATES=Object.freeze(new Set(['RESERVED','EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED']));\nconst RESERVATION_TRANSITIONS=Object.freeze({RESERVED:Object.freeze(['EXPORTED','ORPHANED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE']),EXPORTED:Object.freeze(['RESPONSE_STAGED','ORPHANED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE']),ORPHANED:Object.freeze(['RESUMED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE']),RESUMED:Object.freeze(['EXPORTED','RESPONSE_STAGED','ORPHANED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE']),RESPONSE_STAGED:Object.freeze(['ACCEPTED','REJECTED','ORPHANED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE'])});\nfunction reserve(p,o={}){ensure(p);const n=Number(o.stage==null?p.activeStage:o.stage),operation=String(o.operation||'COMPLETE'),baseScope={...(o.scope||scope(p))},targetSlot=reservationTargetSlot(p,{stage:n,operation,scope:baseScope});if(o.targetSlot!=null&&String(o.targetSlot)!==targetSlot)throw new Error('TARGET_SLOT is application-calculated and cannot be supplied or overridden.');const ph=h.sha256Value(o.payload||{}),key=h.sha256Value({commandType:'RESERVE_OPERATION',contractProfileId:String(p.job?.CONTRACT_PROFILE_ID||schema.CONTRACT_PROFILE_ID||''),jobId:String(p.job?.JOB_ID||''),stage:n,operation,targetSlot,scope:Object.fromEntries(Object.entries(baseScope).filter(([scopeKey])=>scopeKey!=='projectRevision')),payloadHash:ph});const matching=safe(p?.projectData?.operationReservations).filter(r=>Number(fv(r,'STAGE'))===n&&String(fv(r,'OPERATION'))===operation&&String(fv(r,'TARGET_SLOT'))===targetSlot);const exact=matching.find(r=>String(fv(r,'IDEMPOTENCY_KEY'))===key);if(exact)return exact;if(matching.some(r=>RESERVATION_PRESERVING_STATES.has(up(fv(r,'STATUS')))))throw new Error('An authoritative reservation already controls this target operation slot.');const rev=Number(p.revision||0),reservationRevision=rev+1,reservationScope={...baseScope,projectRevision:reservationRevision},created=put(p,'operationReservations',{JOB_ID:String(p.job?.JOB_ID||''),STAGE:n,OPERATION:operation,TARGET_SLOT:targetSlot,PACKAGE_ID:String(o.packageId||''),PROMPT_ID:String(o.promptId||''),SCOPE:reservationScope,EXPECTED_REVISION:reservationRevision,RESERVATION_REVISION:reservationRevision,CHALLENGE_NONCE:nonce(),STATUS:'RESERVED',OWNING_TAB_INSTANCE:String(o.owningTabInstance||'UNKNOWN'),IDEMPOTENCY_KEY:key,PAYLOAD_HASH:ph},{stage:n,source:'APPLICATION_RESERVATION',scope:reservationScope});p.revision=reservationRevision;return created;}\nfunction transitionReservation(r,next){const current=up(fv(r,'STATUS')),target=up(next),allowed=RESERVATION_TRANSITIONS[current]||[];if(!allowed.includes(target))throw new Error(\`Invalid operation-reservation transition \${current||'UNKNOWN'} -> \${target||'UNKNOWN'}.\`);set(r,'operationReservations','STATUS',target);return r;}\nfunction orphan(p,tab){ensure(p);for(const r of safe(p?.projectData?.operationReservations))if(RESERVATION_PRESERVING_STATES.has(up(fv(r,'STATUS')))&&up(fv(r,'STATUS'))!=='ORPHANED'&&String(fv(r,'OWNING_TAB_INSTANCE'))!==String(tab||''))transitionReservation(r,'ORPHANED');return safe(p?.projectData?.operationReservations);}\n`;
engine=engine.slice(0,start)+replacement+engine.slice(end);
engine=replaceOnce(engine,
"reserveOperation:reserve,markOrphanedReservations:orphan,executeIdempotentCommand:idem",
"reserveOperation:reserve,transitionOperationReservation:transitionReservation,reservationTargetSlot,markOrphanedReservations:orphan,executeIdempotentCommand:idem",
'engine reservation exports');
write('workflow-engine.js',engine);

const regression=`import fs from 'node:fs';\nimport vm from 'node:vm';\nimport assert from 'node:assert/strict';\n\nfor(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(new URL('./'+file,import.meta.url),'utf8'),{filename:file});\nconst schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;\nconst value=(record,name)=>engine.recordValue(record,name),id=record=>engine.recordId(record,'operationReservations');\nassert.deepEqual(schema.CONTROLLING_COMPLETION_ENUMS.reservation,['RESERVED','EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','ACCEPTED','REJECTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE']);\nconst p={revision:7,activeStage:1,job:{JOB_ID:'JOB-RESERVATION-TEST',CONTRACT_PROFILE_ID:'closed-loop-completion-profile/1'},projectData:{},stages:{}};engine.ensureShape(p);\nconst operationScope={projectRevision:7,inputVersion:'INPUT-v001'};\nconst target=engine.reservationTargetSlot(p,{stage:1,operation:'COMPLETE',scope:operationScope});\nassert.match(target,/^[a-f0-9]{64}$/);\nassert.throws(()=>engine.reserveOperation(p,{stage:1,operation:'COMPLETE',scope:operationScope,targetSlot:'caller-owned'}),/application-calculated/);\nconst r=engine.reserveOperation(p,{stage:1,operation:'COMPLETE',scope:operationScope,owningTabInstance:'TAB-A',payload:{kind:'test'}});\nassert.equal(p.revision,8,'reservation creation must commit R+1');assert.equal(value(r,'STATUS'),'RESERVED');assert.equal(value(r,'EXPECTED_REVISION'),8);assert.equal(value(r,'RESERVATION_REVISION'),8);assert.equal(value(r,'SCOPE').projectRevision,8);assert.equal(value(r,'TARGET_SLOT'),target);assert.match(value(r,'CHALLENGE_NONCE'),/^[a-f0-9]{32}$/);\nassert.equal(id(engine.reserveOperation(p,{stage:1,operation:'COMPLETE',scope:operationScope,owningTabInstance:'TAB-A',payload:{kind:'test'}})),id(r),'exact retry must return the existing reservation before stale-revision handling');assert.equal(p.revision,8,'exact retry must not reserve another revision');\nengine.transitionOperationReservation(r,'EXPORTED');engine.transitionOperationReservation(r,'RESPONSE_STAGED');engine.transitionOperationReservation(r,'ACCEPTED');assert.equal(value(r,'STATUS'),'ACCEPTED');assert.throws(()=>engine.transitionOperationReservation(r,'RESERVED'),/Invalid operation-reservation transition/);\nconsole.log(JSON.stringify({reservationContract:'PASS',targetSlot:target,reservationRevision:value(r,'RESERVATION_REVISION'),finalState:value(r,'STATUS')}));\n`;
write('verify-reservation-contract.mjs',regression);

let v3=read('verify-v3-contract.mjs');
v3=replaceOnce(v3,
"const v3Proof=read('./verify-v3-definition-of-done.mjs');",
"const v3Proof=read('./verify-v3-definition-of-done.mjs');\nconst reservationProof=read('./verify-reservation-contract.mjs');",
'v3 verifier reservation proof load');
v3=replaceOnce(v3,
"assert.match(schema,/INCOMPLETE','BLOCKED','COMPLETE/,'JOB_RECORD_STATUS must use the closed enum');",
"assert.match(schema,/INCOMPLETE','BLOCKED','COMPLETE/,'JOB_RECORD_STATUS must use the closed enum');\nassert.match(reservationProof,/RESERVED','EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','ACCEPTED','REJECTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE/,'permanent reservation regression must pin the closed state machine');\nassert.match(engine,/p\.revision=reservationRevision/,'reservation creation must commit R+1');\nassert.match(engine,/TARGET_SLOT is application-calculated/,'caller-supplied target slots must be rejected');",
'v3 verifier reservation assertions');
write('verify-v3-contract.mjs',v3);

fs.rmSync('repair-current-reservation-contract.mjs');
fs.rmSync('.github/workflows/repair-current-reservation-contract.yml');
