import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = [
  'workbook.js',
  'workflow-schema.js',
  'workflow-engine.js',
  'prompt-engine.js',
  'response-ingestion.js',
  'project-store.js',
  'app-core.js',
  'index.html',
  '.github/workflows/pages.yml'
];

const probes = {
  'workbook.js': ['PROJECT_SCHEMA', "titles=[", "results=[", "gate={"],
  'workflow-schema.js': ['RESPONSE_SCHEMA', '"intentStatements":', 'intentStatements:', 'candidateRequirements:', 'requirements:', 'STAGE_CONTRACTS', 'readCollections'],
  'workflow-engine.js': ['intentStatements', 'obligation', 'executionHandoff', 'operationalNextAction', 'stage===4', 'case 4'],
  'prompt-engine.js': ['PROMPT_ENGINE_VERSION', "1:'ONE-TIME", "3:'Research", "4:'Compile", 'STAGE 01 DOMAIN INTAKE ADAPTATION', 'function contextFor', 'function body', 'buildPromptRecord'],
  'response-ingestion.js': ['MISSING_INTENT', 'INVALID_INTENT', 'intentStatements', 'candidateRequirements', 'requirements', 'validateStage'],
  'project-store.js': ['closed-loop-project/2', 'human-project/30', 'migrate', 'PROJECT_SCHEMA'],
  'app-core.js': ['generated-prompt', 'expandable-prompt', 'Stage 04', 'intent file', 'stage-output'],
  'index.html': ['.prompt{', '.expandable-prompt', '#generated-prompt', 'test-runtime.js', 'worker-src'],
  '.github/workflows/pages.yml': ['verify-one-time-intent-intake', 'verify-prompt-semantics', 'verify-test-runtime', 'node verify']
};

function snippet(text, needle, radius = 1000) {
  const index = text.indexOf(needle);
  if (index < 0) return `NOT FOUND: ${needle}`;
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + needle.length + radius);
  return text.slice(start, end);
}

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  console.log(`\n===== ${file} (${text.length} chars) =====`);
  for (const needle of probes[file] || []) {
    console.log(`\n--- ${needle} ---\n${snippet(text, needle)}`);
  }
}

const current = fs.readFileSync('index.html', 'utf8');
let baseline = '';
try {
  baseline = execFileSync('git', ['show', 'c2381f08379ede6264cbaea77eaa11ecea7759ba:index.html'], { encoding: 'utf8' });
} catch (error) {
  console.log('\nBASELINE_FETCH_FAILED', String(error?.message || error));
}
const cssRule = (text, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`${escaped}\\{[^}]*\\}`));
  return match?.[0] || null;
};
console.log('\n===== VISUAL BASELINE COMPARISON =====');
for (const selector of ['.prompt', '.expandable-prompt', 'textarea', '.stage-output']) {
  const now = cssRule(current, selector);
  const before = cssRule(baseline, selector);
  console.log(JSON.stringify({ selector, identical: now === before, current: now, baseline: before }, null, 2));
}
