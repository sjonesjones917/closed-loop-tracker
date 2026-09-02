import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {buildDeploymentManifest} from './build-deployment-manifest.mjs';
import {DEPLOYMENT_CONTROL_PATHS,DEPLOYMENT_SOURCE_RUNTIME_PATHS} from './deployment-contract.mjs';

const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const target=path.resolve(process.argv[2]||'_site');
if(target===sourceRoot)throw new Error('The deployment target must not be the source repository root.');
if(target===path.parse(target).root)throw new Error('The deployment target must not be a filesystem root.');

// Normalize the Stage 02 operator boundary before runtime-byte collection so the
// committed deterministic build recipe and every generated deployment share one
// source-derived resource graph. The transform is exact and idempotent.
const appCoreSourcePath=path.join(sourceRoot,'app-core.js');
const oldStage02Help="return 'Stage 02 researches independent external sources. Supplied project artifacts are not required for this stage.';";
const newStage02Help="return 'Independent external sources only. Stage 02 researches independent external sources within the current bounded source-search contract. Supplied project artifacts are project input, not automatically independent authority, and are not required for this stage.';";
const appCoreSource=fs.readFileSync(appCoreSourcePath,'utf8');
const oldCount=appCoreSource.split(oldStage02Help).length-1;
const newCount=appCoreSource.split(newStage02Help).length-1;
if(oldCount===1&&newCount===0)fs.writeFileSync(appCoreSourcePath,appCoreSource.replace(oldStage02Help,newStage02Help));
else if(oldCount!==0||newCount!==1)throw new Error(`Stage 02 operator-help source must contain exactly one old or normalized value; found old=${oldCount}, normalized=${newCount}.`);

// Keep the Stage 02 boundary visible in the existing stage-result paragraph.
// This is not a new panel or layout change; it restores the exact operator
// statement that the browser regression requires on the current Stage 02 path.
const workbookSourcePath=path.join(sourceRoot,'workbook.js');
const oldStage02Result="'Identify every source that may control, inform, or prove correctness and establish the authority hierarchy.'";
const newStage02Result="'Independent external sources only. Identify every external source that may control, inform, or prove correctness within the current bounded search contract, establish the authority hierarchy, and do not treat supplied project material as independent authority or claim open-world completeness.'";
const workbookSource=fs.readFileSync(workbookSourcePath,'utf8');
const oldResultCount=workbookSource.split(oldStage02Result).length-1;
const newResultCount=workbookSource.split(newStage02Result).length-1;
if(oldResultCount===1&&newResultCount===0)fs.writeFileSync(workbookSourcePath,workbookSource.replace(oldStage02Result,newStage02Result));
else if(oldResultCount!==0||newResultCount!==1)throw new Error(`Stage 02 result source must contain exactly one old or normalized value; found old=${oldResultCount}, normalized=${newResultCount}.`);

fs.rmSync(target,{recursive:true,force:true,maxRetries:3,retryDelay:100});
fs.mkdirSync(target,{recursive:true});
for(const file of [...DEPLOYMENT_SOURCE_RUNTIME_PATHS,...DEPLOYMENT_CONTROL_PATHS]){
  const source=path.join(sourceRoot,file),destination=path.join(target,file);
  if(!fs.existsSync(source))throw new Error(`Required static deployment input is missing: ${file}`);
  fs.copyFileSync(source,destination);
}
const manifest=buildDeploymentManifest(target,{sourceRoot});
console.log(JSON.stringify({staticSiteBuild:'PASS',target,sourceCommit:manifest.sourceCommit,buildIdentity:manifest.buildIdentity,buildIdentityDerivationDigest:manifest.buildIdentityDerivation.digest,runtimeResources:manifest.runtimeResources.length,reproducibilityStatus:manifest.reproducibilityStatus,manifestDigest:manifest.overallManifestDigest},null,2));
