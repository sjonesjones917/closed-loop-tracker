import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const verifiedSourceCommit='707ae8f767435cb8f810cedb5a2a3ae2ae04e202';
execFileSync('git',['fetch','origin','fix/mobile-replacement-state-20260827'],{stdio:'inherit'});
execFileSync('git',['checkout',verifiedSourceCommit,'--','app-core.js','verify-browser.mjs','verify-ingestion.mjs'],{stdio:'inherit'});

const path='index.html';
let text=fs.readFileSync(path,'utf8');
const oldHelp='<p>If research or requirements reveal a new human-only decision later, the agent may ask you then. That is expected; it must not guess.</p>';
const newHelp='<p>If research or requirements reveal a new human-only decision later, the agent may ask you then. That is expected; it must not guess. After you replace a rejected response, the status changes to <strong>Replacement not evaluated</strong> until you tap <em>Parse / validate response</em> again.</p>';
const first=text.indexOf(oldHelp),second=first<0?-1:text.indexOf(oldHelp,first+oldHelp.length);
if(first<0||second>=0)throw new Error('Expected one unchanged collapsed-help paragraph.');
text=text.slice(0,first)+newHelp+text.slice(first+oldHelp.length);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const manifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeIdentity=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
const tokens=[...text.matchAll(/runtime-[0-9a-f]{16}/g)].map(match=>match[0]);
if(tokens.length!==runtimeFiles.length||new Set(tokens).size!==1)throw new Error(`Unexpected runtime token set: ${tokens.join(', ')}`);
text=text.replaceAll(tokens[0],runtimeIdentity);
fs.writeFileSync(path,text);

for(const [file,needles] of [
  ['app-core.js',['Replacement not evaluated.','replacement not evaluated']],
  ['verify-browser.mjs',['Edited replacement text must stop presenting the prior rejection as the current response state.']],
  ['verify-ingestion.mjs',['JOB-SMART-QUOTE-JSON','JSON_TYPOGRAPHY_NORMALIZED','Exact smart-quoted raw response was not preserved unchanged.']],
  ['index.html',['After you replace a rejected response','Replacement not evaluated']]
]){
  const value=fs.readFileSync(file,'utf8');
  for(const needle of needles)if(!value.includes(needle))throw new Error(`${file}: missing ${needle}`);
}
