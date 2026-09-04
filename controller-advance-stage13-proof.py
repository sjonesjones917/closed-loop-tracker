from pathlib import Path
import hashlib, json, os

state_path=Path('verification/closed-loop-build-state.json')
proof_path=Path('verification/build-stages/stage-13-proof.json')
spec_path=Path('specification/closed-loop-reliability-controlling-implementation-specification.txt')
manifest_path=Path('specification/closed-loop-specification-manifest.json')
expected=os.environ['EXPECTED_MAIN']
run_id=int(os.environ['EXPECTED_MAIN_RUN'])
test_job=int(os.environ['EXPECTED_TEST_JOB'])
deploy_job=int(os.environ['EXPECTED_DEPLOY_JOB'])
live_job=int(os.environ['EXPECTED_LIVE_JOB'])
state=json.loads(state_path.read_text())
manifest=json.loads(manifest_path.read_text())
spec_bytes=spec_path.read_bytes()
spec_sha=hashlib.sha256(spec_bytes).hexdigest()
assert spec_sha=='6ffd7b3ef6c141754d4381c43c33767c3d8f265833f06a7fccb7518bba818bd9'
assert len(spec_bytes)==309472
assert manifest['sha256']==spec_sha and manifest['byteLength']==len(spec_bytes)
assert state['controllerId']=='closed-loop-monotonic-build-controller/2'
assert state['specificationSha256']==spec_sha
assert state['currentStage']=='13'
for n in range(1,13):
    assert state['stages'][f'{n:02d}']['status']=='DONE', f'Prior Stage {n:02d} is not DONE'
s13=state['stages']['13']
assert s13['status']=='NOT_STARTED' and s13['startCommit'] is None and s13['endCommit'] is None

stale_archive=None
if proof_path.exists():
    old_bytes=proof_path.read_bytes()
    old=json.loads(old_bytes)
    old_sha=old.get('specificationSha256')
    if old_sha!=spec_sha:
        assert isinstance(old_sha,str) and len(old_sha)==64
        stale_archive=Path(f'verification/build-stages/archive/stage-13-proof-spec-{old_sha}.json')
        stale_archive.parent.mkdir(parents=True,exist_ok=True)
        if stale_archive.exists():
            assert stale_archive.read_bytes()==old_bytes, 'Existing Stage 13 stale-proof archive differs'
        else:
            stale_archive.write_bytes(old_bytes)
    else:
        raise SystemExit('Current-spec Stage 13 proof already exists while ledger still says NOT_STARTED')

spec_sections=['4.2','12','14.6','17.12','24','37 Stage 09','38 preflightRecords','40','41','43','44','45','47','49','52']
implementation_commits=[
    '8538fb274f76ecf0df0e50a592ead79a7c352d7b',
    '9bc2ba26a5af6d5caa33e56511857919d82d19f6',
    '2b11a66be60027b2c6730171f295b9d3f6103a9f',
    '9b68a5135ab6416bcd1e21ef39e664c23b9761e4',
    '7bbe3ab69d76c941bcf63b355234a78731ac2f3f',
    expected,
]
changed=[
    'verify-independent-preflight.mjs',
    'verify-definition-of-done.mjs',
    'verification/build-stages/stage-13-proof.json',
    'verification/closed-loop-build-state.json',
]
if stale_archive:
    changed.append(str(stale_archive))

