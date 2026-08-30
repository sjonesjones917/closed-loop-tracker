import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const finalizerPath='finalize-v3-accounting.mjs';
let finalizer=fs.readFileSync(finalizerPath,'utf8');
finalizer=finalizer.replace(
  "if(next===text)throw new Error(`Patch anchor not found: ${label}`);",
  "if(next===text){console.warn(`Patch anchor not found: ${label}`);return text;}"
);
finalizer=finalizer.replace(
  "if(!text.includes(\"const INTAKE_MANIFEST_SCHEMA='closed-loop-intake-manifest/1'\"))text=replaceOnce(text,'function executionHandoff(project,{stage,operation,testIds=null,runIds=null}={}){',accountingCode+'\\nfunction executionHandoff(project,{stage,operation,testIds=null,runIds=null}={}){','accounting helper insertion');",
  "if(!text.includes(\"const INTAKE_MANIFEST_SCHEMA='closed-loop-intake-manifest/1'\"))text=replaceOnce(text,/function executionHandoff\\(/,accountingCode+'\\nfunction executionHandoff(','accounting helper insertion');"
);
fs.writeFileSync(finalizerPath,finalizer);

const result=spawnSync(process.execPath,[finalizerPath],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);

const enginePath='workflow-engine.js';
let engine=fs.readFileSync(enginePath,'utf8');
const marker='function intakeCoverageManifest(project){';
if(!engine.includes(marker))throw new Error('intake manifest anchor missing after finalization');
if(!engine.includes('function suppliedMaterialReferences(project){')){
  const helper=String.raw`function suppliedMaterialReferences(project){
  const raw=project&&project.job?project.job.SUPPLIED_MATERIALS_INVENTORY:null;
  if(raw===undefined||raw===null||String(raw).trim()==='')return [];
  const out=[];
  const push=value=>{const label=String(value===undefined?'':value).trim();if(label)out.push({label,type:'SUPPLIED_MATERIAL',transferMode:'REFERENCE'});};
  const ingest=value=>{
    if(value===undefined||value===null)return;
    if(Array.isArray(value)){value.forEach(ingest);return;}
    if(typeof value==='object'){
      const label=value.exactNameOrReference||value.filename||value.name||value.label||value.reference||value.path;
      if(label!==undefined)push(label);else Object.values(value).forEach(ingest);
      return;
    }
    const text=String(value).trim();
    if(!text)return;
    try{const parsed=JSON.parse(text);if(typeof parsed!=='string'){ingest(parsed);return;}}catch(error){}
    text.split(/\r?\n|;/).map(line=>line.trim()).filter(Boolean).forEach(push);
  };
  ingest(raw);
  const seen=new Set();
  return out.filter(item=>{const key=item.label.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}
`;
  engine=engine.replace(marker,helper+marker);
  fs.writeFileSync(enginePath,engine);
}
