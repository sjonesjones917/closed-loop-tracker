import fs from 'node:fs';

const path='verify-full-cycle.mjs';
let source=fs.readFileSync(path,'utf8');
const oldText="OBSERVATIONS:'No defects'";
const newText="OBSERVATIONS:JSON.stringify({requiredPageOrViewIds:[],inspectedPageOrViewIds:[],requiredPackagedFileIds:[],openedOrTestedPackagedFileIds:[],requiredTransformationIds:['DIRECT_PRODUCT_BYTES'],inspectedTransformationIds:['DIRECT_PRODUCT_BYTES'],observation:'No defects'})";
const first=source.indexOf(oldText);
if(first<0)throw new Error('Stage 25 legacy prose fixture was not found.');
if(source.indexOf(oldText,first+oldText.length)>=0)throw new Error('Stage 25 legacy prose fixture is not unique.');
source=source.slice(0,first)+newText+source.slice(first+oldText.length);
fs.writeFileSync(path,source);
console.log(JSON.stringify({acceptanceEpochCorrection:'STAGE25_STRICT_COVERAGE_FIXTURE',file:path}));
