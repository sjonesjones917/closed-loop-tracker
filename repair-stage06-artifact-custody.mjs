import fs from 'node:fs';

const enginePath='workflow-engine.js';
let text=fs.readFileSync(enginePath,'utf8');
const old=`      const unsupportedApplication=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='APPLICATION_DETERMINISTIC'&&!applicationTestSupported(test));
      if(unsupportedApplication.length)reasons.push(\`${'${unsupportedApplication.length}'} mandatory test definition(s) claim APPLICATION_DETERMINISTIC without a registered application-native executor.\`);
      // Stage 06 proves the verification definition is complete, not that future execution inputs already exist.
      // Exact byte readiness remains fail-closed in testExecutionPlan() at the execution stage.
      break;`;
const replacement=`      const unsupportedApplication=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='APPLICATION_DETERMINISTIC'&&!applicationTestSupported(test));
      if(unsupportedApplication.length)reasons.push(\`${'${unsupportedApplication.length}'} mandatory test definition(s) claim APPLICATION_DETERMINISTIC without a registered application-native executor.\`);
      // Stage 06 does not require future execution artifacts that have not yet been created.
      // It does fail closed when a mandatory test already binds an exact canonical artifact identity
      // and that known required artifact is missing or no longer application-verified.
      const planByTest=new Map(testExecutionPlan(project).items.map(item=>[item.testId,item]));
      const knownCustodyFailures=mandatoryTests.filter(test=>{
        const item=planByTest.get(recordId(test,'tests'));
        return item&&item.artifactIds.length>0&&!item.artifactReady;
      });
      if(knownCustodyFailures.length)reasons.push(\`${'${knownCustodyFailures.length}'} mandatory test definition(s) require exact artifact bytes that are missing or no longer application-verified.\`);
      break;`;
if(!text.includes(replacement)){
  const count=text.split(old).length-1;
  if(count!==1)throw new Error(`Expected exactly one Stage 06 gate block; found ${count}.`);
  text=text.replace(old,replacement);
  fs.writeFileSync(enginePath,text);
  console.log('Applied Stage 06 known-artifact custody gate correction.');
}else console.log('Stage 06 artifact-custody correction already present.');

const testPath='verify-complete.mjs';
let test=fs.readFileSync(testPath,'utf8');
const stale="  const p=project('JOB-BAD-REL'),stage=3,pr=prompt(p,stage);";
const current="  const p=project('JOB-BAD-REL');p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};const stage=3,pr=prompt(p,stage);";
if(!test.includes(current)){
  const count=test.split(stale).length-1;
  if(count!==1)throw new Error(`Expected exactly one stale Stage 03 fixture; found ${count}.`);
  test=test.replace(stale,current);
  fs.writeFileSync(testPath,test);
  console.log('Updated Stage 03 negative fixture to satisfy its Stage 02 prerequisite.');
}else console.log('Stage 03 prerequisite fixture already current.');
