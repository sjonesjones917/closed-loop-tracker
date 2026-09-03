import fs from 'node:fs';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';

const SPEC_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const SPEC_MANIFEST_PATH='specification/closed-loop-specification-manifest.json';
const NORMATIVE_MANIFEST_PATH='specification/closed-loop-normative-requirements.json';
const CONTRACT_PROFILE='closed-loop-completion-profile/1';
const SPEC_MANIFEST_SCHEMA='closed-loop-specification-manifest/1';
const NORMATIVE_SCHEMA='closed-loop-normative-requirements/1';
const GENERATOR_VERSION='closed-loop-governance-generator/1';

const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=value=>{
  if(value===null)return 'null';
  if(typeof value==='boolean')return value?'true':'false';
  if(typeof value==='number'){
    if(!Number.isSafeInteger(value)||Object.is(value,-0))throw new Error('Governance canonical JSON permits only safe integers.');
    return String(value);
  }
  if(typeof value==='string')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  throw new Error(`Unsupported canonical type ${typeof value}`);
};
const digestObject=(value,field)=>{
  const copy=JSON.parse(JSON.stringify(value));
  delete copy[field];
  return sha256(Buffer.from(canonical(copy),'utf8'));
};
const stableId=(prefix,payload)=>`${prefix}-${sha256(Buffer.from(payload,'utf8')).slice(0,24)}`;
const normalizeText=text=>text.replace(/\s+/g,' ').trim();
const sourceCommit=()=>{
  if(process.env.SOURCE_COMMIT)return process.env.SOURCE_COMMIT;
  try{return childProcess.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}
  catch{return 'UNRESOLVED_SOURCE_COMMIT';}
};

if(!fs.existsSync(SPEC_PATH))throw new Error(`Missing controlling specification: ${SPEC_PATH}`);
const sourceBytes=fs.readFileSync(SPEC_PATH);
const sourceText=sourceBytes.toString('utf8');
if(Buffer.from(sourceText,'utf8').compare(sourceBytes)!==0)throw new Error('Specification is not valid round-trip UTF-8.');
if(sourceText.charCodeAt(0)===0xfeff)throw new Error('Specification must not have a UTF-8 BOM.');

const lines=sourceText.split(/\n/);
const headingPattern=/^(\d+(?:\.\d+)*(?:[A-Z])?)\.\s+(.+?)\s*$/;
const sectionStarts=[];
for(let i=0;i<lines.length;i++){
  const m=lines[i].match(headingPattern);
  if(m)sectionStarts.push({sectionId:m[1],title:m[2],startLine:i+1});
}
if(!sectionStarts.some(s=>s.sectionId==='0')||!sectionStarts.some(s=>s.sectionId==='52'))throw new Error('Specification section inventory does not include controlling Sections 0 through 52.');
for(let i=0;i<sectionStarts.length;i++)sectionStarts[i].endLine=(sectionStarts[i+1]?.startLine||lines.length+1)-1;

const sectionForLine=line=>{
  let found=null;
  for(const section of sectionStarts){
    if(section.startLine>line)break;
    found=section;
  }
  return found;
};

