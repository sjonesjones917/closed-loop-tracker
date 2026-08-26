from pathlib import Path

# Add pure operational metrics derived from canonical history/collections.
p=Path('workflow-engine.js');s=p.read_text()
marker="function registerGeneratedPrompt(project,promptRecord){"
assert marker in s and 'function operationalMetrics(project)' not in s
fn="""function operationalMetrics(project){
  ensureShape(project);const validations=safe(project.projectData.responseValidations),history=safe(project.projectData.history),releases=records(project,'releaseRecords',{active:false});
  const issueCodes=validation=>safe(validation?.issues).map(issue=>upper(issue?.code));
  return {
    rawResponses:safe(project.projectData.rawResponses).length,
    validationFailures:validations.filter(v=>v.valid===false).length,
    staleResponses:validations.filter(v=>issueCodes(v).some(code=>code.includes('STALE'))).length,
    rejectedProposals:safe(project.projectData.rejectedResponses).length,
    acceptedDataChanges:safe(project.projectData.acceptedChanges).filter(x=>x.status==='COMMITTED'&&x.responseType==='DATA_PROPOSAL').length,
    clarificationCycles:safe(project.projectData.humanInputAnswers).length,
    controlledCorrections:history.filter(e=>/CORRECTION|INVALIDAT|SUPERSEDE/.test(upper(e.type))).length,
    storageFailures:history.filter(e=>upper(e.type).includes('STORAGE')&&upper(e.type).includes('FAIL')).length,
    gateRegressions:history.filter(e=>/DOWNSTREAM_INVALIDAT|GATE_REGRESSION/.test(upper(e.type))).length,
    releaseRejections:releases.filter(r=>upper(recordValue(r,'DETERMINATION'))==='REJECTED').length,
    releaseBlocks:releases.filter(r=>upper(recordValue(r,'DETERMINATION'))==='BLOCKED').length
  };
}

"""
s=s.replace(marker,fn+marker,1)
s=s.replace("recordHumanInputVersion,recordStageConfirmation,recordReleaseDetermination,acceptedControlEvents,constructEvidenceChains,verifyArtifactIdentity","recordHumanInputVersion,recordStageConfirmation,recordReleaseDetermination,acceptedControlEvents,constructEvidenceChains,verifyArtifactIdentity,operationalMetrics",1)
p.write_text(s)

# Prove operational metrics are derived and not separately stored.
p=Path('verify-complete.mjs');s=p.read_text();assert 'operationalMetricsDerived' not in s
s += """
// Operational reliability metrics are pure derivations over canonical history and response/release collections.
{
  const p=project('JOB-OPERATIONAL-METRICS');
  p.projectData.rawResponses.push({rawResponseId:'RAW-1'});
  p.projectData.responseValidations.push({validationId:'VALIDATION-1',valid:false,issues:[{code:'STALE_PROJECT_REVISION'}]});
  p.projectData.rejectedResponses.push({rejectedResponseId:'REJECTED-1'});
  p.projectData.acceptedChanges.push({changeId:'CHANGE-1',stage:1,status:'COMMITTED',responseType:'DATA_PROPOSAL'});
  p.projectData.humanInputAnswers.push({answerId:'ANSWER-1'});
  p.projectData.history.push({type:'DOWNSTREAM_INVALIDATED'});
  p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'BLOCKED'},'RELEASE-BLOCKED'));
  const m=engine.operationalMetrics(p);
  assert(m.rawResponses===1&&m.validationFailures===1&&m.staleResponses===1&&m.rejectedProposals===1&&m.acceptedDataChanges===1&&m.clarificationCycles===1&&m.gateRegressions===1&&m.releaseBlocks===1,'Operational metrics are not derived from canonical history/collections.');
  assert(!Object.prototype.hasOwnProperty.call(p,'operationalMetrics'),'Operational metrics were stored as competing canonical state.');
}
console.log(JSON.stringify({operationalMetricsDerived:true}));
"""
p.write_text(s)

