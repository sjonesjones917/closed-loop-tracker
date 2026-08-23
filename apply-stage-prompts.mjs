import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const dir='apply-stage-prompts-runtime';
const files=fs.readdirSync(dir).filter(name=>/^part-\d+\.txt$/.test(name)).sort();
if(!files.length)throw new Error('No apply-stage-prompts runtime parts were found.');
const source=files.map(name=>fs.readFileSync(`${dir}/${name}`,'utf8')).join('');
const generated='.apply-stage-prompts.generated.mjs';
fs.writeFileSync(generated,source);
try{await import(`${pathToFileURL(`${process.cwd()}/${generated}`).href}?run=${Date.now()}`)}finally{fs.rmSync(generated,{force:true})}
