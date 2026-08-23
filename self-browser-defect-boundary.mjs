import fs from 'node:fs';

const path = 'self-browser-e2e.mjs';
const oldAssertion = "assert.ok(!candidateHtml.includes('SELF_VERIFIED_PROJECT.json'),'The first candidate must contain the real sidecar filename defect.');\nassert.ok(candidateHtml.includes('SELF_VERIFIED_PROJEC.json'),'The first candidate defect is not present.');\nassert.ok(finalHtml.includes('SELF_VERIFIED_PROJECT.json'),'The corrected app must use the exact sidecar filename.');";
const newAssertion = "assert.doesNotMatch(candidateHtml,/const SELF_PROJECT_PATH=\\\"SELF_VERIFIED_PROJECT\\.json\\\";/,'The first candidate sidecar path is already corrected, so the required defect is absent.');\nassert.match(candidateHtml,/const SELF_PROJECT_PATH=\\\"SELF_VERIFIED_PROJEC\\.json\\\";/,'The first candidate does not contain the required misspelled sidecar path defect.');\nassert.match(finalHtml,/const SELF_PROJECT_PATH=\\\"SELF_VERIFIED_PROJECT\\.json\\\";/,'The corrected app does not use the exact sidecar path.');";
let source = fs.readFileSync(path, 'utf8');
if (source.includes(oldAssertion)) source = source.replace(oldAssertion, newAssertion);
else if (!source.includes(newAssertion)) throw new Error('Candidate-defect assertion patch anchor is missing.');
fs.writeFileSync(path, source);
console.log(JSON.stringify({status:'PATCHED',file:path,defectField:'SELF_PROJECT_PATH',candidate:'SELF_VERIFIED_PROJEC.json',corrected:'SELF_VERIFIED_PROJECT.json'}));
