import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {appMarkup,observeWorkflowMarkup,assertWorkflowPresentation} from './test-app-markup.mjs';
globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const {buildUnchangedConfirmationFixture}=await import('./stage19-fixture.mjs');
const {p}=buildUnchangedConfirmationFixture('JOB-GUIDANCE-REGRESSION'),engine=globalThis.closedLoopWorkflowEngine,schema=globalThis.closedLoopWorkflowSchema,core=globalThis.closedLoopCore;
const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),pages=[],presentationCases=[];
for(const stage of core.STAGES){
 for(const operation of schema.STAGE_CONTRACTS[stage.number].operations||['COMPLETE']){
  const project=engine.clone(p);project.activeStage=stage.number;
  const rendered=appMarkup(globalThis,project,{source,instructionEvidence:true,operations:{[stage.number]:typeof operation==='string'?operation:operation.id||operation.operation}});
  presentationCases.push(assertWorkflowPresentation(observeWorkflowMarkup(rendered.html),{instruction:rendered.instruction,caseId:`selected-stage-${stage.number}-${operation}`}));
  pages.push({stage:stage.number,operation,html:rendered.html});
 }
}
for(const view of ['Overview','Files'])pages.push({view,html:appMarkup(globalThis,engine.clone(p),{source,view})});
const parser=`import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.parts=[]
 def handle_starttag(self,t,a):
  a=dict(a);hidden=t in ['details','script','style'] or a.get('id')=='generated-prompt' or 'hidden' in a
  if t not in ['input','br','hr','img','meta','link']:self.stack.append((t,hidden))
 def handle_endtag(self,t):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i][0]==t:self.stack=self.stack[:i];break
 def handle_data(self,text):
  if not any(hidden for _,hidden in self.stack):self.parts.append(text)
out=[]
for row in json.load(sys.stdin):
 p=P();p.feed(row.pop('html'));out.append(dict(row,text=' '.join(p.parts)))
print(json.dumps(out))`;
const parsed=spawnSync('python',['-c',parser],{input:JSON.stringify(pages),encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(parsed.status,0,parsed.stderr);
const observations=JSON.parse(parsed.stdout),ids=new Set(p.projectData.allocationReceipts.map(row=>row.resultingId));
const cases=observations.map(row=>({stage:row.stage??null,operation:row.operation??null,view:row.view||'Workflow',leakedIds:[...ids].filter(id=>row.text.includes(id))}));
console.log(JSON.stringify({synthetic:true,actualBrowser:false,source:process.env.APP_SOURCE||'app-core.js',expected:'Every stage and available operation keeps internal identities out of primary guidance and presents one instruction with at most one consolidated handoff control; exact bindings and diagnostic disclosures remain available',cases,presentationCases},null,2));
assert.ok(cases.every(row=>!row.leakedIds.length),'PRIMARY_GUIDANCE_ORACLE: current-stage controls and next-action guidance must not expose internal identities outside instructions or disclosures.');
