import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const partDir='.authoritative-patch-payload';
const payload=fs.readdirSync(partDir).filter(name=>/^part-\d+\.txt$/.test(name)).sort().map(name=>fs.readFileSync(path.join(partDir,name),'utf8').trim()).join('');
const expected={"README.md":"4b0f8990a1842219c3b01f9cc8aa5b7e56f50fd1c674322a8a919d2ce291f00b","attach-self-project.mjs":"c4212b90594ba8801b7742f83a972f2e12a419218523e0b855eed5cca0a9cc74","migrate-self-project.mjs":"cc9c8c635310b1d3cc3f7b9e54873e7185d24815cdbd5bf4ee49983e50f557b1","verify-app.mjs":"9e36df609afb9dcbe2a0cb3d61008da0a057e2e82116087818e916b184300475","verify-self-project.mjs":"e432854eef87e85002302fc3d87a8307a7219e9fb6f0f5027be34610875f9aa4","browser-smoke.mjs":"0838da6adf5c97d43de684701ef8f59521eac77e605903f356ada8354683088e",".github/workflows/pages.yml":"3b31b6b67a8aadadba819ae9d79a8698f7e47a44383a449ca981324513ffdf60"};
const files=JSON.parse(zlib.gunzipSync(Buffer.from(payload,'base64')).toString('utf8'));
for(const [name,content] of Object.entries(files)){
  const dir=path.dirname(name);if(dir!=='.')fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(name,content,'utf8');
  const actual=crypto.createHash('sha256').update(Buffer.from(content,'utf8')).digest('hex');
  if(actual!==expected[name])throw new Error(`Patch hash mismatch for ${name}: ${actual} != ${expected[name]}`);
}
for(const obsolete of ['.github/workflows/rebuild-retained-project-once.yml','.github/workflows/repair-current.yml','complete-final-correction.mjs','minimal-project-correction.mjs','SELF_PROJECT_REBUILD_FAILURE.log']){
  if(fs.existsSync(obsolete))fs.rmSync(obsolete,{force:true});
}
console.log(JSON.stringify({status:'PASS',files:Object.keys(files),removedObsoleteCorrectionPaths:true},null,2));
