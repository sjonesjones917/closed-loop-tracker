import fs from 'node:fs';

const RULESET = 'external-authority-first-2026-08-22-r5-state-replay';
const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['app-v13-candidate1.html', 'app-v13.html'];

const replaceBetween = (text, start, end, replacement) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`Patch anchor missing: ${start} / ${end}`);
  return text.slice(0, a) + replacement + text.slice(b);
};

const sourceOf = (fn, name) => fn.toString().replace(/^function\s+\w+/, `function ${name}`);

function generatedResetProjectFrom(p, n, reason) {
  const start = Math.max(1, Math.min(31, Number(n) || 1));
  for (let i = start - 1; i < 31; i += 1) p.stages[i] = newStage(i);
  p.artifact = '';
  p.artifactName = 'released-artifact.txt';
  p.releaseDecision = 'UNSET';
  p.auditedHash = '';
  p.releaseHash = '';
  p.revalidation = {
    ruleset: PROJECT_REPLAY_RULESET,
    at: now(),
    invalidatedFromStage: start,
    reason: String(reason || 'Stored completion did not satisfy the current validation rules.')
  };
  p.updatedAt = p.revalidation.at;
  return p;
}

function generatedReplayProject(input) {
  if (!input || input.schemaVersion !== 13 || !input.projectId || !input.jobId || !Array.isArray(input.stages) || input.stages.length !== 31) {
    throw Error('Not a valid v13 project export.');
  }
  const p = JSON.parse(JSON.stringify(input));
  p.stages = p.stages.map((value, i) => {
    const stage = value && typeof value === 'object' ? value : {};
    const producers = Array.isArray(stage.producers) ? stage.producers.slice(0, 10) : [];
    const verifiers = Array.isArray(stage.verifiers) ? stage.verifiers.slice(0, 10) : [];
    while (producers.length < 10) producers.push('');
    while (verifiers.length < 10) verifiers.push('');
    return { ...newStage(i), ...stage, number: i + 1, producers, verifiers };
  });

  let firstIncomplete = 0;
  for (let n = 1; n <= 3; n += 1) {
    const stage = p.stages[n - 1];
    if (stage.status !== 'COMPLETE') {
      firstIncomplete = n;
      break;
    }
    try {
      validateStandard(p, n, stage.response);
    } catch (error) {
      const reason = `Stage ${n} replay validation failed: ${error.message}`;
      return { project: resetProjectFrom(p, n, reason), invalidatedFrom: n, reason };
    }
  }

  if (firstIncomplete && p.stages.slice(firstIncomplete).some((stage) => stage.status === 'COMPLETE')) {
    const reason = `Non-contiguous imported completion detected after Stage ${firstIncomplete}.`;
    return { project: resetProjectFrom(p, firstIncomplete, reason), invalidatedFrom: firstIncomplete, reason };
  }
  return { project: p, invalidatedFrom: 0, reason: '' };
}

function generatedLoad() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
    const source = Array.isArray(stored) ? stored : [];
    let invalidated = 0;
    let dropped = 0;
    projects = source.map((input) => {
      try {
        const replay = replayProject(input);
        if (replay.invalidatedFrom) invalidated += 1;
        return replay.project;
      } catch (_) {
        dropped += 1;
        return null;
      }
    }).filter(Boolean);
    selected = localStorage.getItem(SEL) || null;
    if (selected && !projects.some((p) => p.projectId === selected)) selected = null;
    if (invalidated || dropped) save();
    const suffix = invalidated || dropped
      ? ` Current-rule replay reset ${invalidated} obsolete project${invalidated === 1 ? '' : 's'} and rejected ${dropped} malformed record${dropped === 1 ? '' : 's'}.`
      : '';
    setStatus(`Ready. ${projects.length} project${projects.length === 1 ? '' : 's'} stored on this browser.${suffix}`, Boolean(invalidated || dropped));
  } catch (e) {
    storageOK = false;
    projects = [];
    selected = null;
    setStatus('Persistent storage is unavailable in this browser context. The app remains usable, but export the project before closing.', true);
  }
}

function generatedImportProjectObject(input, options = {}) {
  const replay = replayProject(input);
  if (options.requireFullyValid && replay.invalidatedFrom) {
    throw Error(`${options.source || 'Published self-project'} rejected by current replay validation at Stage ${replay.invalidatedFrom}: ${replay.reason}`);
  }
  const p = replay.project;
  if (projects.some((x) => x.projectId === p.projectId)) projects = projects.filter((x) => x.projectId !== p.projectId);
  projects.unshift(p);
  selected = p.projectId;
  save();
  setStatus(
    replay.invalidatedFrom
      ? `Imported ${p.name}; obsolete completion was reset from Stage ${replay.invalidatedFrom}. ${replay.reason}`
      : `Imported ${p.name}.`,
    Boolean(replay.invalidatedFrom)
  );
  render();
  return p;
}

async function generatedLoadSelfProject(manual = false) {
  try {
    const r = await fetch(SELF_PROJECT_PATH, { cache: 'no-store' });
    if (!r.ok) {
      if (manual) throw Error(`Verified self-project export unavailable (${r.status}).`);
      return false;
    }
    importProjectObject(await r.json(), { requireFullyValid: true, source: 'Published self-project' });
    if (manual) show('workflow');
    return true;
  } catch (e) {
    if (manual || /rejected by current replay validation/i.test(String(e.message || e))) setStatus(e.message, true);
    return false;
  }
}

for (const file of targets) {
  if (!fs.existsSync(file)) throw new Error(`${file} does not exist.`);
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes('const PROJECT_REPLAY_RULESET=') || !text.includes(RULESET)) {
    text = replaceBetween(
      text,
      'function load(){',
      'function save(){',
      `const PROJECT_REPLAY_RULESET=${JSON.stringify(RULESET)};${sourceOf(generatedResetProjectFrom, 'resetProjectFrom')}\n${sourceOf(generatedReplayProject, 'replayProject')}\n${sourceOf(generatedLoad, 'load')}\n`
    );
    text = replaceBetween(
      text,
      'function importProjectObject(p){',
      "$('newBtn').onclick=",
      `${sourceOf(generatedImportProjectObject, 'importProjectObject')}\n`
    );
    text = replaceBetween(
      text,
      'async function loadSelfProject(manual=false){',
      "$('loadVerifiedBtn').onclick=",
      `${sourceOf(generatedLoadSelfProject, 'loadSelfProject')};`
    );
  }

  const required = [
    'const PROJECT_REPLAY_RULESET=',
    RULESET,
    'function replayProject(input)',
    'Stage ${n} replay validation failed',
    'obsolete completion was reset from Stage',
    "requireFullyValid: true, source: 'Published self-project'"
  ];
  for (const token of required) if (!text.includes(token)) throw new Error(`${file} missing state-replay token: ${token}`);
  if (/function importProjectObject\(p\)\{if\(!p\|\|p\.schemaVersion!==13/.test(text)) {
    throw new Error(`${file} still trusts imported completion flags without replay.`);
  }
  fs.writeFileSync(file, text);
  console.log(JSON.stringify({ file, bytes: Buffer.byteLength(text), ruleset: RULESET, patched: true }));
}