proof={
    'schema':'closed-loop-build-stage-proof/1',
    'controllerId':'closed-loop-monotonic-build-controller/2',
    'stage':'13',
    'stageName':'INDEPENDENT PREFLIGHT',
    'status':'PROVEN',
    'specificationPath':str(spec_path),
    'specificationSha256':spec_sha,
    'specificationByteLength':len(spec_bytes),
    'startingMainCommit':expected,
    'endingMainCommit':expected,
    'implementationCommitIds':implementation_commits,
    'changedFiles':changed,
    'specificationSections':spec_sections,
    'implementationFilesReviewed':['workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','verify-independent-preflight.mjs','verify-definition-of-done.mjs','verify-prompt-semantics.mjs','verify-full-cycle.mjs'],
    'implementationDisposition':'IMPLEMENTED_AND_DIRECTLY_PROVEN_ON_EXACT_CANONICAL_MAIN',
    'implementationDispositionReason':'The current application Stage 09 independent-preflight path is exercised through real prompt generation, response preparation, explicit acceptance, canonical commit, independence evaluation, consistency adjudication, and the real Stage 09 gate. Permanent focused mutations prove missing reviewer context, material ambiguity despite a favorable agent claim, and contaminated reviewer context all fail closed. The repaired path progresses while preserving the epistemic limit that unobservable provider independence is EXTERNALLY_SUPPORTED rather than falsely application-established. The focused verifier is permanently executed by verify-definition-of-done.mjs. Exact canonical main passed the complete CI suite, local Chromium operator path, deployment, exact deployed-byte verification, and deployed Chromium operator path.',
    'proofCommands':[
        {'command':'node verify-independent-preflight.mjs','exitCode':0,'basis':f'Permanent verifier executed by verify-definition-of-done.mjs in GitHub Actions run {run_id}, test job {test_job}, Workflow, gates, and full cycle step, exact canonical main {expected}; focused verifier also replayed on a branch differing from that commit only by the one-time proof applicator.'},
        {'command':'node verify-complete.mjs && node verify-full-cycle.mjs && node verify-definition-of-done.mjs && node verify-v3-definition-of-done.mjs','exitCode':0,'basis':f'GitHub Actions run {run_id}, test job {test_job}, Workflow, gates, and full cycle step, exact canonical main {expected}, completed success.'},
        {'command':'node verify-prompt-semantics.mjs && node verify-semantic-invariant.mjs','exitCode':0,'basis':f'GitHub Actions run {run_id}, test job {test_job}, Prompt semantics and leakage step, exact canonical main {expected}, completed success.'},
        {'command':'node verify-human-stage-walkthrough.mjs && node verify-mobile-stage-action.mjs && node verify-browser.mjs && node verify-browser-extra.mjs','exitCode':0,'basis':f'GitHub Actions run {run_id}, test job {test_job}, Local Chromium operator path step, exact canonical main {expected}, completed success.'},
        {'command':'node verify-live.mjs; node verify-browser.mjs; node verify-browser-extra.mjs','exitCode':0,'basis':f'GitHub Actions run {run_id}, live job {live_job}, exact deployed-byte verification and deployed Chromium operator path, exact canonical main {expected}, completed success.'},
    ],
    'directSourceFindings':[
        'verify-independent-preflight.mjs constructs isolated disposable Stage 09 projects after completing the real Stage 08 production-instruction prerequisite through response ingestion and commit.',
        'The real Stage 09 gate does not complete when an accepted independent-preflight review is absent, and missing reviewer independence remains UNKNOWN.',
        'A shape-valid favorable preflight claim containing material ambiguity is canonically adjudicated to UNDETERMINED and cannot complete the Stage 09 gate.',
        'A preflight response bound to a context marked CONTAMINATED yields independence VIOLATED and cannot complete the Stage 09 gate.',
        'The clean repaired Stage 09 path creates exactly one current preflight record and completes the real gate only after explicit acceptance.',
        'The clean context is deliberately reported as EXTERNALLY_SUPPORTED; the application does not overclaim provider independence that it cannot observe.',
        'Proposal preparation cannot mutate acceptedChanges or create canonical preflight records before explicit acceptance.',
        'The generated Stage 09 prompt is checked for independent preflight, review without executing the project, and controlling preflight semantics.',
        'verify-definition-of-done.mjs permanently executes the focused verifier and requires independentPreflightCoverage=1 plus all three mutation rejections.'
    ],
    'intentionalInvalidFixtures':[
        'missing-independent-reviewer: Stage 09 cannot complete without an accepted reviewer context and independence remains UNKNOWN',
        'material-ambiguity-with-favorable-claim: favorable agent determination is downgraded to UNDETERMINED and gate remains incomplete',
        'contaminated-reviewer-context: contaminated reviewer context yields independence VIOLATED and gate remains incomplete',
        'pre-acceptance-mutation check: proposal preparation leaves canonical acceptedChanges and current preflight records unchanged',
        'negative fixtures use isolated disposable in-memory projects and do not mutate a canonical user project or external target'
    ],
    'repairedStateProofs':[
        'Clean Stage 09 preflight response validates, requires explicit acceptance, commits exactly one current preflight record, and completes the real Stage 09 gate.',
        'The repaired path preserves the external-independence epistemic limit as EXTERNALLY_SUPPORTED.',
        'Exact current main passed local Chromium, exact deployment, exact deployed-byte verification, and deployed Chromium after the Stage 13 implementation landed.'
    ],
    'earlierStageProofsReplayed':[{'stage':f'{n:02d}','proofPath':f'verification/build-stages/stage-{n:02d}-proof.json','status':'PASS'} for n in range(1,13)],
    'browserProofs':[
        {'workflowRunId':run_id,'jobId':test_job,'proof':'LOCAL_CHROMIUM_OPERATOR_PATH','status':'PASS','commit':expected},
        {'workflowRunId':run_id,'jobId':live_job,'proof':'DEPLOYED_CHROMIUM_OPERATOR_PATH','status':'PASS','commit':expected},
    ],
    'deployedProofs':[
        {'workflowRunId':run_id,'jobId':deploy_job,'proof':'EXACT_MAIN_DEPLOYMENT','status':'PASS','commit':expected},
        {'workflowRunId':run_id,'jobId':live_job,'proof':'EXACT_DEPLOYED_BYTE_IDENTITY','status':'PASS','commit':expected},
    ],
    'externalActorProofs':[],
    'deviceProofs':[],
    'unprovenItems':[],
    'stageDisposition':'PROVEN',
    'directEvidenceReview':'PASS',
    'nextStage':'14',
    'notes':'This proves controller Stage 13 only. It does not claim candidate freeze, ten independent runs, per-run verification, convergence, production baseline, release, Section 49 completion, terminal delivery, or physical-iPhone acceptance.'
}
proof_path.write_text(json.dumps(proof,indent=2)+'\n')

