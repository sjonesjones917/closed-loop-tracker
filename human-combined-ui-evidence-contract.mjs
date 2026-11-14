// Scoped Stage01 UI report predicates. No external human/all-stage/full-clause proof.
export const HUMAN_UI_MODES=['EXACT','CORRECTION','REUSED'];
export const HUMAN_UI_IDS=['human-combined-ui.exact-pair','human-combined-ui.correction-replacement','human-combined-ui.current-raw-reuse'];
export const HUMAN_UI_RUNTIME_SOURCES=['index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','test-worker.js'];
export const HUMAN_UI_TEST_SOURCES=['test-human-combined-ui.mjs','test-human-combined-ui-seed.html','test-human-combined-ui-seed.js','human-fixture.js','operator-browser-driver.mjs','human-combined-ui-evidence-contract.mjs'];
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),positive=x=>Number.isSafeInteger(x)&&x>0;
const exact=(a,b)=>Array.isArray(a)&&a.length===b.length&&new Set(a).size===a.length&&b.every(x=>a.includes(x));
const expected={EXACT:{checkId:HUMAN_UI_IDS[0],requiredChangeReview:false,inputVersionChanged:false,answerDelta:1,confirmationDelta:2,decisionDelta:1,acceptedChangeDelta:1,proposalStatus:'ACCEPTED'},CORRECTION:{checkId:HUMAN_UI_IDS[1],requiredChangeReview:true,inputVersionChanged:true,answerDelta:1,confirmationDelta:0,decisionDelta:0,acceptedChangeDelta:0,proposalStatus:'STALE'},REUSED:{checkId:HUMAN_UI_IDS[2],requiredChangeReview:false,inputVersionChanged:false,answerDelta:0,confirmationDelta:1,decisionDelta:1,acceptedChangeDelta:1,proposalStatus:'ACCEPTED'}};
export function validHumanCombinedUiCarrier(r){
 if(r?.schema!=='human-combined-ui-report/1'||r.status!=='PASS'||r.caseCount!==3||!Array.isArray(r.cases)||!exact(r.cases.map(x=>x?.mode),HUMAN_UI_MODES)||!r.cases.every(x=>x.status==='PASS'&&x.checkId===expected[x.mode].checkId))return false;
 if(Object.hasOwn(r,'verificationObservations')||r.privateIsolatedOrigin!==true||r.originalProductionSourcesUnmodified!==true||r.realHuman!==false||r.realExternalAgent!==false||r.deployedBrowser!==false||r.wholeClausePASS!==false||r.currentGlobalReceiptPASS!==false||r.releasePASS!==false)return false;
 if(!r.sourceProvenance||!exact(Object.keys(r.sourceProvenance),HUMAN_UI_RUNTIME_SOURCES)||!HUMAN_UI_RUNTIME_SOURCES.every(name=>{const x=r.sourceProvenance[name];return positive(x?.bytes)&&hash(x.originalSha256)&&x.originalSha256===x.servedSha256&&x.currentSourceMatches===true;}))return false;
 if(!r.owningTestSources||!exact(Object.keys(r.owningTestSources),HUMAN_UI_TEST_SOURCES)||!HUMAN_UI_TEST_SOURCES.every(name=>positive(r.owningTestSources[name]?.bytes)&&hash(r.owningTestSources[name]?.sha256)))return false;
 const names=['test-human-combined-ui-seed.html','test-human-combined-ui-seed.js','human-fixture.js'];if(!r.fixtureProvenance||!exact(Object.keys(r.fixtureProvenance),names)||!names.every(name=>r.fixtureProvenance[name]?.sha256===r.owningTestSources[name].sha256&&r.fixtureProvenance[name]?.bytes===r.owningTestSources[name].bytes))return false;
 return true;
}
export function humanCombinedUiCase(report,mode){
 if(!validHumanCombinedUiCarrier(report)||!HUMAN_UI_MODES.includes(mode))return false;const row=report.cases.find(x=>x.mode===mode);
 if(!Object.entries(expected[mode]).every(([k,v])=>row[k]===v)||!['actualAppCore','actualDom','nativeIndexedDB','storageWorkerEnabled','freshDocumentPublicRead','rawByteEquality'].every(k=>row[k]===true))return false;
 return Number.isSafeInteger(row.humanValueInputEvents)&&(mode==='CORRECTION'?row.humanValueInputEvents>0:row.humanValueInputEvents===0);
}
export const completeHumanCombinedUi=report=>HUMAN_UI_MODES.every(mode=>humanCombinedUiCase(report,mode));

// Independently finite consumer obligations; report contents cannot define this population.
export const HUMAN_UI_CONSUMER_CASE_IDS=[
 'independent-three-literal-predicates','exact-owning-input-discovery','status-FAIL','status-UNKNOWN','case-missing','case-duplicate','case-wrong',
 ...['EXACT','CORRECTION','REUSED'].flatMap(mode=>['requiredChangeReview','humanValueInputEvents','inputVersionChanged','answerDelta','confirmationDelta','decisionDelta','acceptedChangeDelta','proposalStatus'].map(field=>'literal-'+mode+'-'+field)),
 ...['actualAppCore','actualDom','nativeIndexedDB','storageWorkerEnabled','freshDocumentPublicRead','rawByteEquality'].map(field=>'missing-boundary-'+field),
 ...['realHuman','realExternalAgent','deployedBrowser','wholeClausePASS','currentGlobalReceiptPASS','releasePASS'].map(field=>'false-proof-'+field),
 'malformed-legacy-emitted-observations','wrong-served-fixture','valid-independent-source-fingerprint',
 ...['index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','test-worker.js'].map(name=>'wrong-runtime-'+name),
 ...['test-human-combined-ui.mjs','test-human-combined-ui-seed.html','test-human-combined-ui-seed.js','human-fixture.js','operator-browser-driver.mjs','human-combined-ui-evidence-contract.mjs'].flatMap(name=>['missing','wrong'].map(kind=>kind+'-test-'+name)),
 'exact-new-html-path','new-html-traversal-rejected','scope-qualified-selector-LOCAL','scope-qualified-selector-DEPLOYED','missing-ui-marker','duplicate-ui-marker','actual-receipt-additive-ui-identity-branch','actual-receipt-stale-ui-seed'
];
export function completeHumanCombinedUiConsumers(r){return r?.status==='PASS'&&r.synthetic===true&&r.actualBrowser===false&&r.eligibleReceiptCreated===false&&r.caseCount===77&&Array.isArray(r.cases)&&exact(r.cases.map(row=>row?.caseId),HUMAN_UI_CONSUMER_CASE_IDS)&&r.cases.every(row=>row.result==='PASS'||row.result==='DETECTED');}
