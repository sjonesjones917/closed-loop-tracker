import fs from 'node:fs';

const appPath='app-core.js';
const regressionPath='verify-file-first-operator.mjs';
let app=fs.readFileSync(appPath,'utf8');
const oldDecl='const operationSelection={},runSelection={};';
const newDecl='const operationSelection={},runSelection={},responseFileSelection={};';
if(app.includes(newDecl)){
  console.log('app-core response-file selection state already declared');
}else{
  if((app.match(new RegExp(oldDecl.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length!==1)throw new Error('Expected exactly one app-core selection-state declaration target.');
  if(!app.includes('responseFileSelection[current.activeStage]=file'))throw new Error('The file-first UI no longer has the expected response-file change path.');
  app=app.replace(oldDecl,newDecl);
  fs.writeFileSync(appPath,app);
}

let regression=fs.readFileSync(regressionPath,'utf8');
const anchor="  assert.match(appSource,/id=\"response-json-file\"[^>]*type=\"file\"[^>]*accept=\"[^\"]*(?:application\\/json|\\.json)/,'The normal external-response path must expose the authoritative JSON file selector.');\n";
const assertion="  assert.match(appSource,/const operationSelection=\\{\\},runSelection=\\{\\},responseFileSelection=\\{\\};/,'The file-first UI must retain declared response-file selection state before wiring change and process handlers.');\n";
if(!regression.includes(assertion)){
  if(!regression.includes(anchor))throw new Error('Permanent file-first regression insertion anchor is missing.');
  regression=regression.replace(anchor,anchor+assertion);
  regression=regression.replace("assert.throws(()=>verify({appSource:app.replace('id=\"response-json-file\" type=\"file\"','id=\"response-json-file\" type=\"text\"')}),/authoritative JSON file selector/);", "assert.throws(()=>verify({appSource:app.replace('id=\"response-json-file\" type=\"file\"','id=\"response-json-file\" type=\"text\"')}),/authoritative JSON file selector/);\nassert.throws(()=>verify({appSource:app.replace('const operationSelection={},runSelection={},responseFileSelection={};','const operationSelection={},runSelection={};')}),/declared response-file selection state/);");
  regression=regression.replace('mutationsDetected:6','mutationsDetected:7');
  fs.writeFileSync(regressionPath,regression);
}
