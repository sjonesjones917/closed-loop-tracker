import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replaceOnce(text,from,to,label){const count=text.split(from).length-1;if(count!==1)throw new Error(`${label}: expected exactly one match, found ${count}`);return text.replace(from,to);}

let app=read('app-core.js');
app=replaceOnce(
  app,
  "function evidenceExplanationMarkup(n){if(n!==29)return '';const chains=engine.constructEvidenceChains(current),rows=chains.map(chain=>engine.explainEvidenceChain(current,chain));",
  "function evidenceExplanationMarkup(n){if(n!==29)return '';const chains=safe(current.projectData.evidenceChains).filter(item=>item?.active!==false&&!item?.invalidatedBy),rows=chains.map(chain=>engine.explainEvidenceChain(current,chain));",
  'Stage 29 rendering must be read-only'
);
write('app-core.js',app);

let semantics=read('verify-prompt-semantics.mjs');
if(!semantics.includes('stage29RenderingReadOnly:true')){
  semantics += `\n// Stage 29 explanation rendering is read-only: canonical evidence-chain construction remains engine-owned.\n{\n  const ui=fs.readFileSync('app-core.js','utf8');\n  if(/function evidenceExplanationMarkup\\([^)]*\\)\\{[^}]*constructEvidenceChains\\(/s.test(ui))throw new Error('Stage 29 rendering performs canonical evidence-chain construction.');\n  console.log(JSON.stringify({stage29RenderingReadOnly:true},null,2));\n}\n`;
}
write('verify-prompt-semantics.mjs',semantics);
console.log('Final Stage 29 read-only rendering hardening applied.');
