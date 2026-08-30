import { execFileSync } from 'node:child_process';

const candidates = [
  'fix/controlling-bundle-zero-loss-20260830',
  'fix/exhaustive-intake-stage3-stage4-20260830',
  'fix/semantic-completeness-domain-neutral-20260830',
  'fix/closed-loop-v3-controlling-spec',
  'fix/controlling-spec3-complete',
  'closed-loop-v3-completion',
  'repair/user-bundle-zero-loss-20260830',
  'fix/full-controlling-bundle-20260830',
  'fix/final-reliability-closure-20260830',
  'fix/full-spec-conformance-20260830',
  'fix/controlling-spec-final-20260830',
  'fix/controlling-spec-zero-loss-final-20260830-0235',
  'spec-v3-zero-loss-20260830',
  'repair/controlling-v3-zero-loss',
  'fix/stage01-stage04-closed-accounting-current',
  'repair/intent-exhaustion-stage4-20260830',
  'fix/stage4-canonical-obligation-accounting',
  'fix/zero-loss-prompt-context',
  'implement/closed-loop-v3-final2',
  'fix/full-spec-reconcile-20260830'
];

const files = [
  'workbook.js',
  'workflow-schema.js',
  'workflow-engine.js',
  'prompt-engine.js',
  'response-ingestion.js',
  'project-store.js',
  'app-core.js',
  'index.html',
  'test-runtime.js',
  'test-worker.js',
  '.github/workflows/pages.yml'
];

