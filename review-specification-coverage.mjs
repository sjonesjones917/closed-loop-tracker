import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REVIEWER_VERSION='closed-loop-independent-section-review/1';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

// Source identity only: this does not establish coverage, provenance reachability, or conformance.
export function validateSpecificationSource(sourceBytes,committedSpec,sourceCommit){
assert(/^[0-9a-f]{40}$/.test(sourceCommit),'Exact specification source commit is unavailable.');
assert(!sourceBytes.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf])),'Specification BOM is prohibited.');
const sourceText=new TextDecoder('utf-8',{fatal:true}).decode(sourceBytes);
assert(!sourceText.includes('\r'),'Specification contains CR or CRLF bytes.');
assert(!sourceText.startsWith('\n'),'Specification has a leading blank line.');
assert(sourceText.endsWith('\n\n')&&!sourceText.endsWith('\n\n\n'),'Specification must preserve the supplied two final LF bytes.');
assert(sourceText.startsWith('The one\n\nClosed-Loop Reliability Application\nZero-Loss Controlling Implementation Specification\n'),'Specification start boundary is wrong.');
assert(sourceText.endsWith('Completion additionally requires the current exact deployed origin and bytes and the pinned actual physical-iPhone Safari operator path.\n\n'),'Specification end boundary is wrong.');
assert(committedSpec.sha256===sha256(sourceBytes),'Committed specification manifest does not bind the exact source bytes.');
assert(committedSpec.byteLength===sourceBytes.length,'Committed specification manifest byte length is wrong.');
assert(committedSpec.sourceCommit===sourceCommit,'Committed specification source commit is wrong.');
return sourceText;
}



// An independently reviewed exclusion is an exact source-evidence tuple, never
// a heuristic permission to omit a historical section or a mandatory clause.
export function validateMechanicalCandidateExclusions(lines,sourceSha256,semanticReview,reconciliation){
  const exclusions=reconciliation.mechanicalCandidateExclusions||[];
  const descriptor=reconciliation.mechanicalCandidateExclusionEvidence;
  if(!descriptor){assert(exclusions.length===0,'Reviewed mechanical exclusion evidence is missing.');return {exclusions:[],mandatoryPreservedLines:[]};}
  const load=(record,base='.')=>{
    assert(record&&typeof record.path==='string'&&/^[0-9a-f]{64}$/.test(record.sha256),'Reviewed mechanical exclusion evidence identity is missing.');
    const file=path.resolve(base,record.path),bytes=fs.readFileSync(file);
    assert(sha256(bytes)===record.sha256,'Reviewed mechanical exclusion evidence digest mismatch.');
    return {file,value:JSON.parse(bytes)};
  };
  const evidence=load(descriptor),review=evidence.value;
  assert(review.schema==='closed-loop-independent-exclusion-evidence/1'&&review.specificationSha256===sourceSha256,'Reviewed mechanical exclusion source mismatch.');
  assert(JSON.stringify(exclusions)===JSON.stringify(review.mechanicalCandidateExclusions),'Reviewed mechanical exclusion inventory mismatch.');
  const originalB=load(review.independentReview,path.dirname(evidence.file)).value;
  const originalA=load(review.independentExtractorA,path.dirname(evidence.file)).value;
  assert(originalB.source?.sha256===sourceSha256&&originalB.complete_independent_pass===true&&originalB.independence?.other_extractions_read===false&&originalB.independence?.repository_implementation_read===false,'Reviewed mechanical exclusion independent B basis mismatch.');
  assert(semanticReview.normalizationProvenance?.frozenSourceReviewSha256===review.independentReview.sha256&&semanticReview.normalizationProvenance?.semanticContentChanged===false,'Reviewed mechanical exclusion normalized review mismatch.');
  assert(originalA.source_identity?.sha256===sourceSha256&&originalA.source_reading_finished_before_repository_inspection===true&&originalA.repository_or_other_worker_outputs_read_during_independent_phase===false,'Reviewed mechanical exclusion independent A basis mismatch.');
  const pointer=(value,location)=>{
    assert(typeof location==='string'&&location.startsWith('/'),'Reviewed mechanical exclusion pointer is missing.');
    for(const token of location.slice(1).split('/')){const key=token.replace(/~1/g,'/').replace(/~0/g,'~');assert(value!=null&&Object.hasOwn(value,key),'Reviewed mechanical exclusion pointer does not resolve.');value=value[key];}
    return value;
  };
  const seen=new Set,mandatory=new Set(review.mandatoryPreservedLines||[]);
  assert(mandatory.size>0,'Reviewed mechanical exclusion mandatory preservation controls are missing.');
  for(const row of exclusions){
    assert(Number.isInteger(row.line)&&row.line>0&&row.line<lines.length&&!seen.has(row.line)&&!mandatory.has(row.line),'Reviewed mechanical exclusion overlaps or removes a mandatory line.');seen.add(row.line);
    assert(row.sectionId==='51'&&row.classification==='NONNORMATIVE_HISTORICAL_EVIDENCE'&&row.text===lines[row.line-1]&&row.sourceLineSha256===sha256(Buffer.from(lines[row.line-1]))&&row.reason,'Reviewed mechanical exclusion exact source mismatch.');
    const refs=row.independentReviewPointers,classification=pointer(originalB,refs?.classification),exception=pointer(originalB,refs?.exception),block=pointer(originalB,refs?.exactSourceBlock),unit=pointer(originalA,row.extractorAUnitPointer);
    assert(typeof classification==='string'&&classification.length>0&&typeof exception==='string'&&exception.length>0,'Reviewed mechanical exclusion independent classification is missing.');
    assert(block.section==='51'&&Number.isInteger(block.start_line)&&Number.isInteger(block.end_line)&&row.line>=block.start_line&&row.line<=block.end_line,'Reviewed mechanical exclusion is outside its independent source block.');
    const raw=lines.slice(block.start_line-1,block.end_line).join('\n');
    assert(block.verbatim===raw&&block.source_sha256===sha256(Buffer.from(raw+'\n')),'Reviewed mechanical exclusion independent source block mismatch.');
    assert(row.extractorAUnitPointer==='/source_units/'+row.extractorAUnitIndex&&unit.source_anchor==='B:L'+row.line&&unit.text===row.text&&unit.line_sha256===sha256(Buffer.from(row.text+'\n'))&&unit.classification===row.extractorAClassification&&unit.classification==='HISTORICAL_NONNORMATIVE_EVIDENCE','Reviewed mechanical exclusion independent source unit mismatch.');
  }
  for(const line of mandatory)assert(Number.isInteger(line)&&line>0&&line<lines.length&&!seen.has(line),'Reviewed mechanical exclusion mandatory preservation line is invalid.');
  return {exclusions,mandatoryPreservedLines:[...mandatory]};
}

