import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const TARGET_SHA256='101f23168d7e7c1713d702f4c09ef7cbfd2d0f369700ac4c8de6bc044da447e6';
const TARGET_SIZE=416621;
const TITLE='Closed-Loop Reliability Application\nZero-Loss Controlling Implementation Specification';
const run=(args,input)=>{
  const out=spawnSync('git',args,{input,encoding:null,maxBuffer:1024*1024*1024});
  if(out.status!==0)throw new Error(`git ${args.join(' ')} failed: ${String(out.stderr)}`);
  return out.stdout;
};
run(['fetch','--force','--no-tags','origin','+refs/heads/*:refs/remotes/origin/*','+refs/pull/*/head:refs/remotes/pull/*']);
const objects=run(['rev-list','--objects','--all']).toString('utf8').trim().split('\n').filter(Boolean);
const unique=[...new Set(objects.map(line=>line.split(' ')[0]))];
const checkInput=Buffer.from(unique.join('\n')+'\n');
const checked=run(['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],checkInput).toString('utf8').trim().split('\n');
const candidates=[];
for(const line of checked){
  const [sha,type,sizeText]=line.split(' '); const size=Number(sizeText);
  if(type!=='blob'||!Number.isFinite(size)||size<250000||size>500000)continue;
  const bytes=run(['cat-file','blob',sha]);
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const text=(()=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return '';}})();
  const hasTitle=text.includes(TITLE)||text.includes('Zero-Loss Controlling Implementation Specification');
  const refs=objects.filter(row=>row.startsWith(sha+' ')).map(row=>row.slice(sha.length+1));
  const entry={gitBlobSha:sha,size,sha256,hasTitle,paths:refs.slice(0,50)};
  candidates.push(entry);
  if(sha256===TARGET_SHA256){
    fs.mkdirSync('/tmp/spec-source-scan',{recursive:true});
    fs.writeFileSync('/tmp/spec-source-scan/closed-loop-reliability-controlling-implementation-specification.txt',bytes);
  }
}
const exact=candidates.filter(c=>c.sha256===TARGET_SHA256);
const report={target:{sha256:TARGET_SHA256,size:TARGET_SIZE},objectCount:unique.length,candidateCount:candidates.length,exactMatches:exact,candidates};
fs.mkdirSync('/tmp/spec-source-scan',{recursive:true});
fs.writeFileSync('/tmp/spec-source-scan/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
