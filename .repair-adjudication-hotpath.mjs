import fs from 'node:fs';

const enginePath='workflow-engine.js';
let source=fs.readFileSync(enginePath,'utf8');
const start=source.indexOf('function adjudicatedClone(project){');
const end=source.indexOf('\nfunction validateTraceIntegrity',start);
if(start<0||end<0)throw new Error('adjudicatedClone boundary not found');
const replacement=`function adjudicatedClone(project){
  const collections=['verification','deterministicResults','meaningResults','adversarialResults','representationInspections','preflightRecords','confirmationRecords','processAudits','productAudits','regressionExecutions','products'];
  const copy={...project,job:{...(project?.job||{})},release:{...(project?.release||{})},stages:{...(project?.stages||{})},projectData:{...(project?.projectData||{})}};
  for(const collection of collections)copy.projectData[collection]=safe(project?.projectData?.[collection]).map(record=>clone(record));
  for(const collection of collections)for(const r of records(copy,collection)){const test=testForResult(copy,r),d=effectiveDetermination(collection,r,test,copy);if(collection==='processAudits')recordFields(r).PROCESS_DETERMINATION=d;else if(collection==='productAudits')recordFields(r).PRODUCT_DETERMINATION=d;else if(collection==='regressionExecutions'){const phase=upper(recordValue(r,'PHASE'));recordFields(r).RESULT=phase==='PRE_CORRECTION'?(d==='SATISFIED'?'VIOLATED':d==='VIOLATED'?'SATISFIED':'UNDETERMINED'):d;}else if(collection==='products')recordFields(r).STATUS=d==='SATISFIED'?'COMPLETED':d==='VIOLATED'?'FAILED':'BLOCKED';else recordFields(r).DETERMINATION=d;}
  return copy;
}`;
source=source.slice(0,start)+replacement+source.slice(end);
fs.writeFileSync(enginePath,source);

const testPath='verify-semantic-invariant.mjs';
let test=fs.readFileSync(testPath,'utf8');
const marker="const proof={semanticFalseAcceptanceInvariant:true,conclusionBearingCollections:cases.length,releaseGradeIndependence:true,traceIntegrity:true,centralAdjudication:true};";
if(!test.includes(marker))throw new Error('semantic proof insertion marker not found');
const guard=`// Gate adjudication must not serialize the entire project on every recalculation stage.\nconst adjudicationHotPath=source.slice(source.indexOf('function adjudicatedClone(project){'),source.indexOf('\\nfunction validateTraceIntegrity',source.indexOf('function adjudicatedClone(project){')));\nassert(adjudicationHotPath&&!adjudicationHotPath.includes('clone(project)'),'Gate adjudication still deep-clones the entire project');\nassert(adjudicationHotPath.includes('projectData:{...(project?.projectData||{})}'),'Gate adjudication does not use a shallow project-data view');\nassert(adjudicationHotPath.includes('map(record=>clone(record))'),'Gate adjudication does not isolate only conclusion-bearing records before rewriting effective determinations');\nfor(const unrelated of ['rawResponses','generatedPrompts','history','responseProposals'])assert(!adjudicationHotPath.includes('copy.projectData['+JSON.stringify(unrelated)+']'),'Gate adjudication clones unrelated large provenance collection '+unrelated);\n\n`;
test=test.replace(marker,guard+marker);
fs.writeFileSync(testPath,test);
