import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {amendmentEvidencePaths,evidenceFingerprint} from './verification-evidence.mjs';
import {atomicEvidenceReferences,isAtomicEvidencePath,readAtomicEvidenceBytes} from './review-specification-coverage.mjs';
export function verifyAmendmentEvidencePaths(){
const governance=JSON.parse(fs.readFileSync('specification/requirement-evidence-bindings.json'));
assert.equal(governance.atomicExtraction.schema,'closed-loop-approved-insertion-atomic-extraction/1');
assert.deepEqual(amendmentEvidencePaths(governance),[]);
const refs=atomicEvidenceReferences(governance.atomicExtraction);
const fingerprint=evidenceFingerprint();
for(const ref of refs)assert.equal(fingerprint.inputSha256[ref.path],ref.sha256,ref.path);
const source=evidenceFingerprint.toString(),a=source.indexOf('  const sourceRoot='),b=source.indexOf('  const inputs=',a);
const validatePaths=new Function('cwd','governed','fs','path','requireEvidence','atomicPaths','isAtomicEvidencePath',source.slice(a,b));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'amendment-path-controls-'));
const requireEvidence=(ok,message)=>{if(!ok)throw Error(message);};
const validate=(paths,declared=new Set())=>validatePaths(directory,paths,fs,path,requireEvidence,declared,isAtomicEvidencePath);
try{
 fs.mkdirSync(path.join(directory,'verification'));for(const file of ['review.json','proposal.md'])fs.writeFileSync(path.join(directory,'verification',file),'legacy fixture');
 for(const row of [{},{sourceReviewPath:'verification/review.json'},{approvedProposalPath:'verification/proposal.md'}])assert.throws(()=>validate(amendmentEvidencePaths({approvedAmendments:[row]})),/exact first-party verification path/);
 assert.deepEqual(amendmentEvidencePaths({approvedAmendments:[{sourceReviewPath:'verification/review.json',approvedProposalPath:'verification/proposal.md'}]}),['verification/review.json','verification/proposal.md']);
 const nested=refs.find(ref=>ref.path.split('/').length>2).path;
 fs.mkdirSync(path.dirname(path.join(directory,nested)),{recursive:true});fs.writeFileSync(path.join(directory,nested),'fixture');
 validate([nested],new Set([nested]));assert.throws(()=>validate([nested]),/exact first-party verification path/);
 for(const bad of ['../escape.json','verification/../escape.json','/absolute.json','verification\\escape.json'])assert.throws(()=>validate([bad],new Set([bad])),/exact first-party verification path/);
 fs.unlinkSync(path.join(directory,nested));fs.symlinkSync('/etc/hosts',path.join(directory,nested));assert.throws(()=>validate([nested],new Set([nested])),/outside the first-party source root/);
 const bad=structuredClone(governance.atomicExtraction);bad.continuation.sha256='0'.repeat(64);assert.throws(()=>atomicEvidenceReferences(bad));
 assert.throws(()=>atomicEvidenceReferences(governance.atomicExtraction,file=>file===governance.atomicExtraction.continuation.path?Buffer.from('{}'):readAtomicEvidenceBytes(file)));
 return {amendmentEvidencePaths:'PASS',currentReferences:refs.length,currentFingerprintInputs:Object.keys(fingerprint.inputSha256).length,legacyMissingPathsRejected:true,declaredNestedOnly:true,traversalAndSymlinkEscapeRejected:true,continuationTamperingRejected:true};
}finally{fs.rmSync(directory,{recursive:true,force:true});}

}
if(process.argv[1]?.endsWith('/test-amendment-evidence-paths.mjs'))console.log(JSON.stringify(verifyAmendmentEvidencePaths()));
