import fs from 'node:fs';
import crypto from 'node:crypto';

const SPEC_PATH=process.argv[2]||'specification/closed-loop-reliability-controlling-implementation-specification.txt';
const REVIEWER_VERSION='closed-loop-independent-section-review/1';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
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
