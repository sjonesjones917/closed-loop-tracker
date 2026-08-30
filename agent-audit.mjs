import { execFileSync } from 'node:child_process';

const refs = [
  'origin/main',
  'origin/spec-v3-zero-loss-20260830',
  'origin/repair/controlling-v3-zero-loss',
  'origin/fix/closed-loop-v3-controlling-spec',
  'origin/fix/controlling-spec3-complete',
  'origin/closed-loop-v3-completion',
  'origin/implement/closed-loop-v3-final2',
  'origin/spec-v3-controlling-bundle',
  'origin/fix/full-spec-reconcile-20260830',
  'origin/fix/controlling-bundle-zero-loss-20260830'
];

function run(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

function read(ref, path) {
  try { return run(['show', `${ref}:${path}`]); } catch { return ''; }
}

function extractBalanced(text, startNeedle, max = 18000) {
  const start = text.indexOf(startNeedle);
  if (start < 0) return null;
  const open = text.indexOf('{', start);
  if (open < 0) return text.slice(start, Math.min(text.length, start + max));
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < text.length && i < start + max; i++) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start, Math.min(text.length, start + max));
}

function snippets(text, needles, radius = 1700) {
  return needles.map(needle => {
    const i = text.indexOf(needle);
    return i < 0 ? null : { needle, text: text.slice(Math.max(0, i - radius), Math.min(text.length, i + needle.length + radius)) };
  }).filter(Boolean);
}

for (const ref of refs) {
  let sha;
  try { sha = run(['rev-parse', ref]); } catch { continue; }
  const workbook = read(ref, 'workbook.js');
  const schema = read(ref, 'workflow-schema.js');
  const engine = read(ref, 'workflow-engine.js');
  const prompt = read(ref, 'prompt-engine.js');
  const ingestion = read(ref, 'response-ingestion.js');
  const store = read(ref, 'project-store.js');
  const index = read(ref, 'index.html');
  const app = read(ref, 'app-core.js');
  const tests = read(ref, 'verify-controlling-spec.mjs') + '\n' + read(ref, 'verify-full-cycle.mjs') + '\n' + read(ref, 'verify-browser-extra.mjs');
  const [behind, ahead] = ref === 'origin/main' ? [0, 0] : run(['rev-list', '--left-right', '--count', `origin/main...${ref}`]).split(/\s+/).map(Number);
  const actionFn = extractBalanced(engine, 'function operationalNextAction');
  const migrationSnips = snippets(workbook + '\n' + store, ['human-project/30', 'closed-loop-project/2', 'closed-loop-project/3'], 2200);
  const report = {
    ref,
    sha,
    behind,
    ahead,
    project3: /closed-loop-project\/3/.test(workbook),
    response3: /closed-loop-stage-response\/3/.test(schema),
    actionFunctionFound: Boolean(actionFn),
    structuredActionKeys: actionFn ? ['actionType','heading','explanation','primaryButton','secondaryAction','filesToSend','filesToWithhold','expectedReturnFiles','blockingReason','canonicalStateChanged','newPromptRequired'].filter(key => actionFn.includes(key)) : [],
    appConsumesStructuredAction: /NEXT_REQUIRED_ACTION[^\n]{0,300}actionType|action\.actionType|nextAction\.actionType/.test(app),
    humanLegacy: /human-project\/30/.test(workbook + store),
    v2ToV3: /closed-loop-project\/2/.test(workbook + store) && /closed-loop-project\/3/.test(workbook + store),
    migrationPreservationTerms: ['rawResponses','responseValidations','responseProposals','acceptedChanges','extractionManifests','artifact','importedOriginalPayload'].filter(term => (workbook + store).includes(term)),
    intakeFunction: Boolean(extractBalanced(engine, 'function intakeCoverageManifest')),
    obligationFunction: Boolean(extractBalanced(engine, 'function obligationManifest')),
    accountingFunction: Boolean(extractBalanced(engine, 'function accountingClosure')),
    noDomainCatalogue: !/(PATENT \/ REGULATED FILING|SOFTWARE \/ MULTI-FILE SYSTEM|BUILDING \/ ARCHITECTURE \/ AEC|PHYSICAL \/ MECHANICAL \/ CAD)/.test(prompt),
    testHasStructuredAction: /actionType|operationalNextAction/.test(tests),
    visualBaseline: index.includes('.prompt{height:clamp(260px,45vh,520px);') && index.includes('.expandable-prompt{max-height:280px}') && index.includes('textarea{min-height:92px;resize:vertical}') && index.includes('.stage-output{min-height:220px}')
  };
  console.log(`\n===== REPORT ${ref} =====\n${JSON.stringify(report, null, 2)}`);
  console.log(`\n===== ACTION ${ref} =====\n${actionFn || 'NOT FOUND'}`);
  console.log(`\n===== MIGRATION ${ref} =====\n${migrationSnips.map(item => `--- ${item.needle} ---\n${item.text}`).join('\n') || 'NOT FOUND'}`);
  if (ref === 'origin/spec-v3-zero-loss-20260830') {
    for (const name of ['function intakeCoverageManifest','function obligationManifest','function accountingClosure']) {
      console.log(`\n===== ${name} =====\n${extractBalanced(engine, name) || 'NOT FOUND'}`);
    }
    console.log(`\n===== STAGE 1/4 PROMPT =====\n${snippets(prompt, ['PROJECT MEMORY — CAPTURE ONCE, REUSE EVERYWHERE','STAGE 01','STAGE 04'], 3000).map(item=>`--- ${item.needle} ---\n${item.text}`).join('\n')}`);
    console.log(`\n===== ACCOUNTING INGESTION =====\n${snippets(ingestion, ['function validateAccounting','INCOMPLETE_ACCOUNTING','WRONG_ACCOUNTING_MANIFEST'], 2600).map(item=>`--- ${item.needle} ---\n${item.text}`).join('\n')}`);
  }
}
