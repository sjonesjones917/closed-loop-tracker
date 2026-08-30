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

function extractBalanced(text, startNeedle, max = 24000) {
  const start = text.indexOf(startNeedle);
  if (start < 0) return '';
  const open = text.indexOf('{', start);
  if (open < 0) return text.slice(start, Math.min(text.length, start + max));
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < text.length && i < start + max; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start, Math.min(text.length, start + max));
}

function firstIndex(text, needles) {
  for (const needle of needles) {
    const index = text.indexOf(needle);
    if (index >= 0) return { needle, index };
  }
  return null;
}

const results = [];
for (const ref of refs) {
  let sha;
  try { sha = run(['rev-parse', ref]); } catch { continue; }
  const workbook = read(ref, 'workbook.js');
  const schema = read(ref, 'workflow-schema.js');
  const engine = read(ref, 'workflow-engine.js');
  const prompt = read(ref, 'prompt-engine.js');
  const ingestion = read(ref, 'response-ingestion.js');
  const store = read(ref, 'project-store.js');
  const app = read(ref, 'app-core.js');
  const index = read(ref, 'index.html');
  const tests = [
    'verify-controlling-spec.mjs',
    'verify-full-cycle.mjs',
    'verify-browser-extra.mjs',
    'verify-project-lifecycle.mjs',
    'verify-definition-of-done.mjs'
  ].map(path => read(ref, path)).join('\n');
  const action = extractBalanced(engine, 'function operationalNextAction');
  const migrate = extractBalanced(store, 'function migrate') || extractBalanced(workbook, 'function migrate');
  const [behind, ahead] = ref === 'origin/main'
    ? [0, 0]
    : run(['rev-list', '--left-right', '--count', `origin/main...${ref}`]).split(/\s+/).map(Number);
  const actionKeys = ['actionType','heading','explanation','primaryButton','secondaryAction','filesToSend','filesToWithhold','expectedReturnFiles','blockingReason','canonicalStateChanged','newPromptRequired'];
  const preservationKeys = ['rawResponses','responseValidations','responseProposals','acceptedChanges','extractionManifests','artifacts','artifactBlobs','intakeCoverageManifest','obligationManifest','originalImportedPayload'];
  results.push({
    ref,
    sha,
    ahead,
    behind,
    project3: /closed-loop-project\/3/.test(workbook),
    response3: /closed-loop-stage-response\/3/.test(schema),
    actionFunctionLength: action.length,
    actionKeys: actionKeys.filter(key => action.includes(key)),
    actionReturnsObject: /return\s*\{/.test(action),
    appActionKeys: actionKeys.filter(key => app.includes(key)),
    actionTests: actionKeys.filter(key => tests.includes(key)),
    migrateFunctionLength: migrate.length,
    explicitHumanToV2: /human-project\/30[\s\S]{0,4000}closed-loop-project\/2|closed-loop-project\/2[\s\S]{0,4000}human-project\/30/.test(store + workbook),
    explicitV2ToV3: /closed-loop-project\/2[\s\S]{0,4000}closed-loop-project\/3|closed-loop-project\/3[\s\S]{0,4000}closed-loop-project\/2/.test(store + workbook),
    migrationPreserves: preservationKeys.filter(key => (store + workbook).includes(key)),
    migrationTests: ['human-project/30','closed-loop-project/2','closed-loop-project/3','rawResponses','artifacts','artifactBlobs'].filter(key => tests.includes(key)),
    intakeHelper: Boolean(extractBalanced(engine, 'function intakeCoverageManifest')),
    obligationHelper: Boolean(extractBalanced(engine, 'function obligationManifest')),
    accountingHelper: Boolean(extractBalanced(engine, 'function accountingClosure')),
    stage1GateAccounting: /case\s+1[\s\S]{0,6000}(?:accounting|intakeCoverageManifest)/.test(engine),
    stage4GateAccounting: /case\s+4[\s\S]{0,6000}(?:accounting|obligationManifest)/.test(engine),
    stage1IngestionAccounting: /stageNumber\s*===\s*1[\s\S]{0,6000}(?:accounting|manifest)/.test(ingestion),
    stage4IngestionAccounting: /stageNumber\s*===\s*4[\s\S]{0,6000}(?:accounting|manifest)/.test(ingestion),
    captureOncePrompt: /CAPTURE ONCE|never ask the human to retype|do not ask the human to resend/i.test(prompt),
    noDomainCatalogue: !/(PATENT \/ REGULATED FILING|SOFTWARE \/ MULTI-FILE SYSTEM|BUILDING \/ ARCHITECTURE \/ AEC|PHYSICAL \/ MECHANICAL \/ CAD)/.test(prompt),
    visualBaseline: index.includes('.prompt{height:clamp(260px,45vh,520px);') && index.includes('.expandable-prompt{max-height:280px}') && index.includes('textarea{min-height:92px;resize:vertical}') && index.includes('.stage-output{min-height:220px}'),
    actionAnchor: firstIndex(engine, ['function operationalNextAction']),
    migrationAnchor: firstIndex(store + workbook, ['human-project/30','closed-loop-project/2','closed-loop-project/3'])
  });
}
console.log(JSON.stringify(results, null, 2));
