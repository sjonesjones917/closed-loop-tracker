import fs from 'node:fs';
const path='verify-stage26-27-reconciliation-release.mjs';
let text=fs.readFileSync(path,'utf8');
const old="function rec(p,collection,id,fields,scope){const def=schema.RECORD_SCHEMAS[collection],r={id,stage:def.stage||26,active:true,scope:{...scope},fields:{[def.idField]:id,...fields}};Object.assign(r,r.fields);r.contentSha256=h.contentRecordSha256(r,def.idField);r.recordSha256=h.recordSha256(r);r.sha256=r.recordSha256;return r;}";
const replacement="function rec(p,collection,id,fields,scope){const def=schema.RECORD_SCHEMAS[collection],r={id,stage:def.stage||26,active:true,scope:{...scope},fields:{[def.idField]:id,...fields}};Object.assign(r,r.fields);if(collection==='processAudits'||collection==='productAudits'){const evidenceId='EVIDENCE-'+id;r.evidenceRefs=[evidenceId];if(!p.projectData.evidenceRecords.some(x=>e.recordId(x,'evidenceRecords')===evidenceId)){const ev={id:evidenceId,stage:26,active:true,scope:{...scope},fields:{EVIDENCE_ID:evidenceId,KIND:'AUDIT_EXECUTION_EVIDENCE',DESCRIPTION:'Canonical Stage 26 audit execution evidence',AUTHORITY_TYPE:'AGENT_CLAIM',LOCATION:'Stage 26 isolated regression fixture',CONTENT:'Observed audit evidence for '+id,STATUS:'PRESERVED'}};Object.assign(ev,ev.fields);p.projectData.evidenceRecords.push(ev);}}r.contentSha256=h.contentRecordSha256(r,def.idField);r.recordSha256=h.recordSha256(r);r.sha256=r.recordSha256;return r;}";
if(!text.includes(old))throw new Error('Stage 27 verifier record helper anchor missing.');
text=text.replace(old,replacement);
fs.writeFileSync(path,text);
console.log('Stage 27 verifier now uses canonical evidence records for audit sufficiency.');
