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
const manifest=buildDeploymentManifest(target,{sourceRoot});
console.log(JSON.stringify({staticSiteBuild:'PASS',target,sourceCommit:manifest.sourceCommit,buildIdentity:manifest.buildIdentity,buildIdentityDerivationDigest:manifest.buildIdentityDerivation.digest,runtimeResources:manifest.runtimeResources.length,reproducibilityStatus:manifest.reproducibilityStatus,manifestDigest:manifest.overallManifestDigest},null,2));