function reviewSpecificationCoverage(SPEC_PATH){
const bytes=fs.readFileSync(SPEC_PATH);
const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const lines=text.split('\n');

const headingMatch=line=>{
  const match=String(line).match(/^(?:(\d+)\.|(\d+(?:\.\d+)+(?:[A-Z])?))\s+(.+?)\s*$/);
  return match?{sectionId:match[1]||match[2],title:match[3]}:null;
};
const headings=[];
for(let index=0;index<lines.length;index++){
  const match=headingMatch(lines[index]);
  if(!match)continue;
  const blankBefore=index===0||lines[index-1].trim()==='';
  const blankAfter=index===lines.length-1||lines[index+1].trim()==='';
  if(blankBefore&&blankAfter)headings.push({...match,startLine:index+1});
}
for(let index=0;index<headings.length;index++)headings[index].endLine=(headings[index+1]?.startLine||lines.length+1)-1;
const topLevel=headings.filter(item=>/^\d+$/.test(item.sectionId));
const expectedTop=Array.from({length:53},(_,index)=>String(index));
if(topLevel.length!==expectedTop.length||topLevel.some((item,index)=>item.sectionId!==expectedTop[index]))throw new Error('Independent reviewer did not find the exact top-level Section 0 through Section 52 inventory.');
if(new Set(headings.map(item=>item.sectionId)).size!==headings.length)throw new Error('Independent reviewer found duplicate section identifiers.');

const headingByLine=new Map(headings.map(item=>[item.startLine,item]));
let currentSection=null;
const candidateLines=[];
const lineCoverage=[];
const broadNormative=/\b(MUST(?:\s+NOT)?|SHALL(?:\s+NOT)?|REQUIRED|PROHIBITED|REJECT(?:S|ED|ION)?|BLOCKS?|CANNOT|CAN NEVER|NEVER|EXACTLY|ONLY WHEN|COMPLETION|DEFINITION OF DONE|FAILS? CLOSED|DO NOT|MAY NOT)\b/i;
const broadStructure=/^(?:[-*]\s+|\d+\.\s+|Stage\s+\d+\s+—|Role:|Operations:|Completion:|Fields:|[A-Z][A-Z0-9_./-]{2,}(?:\s|$)|[a-z][A-Za-z0-9]+\s*$)/;
const equation=/\s=\s(?:100%|0|1\.0|TRUE|FALSE|ACCEPTED|REJECTED|BLOCKED)\s*$/;
const arrow=/→/;
for(let index=0;index<lines.length;index++){
  const lineNumber=index+1;
  const raw=lines[index];
  const trimmed=raw.trim();
  const heading=headingByLine.get(lineNumber);
  if(heading){
    currentSection=heading;
    const headingNormative=broadNormative.test(heading.title)||/^(?:must|never|do not|completion|definition of done)\b/i.test(heading.title)||['1.1','1.2','1.3','1.4'].includes(heading.sectionId);
    if(headingNormative)candidateLines.push({line:lineNumber,sectionId:heading.sectionId,text:trimmed,textSha256:sha256(Buffer.from(raw,'utf8')),reason:'NORMATIVE_SECTION_HEADING'});
    lineCoverage.push({line:lineNumber,status:headingNormative?'NORMATIVE_SECTION_HEADING':'SECTION_HEADING',sectionId:heading.sectionId,textSha256:sha256(Buffer.from(raw,'utf8'))});
    continue;
  }
  if(!currentSection){
    lineCoverage.push({line:lineNumber,status:trimmed?'DOCUMENT_HEADER':'BLANK',sectionId:null,textSha256:sha256(Buffer.from(raw,'utf8'))});
    continue;
  }
  if(!trimmed){lineCoverage.push({line:lineNumber,status:'BLANK',sectionId:currentSection.sectionId,textSha256:sha256(Buffer.from(raw,'utf8'))});continue;}
  if(trimmed==='⸻'){lineCoverage.push({line:lineNumber,status:'DECORATIVE_SEPARATOR',sectionId:currentSection.sectionId,textSha256:sha256(Buffer.from(raw,'utf8'))});continue;}
  const top=Number(currentSection.sectionId.split('.')[0]);
  const highDensityContractSection=top>=37&&top<=50;
  const candidate=broadNormative.test(trimmed)||broadStructure.test(trimmed)||equation.test(trimmed)||arrow.test(trimmed)||highDensityContractSection;
  if(candidate){
    const reason=broadNormative.test(trimmed)?'NORMATIVE_LANGUAGE':broadStructure.test(trimmed)?'CONTRACT_STRUCTURE':equation.test(trimmed)?'METRIC_EQUATION':arrow.test(trimmed)?'CONTROL_FLOW':'HIGH_DENSITY_CONTRACT_SECTION';
    candidateLines.push({line:lineNumber,sectionId:currentSection.sectionId,text:trimmed,textSha256:sha256(Buffer.from(raw,'utf8')),reason});
    lineCoverage.push({line:lineNumber,status:'NORMATIVE_CANDIDATE',sectionId:currentSection.sectionId,textSha256:sha256(Buffer.from(raw,'utf8')),reason});
  }else{
    lineCoverage.push({line:lineNumber,status:'NONNORMATIVE_CONTEXT',sectionId:currentSection.sectionId,textSha256:sha256(Buffer.from(raw,'utf8')),reason:'No normative language, contract-list structure, metric equation, control-flow arrow, or high-density contract-section rule matched.'});
  }
}

const reviewerSourceBytes=fs.readFileSync(new URL(import.meta.url));
const result={
  schema:'closed-loop-independent-specification-review/1',
  reviewerVersion:REVIEWER_VERSION,
  reviewerIdentitySha256:sha256(reviewerSourceBytes),
  reviewedSourcePath:SPEC_PATH,
  reviewedSourceSha256:sha256(bytes),
  reviewedSourceByteLength:bytes.length,
  draftManifestReceived:false,
  inputs:[SPEC_PATH],
  sectionInventory:headings,
  candidateLines,
  lineCoverage,
  status:'COMPLETE'
};
process.stdout.write(`${JSON.stringify(result)}\n`);

}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))reviewSpecificationCoverage(process.argv[2]||'specification/closed-loop-reliability-controlling-implementation-specification.txt');
