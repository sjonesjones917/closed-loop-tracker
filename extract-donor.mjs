import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const run = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
const read = (ref, path) => {
  try { return run(['show', `${ref}:${path}`]); } catch { return ''; }
};

function functionRanges(text) {
  const ranges = [];
  const pattern = /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
  let match;
  while ((match = pattern.exec(text))) {
    const open = text.indexOf('{', match.index);
    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let i = open; i < text.length; i += 1) {
      const ch = text[i], next = text[i + 1];
      if (lineComment) { if (ch === '\n') lineComment = false; continue; }
      if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i += 1; } continue; }
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '/' && next === '/') { lineComment = true; i += 1; continue; }
      if (ch === '/' && next === '*') { blockComment = true; i += 1; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          ranges.push({ name: match[1], start: match.index, end: i + 1, source: text.slice(match.index, i + 1) });
          pattern.lastIndex = i + 1;
          break;
        }
      }
    }
  }
  return ranges;
}

function selectFunctions(text, namesOrPattern) {
  const functions = functionRanges(text);
  const selected = typeof namesOrPattern === 'function'
    ? functions.filter(item => namesOrPattern(item.name))
    : functions.filter(item => namesOrPattern.includes(item.name));
  return Object.fromEntries(selected.map(item => [item.name, item.source]));
}

function contexts(text, needles, radius = 2200) {
  return needles.flatMap(needle => {
    const result = [];
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(needle, from);
      if (index < 0) break;
      result.push({ needle, index, source: text.slice(Math.max(0, index - radius), Math.min(text.length, index + needle.length + radius)) });
      from = index + needle.length;
      if (result.length >= 4) break;
    }
    return result;
  });
}

const refs = {
  main: 'origin/main',
  zeroLoss: 'origin/spec-v3-zero-loss-20260830',
  actionDonor: 'origin/repair/controlling-v3-zero-loss',
  bundleDonor: 'origin/spec-v3-controlling-bundle'
};
const files = {};
for (const [label, ref] of Object.entries(refs)) {
  files[label] = {};
  for (const path of ['workflow-engine.js','workflow-schema.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js','app-core.js','index.html','test-runtime.js','test-worker.js','test-fixtures.mjs','build-test-project.mjs','verify-full-cycle.mjs','verify-project-lifecycle.mjs','verify-definition-of-done.mjs']) {
    files[label][path] = read(ref, path);
  }
}

const report = {
  refs: Object.fromEntries(Object.entries(refs).map(([name, ref]) => [name, run(['rev-parse', ref]).trim()])),
  functionNames: Object.fromEntries(Object.entries(files).map(([label, byPath]) => [label, Object.fromEntries(Object.entries(byPath).filter(([, text]) => text).map(([path, text]) => [path, functionRanges(text).map(item => item.name)]))])),
  actionDonor: {
    engine: selectFunctions(files.actionDonor['workflow-engine.js'], ['actionReceiptState','actionEnvelope','stage16CorrectionPlan','operationalNextAction']),
    app: selectFunctions(files.actionDonor['app-core.js'], name => /action|next|handoff|primary/i.test(name)),
    contexts: contexts(files.actionDonor['app-core.js'], ['operationalNextAction','actionType','primaryButton','filesToSend','newPromptRequired'], 2600)
  },
  bundleDonor: {
    engine: selectFunctions(files.bundleDonor['workflow-engine.js'], ['actionReceiptState','actionEnvelope','stage16CorrectionPlan','operationalNextAction']),
    app: selectFunctions(files.bundleDonor['app-core.js'], name => /action|next|handoff|primary/i.test(name)),
    contexts: contexts(files.bundleDonor['app-core.js'], ['operationalNextAction','actionType','primaryButton','filesToSend','newPromptRequired'], 2200)
  },
  zeroLoss: {
    engine: selectFunctions(files.zeroLoss['workflow-engine.js'], ['splitInputUnits','intakeCoverageManifest','obligationManifest','accountingClosure','stageGate','recalculate','operationalNextAction']),
    schemaContexts: contexts(files.zeroLoss['workflow-schema.js'], ['accounting','intakeCoverageManifest','obligationManifest','closed-loop-stage-response/3','EXECUTABLE_KIND'], 2600),
    promptContexts: contexts(files.zeroLoss['prompt-engine.js'], ['PROJECT MEMORY — CAPTURE ONCE, REUSE EVERYWHERE','STAGE 01','STAGE 04','intakeCoverageManifest','obligationManifest'], 3200),
    ingestionFunctions: selectFunctions(files.zeroLoss['response-ingestion.js'], name => /account|validat/i.test(name)),
    ingestionContexts: contexts(files.zeroLoss['response-ingestion.js'], ['INCOMPLETE_ACCOUNTING','WRONG_ACCOUNTING_MANIFEST','response.accounting'], 3000),
    fixtureFunctions: selectFunctions(files.zeroLoss['test-fixtures.mjs'], name => /response|stage|fixture|project|build/i.test(name)),
    fullCycleFunctions: selectFunctions(files.zeroLoss['verify-full-cycle.mjs'], name => /response|stage|fixture|project|build|run/i.test(name)),
    fullCycleContexts: contexts(files.zeroLoss['verify-full-cycle.mjs'], ['stage===1','stage === 1','operationForStage','responseType','stageData'], 3200)
  },
  migration: Object.fromEntries(Object.entries(files).map(([label, byPath]) => [label, {
    workbookFunctions: selectFunctions(byPath['workbook.js'], name => /migrat|upgrade|legacy|project/i.test(name)),
    storeFunctions: selectFunctions(byPath['project-store.js'], name => /migrat|upgrade|legacy|import|normalize|activate/i.test(name)),
    workbookContexts: contexts(byPath['workbook.js'], ['human-project/30','closed-loop-project/2','closed-loop-project/3','function migrate'], 2600),
    storeContexts: contexts(byPath['project-store.js'], ['human-project/30','closed-loop-project/2','closed-loop-project/3','function migrate'], 2600)
  }])),
  visualRules: Object.fromEntries(Object.entries(files).map(([label, byPath]) => [label, contexts(byPath['index.html'], ['.prompt{','.expandable-prompt{','textarea{','.stage-output{'], 200)]))
};

fs.writeFileSync('donor-snippets.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Wrote donor-snippets.json (${fs.statSync('donor-snippets.json').size} bytes).`);
