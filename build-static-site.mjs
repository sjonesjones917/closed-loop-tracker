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

fs.rmSync(target,{recursive:true,force:true,maxRetries:3,retryDelay:100});
fs.mkdirSync(target,{recursive:true});
for(const file of [...DEPLOYMENT_SOURCE_RUNTIME_PATHS,...DEPLOYMENT_CONTROL_PATHS]){
  const source=path.join(sourceRoot,file),destination=path.join(target,file);
  if(!fs.existsSync(source))throw new Error(`Required static deployment input is missing: ${file}`);
  fs.copyFileSync(source,destination);
}

// Preserve the established Stage 02 operator boundary after the bounded-search
// amendment. The generated site is the deployed application artifact, and this
// controlled exact replacement is included in the content-derived build identity.
const appCorePath=path.join(target,'app-core.js');
const oldStage02Help="return 'Stage 02 researches independent external sources. Supplied project artifacts are not required for this stage.';";
const newStage02Help="return 'Independent external sources only. Stage 02 researches independent external sources within the current bounded source-search contract. Supplied project artifacts are project input, not automatically independent authority, and are not required for this stage.';";
const appCoreSource=fs.readFileSync(appCorePath,'utf8');
const replacementCount=appCoreSource.split(oldStage02Help).length-1;
if(replacementCount!==1)throw new Error(`Stage 02 operator-help source must contain exactly one controlled replacement point; found ${replacementCount}.`);
fs.writeFileSync(appCorePath,appCoreSource.replace(oldStage02Help,newStage02Help));

const manifest=buildDeploymentManifest(target,{sourceRoot});
console.log(JSON.stringify({staticSiteBuild:'PASS',target,sourceCommit:manifest.sourceCommit,buildIdentity:manifest.buildIdentity,buildIdentityDerivationDigest:manifest.buildIdentityDerivation.digest,runtimeResources:manifest.runtimeResources.length,reproducibilityStatus:manifest.reproducibilityStatus,manifestDigest:manifest.overallManifestDigest},null,2));
