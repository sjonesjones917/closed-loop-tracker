import fs from 'node:fs';

function replaceExactlyOnce(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one repair target; found ${count}.`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceExactlyOnce(
  'workflow-engine.js',
  "evaluation.reasons.some(reason=>reason.includes('independence is not application-established'))",
  'evaluation.reasons.some(reason=>/\\bindependence\\b/i.test(reason))',
  'Stage 12 authoritative independence gate'
);

const verifierPath = 'verify-independent-run-verification.mjs';
let verifier = fs.readFileSync(verifierPath, 'utf8');
const completionMarker = "console.log(JSON.stringify({controllerStage:'16',applicationStage:'12',independentVerification:'PASS'";
if ((verifier.split(completionMarker).length - 1) !== 1) throw new Error('Stage 16 verifier completion marker is not unique.');
const authoritativeMatrixRegression = "setField(first,'VERIFIER_CONTEXT_ID',generatorContextId);matrix=engine.verificationMatrix(p,iterationId);assert(matrix.invalid.some(r=>engine.recordId(r,'verification')===first.id),'Authoritative Stage 12 matrix accepted generator/verifier context reuse.');setField(first,'VERIFIER_CONTEXT_ID','CONTEXT-STAGE16-VERIFY-1');matrix=engine.verificationMatrix(p,iterationId);assert(matrix.invalid.length===0,'Authoritative Stage 12 matrix did not recover after generator/verifier reuse repair.');setField(v2,'AUTHORIZED_PROJECT_INPUTS',['target run','other verifier determination','Stage 13 comparison','root cause','proposed correction']);matrix=engine.verificationMatrix(p,iterationId);assert(matrix.invalid.some(r=>engine.recordId(r,'verification')===second.id),'Authoritative Stage 12 matrix accepted prohibited verifier-context leakage.');setField(v2,'AUTHORIZED_PROJECT_INPUTS',['target run','target requirement','target test']);matrix=engine.verificationMatrix(p,iterationId);assert(matrix.invalid.length===0&&matrix.coverage===1,'Authoritative Stage 12 matrix did not recover after prohibited-context repair.');\n";
verifier = verifier.replace(completionMarker, authoritativeMatrixRegression + completionMarker);
fs.writeFileSync(verifierPath, verifier);

const residualPath = 'verify-spec-residual-closure.mjs';
let residual = fs.readFileSync(residualPath, 'utf8');
const binding = "await import('./verify-independent-run-verification.mjs');";
if (!residual.includes(binding)) {
  const anchor = "await import('./verify-ten-independent-runs.mjs');";
  if ((residual.split(anchor).length - 1) !== 1) throw new Error('Stage 15 proof-chain anchor is not unique.');
  residual = residual.replace(anchor, `${anchor}\n${binding}`);
  fs.writeFileSync(residualPath, residual);
}

fs.rmSync('.github/workflows/controller2-stage16-authoritative-matrix.yml', { force: true });
fs.rmSync('repair-controller-stage16.mjs', { force: true });
console.log(JSON.stringify({controllerStage:16, repair:'APPLIED', responsibleLayer:'Stage 12 authoritative verification matrix'}));
