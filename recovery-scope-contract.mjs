import assert from 'node:assert/strict';
// Frozen identities of all existing recovery-prefix cases, including repeated-ID variants.
const identityFields=["caseId","class","consumer","invalid","reusedPreOperation","mode","fixtureStage","operation","persistent","failHealth","initiallyAvailable","becomesAvailable","failsAfterUpdate","stage","control","primaryButton"];
const expectedCases=[
 {"caseId":"NOOP-NAVIGATION-PRESERVES-VISIBLE-DRAFT-AND-REVIEW"},
 {"caseId":"BROWSER-BLOCKED-STARTUP-DOCUMENT-BOUNDARY"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"visible centre"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"visual viewport offset"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"scaled visual viewport uses CSS input"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"below visual viewport"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"visible at top edge"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"visible at bottom edge"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"pending focus before activation"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"partly above"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"partly below"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"partly left"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"partly right"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"inside closed disclosure"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"closed disclosure summary"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"covered by sticky header"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"sticky header reveal on later frames"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"sticky panel covers viewport center"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"display none"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"visibility hidden"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"zero area"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"obstructed control"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"disabled control"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"inert control"},
 {"caseId":"DRIVER-VIEW-PRESERVATION","class":"layout hides revealed control"},
 {"caseId":"DRIVER-CONSUMER-AUTHORITY","consumer":"verify-browser.mjs"},
 {"caseId":"DRIVER-CONSUMER-AUTHORITY","consumer":"verify-browser-extra.mjs"},
 {"caseId":"DRIVER-CONSUMER-AUTHORITY","consumer":"verify-mobile-stage-action.mjs"},
 {"caseId":"JOURNEY-READ-BOUNDARY","invalid":false,"reusedPreOperation":true},
 {"caseId":"JOURNEY-READ-BOUNDARY","invalid":false,"reusedPreOperation":false},
 {"caseId":"JOURNEY-READ-BOUNDARY","invalid":true,"reusedPreOperation":true},
 {"caseId":"JOURNEY-READ-BOUNDARY","invalid":true,"reusedPreOperation":false},
 {"caseId":"JOURNEY-CONTINUATION-READS","mode":"external-observation"},
 {"caseId":"JOURNEY-CONTINUATION-READS","mode":"external-without-observation"},
 {"caseId":"JOURNEY-CONTINUATION-READS","mode":"application-command"},
 {"caseId":"JOURNEY-CONTINUATION-READS","mode":"reload"},
 {"caseId":"UI-SHARED-ACTION-DUPLICATE","fixtureStage":1,"operation":"SAVE_INSTRUCTION"},
 {"caseId":"FINAL-BACKUP-OBSERVATION"},
 {"caseId":"RETAINED_HISTORY_LITERAL_CONTROL"},
 {"caseId":"RETAINED_HISTORY_PREFIX_GUARD_ORACLE"},
 {"caseId":"RETAINED_HISTORY_SESSION_GUARD_ORACLE"},
 {"caseId":"RETAINED_HISTORY_EXPORT_BYTES_GUARD_ORACLE"},
 {"caseId":"RETAINED_HISTORY_EXPORT_FILE_GUARD_ORACLE"},
 {"caseId":"RETAINED_HISTORY_RESTORE_BYTES_GUARD_ORACLE"},
 {"caseId":"RETAINED_HISTORY_APPEND_CONTROL"},
 {"caseId":"RETAINED_HISTORY_SOURCE_LITERAL_CONTROL"},
 {"caseId":"RETAINED_HISTORY_SOURCE_REFERENCE_GUARD_ORACLE"},
 {"caseId":"RETAINED_HISTORY_SOURCE_BYTES_GUARD_ORACLE"},
 {"caseId":"UI-COMPLETE-EXPORT-CROSS-CONTROL-DUPLICATE"},
 {"caseId":"UI-OPTIONAL-HEALTH-BROWSER-COMPLETION","persistent":false,"failHealth":false},
 {"caseId":"UI-OPTIONAL-HEALTH-BROWSER-COMPLETION","persistent":false,"failHealth":true},
 {"caseId":"UI-OPTIONAL-HEALTH-BROWSER-COMPLETION","persistent":true,"failHealth":false},
 {"caseId":"UI-OPTIONAL-HEALTH-BROWSER-COMPLETION","persistent":true,"failHealth":true},
 {"caseId":"UI-ACTION-FAILURE-RETRY"},
 {"caseId":"UI-HISTORY-CONTROL-STATE","initiallyAvailable":false,"becomesAvailable":false,"failsAfterUpdate":false},
 {"caseId":"UI-HISTORY-CONTROL-STATE","initiallyAvailable":false,"becomesAvailable":false,"failsAfterUpdate":true},
 {"caseId":"UI-HISTORY-CONTROL-STATE","initiallyAvailable":false,"becomesAvailable":true,"failsAfterUpdate":false},
 {"caseId":"UI-HISTORY-CONTROL-STATE","initiallyAvailable":false,"becomesAvailable":true,"failsAfterUpdate":true},
 {"caseId":"UI-HISTORY-CONTROL-STATE","initiallyAvailable":true,"becomesAvailable":false,"failsAfterUpdate":false},
 {"caseId":"UI-HISTORY-CONTROL-STATE","initiallyAvailable":true,"becomesAvailable":false,"failsAfterUpdate":true},
 {"caseId":"UI-HISTORY-CONTROL-STATE","initiallyAvailable":true,"becomesAvailable":true,"failsAfterUpdate":false},
 {"caseId":"UI-HISTORY-CONTROL-STATE","initiallyAvailable":true,"becomesAvailable":true,"failsAfterUpdate":true},
 {"caseId":"UI-RECOVERY-AVAILABILITY-true"},
 {"caseId":"UI-RECOVERY-AVAILABILITY-false"},
 {"caseId":"UI-WORKFLOW-PRIMARY-CONTINUE_AGENT_CONVERSATION","stage":1,"control":"next-export-prompt-file","primaryButton":"Export instruction file"},
 {"caseId":"UI-WORKFLOW-PRIMARY-CONTINUE_AGENT_CONVERSATION","stage":1,"control":"next-export-prompt-file","primaryButton":"Continue conversation"},
 {"caseId":"UI-WORKFLOW-PRIMARY-AI_REVIEW","stage":23,"control":"next-export-prompt-file","primaryButton":"Export instruction file"},
 {"caseId":"UI-WORKFLOW-PRIMARY-EXTERNAL_AGENT_TOOL","stage":21,"control":"next-export-prompt-file","primaryButton":"Export instruction file"},
 {"caseId":"UI-WORKFLOW-PRIMARY-RUN_APP_TESTS","stage":22,"control":"run-native-tests","primaryButton":"Run automatic tests"},
 {"caseId":"UI-WORKFLOW-PRIMARY-CALCULATE_CONVERGENCE","stage":18,"control":"calculate-stage18-convergence","primaryButton":"Calculate convergence"},
 {"caseId":"UI-WORKFLOW-PRIMARY-CALCULATE_UNCHANGED_CONFIRMATION","stage":19,"control":"calculate-stage19-confirmation","primaryButton":"Calculate confirmation"},
 {"caseId":"UI-WORKFLOW-PRIMARY-CALCULATE_RELEASE","stage":27,"control":"calculate-stage27-release","primaryButton":"Calculate release"},
 {"caseId":"UI-WORKFLOW-PRIMARY-BUILD_EVIDENCE_CHAINS","stage":29,"control":"build-evidence-chains","primaryButton":"Build evidence chains"},
 {"caseId":"UI-WORKFLOW-PRIMARY-FREEZE_CANDIDATE","stage":10,"control":"next-freeze-candidate","primaryButton":"Freeze candidate"},
 {"caseId":"UI-WORKFLOW-PRIMARY-FREEZE_DELIVERY_CANDIDATE","stage":25,"control":"freeze-delivery-candidate","primaryButton":"Freeze delivery candidate"},
 {"caseId":"UI-WORKFLOW-PRIMARY-RESERVE_RUN_BATCH","stage":11,"control":"next-reserve-run-batch","primaryButton":"Reserve ten runs"},
 {"caseId":"UI-WORKFLOW-PRIMARY-BEGIN_UNCHANGED_CONFIRMATION","stage":19,"control":"next-begin-unchanged-confirmation","primaryButton":"Begin unchanged confirmation"},
 {"caseId":"UI-WORKFLOW-PRIMARY-FREEZE_BASELINE","stage":20,"control":"next-freeze-baseline","primaryButton":"Freeze baseline"},
 {"caseId":"UI-WORKFLOW-PRIMARY-REGISTER_PRODUCTION_CONTEXT","stage":21,"control":"next-register-production-context","primaryButton":"Register production context"},
 {"caseId":"UI-WORKFLOW-PRIMARY-RESERVE_PRODUCT_EXECUTION","stage":21,"control":"next-reserve-product-execution","primaryButton":"Reserve product execution"},
 {"caseId":"UI-WORKFLOW-PRIMARY-HUMAN_INSPECTION","stage":22,"control":"record-human-inspection","primaryButton":"Record observation"},
 {"caseId":"UI-WORKFLOW-PRIMARY-CONFIRM_STAGE_ONE_INTENT","stage":1,"control":"confirm-stage-one","primaryButton":"Confirm captured intent"},
 {"caseId":"UI-WORKFLOW-PRIMARY-CAPTURE_DELIVERY_INTENT","stage":30,"control":"capture-delivery-intent","primaryButton":"Record delivery intent"},
 {"caseId":"UI-WORKFLOW-PRIMARY-CALCULATE_TERMINAL","stage":30,"control":"calculate-stage30-terminal","primaryButton":"Calculate terminal state"},
 {"caseId":"UI-WORKFLOW-PRIMARY-EXPORT_PRE_DELIVERY_CHECKPOINT","stage":30,"control":"export-pre-delivery-checkpoint","primaryButton":"Export recovery checkpoint"},
 {"caseId":"UI-WORKFLOW-PRIMARY-EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS","stage":30,"control":"export-authorized-artifacts","primaryButton":"Export authorized files"},
 {"caseId":"UI-WORKFLOW-PRIMARY-AI_REVIEW","stage":23,"control":"download-execution-package","primaryButton":"Download verification package"},
 {"caseId":"UI-WORKFLOW-PRIMARY-EXTERNAL_SYSTEM","stage":22,"control":"download-execution-package","primaryButton":"Download verification package"},
 {"caseId":"UI-CONDITIONAL-INDEPENDENT-REVIEW-GUIDANCE","operation":"EXECUTE_FAILURE_TEST","stage":8},
 {"caseId":"UI-DELAYED-IMPORT-BROWSER-SELECTION"},
 {"caseId":"UI-MIGRATION-FAILURE-STATUS"},
 {"caseId":"UI-HUMAN-STAGE-CONTROL-LABEL","stage":10},
 {"caseId":"UI-HUMAN-STAGE-CONTROL-LABEL","stage":20},
 {"caseId":"UI-HUMAN-STAGE-CONTROL-LABEL","stage":28},
 {"caseId":"UI-HUMAN-AUTHORITY-CONTROL-LABEL"}
];
export const recoveryFaults=[
 ['blocked-startup-navigation-readiness','BLOCKED_STARTUP_NAVIGATION_ORACLE'],
 ['obsolete-recovery-control','HISTORY_CONTROL_STATE_ORACLE'],
 ['overlapping-complete-exports','UI_EXPORT_DUPLICATE_ORACLE'],
 ['obsolete-storage-health-oracle','STORAGE_HEALTH_BROWSER_ORACLE'],
 ['incorrect-storage-persistence','STORAGE_HEALTH_BROWSER_ORACLE'],
 ['forced-operator-scroll','DRIVER_VIEW_PRESERVATION_ORACLE'],
 ['repeat-pre-ingestion-read','JOURNEY_READ_BOUNDARY_ORACLE'],
 ['stale-post-ingestion-state','Accept did not commit exactly one response'],
 ['repeat-post-ingestion-read','JOURNEY_CONTINUATION_READ_ORACLE'],
 ['detached-workflow-decision','JOURNEY_RUNTIME_AUTHORITY_ORACLE']
];
export function recoveryScopeSelected(args){
 const scope=args.filter(arg=>arg.startsWith('--recovery-scope'));
 if(!scope.length)return false;
 assert.equal(scope.length,1,'RECOVERY_SCOPE_ARGUMENT_ORACLE: duplicate scope');
 assert.equal(scope[0],'--recovery-scope=controls-v1','RECOVERY_SCOPE_ARGUMENT_ORACLE: unknown scope');
 const faults=args.filter(arg=>arg.startsWith('--fault='));
 assert.ok(faults.length<=1&&args.every(arg=>arg===scope[0]||faults.includes(arg))&&faults.every(arg=>recoveryFaults.some(([fault])=>arg==='--fault='+fault)),'RECOVERY_SCOPE_ARGUMENT_ORACLE: incompatible or unknown selector');
 return true;
}
const identity=row=>JSON.stringify(identityFields.map(key=>Object.hasOwn(row,key)?[key,row[key]]:null));
const expectedIdentities=expectedCases.map(identity).sort();
export function recoveryScopeReport(cases){return {schema:'closed-loop-recovery-control-scope/1',scope:'controls-v1',synthetic:true,actualBrowser:false,defaultLifecycleComplete:false,extendedHelperSuitesExecuted:false,targetFaults:recoveryFaults.map(([fault])=>fault),cases};}
export function assertRecoveryScopeReport(report){
 const keys=['schema','scope','synthetic','actualBrowser','defaultLifecycleComplete','extendedHelperSuitesExecuted','targetFaults','cases'];
 assert.ok(report&&typeof report==='object'&&!Array.isArray(report)&&Object.keys(report).length===keys.length&&keys.every(key=>Object.hasOwn(report,key)),'RECOVERY_SCOPE_REPORT_ORACLE: malformed report');
 assert.equal(report.schema,'closed-loop-recovery-control-scope/1','RECOVERY_SCOPE_REPORT_ORACLE: schema');
 assert.equal(report.scope,'controls-v1','RECOVERY_SCOPE_REPORT_ORACLE: scope');
 assert.ok(report.synthetic===true&&report.actualBrowser===false&&report.defaultLifecycleComplete===false&&report.extendedHelperSuitesExecuted===false,'RECOVERY_SCOPE_REPORT_ORACLE: overclaim');
 assert.deepEqual(report.targetFaults,recoveryFaults.map(([fault])=>fault),'RECOVERY_SCOPE_REPORT_ORACLE: exact ten fault targets');
 assert.ok(Array.isArray(report.cases)&&report.cases.length===95&&report.cases.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&row.result==='PASS'&&row.actualBrowser!==true),'RECOVERY_SCOPE_REPORT_ORACLE: incomplete or failed cases');
 assert.deepEqual(report.cases.map(identity).sort(),expectedIdentities,'RECOVERY_SCOPE_REPORT_ORACLE: exact 95 case variants');
 return report;
}
export function verifyRecoveryScopeContract(){
 const valid=recoveryScopeReport(expectedCases.map(row=>({...row,result:'PASS'}))),controls=[];
 const reject=(name,change)=>{const report=structuredClone(valid);change(report);assert.throws(()=>assertRecoveryScopeReport(report),error=>error.code==='ERR_ASSERTION','RECOVERY_SCOPE_NEGATIVE_ORACLE: '+name);controls.push(name);};
 assertRecoveryScopeReport(valid);assertRecoveryScopeReport({...valid,cases:[...valid.cases].reverse()});
 for(let i=0;i<95;i++){
  reject('missing-variant-'+i,r=>r.cases.splice(i,1));
  reject('duplicate-replaces-variant-'+i,r=>r.cases[i]=structuredClone(r.cases[(i+1)%95]));
  reject('failed-variant-'+i,r=>r.cases[i].result='FAIL');
 }
 for(let i=0;i<10;i++){
  reject('missing-fault-'+i,r=>r.targetFaults.splice(i,1));
  reject('duplicate-fault-'+i,r=>r.targetFaults[i]=r.targetFaults[(i+1)%10]);
 }
 for(const field of ['defaultLifecycleComplete','extendedHelperSuitesExecuted','actualBrowser'])reject('false-claim-'+field,r=>r[field]=true);
 reject('wrong-schema',r=>r.schema='closed-loop-executed-cases/1');reject('wrong-scope',r=>r.scope='unknown');reject('unknown-field',r=>r.fullSuite=true);reject('non-array-cases',r=>r.cases={});reject('unknown-case',r=>r.cases[0].caseId='UNKNOWN');
 for(const malformed of [null,[],{},'PASS'])assert.throws(()=>assertRecoveryScopeReport(malformed),{code:'ERR_ASSERTION'});
 assert.equal(recoveryScopeSelected([]),false);assert.equal(recoveryScopeSelected(['--recovery-scope=controls-v1']),true);
 for(const [fault]of recoveryFaults)assert.equal(recoveryScopeSelected(['--recovery-scope=controls-v1','--fault='+fault]),true);
 for(const args of [['--recovery-scope'],['--recovery-scope=unknown'],['--recovery-scope=controls-v1','--recovery-scope=controls-v1'],['--recovery-scope=controls-v1','--navigation-draft-only'],['--recovery-scope=controls-v1','--driver-activation-only'],['--recovery-scope=controls-v1','--fault=unknown'],['--recovery-scope=controls-v1','--fault=forced-operator-scroll','--fault=forced-operator-scroll']]){
  assert.throws(()=>recoveryScopeSelected(args),error=>error.code==='ERR_ASSERTION'&&error.message.includes('RECOVERY_SCOPE_ARGUMENT_ORACLE'));controls.push('argument:'+args.join(' '));
 }
 return {consumerOnly:true,defaultLifecycleExecuted:false,controls,passed:true};
}