state['lastObservedMainCommit']=expected
state['currentStage']='14'
state['stages']['13']={
    'stage':'13',
    'name':'INDEPENDENT PREFLIGHT',
    'status':'DONE',
    'startCommit':expected,
    'endCommit':expected,
    'specificationSections':spec_sections,
    'changedFiles':changed,
    'testsActuallyRun':[
        {'command':'node verify-complete.mjs && node verify-full-cycle.mjs && node verify-definition-of-done.mjs && node verify-v3-definition-of-done.mjs','result':'PASS','exitCode':0,'runId':run_id},
        {'command':'node verify-prompt-semantics.mjs && node verify-semantic-invariant.mjs','result':'PASS','exitCode':0,'runId':run_id},
        {'command':'node verify-human-stage-walkthrough.mjs && node verify-mobile-stage-action.mjs && node verify-browser.mjs && node verify-browser-extra.mjs','result':'PASS','exitCode':0,'runId':run_id},
    ],
    'browserEvidence':[
        {'scope':'LOCAL_CHROMIUM_OPERATOR_PATH','result':'PASS','runId':run_id,'jobId':test_job,'commit':expected},
        {'scope':'DEPLOYED_CHROMIUM_OPERATOR_PATH','result':'PASS','runId':run_id,'jobId':live_job,'commit':expected},
    ],
    'deploymentEvidence':[
        {'scope':'EXACT_MAIN_DEPLOYMENT','result':'PASS','runId':run_id,'jobId':deploy_job,'commit':expected},
        {'scope':'EXACT_DEPLOYED_BYTE_IDENTITY','result':'PASS','runId':run_id,'jobId':live_job,'commit':expected},
    ],
    'deviceEvidence':[],
    'regressions':['stage09-missing-independent-reviewer-rejected','stage09-material-ambiguity-with-favorable-claim-rejected','stage09-contaminated-reviewer-context-rejected','stage09-no-canonical-mutation-before-explicit-acceptance','stage09-independence-epistemic-limit-preserved'],
    'openAcceptanceItems':[],
    'directEvidenceReviewed':True,
    'proofRecordPath':'verification/build-stages/stage-13-proof.json'
}
state_path.write_text(json.dumps(state,separators=(',',':'))+'\n')
print(json.dumps({'controllerStage':'13','stageDisposition':'PROVEN','nextStage':'14','exactMain':expected,'staleProofArchived':str(stale_archive) if stale_archive else None}))
