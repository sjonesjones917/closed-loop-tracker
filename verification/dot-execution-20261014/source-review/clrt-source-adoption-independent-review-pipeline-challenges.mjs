import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {validateMechanicalCandidateExclusions} from '/workspace/shared/clrt-source-review-pipeline/review-specification-coverage.mjs';
const root='/workspace/shared/clrt-source-review-pipeline';const sha=b=>crypto.createHash('sha256').update(b).digest('hex');const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));const source=fs.readFileSync(path.join(root,'specification/closed-loop-reliability-controlling-implementation-specification.txt')),lines=source.toString('utf8').split('\n');
const original=read('verification/source-exclusion-evidence-20261014.json'),originalA=read('verification/clrt-source-extraction-a-independent.json'),originalB=read('verification/clrt-source-extraction-b.json'),originalReview=read('verification/independent-source-review-20261014.json');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-pipeline-challenges-')),checks=[];
function fixture(edit){const evidence=structuredClone(original),a=structuredClone(originalA),b=structuredClone(originalB),review=structuredClone(originalReview);edit?.({evidence,a,b,review});
for(const [key,value] of [['independentExtractorA',a],['independentReview',b]]){const file=path.join(temp,key+'.json'),bytes=Buffer.from(JSON.stringify(value));fs.writeFileSync(file,bytes);evidence[key]={path:file,sha256:sha(bytes)};}
review.normalizationProvenance.frozenSourceReviewSha256=evidence.independentReview.sha256;const bytes=Buffer.from(JSON.stringify(evidence)),file=path.join(temp,'exclusions.json');fs.writeFileSync(file,bytes);return [lines,sha(source),review,{mechanicalCandidateExclusionEvidence:{path:file,sha256:sha(bytes)},mechanicalCandidateExclusions:evidence.mechanicalCandidateExclusions}];}
try{
assert.equal(validateMechanicalCandidateExclusions(...fixture()).exclusions.length,9);
for(const [name,edit,pattern] of [
 ['duplicate exclusion with coherent rehashed inventory',({evidence})=>evidence.mechanicalCandidateExclusions.push(structuredClone(evidence.mechanicalCandidateExclusions[0])),/overlaps or removes a mandatory line/],
 ['mandatory substitution with coherent rehashed inventory',({evidence})=>evidence.mechanicalCandidateExclusions[0].line=5578,/overlaps or removes a mandatory line/],
 ['wrong source text with coherent rehashed inventory',({evidence})=>evidence.mechanicalCandidateExclusions[0].text+='!',/exact source mismatch/],
 ['different source identity with coherent evidence digest',({evidence})=>evidence.specificationSha256='0'.repeat(64),/source mismatch/],
 ['B independence false despite rehashed lineage',({b})=>b.independence.other_extractions_read=true,/independent B basis mismatch/],
 ['A independence false despite rehashed lineage',({a})=>a.repository_or_other_worker_outputs_read_during_independent_phase=true,/independent A basis mismatch/],
 ['B source block altered despite rehashed lineage',({b})=>b.source_block_anchors[1009].verbatim+='!',/source block mismatch/],
 ['A classification changed despite rehashed lineage',({a})=>a.source_units[4451].classification='NORMATIVE_REQUIREMENT',/source unit mismatch/],
 ['B block pointer points outside exclusion line',({evidence})=>evidence.mechanicalCandidateExclusions[0].independentReviewPointers.exactSourceBlock='/source_block_anchors/1010',/outside its independent source block/],
 ['A source unit pointer points to another line',({evidence})=>{evidence.mechanicalCandidateExclusions[0].extractorAUnitIndex=4452;evidence.mechanicalCandidateExclusions[0].extractorAUnitPointer='/source_units/4452';},/source unit mismatch/],
 ['normalizer admits semantic content changed',({review})=>review.normalizationProvenance.semanticContentChanged=true,/normalized review mismatch/],
 ['missing mandatory preservation list',({evidence})=>evidence.mandatoryPreservedLines=[],/preservation controls are missing/]
]){assert.throws(()=>validateMechanicalCandidateExclusions(...fixture(edit)),pattern,name);assert.equal(validateMechanicalCandidateExclusions(...fixture()).exclusions.length,9);checks.push(name);}
console.log(JSON.stringify({result:'PASS',freshRehashedEvidenceNegativeControls:checks,count:checks.length},null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