function run(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

function exists(ref) {
  try { run(['rev-parse', '--verify', ref]); return true; } catch { return false; }
}

function read(ref, path) {
  try { return run(['show', `${ref}:${path}`]); } catch { return ''; }
}

function count(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function cssRule(text, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.match(new RegExp(`${escaped}\\{[^}]*\\}`))?.[0] || null;
}

const mainIndex = read('origin/main', 'index.html');
const selectors = ['.prompt', '.expandable-prompt', 'textarea', '.stage-output'];
const reports = [];

for (const branch of candidates) {
  const ref = `origin/${branch}`;
  if (!exists(ref)) {
    reports.push({ branch, missing: true });
    continue;
  }
  const contents = Object.fromEntries(files.map(file => [file, read(ref, file)]));
  const all = files.map(file => contents[file]).join('\n');
  const prompt = contents['prompt-engine.js'];
  const schema = contents['workflow-schema.js'];
  const engine = contents['workflow-engine.js'];
  const ingestion = contents['response-ingestion.js'];
  const store = contents['project-store.js'];
  const workbook = contents['workbook.js'];
  const runtime = contents['test-runtime.js'];
  const index = contents['index.html'];
  const changed = run(['diff', '--name-only', 'origin/main...', ref]).split('\n').filter(Boolean);
  const [behind, ahead] = run(['rev-list', '--left-right', '--count', `origin/main...${ref}`]).split(/\s+/).map(Number);
  const visualSelectorsEqualMain = selectors.every(selector => cssRule(index, selector) === cssRule(mainIndex, selector));
  const hardCodedDomainBranch = /STAGE 01 DOMAIN INTAKE ADAPTATION|PATENT \/ REGULATED|SOFTWARE \/ TECHNICAL|AEC \/ BUILDING|MECHANICAL \/ PHYSICAL/i.test(prompt);
  const intakeManifestSignals = count(all, /intake(?:Coverage)?Manifest|intake coverage manifest|controlled input unit|inputUnitId|INPUT_UNIT_ID/gi);
  const obligationManifestSignals = count(all, /obligationManifest|obligation manifest|obligationUniverse|OBLIGATION_ID|obligationDisposition/gi);
  const appEnumerationSignals = count(engine + schema + store, /enumerat(?:e|ion).{0,80}(?:input|statement|unit)|stable.{0,40}(?:input|statement|unit).{0,40}(?:identity|id)/gi);
  const closureSignals = count(engine + ingestion, /missing.{0,80}(?:input|statement|obligation)|coverage.{0,80}(?:1(?:\.0+)?|complete)|every.{0,80}(?:input|statement|obligation)/gi);
  const operationSet = [...new Set((runtime.match(/'([A-Z][A-Z0-9_]+)'/g) || []).map(value => value.slice(1, -1)))];
  const report = {
    branch,
    sha: run(['rev-parse', ref]),
    date: run(['log', '-1', '--format=%cI', ref]),
    ahead,
    behind,
    changedFileCount: changed.length,
    changedCoreFiles: changed.filter(file => files.includes(file)),
    project3: /closed-loop-project\/3/.test(workbook),
    response3: /closed-loop-stage-response\/3/.test(schema),
    stage16CorrectRootCauseLabel: /CORRECT THE ROOT CAUSE/.test(workbook),
    domainNeutralPrompt: !hardCodedDomainBranch,
    intakeManifestSignals,
    obligationManifestSignals,
    appEnumerationSignals,
    closureSignals,
    stage1IngestionClosure: /stageNumber===1[\s\S]{0,6000}(?:manifest|coverage|omitted|missing)/i.test(ingestion),
    stage4IngestionClosure: /stageNumber===4[\s\S]{0,8000}(?:obligation|manifest)[\s\S]{0,2000}(?:omitted|missing|coverage|disposition)/i.test(ingestion),
    stage4PromptUsesStage1And3Union: /Stage 01[\s\S]{0,2500}Stage 03/i.test(prompt) && /(?:complete union|obligation universe|every applicable input obligation)/i.test(prompt),
    structuredNextAction: /function operationalNextAction[\s\S]{0,1500}actionType/.test(engine),
    humanLegacyMigration: /human-project\/30/.test(workbook + store),
    directV2ToV3Migration: /closed-loop-project\/2[\s\S]{0,500}closed-loop-project\/3|closed-loop-project\/3[\s\S]{0,500}closed-loop-project\/2/.test(workbook + store),
    executableKindTestIr: /EXECUTABLE_KIND[\s\S]{0,600}(?:NONE|TEST_IR)/.test(schema + runtime),
    noCustomPipelineRuntime: !/CUSTOM_PIPELINE/.test(runtime),
    parseXml: operationSet.includes('PARSE_XML'),
    selectXml: operationSet.includes('SELECT_XML'),
    packageSchema: /closed-loop-verification-package\/1/.test(store + engine + schema),
    workerCsp: /worker-src\s+'self'|worker-src\s+self/i.test(index),
    runtimeLoaded: /test-runtime\.js/.test(index),
    visualSelectorsEqualMain,
    promptCss: Object.fromEntries(selectors.map(selector => [selector, cssRule(index, selector)])),
    testWorkflowMentionsClosure: /intake|obligation|zero.loss|stage.?0?4/i.test(contents['.github/workflows/pages.yml']),
    score: 0
  };
  report.score = [
    report.project3,
    report.response3,
    report.stage16CorrectRootCauseLabel,
    report.domainNeutralPrompt,
    report.intakeManifestSignals > 0,
    report.obligationManifestSignals > 0,
    report.appEnumerationSignals > 0,
    report.stage1IngestionClosure,
    report.stage4IngestionClosure,
    report.stage4PromptUsesStage1And3Union,
    report.structuredNextAction,
    report.humanLegacyMigration,
    report.directV2ToV3Migration,
    report.executableKindTestIr,
    report.noCustomPipelineRuntime,
    report.parseXml,
    report.selectXml,
    report.packageSchema,
    report.workerCsp,
    report.runtimeLoaded,
    report.visualSelectorsEqualMain,
    report.testWorkflowMentionsClosure
  ].filter(Boolean).length;
  reports.push(report);
}

reports.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.ahead || 0) - (a.ahead || 0));
console.log(JSON.stringify(reports, null, 2));
