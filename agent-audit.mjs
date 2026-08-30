import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const REPO = process.cwd();
const MAIN = 'origin/main';
const CORE_FILES = [
  'workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js',
  'workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','index.html'
];
const REQUIRED_OPS = [
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML',
  'SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256',
  'REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE',
  'ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
];
const TESTS = [
  'verify-v3-contract.mjs','verify-v3-migration.mjs','verify-intake-obligation-accounting.mjs',
  'verify-exhaustive-stage1-stage3-stage4.mjs','verify-test-runtime.mjs','verify-test-runtime-v3.mjs',
  'verify-test-runtime-limits.mjs','verify-hash.mjs','verify.mjs','verify-ingestion.mjs',
  'verify-complete.mjs','verify-full-cycle.mjs','verify-prompt-semantics.mjs',
  'verify-semantic-invariant.mjs','verify-definition-of-done.mjs','verify-v3-definition-of-done.mjs',
  'verify-project-lifecycle.mjs'
];

function run(args, options = {}) {
  return execFileSync('git', args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore','pipe','pipe'],
    ...options
  }).trim();
}
function read(ref, file) {
  try { return run(['show', `${ref}:${file}`]); } catch { return ''; }
}
function bool(value) { return value ? 1 : 0; }
function cssRule(text, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.match(new RegExp(`${escaped}\\{[^}]*\\}`))?.[0] || null;
}
function branchRefs() {
  const rows = run(['for-each-ref','--sort=-committerdate','--format=%(refname:short)|%(objectname)|%(committerdate:iso-strict)','refs/remotes/origin']).split('\n');
  return rows.map(row => {
    const [ref, sha, date] = row.split('|');
    return { ref, sha, date, branch: ref.replace(/^origin\//,'') };
  }).filter(item => item.ref !== 'origin/HEAD' && item.ref !== MAIN);
}

const mainIndex = read(MAIN, 'index.html');
const visualSelectors = ['.prompt','.expandable-prompt','textarea','.stage-output'];
const nameFilter = /(?:v3|zero.loss|controlling|exhaust|intent|stage0?4|stage0?1|closed.account|full.spec|bundle|completion|reconcile|capture.once|single.supply|reliability.final)/i;
const refs = branchRefs().filter(item => nameFilter.test(item.branch) && item.date >= '2026-08-28');
const reports = [];

for (const item of refs) {
  let behind = 9999, ahead = 0;
  try { [behind, ahead] = run(['rev-list','--left-right','--count',`${MAIN}...${item.ref}`]).split(/\s+/).map(Number); } catch {}
  if (behind > 40) continue;
  const source = Object.fromEntries(CORE_FILES.map(file => [file, read(item.ref, file)]));
  const workbook = source['workbook.js'];
  const schema = source['workflow-schema.js'];
  const runtime = source['test-runtime.js'];
  const worker = source['test-worker.js'];
  const engine = source['workflow-engine.js'];
  const prompt = source['prompt-engine.js'];
  const ingestion = source['response-ingestion.js'];
  const store = source['project-store.js'];
  const app = source['app-core.js'];
  const index = source['index.html'];
  if (!workbook || !schema || !engine || !prompt || !ingestion || !store || !app || !index) continue;
  let changedFiles = [];
  try { changedFiles = run(['diff','--name-only',`${MAIN}...${item.ref}`]).split('\n').filter(Boolean); } catch {}
  const testsPresent = TESTS.filter(file => Boolean(read(item.ref, file)));
  const actionStart = engine.indexOf('function operationalNextAction');
  const actionSlice = actionStart >= 0 ? engine.slice(actionStart, actionStart + 14000) : '';
  const requiredActionKeys = ['actionType','heading','explanation','primaryButton','secondaryAction','filesToSend','filesToWithhold','expectedReturnFiles','blockingReason','canonicalStateChanged','newPromptRequired'];
  const features = {
    project3: /closed-loop-project\/3/.test(workbook),
    response3: /closed-loop-stage-response\/3/.test(schema),
    exactly30: /STAGE_COUNT\s*=\s*30|length\s*===\s*30/.test(workbook + schema),
    stage16Label: /CORRECT THE ROOT CAUSE/.test(workbook),
    domainNeutral: !/(STAGE 01 DOMAIN INTAKE ADAPTATION|PATENT \/ REGULATED|SOFTWARE \/ TECHNICAL|AEC \/ BUILDING|MECHANICAL \/ PHYSICAL|patent application fixture)/i.test(prompt),
    intakeManifest: /function intakeCoverageManifest/.test(engine),
    intakeEvaluation: /function evaluateIntakeCoverage/.test(engine),
    obligationManifest: /function obligationManifest/.test(engine),
    obligationEvaluation: /function evaluateObligationAccounting/.test(engine),
    stableSourceLocation: /sourcePath|sourceLocation/.test(engine) && /rawValueSha256|rawSha256/.test(engine),
    inputOffsets: /startOffset/.test(engine) && /endOffset/.test(engine),
    stage1GateClosure: /case\s+1[\s\S]{0,8000}(?:intake|accounting)/.test(engine),
    stage4GateClosure: /case\s+4[\s\S]{0,8000}(?:obligation|accounting)/.test(engine),
    stage1IngestionClosure: /stageNumber\s*===\s*1[\s\S]{0,9000}(?:intake|accounting|manifest)/.test(ingestion),
    stage4IngestionClosure: /stageNumber\s*===\s*4[\s\S]{0,9000}(?:obligation|accounting|manifest)/.test(ingestion),
    stage3ExhaustionPrompt: /initial extraction pass/i.test(prompt) && /conflict\/exception\/completeness pass/i.test(prompt),
    stage3GateClosure: /case\s+3[\s\S]{0,8000}(?:LATEST_PASS_NUMBER|SATURATION_STATUS|SECOND_CONFLICT)/.test(engine),
    stage3IngestionClosure: /stageNumber\s*===\s*3[\s\S]{0,9000}(?:LATEST_PASS_NUMBER|SATURATION_STATUS|SECOND_CONFLICT)/.test(ingestion),
    stage4CompleteStage1: /COMPLETE ACCEPTED STAGE 01 JOB DEFINITION/.test(prompt),
    stage4CompleteStage3: /COMPLETE EXHAUSTED STAGE 03 STAGE DATA/.test(prompt),
    stage4NoResupply: /do not ask the human to (?:repeat|resend|reattach)|never ask the human to retype/i.test(prompt),
    structuredAction: requiredActionKeys.every(key => actionSlice.includes(key) || engine.includes(key)),
    appConsumesAction: /operationalNextAction/.test(app) && /actionType/.test(app),
    humanLegacyMigration: /human-project\/30/.test(workbook + store),
    v2Migration: /closed-loop-project\/2/.test(workbook + store) && /closed-loop-project\/3/.test(workbook + store),
    migrationAuditPayload: /originalImportedPayload|MIGRATION_SOURCE|LEGACY_STAGE_RECORDS/.test(workbook + store),
    testIrSchema: /closed-loop-test-spec\/1/.test(schema + runtime),
    testIrAllOps: REQUIRED_OPS.every(op => runtime.includes(op)),
    noCustomPipeline: !/CUSTOM_PIPELINE/.test(runtime),
    workerNoNetwork: /fetch\s*=\s*undefined/.test(worker) && /XMLHttpRequest\s*=\s*undefined/.test(worker),
    packageSchema: /closed-loop-verification-package\/1/.test(schema + store + engine),
    cspWorker: /worker-src\s+'self'/.test(index),
    runtimeOrder: index.indexOf('workflow-schema.js') >= 0 && index.indexOf('test-runtime.js') > index.indexOf('workflow-schema.js') && index.indexOf('workflow-engine.js') > index.indexOf('test-runtime.js'),
    visualBaseline: visualSelectors.every(selector => cssRule(index, selector) === cssRule(mainIndex, selector)),
    testsBroad: testsPresent.length >= 12,
    noOneTimeWorkflows: !changedFiles.some(file => /(?:one.time|repair|bootstrap|z-exhaustive|audit-v3|apply-v3)/i.test(file) && file.startsWith('.github/workflows/'))
  };
  const weights = {
    project3:4,response3:4,exactly30:2,stage16Label:1,domainNeutral:4,
    intakeManifest:5,intakeEvaluation:4,obligationManifest:5,obligationEvaluation:4,
    stableSourceLocation:3,inputOffsets:3,stage1GateClosure:4,stage4GateClosure:4,
    stage1IngestionClosure:4,stage4IngestionClosure:4,stage3ExhaustionPrompt:3,stage3GateClosure:3,stage3IngestionClosure:3,
    stage4CompleteStage1:3,stage4CompleteStage3:3,stage4NoResupply:4,structuredAction:3,appConsumesAction:2,
    humanLegacyMigration:2,v2Migration:5,migrationAuditPayload:2,testIrSchema:2,testIrAllOps:4,noCustomPipeline:3,
    workerNoNetwork:2,packageSchema:1,cspWorker:1,runtimeOrder:1,visualBaseline:5,testsBroad:2,noOneTimeWorkflows:3
  };
  const featureScore = Object.entries(weights).reduce((sum,[key,weight]) => sum + (features[key] ? weight : 0),0);
  const score = featureScore - Math.min(behind,40) * 1.5;
  reports.push({ ...item, behind, ahead, score, featureScore, features, testsPresent, changedFiles });
}

reports.sort((a,b) => b.score - a.score || a.behind - b.behind || b.ahead - a.ahead || b.date.localeCompare(a.date));
const candidates = reports.slice(0, 12);

function dynamicCheck(candidate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'closed-loop-candidate-'));
  const result = { branch: candidate.branch, sha: candidate.sha, syntax: false, build: null, tests: [], error: null };
  try {
    const archive = spawnSync('git',['archive',candidate.ref],{cwd:REPO,encoding:null,maxBuffer:128*1024*1024});
    if (archive.status !== 0) throw new Error(String(archive.stderr || 'git archive failed'));
    const untar = spawnSync('tar',['-x','-C',dir],{input:archive.stdout,encoding:null,maxBuffer:128*1024*1024});
    if (untar.status !== 0) throw new Error(String(untar.stderr || 'tar failed'));
    const core = CORE_FILES.filter(file => file.endsWith('.js') && fs.existsSync(path.join(dir,file)));
    for (const file of core) {
      const check = spawnSync(process.execPath,['--check',file],{cwd:dir,encoding:'utf8',timeout:30000});
      if (check.status !== 0) throw new Error(`${file} syntax failed: ${check.stderr || check.stdout}`);
    }
    result.syntax = true;
    if (fs.existsSync(path.join(dir,'build-test-project.mjs'))) {
      const build = spawnSync(process.execPath,['build-test-project.mjs'],{cwd:dir,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
      result.build = { status: build.status, output: `${build.stdout || ''}${build.stderr || ''}`.trim().slice(-2400) };
      if (build.status !== 0) return result;
    }
    for (const test of TESTS) {
      if (!fs.existsSync(path.join(dir,test))) continue;
      const proc = spawnSync(process.execPath,[test],{cwd:dir,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
      result.tests.push({ file:test, status:proc.status, signal:proc.signal, output:`${proc.stdout || ''}${proc.stderr || ''}`.trim().slice(-1800) });
      if (proc.status !== 0) break;
    }
  } catch (error) {
    result.error = String(error?.stack || error);
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
  }
  return result;
}

const dynamic = candidates.slice(0, 6).map(dynamicCheck);
fs.writeFileSync('candidate-scan.json', JSON.stringify({ generatedAt:new Date().toISOString(), main:run(['rev-parse',MAIN]), scanned:reports.length, candidates, dynamic }, null, 2) + '\n');
console.log(JSON.stringify({ scanned:reports.length, top:candidates.map(x=>({branch:x.branch,sha:x.sha,score:x.score,behind:x.behind,ahead:x.ahead})), dynamic:dynamic.map(x=>({branch:x.branch,syntax:x.syntax,build:x.build?.status,passed:x.tests.filter(t=>t.status===0).length,failed:x.tests.find(t=>t.status!==0)?.file||null,error:x.error})) }, null, 2));
