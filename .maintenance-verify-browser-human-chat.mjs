import fs from 'node:fs';

const path = 'verify-browser.mjs';
const oldText = " await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start with one thing: save the verbatim job request','one structured HUMAN_INPUT_REQUIRED response','STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);assert(!text.includes('plain-language questions before final JSON'),'Stage 01 UI still advertises the contradictory conversational-before-JSON path.');";
const newText = " await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start with one thing: save the verbatim job request','answer any short plain-language questions in that same chat',\"Paste only the agent's final JSON response\",'STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);for(const legacy of ['one structured HUMAN_INPUT_REQUIRED response','then record the answer in User Job Input and regenerate this instruction'])assert(!text.includes(legacy),`Stage 01 UI still advertises the legacy machine-first path: ${legacy}.`);";
let text = fs.readFileSync(path, 'utf8');
const first = text.indexOf(oldText);
if (first < 0) throw new Error('Stale Stage 01 browser assertion was not found.');
if (text.indexOf(oldText, first + oldText.length) >= 0) throw new Error('Stale Stage 01 browser assertion was not unique.');
text = text.slice(0, first) + newText + text.slice(first + oldText.length);
fs.writeFileSync(path, text);