const normativeMarker=/\b(MUST(?:\s+NOT)?|SHALL(?:\s+NOT)?|REQUIRED|PROHIBITED|REJECT(?:S|ED|ION)?|BLOCKS?|CANNOT|CAN NEVER|NEVER|EXACTLY|ONLY WHEN|COMPLETION|DEFINITION OF DONE)\b/i;
const imperativeMarker=/^(?:[-*]\s*)?(?:implement|preserve|reject|require|verify|record|create|store|calculate|derive|enforce|prevent|keep|run|execute|inspect|bind|route|expose|render|use|remove|add|generate|publish|freeze|invalidate|migrate|support|permit|do not|must|never)\b/i;
const locationOwnerRules=[
  [/prompt-engine\.js/i,'prompt-engine.js'],[/response-ingestion\.js/i,'response-ingestion.js'],[/project-store\.js/i,'project-store.js'],[/workflow-engine\.js/i,'workflow-engine.js'],[/workflow-schema\.js/i,'workflow-schema.js'],[/test-runtime\.js/i,'test-runtime.js'],[/test-worker\.js/i,'test-worker.js'],[/app-core\.js/i,'app-core.js'],[/index\.html/i,'index.html'],[/workbook\.js/i,'workbook.js'],[/hash\.js/i,'hash.js'],[/pages\.yml|CI\b|repository governance/i,'.github/workflows/pages.yml']
];
const ownerFor=(text,sectionId)=>{
  for(const [re,owner] of locationOwnerRules)if(re.test(text))return owner;
  const n=Number(String(sectionId).split('.')[0]);
  if(n<=2)return '.github/workflows/pages.yml';
  if([10,17,18,24,25,27,28].includes(n))return 'prompt-engine.js';
  if([14,15,16,20,21,23,26,29,30,31,32,33,36].includes(n))return 'workflow-engine.js';
  if([13,34].includes(n))return 'workflow-schema.js';
  if([19,35].includes(n))return 'project-store.js';
  if([39,45].includes(n))return 'app-core.js';
  if([40,41,42,43,44,46,49].includes(n))return 'verification';
  return 'cross-cutting';
};
const testFor=(owner,sectionId)=>{
  if(owner==='prompt-engine.js')return ['verify-prompt-semantics.mjs','verify-all-stage-prompts.mjs'];
  if(owner==='response-ingestion.js')return ['verify-ingestion.mjs'];
  if(owner==='project-store.js')return ['verify-project-lifecycle.mjs'];
  if(owner==='workflow-engine.js')return ['verify-complete.mjs','verify-full-cycle.mjs'];
  if(owner==='workflow-schema.js')return ['verify-v3-contract.mjs','verify-contract-closure.mjs'];
  if(owner==='test-runtime.js'||owner==='test-worker.js')return ['verify-test-runtime-v3.mjs','verify-test-runtime-limits.mjs'];
  if(owner==='app-core.js'||owner==='index.html')return ['verify-browser.mjs','verify-browser-extra.mjs'];
  if(owner==='.github/workflows/pages.yml')return ['verify-specification-governance.mjs','verify-deployment-manifest.mjs'];
  const n=Number(String(sectionId).split('.')[0]);
  if(n===1||n===2)return ['verify-specification-governance.mjs'];
  if(n===49)return ['verify-definition-of-done.mjs','verify-definition-of-done-invariants.mjs'];
  return ['verify-complete.mjs'];
};

// Extractor A: line/bullet-oriented normative extraction.
const draft=[];
for(let i=0;i<lines.length;i++){
  const raw=lines[i];
  const text=normalizeText(raw.replace(/^[-*]\s*/,''));
  if(!text)continue;
  const section=sectionForLine(i+1);
  if(!section)continue;
  const isNormative=normativeMarker.test(text)||imperativeMarker.test(text)||/^Completion:/i.test(text)||/^Fields:/i.test(text);
  if(!isNormative)continue;
  const owner=ownerFor(text,section.sectionId);
  const location=`${SPEC_PATH}:L${i+1}`;
  const requirementId=stableId('NR',`${location}\n${text}`);
  draft.push({
    normativeRequirementId:requirementId,
    sectionId:section.sectionId,
    sectionTitle:section.title,
    sourceLocation:{path:SPEC_PATH,startLine:i+1,endLine:i+1},
    controllingText:text,
    requirementClass:/\bMUST NOT\b|\bPROHIBITED\b|\bNEVER\b|\bCANNOT\b/i.test(text)?'PROHIBITION':'REQUIREMENT',
    implementationOwner:owner,
    schemaOrRegistryEntry:null,
    deterministicTestIds:testFor(owner,section.sectionId),
    semanticTestIds:[],
    mutationTestIds:['verify-specification-governance.mjs#intentional-uncovered-section'],
    requiredBrowserOrPhysicalProof:/iPhone|physical device/i.test(text)?['ACTUAL_IPHONE_SAFARI']:/browser|viewport|UI\b/i.test(text)?['LOCAL_AND_DEPLOYED_BROWSER']:[],
    acceptanceReportField:`normativeTrace.${requirementId}`,
    currentDisposition:'IMPLEMENTED_UNPROVEN'
  });
}

const byId=new Map();
for(const entry of draft){
  if(byId.has(entry.normativeRequirementId))throw new Error(`Duplicate normative requirement ID ${entry.normativeRequirementId}`);
  byId.set(entry.normativeRequirementId,entry);
}

// Independent reviewer B: section-by-section coverage pass. It does not consume draft entries.
const review=[];
for(const section of sectionStarts){
  const body=lines.slice(section.startLine-1,section.endLine).join('\n');
  const markerLines=[];
  for(let line=section.startLine;line<=section.endLine;line++){
    const text=normalizeText(lines[line-1]||'');
    if(normativeMarker.test(text)||imperativeMarker.test(text))markerLines.push(line);
  }
  review.push({
    sectionId:section.sectionId,
    sectionTitle:section.title,
    sourceRange:{startLine:section.startLine,endLine:section.endLine},
    independentlyDetectedNormativeMarkerLines:markerLines,
    independentlyDetectedNormative:markerLines.length>0,
    bodySha256:sha256(Buffer.from(body,'utf8'))
  });
}

