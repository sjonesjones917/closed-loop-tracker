import assert from 'node:assert/strict';
import {readInsertionAtomicDescriptor} from './approved-source-continuation.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {validateMechanicalCandidateExclusions} from './review-specification-coverage.mjs';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourcePath='specification/closed-loop-reliability-controlling-implementation-specification.txt',currentSource=fs.readFileSync(sourcePath),governance=JSON.parse(fs.readFileSync('specification/requirement-evidence-bindings.json'));
const continuation=governance.atomicExtraction?.schema==='closed-loop-approved-insertion-atomic-extraction/1'?readInsertionAtomicDescriptor(governance.atomicExtraction).continuation:null;
const archived=continuation?.base.view.find(row=>row.logicalPath===sourcePath),bytes=archived?fs.readFileSync(archived.storagePath):currentSource;
if(archived)assert.equal(sha(bytes),archived.sha256,'HISTORICAL_CLASSIFICATION_SOURCE_IDENTITY_ORACLE');
const sourceSha256=sha(bytes),lines=new TextDecoder('utf-8',{fatal:true}).decode(bytes).split('\n');
const review=JSON.parse(fs.readFileSync('verification/independent-source-review-20261014.json'));
const path='verification/source-exclusion-evidence-20261014.json',evidenceBytes=fs.readFileSync(path),evidence=JSON.parse(evidenceBytes);
const input={mechanicalCandidateExclusionEvidence:{path,sha256:sha(evidenceBytes)},mechanicalCandidateExclusions:evidence.mechanicalCandidateExclusions};
const check=value=>validateMechanicalCandidateExclusions(lines,sourceSha256,review,value);
assert.deepEqual(check(input).exclusions.map(row=>row.line),[5565,5566,5567,5568,5569,5570,5573,5574,5575]);
assert.ok(check(input).mandatoryPreservedLines.includes(5578));
const cases=[];
for(const [name,edit,pattern] of [
 ['missing evidence',value=>delete value.mechanicalCandidateExclusionEvidence,/evidence is missing/],
 ['changed evidence digest',value=>value.mechanicalCandidateExclusionEvidence.sha256='0'.repeat(64),/digest mismatch/],
 ['missing reviewed exclusion',value=>value.mechanicalCandidateExclusions.pop(),/inventory mismatch/],
 ['overbroad historical exclusion',value=>value.mechanicalCandidateExclusions.push({...value.mechanicalCandidateExclusions[0],line:5578}),/inventory mismatch/],
 ['mandatory line substituted',value=>value.mechanicalCandidateExclusions[0].line=5578,/inventory mismatch/],
 ['changed exclusion source text',value=>value.mechanicalCandidateExclusions[0].text+=' altered',/inventory mismatch/],
 ['changed independent pointer',value=>value.mechanicalCandidateExclusions[0].independentReviewPointers.classification='/requirement_groups/51/mandatory_groups/1',/inventory mismatch/]
]){
 const invalid=structuredClone(input);edit(invalid);assert.throws(()=>check(invalid),pattern,name);assert.equal(check(input).exclusions.length,9);cases.push(name);
}
assert.equal(sha(fs.readFileSync(path)),input.mechanicalCandidateExclusionEvidence.sha256);
assert.equal(sha(fs.readFileSync(sourcePath)),sha(currentSource));
console.log(JSON.stringify({test:'test-specification-source-classifications',result:'PASS',scope:'REVIEWED_SOURCE_CLASSIFICATION_ONLY',exclusionCount:9,mandatoryPreservedLines:check(input).mandatoryPreservedLines,negativeControls:cases,atomicRequirementCompletenessEstablished:false,implementationConformanceClaim:false},null,2));
