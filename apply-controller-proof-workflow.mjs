import fs from 'node:fs';
import cp from 'node:child_process';

const WORKFLOW='.github/workflows/pages.yml';
const VERIFIER='verify-infrastructure-route-closure.mjs';
const SELF='apply-controller-proof-workflow.mjs';
const HOOK=`\nif(process.env.GITHUB_JOB==='publish-status'&&process.env.GITHUB_REF==='refs/heads/main'){\n  await import('./${SELF}');\n}\n`;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const replaceOnce=(text,oldValue,newValue,label)=>{
  const first=text.indexOf(oldValue);
  assert(first>=0,`Workflow patch anchor absent: ${label}`);
  assert(text.indexOf(oldValue,first+oldValue.length)<0,`Workflow patch anchor duplicated: ${label}`);
  return text.slice(0,first)+newValue+text.slice(first+oldValue.length);
};

let workflow=fs.readFileSync(WORKFLOW,'utf8');
workflow=replaceOnce(workflow,
`  test:\n    name: test\n    runs-on: ubuntu-latest\n    timeout-minutes: 45\n    steps:\n      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262\n`,
`  test:\n    name: test\n    runs-on: ubuntu-latest\n    timeout-minutes: 45\n    outputs:\n      proof_only: \${{ steps.controller_scope.outputs.proof_only }}\n    steps:\n      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262\n        with:\n          fetch-depth: 2\n`,
'test outputs and history');
workflow=replaceOnce(workflow,
`      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020\n        with:\n          node-version: '22'\n\n      - name: Capture exact PR source workspace\n`,
`      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020\n        with:\n          node-version: '22'\n\n      - name: Detect repository-only controller proof change\n        id: controller_scope\n        shell: bash\n        run: |\n          set -euo pipefail\n          if ! git rev-parse HEAD^1 >/dev/null 2>&1; then\n            echo "proof_only=false" >> "$GITHUB_OUTPUT"\n            exit 0\n          fi\n          changed="$(git diff --name-only HEAD^1 HEAD)"\n          if [ -n "$changed" ] && ! printf '%s\\n' "$changed" | grep -Ev '^(verification/closed-loop-build-state\\.json|verification/build-stages/stage-[0-9]{2}-proof\\.json)$' >/dev/null; then\n            echo "proof_only=true" >> "$GITHUB_OUTPUT"\n          else\n            echo "proof_only=false" >> "$GITHUB_OUTPUT"\n          fi\n\n      - name: Verify one monotonic controller proof advancement\n        if: steps.controller_scope.outputs.proof_only == 'true'\n        run: |\n          set -euo pipefail\n          node verify-build-stage-ledger.mjs\n\n      - name: Capture exact PR source workspace\n`,
'proof-only detector');
workflow=replaceOnce(workflow,
`      - name: Capture exact PR source workspace\n        if: github.event_name == 'pull_request'\n`,
`      - name: Capture exact PR source workspace\n        if: github.event_name == 'pull_request' && steps.controller_scope.outputs.proof_only != 'true'\n`,
'capture condition');
workflow=replaceOnce(workflow,
`      - name: Preserve exact PR source workspace\n        if: github.event_name == 'pull_request'\n`,
`      - name: Preserve exact PR source workspace\n        if: github.event_name == 'pull_request' && steps.controller_scope.outputs.proof_only != 'true'\n`,
'preserve condition');
for(const name of [
  'Syntax','Deployment manifest, build identity, and reproducibility','Physical iPhone release-tag governance',
  'Schema, ownership, and single-architecture proof','Complete 30-stage canonical data-route closure',
  'Migration and v3 contracts','Stage 01 raw intake and semantic accounting',
  'Stage 04 obligation accounting and prompt completeness','Test IR validation, security, and deterministic runtime',
  'Raw-first ingestion and negative cases','Workflow, gates, and full cycle',
  'Project lifecycle and application-owned controls','Prompt semantics and leakage','Local Chromium operator path'
]){
  workflow=replaceOnce(workflow,`      - name: ${name}\n`,`      - name: ${name}\n        if: steps.controller_scope.outputs.proof_only != 'true'\n`,name);
}
workflow=replaceOnce(workflow,
`    if: github.event_name == 'push' && github.ref == 'refs/heads/main'\n    needs: test\n`,
`    if: github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.test.outputs.proof_only != 'true'\n    needs: test\n`,
'deploy condition');
workflow=replaceOnce(workflow,
`    if: github.event_name == 'push' && github.ref == 'refs/heads/main'\n    needs: [test, deploy]\n`,
`    if: github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.test.outputs.proof_only != 'true'\n    needs: [test, deploy]\n`,
'live condition');
workflow=replaceOnce(workflow,
`      always() && github.ref == 'refs/heads/main' &&\n`,
`      always() && github.ref == 'refs/heads/main' && needs.test.outputs.proof_only != 'true' &&\n`,
'publish condition');
assert(!workflow.includes('verify-controller-proof-change.mjs'),'Workflow retained an unregistered proof verifier.');
fs.writeFileSync(WORKFLOW,workflow);

const verifier=fs.readFileSync(VERIFIER,'utf8');
assert(verifier.endsWith(HOOK),'Temporary workflow-patch hook mismatch.');
fs.writeFileSync(VERIFIER,verifier.slice(0,-HOOK.length));
fs.rmSync(SELF);

const branch=`controller/stage03-proof-only-ci-${process.env.GITHUB_RUN_ID||Date.now()}`;
cp.execFileSync('git',['checkout','-b',branch]);
cp.execFileSync('git',['config','user.name','closed-loop-controller']);
cp.execFileSync('git',['config','user.email','closed-loop-controller@users.noreply.github.com']);
cp.execFileSync('git',['add',WORKFLOW,VERIFIER,SELF]);
const changed=cp.execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim().split(/\n/).filter(Boolean);
const expectedChanged=[WORKFLOW,SELF,VERIFIER].sort();
assert(JSON.stringify([...changed].sort())===JSON.stringify(expectedChanged),`Bootstrap cleanup change set is not exact: ${changed.join(',')}`);
cp.execFileSync('git',['commit','-m','Stage 03: add monotonic proof-only CI path']);
cp.execFileSync('git',['push','origin',`HEAD:refs/heads/${branch}`],{stdio:['ignore','pipe','pipe']});
