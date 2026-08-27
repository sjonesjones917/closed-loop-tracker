import fs from 'node:fs';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

const payload = [0, 1, 2, 3, 4, 5]
  .map((index) => fs.readFileSync(`.apply-payload/part${String(index).padStart(2, '0')}`, 'utf8').trim())
  .join('');
const runtimePath = '.closed-loop-apply-runtime.mjs';
fs.writeFileSync(runtimePath, zlib.gunzipSync(Buffer.from(payload, 'base64')));

try {
  await import(`${pathToFileURL(`${process.cwd()}/${runtimePath}`).href}?v=${Date.now()}`);

  let engine = fs.readFileSync('workflow-engine.js', 'utf8');
  const evidenceBefore = "function referencedEvidenceIds(result){return [...new Set([...safe(result?.evidenceRefs),...safe(result?.evidenceIds),...safe(recordValue(result,'EVIDENCE_ID'))].flat().map(String).filter(Boolean))];}";
  const evidenceAfter = "function referencedEvidenceIds(result){const direct=recordValue(result,'EVIDENCE_ID');return [...new Set([...safe(result?.evidenceRefs),...safe(result?.evidenceIds),...(Array.isArray(direct)?direct:direct?[direct]:[])].flat().map(String).filter(Boolean))];}";
  if (!engine.includes(evidenceBefore)) throw new Error('Expected direct-evidence normalization marker was not produced.');
  engine = engine.replace(evidenceBefore, evidenceAfter);

  const contaminationBefore = "if(!['NONE','FALSE','CLEAN','NOT CONTAMINATED'].includes(contaminationText(targetRun,context).trim()))reasons.push('Contamination is affirmative, unknown, or not explicitly clean.');";
  const contaminationAfter = "const contamination=contaminationText(targetRun,context).trim(),cleanContamination=/(^|\\s)(NONE|FALSE|CLEAN|NOT CONTAMINATED)(\\s|$)/.test(contamination)&&!/(^|\\s)(TRUE|YES|CONTAMINATED|UNKNOWN|PENDING|UNDETERMINED)(\\s|$)/.test(contamination);if(!cleanContamination)reasons.push('Contamination is affirmative, unknown, or not explicitly clean.');";
  if (!engine.includes(contaminationBefore)) throw new Error('Expected contamination normalization marker was not produced.');
  engine = engine.replace(contaminationBefore, contaminationAfter);

  fs.writeFileSync('workflow-engine.js', engine);
} finally {
  fs.rmSync(runtimePath, { force: true });
}
