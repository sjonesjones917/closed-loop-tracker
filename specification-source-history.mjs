// Git source-byte provenance only. Full semantic governance remains separate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {runVerifier} from './verify-conformance-regressions.mjs';
import {readAtomicEvidenceBytes} from './review-specification-coverage.mjs';
import {readInsertionAtomicDescriptor,insertionAtomicEvidenceReferences,createApprovedInsertionMap,validateInsertionMapSegments} from './approved-source-continuation.mjs';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const requireHistory=(condition,message)=>{if(!condition)throw Error(message);};
export function verifyInsertionSourceBase({approved,sourceBytes,committedBaseBytes,specificationPath,readFile=readAtomicEvidenceBytes}){
  const {continuation:d}=readInsertionAtomicDescriptor(approved.atomicExtraction,{readFile});
  requireHistory(d.base?.source?.path===specificationPath,'Insertion base specification path differs.');
  requireHistory(Buffer.isBuffer(committedBaseBytes)&&sha(committedBaseBytes)===d.base.source.sha256,'Recorded source commit differs from pinned insertion base.');
  requireHistory(Buffer.isBuffer(sourceBytes)&&sha(sourceBytes)===d.source?.sha256,'Current insertion source bytes differ.');
  const refs=insertionAtomicEvidenceReferences(approved.atomicExtraction,{readFile}),pins=new Map(refs.map(ref=>[ref.path,ref.sha256]));
  const resolve=(ref,rows,key)=>{
    const matches=rows.filter(row=>row[key]===ref.path);
    requireHistory(matches.length===1&&matches[0].sha256===ref.sha256,'Insertion source custody must resolve uniquely with the exact reference digest.');
    const row=matches[0];requireHistory(pins.get(row.storagePath)===ref.sha256,'Insertion source is outside validated physical custody.');
    const bytes=readFile(row.storagePath);requireHistory(Buffer.isBuffer(bytes)&&sha(bytes)===ref.sha256,'Insertion source physical bytes differ.');return bytes;
  };
  const baseBytes=resolve(d.base.source,d.base.view,'logicalPath'),currentBytes=resolve(d.source,d.view,'provenancePath'),proposalBytes=resolve(d.proposal,d.view,'provenancePath'),declared=JSON.parse(resolve(d.insertionMap,d.view,'provenancePath'));
  requireHistory(baseBytes.equals(committedBaseBytes)&&currentBytes.equals(sourceBytes),'Insertion source does not equal the recorded/current exact bytes.');
  requireHistory(Array.isArray(declared.ranges)&&declared.ranges.length>0&&(approved.approvedClarifications??[]).length===0,'Insertion ranges missing or unsupported clarifications present.');
  const keys=Object.keys(declared.ranges[0]);
  requireHistory(isDeepStrictEqual((approved.approvedAmendments??[]).map(row=>Object.fromEntries(keys.map(key=>[key,row[key]]))),declared.ranges),'Approved insertion range inventory differs.');
  const map=createApprovedInsertionMap({baseBytes,currentBytes,proposalBytes,baseSha256:d.base.source.sha256,currentSha256:d.source.sha256,proposalSha256:d.proposal.sha256,specificationPath,ranges:declared.ranges});
  validateInsertionMapSegments(map,declared.originalToSuccessorSegments??declared.segments);
  return {checked:true,basis:'APPROVED_INSERTION_PINNED_BASE_RECONSTRUCTION'};
}
export async function verifySpecificationSourceCommit({sourceBytes,sourceCommit,specificationPath,cwd=process.cwd(),ci=process.env.GITHUB_ACTIONS==='true'}){
  if(!ci)return {checked:false};
  const shallow=cp.execFileSync('git',['rev-parse','--is-shallow-repository'],{cwd,timeout:30000,killSignal:'SIGKILL',encoding:'utf8'}).trim()==='true';
  const fetchArgs=shallow?['fetch','--no-tags','--unshallow','origin','main']:['fetch','--no-tags','origin','main'];
  const fetched=await runVerifier('git',fetchArgs,{cwd,encoding:'utf8',timeout:120000});
  requireHistory(fetched.status===0&&!fetched.error&&!fetched.signal,'Unable to fetch complete canonical main history. '+fetched.stderr);
  requireHistory(cp.spawnSync('git',['merge-base','--is-ancestor',sourceCommit,'HEAD'],{cwd,timeout:30000,killSignal:'SIGKILL',stdio:'ignore'}).status===0,'Specification source commit is not reachable from current canonical main.');
  const shown=cp.spawnSync('git',['show',`${sourceCommit}:${specificationPath}`],{cwd,timeout:30000,killSignal:'SIGKILL',encoding:null,maxBuffer:64*1024*1024});
  requireHistory(shown.status===0,'Specification is absent from the recorded source commit.');
  if(Buffer.compare(Buffer.from(shown.stdout),sourceBytes)===0)return {checked:true,basis:'EXACT_CURRENT_SPECIFICATION_BYTES'};
  const approved=JSON.parse(fs.readFileSync(path.join(cwd,'specification/requirement-evidence-bindings.json'),'utf8'));
  if(approved.atomicExtraction?.schema==='closed-loop-approved-insertion-atomic-extraction/1')return verifyInsertionSourceBase({approved,sourceBytes,committedBaseBytes:Buffer.from(shown.stdout),specificationPath,readFile:file=>readAtomicEvidenceBytes(file,cwd)});
  const clarifications=[...(approved.approvedClarifications||[]),...(approved.approvedAmendments||[])];
  let pinnedBytes=sourceBytes;
  if(clarifications.length){
    const lines=sourceBytes.toString('utf8').split('\n'),excluded=new Set();
    for(const c of clarifications){
      requireHistory(c.approval&&sha(Buffer.from(lines.slice(c.startLine-1,c.startLine-1+c.lineCount).join('\n')+'\n'))===c.textSha256,'Approved source amendment bytes differ.');
      for(let i=c.startLine-1;i<c.startLine-1+c.lineCount;i++){requireHistory(!excluded.has(i),'Approved source amendments overlap.');excluded.add(i);}
    }
    pinnedBytes=Buffer.from(lines.filter((_,i)=>!excluded.has(i)).join('\n'));
    requireHistory(clarifications.every(c=>sha(pinnedBytes)===c.baseSpecificationSha256),'Approved source amendment changes unrelated controlling text.');
  }
  requireHistory(Buffer.compare(Buffer.from(shown.stdout),pinnedBytes)===0,'Recorded source commit does not contain the exact pinned base specification bytes.');
  return {checked:true,basis:'APPROVED_PINNED_BASE_RECONSTRUCTION'};
}
