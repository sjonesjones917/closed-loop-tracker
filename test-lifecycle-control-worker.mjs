import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
// Positive lifecycle controls execute their original exported functions with
// isolated module/VM state. Source bytes travel through stdin, never a shared file.
const [script,entry]=process.argv.slice(2);
const module=await import(pathToFileURL(path.resolve(script)).href);
const options=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(await module[entry](options)));
