import json
from pathlib import Path

path=Path('verification/closed-loop-build-state.json')
state=json.loads(path.read_text())
state['lastObservedMainCommit']='d59d3159210ecbad7f929d1ed11a5400bf5443d6'
state['currentStage']='18'
state['stages']['17']={
  'stage':'17',
  'name':'REQUIREMENT RESOLUTION',
  'status':'DONE',
  'startCommit':'394844ffab2ff9ebd8c5788577bb1c5233baeff4',
  'endCommit':'d59d3159210ecbad7f929d1ed11a5400bf5443d6',
  'specificationSections':['14.5','14.6','26.5','29.10','29.12','29.13','29.15','37 Stage 05','38 requirementResolutions/applicabilityRecords/semanticReviews','40','41','44','49'],
  'changedFiles':['workflow-engine.js','app-core.js','prompt-engine.js','response-ingestion.js','verify-semantic-operation-boundaries.mjs','verify-full-cycle.mjs','verify-production-instruction.mjs','verify-independent-preflight.mjs','verification/build-stages/stage-17-proof.json','verification/build-stages/archive/stage-17-proof-spec-3336446403ea39391e05f0b0b4d2f2189817cf48962e05df1950df552f2f8564.json','verification/closed-loop-build-state.json'],
  'testsActuallyRun':[
    {'command':'node verify-semantic-operation-boundaries.mjs','result':'PASS','exitCode':0,'runId':33897661135,'evidence':'PR 1105 final required-check run; focused Stage 17 invalid/repaired semantic-review fixtures passed.'},
    {'command':'node verify-complete.mjs && node verify-full-cycle.mjs && node verify-definition-of-done.mjs && node verify-v3-definition-of-done.mjs','result':'PASS','exitCode':0,'runId':33898082950,'jobId':101105399465,'commit':'d59d3159210ecbad7f929d1ed11a5400bf5443d6','evidence':'Exact canonical main Workflow, gates, and full cycle step completed success.'}
  ],
  'browserEvidence':[
    {'scope':'LOCAL_CHROMIUM_OPERATOR_PATH','result':'PASS','runId':33898082950,'jobId':101105399465,'commit':'d59d3159210ecbad7f929d1ed11a5400bf5443d6'},
    {'scope':'DEPLOYED_CHROMIUM_OPERATOR_PATH','result':'PASS','runId':33898082950,'jobId':101106643234,'commit':'d59d3159210ecbad7f929d1ed11a5400bf5443d6'}
  ],
  'deploymentEvidence':[
    {'scope':'EXACT_MAIN_DEPLOYMENT','result':'PASS','runId':33898082950,'jobId':101106467046,'commit':'d59d3159210ecbad7f929d1ed11a5400bf5443d6'},
    {'scope':'EXACT_DEPLOYED_BYTE_IDENTITY','result':'PASS','runId':33898082950,'jobId':101106643234,'commit':'d59d3159210ecbad7f929d1ed11a5400bf5443d6'}
  ],
  'deviceEvidence':[],
  'regressions':['stage05-missing-independent-applicability-review-rejected','stage05-self-review-rejected','stage05-same-context-review-rejected','stage05-unreconciled-disagreement-rejected','stage05-missing-activation-proof-rejected','stage05-unsupported-normative-reduction-blocked','stage05-circular-dependency-rejected'],
  'openAcceptanceItems':[],
  'directEvidenceReviewed':True,
  'proofRecordPath':'verification/build-stages/stage-17-proof.json'
}
path.write_text(json.dumps(state,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'stage17LedgerBound':True,'currentStage':state['currentStage'],'lastObservedMainCommit':state['lastObservedMainCommit']}))
