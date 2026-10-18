import os from 'node:os';import path from 'node:path';
import fs from 'node:fs';import assert from 'node:assert/strict';import {fileFirstComponentFailure,validateFileFirstComponents,isComponentInfrastructureFailure,isComponentProcessingFailure,settleFileFirstComponent} from './test-file-first-components.mjs';import {runVerifier,detectedFault} from './verify-conformance-regressions.mjs';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'file-first-component-results-'));
const oracle='CONTROLLED_COMPONENT_ORACLE';const base={outcome:'FAIL',status:1,error:null,signal:null,reason:null,stderr:'AssertionError [ERR_ASSERTION]: '+oracle};const cases=[];
for(const [name,changes,expected] of [['assertion',{},true],['error',{stderr:'Error: '+oracle},true],['type-error',{stderr:'TypeError: '+oracle},false],['reference-error',{stderr:'ReferenceError: '+oracle},false],['timeout',{outcome:'TIMEOUT',reason:'TIMEOUT'},false],['signal',{signal:'SIGTERM'},false],['execution-error',{error:{code:'EFAIL'}},false],['wrong-exit',{status:2},false]]){
 const r={...base,...changes},error=fileFirstComponentFailure(r);const observed=detectedFault({status:1,stderr:error.stack,outcome:'FAIL'},oracle);assert.equal(observed,expected,name);cases.push({name,expected,observed});
}
const actual=await runVerifier(process.execPath,['--input-type=module','-e',"console.error('AssertionError [ERR_ASSERTION]: CONTROLLED_COMPONENT_ORACLE');setInterval(()=>{},1000)"],{timeout:300,evidenceDirectory:path.join(directory,'children')});assert.equal(actual.outcome,'TIMEOUT');assert.equal(detectedFault({status:1,outcome:'FAIL',stderr:fileFirstComponentFailure(actual).stack},oracle),false);cases.push({name:'actual-timeout-after-oracle',outcome:actual.outcome,expected:false,observed:false,evidencePath:actual.evidencePath});

const pass={outcome:'PASS',status:0,stderr:''};
for(const bad of [{...base,outcome:'TIMEOUT',reason:'TIMEOUT'},{...base,stderr:'TypeError: '+oracle},{...base,reportError:'bad report'}]){
 let caught;try{validateFileFirstComponents([base,pass,pass,bad]);}catch(error){caught=error;}
 assert(caught);assert.equal(detectedFault({status:1,outcome:'FAIL',stderr:caught.stack},oracle),false);
}


assert.equal(isComponentInfrastructureFailure(pass),false);
assert.equal(isComponentInfrastructureFailure(base),false);
for(const bad of [{...base,outcome:'TIMEOUT',reason:'TIMEOUT'},{...base,stderr:'TypeError: '+oracle},{...base,reportError:'invalid JSON'}])assert.equal(isComponentInfrastructureFailure(bad),true);
const invalidDirectory=path.join(directory,'not-a-directory');fs.writeFileSync(invalidDirectory,'controlled evidence path failure');
let supervisionError;try{await runVerifier(process.execPath,['-e',"throw new Error('must not launch')"],{timeout:300,evidenceDirectory:invalidDirectory});}catch(error){supervisionError=error;}
assert(supervisionError);assert.equal(supervisionError.name,'Error');assert.equal(isComponentProcessingFailure(supervisionError,undefined),true);
assert.equal(isComponentProcessingFailure(new assert.AssertionError({message:oracle}),base),false);
const rejectedComponent=await settleFileFirstComponent(Promise.reject(supervisionError));
assert.equal(isComponentInfrastructureFailure(rejectedComponent),true);
assert.equal(detectedFault({status:1,outcome:'FAIL',stderr:fileFirstComponentFailure(rejectedComponent).stack},oracle),false);
const nested=fileFirstComponentFailure({...base,outcome:'TIMEOUT',reason:'TIMEOUT'});
let nestedCaught;try{validateFileFirstComponents([base,pass,pass,{outcome:'FAIL',status:1,stderr:nested.stack}]);}catch(error){nestedCaught=error;}
assert(nestedCaught);assert.equal(detectedFault({status:1,outcome:'FAIL',stderr:nestedCaught.stack},oracle),false);
fs.writeFileSync(path.join(directory,'proof.json'),JSON.stringify({outcome:'PASS',cases,siblingInfrastructureDominates:true,nestedInfrastructureDominates:true,actualSupervisorRejectionClassified:true,nestedSupervisorRejectionSettled:true},null,2));

console.log(fs.readFileSync(path.join(directory,'proof.json'),'utf8'));