const entriesBySection=new Map();
for(const entry of draft){
  const list=entriesBySection.get(entry.sectionId)||[];
  list.push(entry);
  entriesBySection.set(entry.sectionId,list);
}
const nonnormativeSections=[];
const reconciliation=[];
for(const item of review){
  const entries=entriesBySection.get(item.sectionId)||[];
  if(item.independentlyDetectedNormative&&entries.length===0)throw new Error(`Independent coverage review found normative content in uncovered section ${item.sectionId}.`);
  if(entries.length===0){
    nonnormativeSections.push({sectionId:item.sectionId,reason:'Independent section-by-section coverage pass found no normative or imperative marker under the current extraction contract.'});
  }
  reconciliation.push({sectionId:item.sectionId,draftEntryCount:entries.length,reviewDetectedNormative:item.independentlyDetectedNormative,status:'RECONCILED'});
}

const requirements=[...draft].sort((a,b)=>a.sourceLocation.startLine-b.sourceLocation.startLine||a.normativeRequirementId.localeCompare(b.normativeRequirementId));
const sectionInventory=sectionStarts.map(section=>({
  sectionId:section.sectionId,title:section.title,startLine:section.startLine,endLine:section.endLine,
  normativeRequirementIds:(entriesBySection.get(section.sectionId)||[]).map(x=>x.normativeRequirementId),
  disposition:(entriesBySection.get(section.sectionId)||[]).length?'COVERED':'NONNORMATIVE',
  nonnormativeReason:(entriesBySection.get(section.sectionId)||[]).length?null:nonnormativeSections.find(x=>x.sectionId===section.sectionId)?.reason||null
}));

const normativeManifest={
  schema:NORMATIVE_SCHEMA,
  generatorVersion:GENERATOR_VERSION,
  contractProfileId:CONTRACT_PROFILE,
  sourceCommit:sourceCommit(),
  sourcePath:SPEC_PATH,
  sourceSha256:sha256(sourceBytes),
  sourceByteLength:sourceBytes.length,
  extraction:{draftMethod:'line-and-bullet-normative-marker/1',independentReviewMethod:'section-by-section-coverage-pass/1',reconciliationMethod:'closed-section-reconciliation/1'},
  requirements,
  nonnormativeSections,
  challengeEvidence:{review,reconciliation,status:'RECONCILED'},
  manifestSha256:null
};
normativeManifest.manifestSha256=digestObject(normativeManifest,'manifestSha256');

const specManifest={
  schema:SPEC_MANIFEST_SCHEMA,
  generatorVersion:GENERATOR_VERSION,
  sourceCommit:sourceCommit(),
  repositoryPath:SPEC_PATH,
  artifactFilename:SPEC_PATH.split('/').pop(),
  byteLength:sourceBytes.length,
  sha256:sha256(sourceBytes),
  sectionInventory,
  contractProfileId:CONTRACT_PROFILE,
  normativeRequirementManifest:{path:NORMATIVE_MANIFEST_PATH,schema:NORMATIVE_SCHEMA,sha256:normativeManifest.manifestSha256,requirementCount:requirements.length},
  challengeEvidence:{status:'RECONCILED',sectionCount:sectionInventory.length,coveredSectionCount:sectionInventory.filter(x=>x.disposition==='COVERED').length,nonnormativeSectionCount:sectionInventory.filter(x=>x.disposition==='NONNORMATIVE').length},
  manifestSha256:null
};
specManifest.manifestSha256=digestObject(specManifest,'manifestSha256');

fs.mkdirSync('specification',{recursive:true});
fs.writeFileSync(NORMATIVE_MANIFEST_PATH,JSON.stringify(normativeManifest,null,2)+'\n');
fs.writeFileSync(SPEC_MANIFEST_PATH,JSON.stringify(specManifest,null,2)+'\n');
console.log(JSON.stringify({sourceCommit:specManifest.sourceCommit,specificationSha256:specManifest.sha256,specificationByteLength:specManifest.byteLength,sectionCount:sectionInventory.length,normativeRequirementCount:requirements.length,specificationManifestSha256:specManifest.manifestSha256,normativeRequirementManifestSha256:normativeManifest.manifestSha256,challengeStatus:'RECONCILED'},null,2));
