import fs from 'node:fs';

const file='spec-v3-repair.mjs';
let source=fs.readFileSync(file,'utf8');

function protectTemplate(constant,nextMarker){
  const startToken=`const ${constant}=String.raw\``;
  const start=source.indexOf(startToken);
  if(start<0)throw new Error(`Missing ${constant} template.`);
  const bodyStart=start+startToken.length;
  const next=source.indexOf(nextMarker,bodyStart);
  if(next<0)throw new Error(`Missing end marker for ${constant}.`);
  const end=source.lastIndexOf('`;',next);
  if(end<bodyStart)throw new Error(`Missing closing template for ${constant}.`);
  const body=source.slice(bodyStart,end).replaceAll('${','__CL_DOLLAR_OPEN__');
  source=source.slice(0,bodyStart)+body+"`.replaceAll('__CL_DOLLAR_OPEN__','${');"+source.slice(end+2);
}

protectTemplate('runtimeSource','const workerSource=String.raw`');
protectTemplate('verifier','function addVerifier()');
source=source.replace('const diff=Math.abs(actual-expected),absolute=step.absoluteTolerance??0,relative=step.relativeTolerance??0*Math.max(Math.abs(actual),Math.abs(expected));','const diff=Math.abs(actual-expected),absolute=step.absoluteTolerance??0,relative=(step.relativeTolerance??0)*Math.max(Math.abs(actual),Math.abs(expected));');
fs.writeFileSync(file,source);
await import('./spec-v3-repair.mjs');