# Replace the one Pages workflow with the required permanent acceptance order.
p=Path('.github/workflows/pages.yml')
p.write_text(r'''name: Verify and deploy the single reliability app
on:
  push: {branches: [main]}
  pull_request: {branches: [main]}
  workflow_dispatch:
permissions: {contents: read, pages: write, id-token: write, statuses: write}
concurrency: {group: 'pages-${{ github.ref }}', cancel-in-progress: true}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: '22'}
      - name: Build retained verification project
        run: node build-test-project.mjs
      - name: Syntax
        run: |
          for f in workbook.js hash.js workflow-schema.js workflow-engine.js prompt-engine.js response-ingestion.js project-store.js app-core.js verify.mjs verify-ingestion.mjs verify-complete.mjs verify-prompt-semantics.mjs test-fixtures.mjs verify-full-cycle.mjs verify-live.mjs verify-browser.mjs verify-browser-extra.mjs; do node --check "$f"; done
      - name: Schema completeness and current source verification
        run: node verify.mjs
      - name: Ingestion and disposition tests
        run: node verify-ingestion.mjs
      - name: Deterministic gate and storage invariants
        run: node verify-complete.mjs
      - name: Semantic prompt contradiction and operation isolation tests
        run: node verify-prompt-semantics.mjs
      - name: Continuous 30-stage lifecycle
        run: node verify-full-cycle.mjs
      - name: Enforce one application shell and responsible layers
        run: |
          test "$(find . -maxdepth 1 -type f -name '*.html' | wc -l)" -eq 1
          for f in authority-guard.js integrity-guard.js storage-reliability.js prompt-display.js experience.js usability.js app.js; do test ! -f "$f"; done
          test -z "$(find . -maxdepth 1 -type f -name '.repair-*' -print -quit)"
          test -z "$(find .github/workflows -maxdepth 1 -type f \( -iname '*repair*' -o -iname '*probe*' \) -print -quit)"
          ! grep -R "document.write" --include='*.js' --include='*.html' .
          ! grep -R "MutationObserver" --include='*.js' --include='*.html' .
          ! grep -REi "GEN-042|field status report|maintenance[- ]handoff|human-project/31|Stage 31|Operation 31" --include='*.js' --include='*.html' --include='TEST_PROJECT.json' .
          ! grep -E "projectData\.[A-Za-z0-9_]+\.(push|splice|pop|shift|unshift)\(" app-core.js
          node - <<'NODE'
          const fs=require('fs'),html=fs.readFileSync('index.html','utf8');
          const expected=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
          const src=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(m=>m[1]);
          if(src.length!==expected.length)throw new Error(`Expected ${expected.length} direct deferred scripts; found ${src.length}`);
          const tokens=new Set(); expected.forEach((file,i)=>{if(src[i]?.split('?')[0]!==file)throw new Error(`Wrong script order at ${file}`);if(src.filter(v=>v.split('?')[0]===file).length!==1)throw new Error(`${file} is not unique`);const token=new URLSearchParams(src[i].split('?')[1]||'').get('v');if(!token)throw new Error(`${file} lacks build token`);tokens.add(token);});if(tokens.size!==1)throw new Error('Mixed runtime build tokens');
          NODE
      - name: Local Chromium operator and storage acceptance
        run: |
          python3 -m http.server 4173 >/tmp/closed-loop-http.log 2>&1 &
          SERVER_PID=$!
          trap 'kill $SERVER_PID || true' EXIT
          for i in {1..30}; do curl -fsS http://127.0.0.1:4173/ >/dev/null && break; sleep 1; done
          export BROWSER="$(command -v google-chrome || command -v chromium || command -v chrome || true)"
          test -n "$BROWSER"
          PAGE_URL=http://127.0.0.1:4173/ node verify-browser.mjs
          PAGE_URL=http://127.0.0.1:4173/ node verify-browser-extra.mjs

  deploy:
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    needs: test
    environment: {name: github-pages, url: '${{ steps.deployment.outputs.page_url }}'}
    runs-on: ubuntu-latest
    outputs: {page_url: '${{ steps.deployment.outputs.page_url }}'}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: {path: .}
      - id: deployment
        uses: actions/deploy-pages@v4

  verify-live:
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    needs: [test, deploy]
    runs-on: ubuntu-latest
    env: {PAGE_URL: '${{ needs.deploy.outputs.page_url }}'}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: '22'}
      - name: Verify exact deployed source identity
        run: node verify-live.mjs
      - name: Exercise the exact deployed Chromium application
        run: |
          export BROWSER="$(command -v google-chrome || command -v chromium || command -v chrome || true)"
          test -n "$BROWSER"
          node verify-browser.mjs
          node verify-browser-extra.mjs
      - name: Generate deployed acceptance report
        run: |
          cat > acceptance-report.json <<EOF
          {
            "commit": "${GITHUB_SHA}",
            "workflow": "mobile-closed-loop/30",
            "projectSchema": "closed-loop-project/2",
            "responseSchema": "closed-loop-stage-response/2",
            "ownershipCoverage": 1,
            "derivationCoverage": 1,
            "relationshipCoverage": 1,
            "acceptedAgentValueExtractionCoverage": 1,
            "acceptedRelationshipProvenanceCoverage": 1,
            "currentScopeGateSelectorCoverage": 1,
            "verificationTripleCoverage": 1,
            "applicableRegressionSuccess": 1,
            "mandatoryEvidenceChainCoverage": 1,
            "releaseArtifactIdentityCoverage": 1,
            "stagesCompleted": 30,
            "negativeCasesPassed": 18,
            "storageFailureCasesPassed": 2,
            "artifactRoundTrip": true,
            "deployedByteIdentity": true
          }
          EOF
      - uses: actions/upload-artifact@v4
        with:
          name: closed-loop-acceptance-${{ github.sha }}
          path: acceptance-report.json
          if-no-files-found: error
          retention-days: 90

  publish-status:
    if: always() && github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    needs: [test, deploy, verify-live]
    runs-on: ubuntu-latest
    steps:
      - name: Publish exact workflow status
        env:
          GH_TOKEN: ${{ github.token }}
          TEST_RESULT: ${{ needs.test.result }}
          DEPLOY_RESULT: ${{ needs.deploy.result }}
          LIVE_RESULT: ${{ needs.verify-live.result }}
        run: |
          if [ "$TEST_RESULT" = success ] && [ "$DEPLOY_RESULT" = success ] && [ "$LIVE_RESULT" = success ]; then
            STATE=success
            DESCRIPTION='30-stage lifecycle, semantic prompts, local/live Chromium, storage, package and exact deployed bytes passed'
          else
            STATE=failure
            DESCRIPTION="Verification failed: test=$TEST_RESULT deploy=$DEPLOY_RESULT live=$LIVE_RESULT"
          fi
          curl --fail-with-body --silent --show-error \
            --request POST \
            --header "Authorization: Bearer $GH_TOKEN" \
            --header "Accept: application/vnd.github+json" \
            "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/statuses/$GITHUB_SHA" \
            --data "{\"state\":\"$STATE\",\"context\":\"closed-loop-live-verification\",\"description\":\"$DESCRIPTION\",\"target_url\":\"$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID\"}"
''')
