import fs from 'node:fs';

const app=fs.readFileSync('app-core.js','utf8');
const ingestion=fs.readFileSync('response-ingestion.js','utf8');

function assert(condition,message){if(!condition)throw new Error(message);}

assert(/id=["']stage-response-file["']/.test(app),'The normal external-response path must expose a response JSON file selector.');
assert(/type=["']file["']/.test(app)&&/accept=["'][^"']*(application\/json|\.json)/.test(app),'The authoritative response selector must be a JSON file control.');
assert(/SELECT_RESPONSE_JSON_FILE/.test(app),'The operator UI must expose the SELECT_RESPONSE_JSON_FILE action.');
assert(!/Paste only the final strict JSON/i.test(app),'The normal operator path still instructs the user to paste final JSON.');
assert(!/PASTE_FINAL_JSON/.test(app),'PASTE_FINAL_JSON must not remain a primary structured action type.');
assert(/captureRaw(File|Bytes)/.test(ingestion),'Response ingestion must provide a raw-byte/file capture entry point.');
assert(/arrayBuffer|Uint8Array|byteLength/.test(ingestion),'Authoritative response capture must operate on selected file bytes before parsing.');
assert(/rawResponseSha256/.test(ingestion),'Authoritative response capture must bind the preserved response to its byte digest.');
assert(!/captureRaw\([^)]*text[^)]*\)/s.test(app),'The normal UI must not feed pasted response text directly into canonical raw capture.');

console.log(JSON.stringify({fileFirstOperatorPath:'PASS',responseFileSelector:true,pasteNotRequired:true,rawBytesCapturedBeforeParse:true},null,2));
