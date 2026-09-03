import fs from 'node:fs';

const schemaPath='workflow-schema.js';
let source=fs.readFileSync(schemaPath,'utf8');
const before="agentWritableCollections:Object.freeze([...(EXTERNAL_AGENT_WRITES[key]||base?.agentWritableCollections||[])])";
const after="agentWritableCollections:Object.freeze([...(base?.agentWritableCollections||[])])";
if(!source.includes(before))throw new Error('Expected external-agent narrowing expression not found.');
source=source.replace(before,after);
fs.writeFileSync(schemaPath,source);

const oraclePath='verify-spec-grounded-route-oracle.mjs';
let oracle=fs.readFileSync(oraclePath,'utf8');
if(!oracle.includes('const NON_AGENT_WRITE_OPS=')){
  const expectedStart='const expected=(s,o)=>{';
  if(!oracle.includes(expectedStart))throw new Error('Route oracle expected() function not found.');
  oracle=oracle.replace(expectedStart,'const legacyExpected=(s,o)=>{');
  const stateAnchor='\n\nconst state=';
  if(!oracle.includes(stateAnchor))throw new Error('Route oracle state anchor not found.');
  const closure=`\nconst NON_AGENT_WRITE_OPS=new Set([\n  '10:FREEZE','17:FREEZE','18:COMPLETE','19:CONFIRM_FREEZE','19:CONFIRM','20:FREEZE_BASELINE',\n  '22:RUN_NATIVE_TESTS','24:RUN_NATIVE_ATTACKS','25:FREEZE_DELIVERY_CANDIDATE',\n  '27:CALCULATE_RELEASE','28:VERIFY_IDENTITY','28:CAPTURE_DELIVERY_INTENT',\n  '29:CALCULATE_EVIDENCE_CHAINS','30:CALCULATE_TERMINAL',\n  '30:EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','30:RECORD_DELIVERY_EVIDENCE'\n]);\nconst expected=(s,o)=>{const x=legacyExpected(s,o);return NON_AGENT_WRITE_OPS.has(String(s)+':'+String(o))?{...x,w:[]}:x;};\n`;
  oracle=oracle.replace(stateAnchor,closure+stateAnchor);
  fs.writeFileSync(oraclePath,oracle);
}
