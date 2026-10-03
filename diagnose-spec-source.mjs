import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const TARGET_SHA256='101f23168d7e7c1713d702f4c09ef7cbfd2d0f369700ac4c8de6bc044da447e6';
const TARGET_SIZE=416621;
const TITLE='Closed-Loop Reliability Application\nZero-Loss Controlling Implementation Specification';
const execGit=(args,{input=null,allowFailure=false}={})=>{
  const out=spawnSync('git',args,{input,encoding:null,maxBuffer:1024*1024*1024});
  if(out.status!==0&&!allowFailure)throw new Error(`git ${args.join(' ')} failed: ${String(out.stderr)}`);
  return out;
};
const run=(args,input)=>execGit(args,{input}).stdout;
const remoteLines=[
  ...run(['ls-remote','--heads','origin']).toString('utf8').trim().split('\n'),
  ...run(['ls-remote','origin','refs/pull/*/head']).toString('utf8').trim().split('\n')
].filter(Boolean);
const tips=[...new Set(remoteLines.map(line=>line.split(/\s+/)[0]).filter(value=>/^[0-9a-f]{40}$/.test(value)))];
for(let offset=0;offset<tips.length;offset+=40){
  const chunk=tips.slice(offset,offset+40);
  const fetched=execGit(['fetch','--force','--no-tags','--depth=1000000','origin',...chunk],{allowFailure:true});
  if(fetched.status!==0){
    for(const sha of chunk)execGit(['fetch','--force','--no-tags','--depth=1000000','origin',sha],{allowFailure:true});
  }
}
const checked=run(['cat-file','--batch-all-objects','--batch-check=%(objectname) %(objecttype) %(objectsize)']).toString('utf8').trim().split('\n');
const candidates=[];
for(const line of checked){
  const [sha,type,sizeText]=line.split(' '); const size=Number(sizeText);
  if(type!=='blob'||!Number.isFinite(size)||size<250000||size>500000)continue;
  const bytes=run(['cat-file','blob',sha]);
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const text=(()=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return '';}})();
  const hasTitle=text.includes(TITLE)||text.includes('Zero-Loss Controlling Implementation Specification');
  candidates.push({gitBlobSha:sha,size,sha256,hasTitle});
}
const exactMatches=candidates.filter(entry=>entry.sha256===TARGET_SHA256);
const titleMatches=candidates.filter(entry=>entry.hasTitle);
const targetSizeMatches=candidates.filter(entry=>entry.size===TARGET_SIZE);
const report={target:{sha256:TARGET_SHA256,size:TARGET_SIZE},remoteTipCount:tips.length,scannedObjectCount:checked.length,candidateCount:candidates.length,exactMatches,titleMatches,targetSizeMatches};
fs.mkdirSync('/tmp/spec-source-scan',{recursive:true});
fs.writeFileSync('/tmp/spec-source-scan/report.json',JSON.stringify(report,null,2)+'\n');
const compact=list=>list.map(entry=>`${entry.gitBlobSha}:${entry.size}:${entry.sha256}`).join(',')||'NONE';
throw new Error(`SPEC_SCAN exact=${compact(exactMatches)} title=${compact(titleMatches)} size=${compact(targetSizeMatches)} candidates=${candidates.length} objects=${checked.length} tips=${tips.length}`);
