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
const newStage02Help="return 'Independent external sources only. Stage 02 researches independent external sources within the current bounded source-search contract. Supplied project artifacts are project input, not automatically independent authority, and are not required for this stage. The required response schema is closed-loop-stage-response/3.';";
const appCoreSource=fs.readFileSync(appCoreSourcePath,'utf8');
const oldCount=appCoreSource.split(oldStage02Help).length-1;
const newCount=appCoreSource.split(newStage02Help).length-1;
if(oldCount===1&&newCount===0)fs.writeFileSync(appCoreSourcePath,appCoreSource.replace(oldStage02Help,newStage02Help));
else if(oldCount!==0||newCount!==1)throw new Error(`Stage 02 operator-help source must contain exactly one old or normalized value; found old=${oldCount}, normalized=${newCount}.`);

// Keep the Stage 02 boundary visible in the existing stage-result paragraph.
// Workbook Stage 02 has both a base result and a controlling amendment override;
// both are normalized so the actual rendered STAGES entry carries the boundary.
const workbookSourcePath=path.join(sourceRoot,'workbook.js');
const oldStage02Result="'Identify every source that may control, inform, or prove correctness and establish the authority hierarchy.'";
const newStage02Result="'Independent external sources only. Identify every external source that may control, inform, or prove correctness within the current bounded search contract, establish the authority hierarchy, and do not treat supplied project material as independent authority or claim open-world completeness. The required response schema is closed-loop-stage-response/3.'";
const oldStage02Override="2:'Identify and disposition every source within a bounded, evidenced source-search contract without claiming universal source completeness.'";
const newStage02Override="2:'Independent external sources only. Identify and disposition every external source within the current bounded, evidenced source-search contract; do not treat supplied project material as independent authority or claim universal source completeness. The required response schema is closed-loop-stage-response/3.'";
let workbookSource=fs.readFileSync(workbookSourcePath,'utf8');
const oldResultCount=workbookSource.split(oldStage02Result).length-1;
const newResultCount=workbookSource.split(newStage02Result).length-1;
if(oldResultCount===1&&newResultCount===0)workbookSource=workbookSource.replace(oldStage02Result,newStage02Result);
else if(oldResultCount!==0||newResultCount!==1)throw new Error(`Stage 02 base result source must contain exactly one old or normalized value; found old=${oldResultCount}, normalized=${newResultCount}.`);
const oldOverrideCount=workbookSource.split(oldStage02Override).length-1;
const newOverrideCount=workbookSource.split(newStage02Override).length-1;
if(oldOverrideCount===1&&newOverrideCount===0)workbookSource=workbookSource.replace(oldStage02Override,newStage02Override);
else if(oldOverrideCount!==0||newOverrideCount!==1)throw new Error(`Stage 02 controlling result override must contain exactly one old or normalized value; found old=${oldOverrideCount}, normalized=${newOverrideCount}.`);
fs.writeFileSync(workbookSourcePath,workbookSource);

// Follow the actual Stage 02 operator sequence in the browser regression: a
// nonplaceholder authoring context and exact operation reservation must exist
// before the controlling prompt is exposed. The transform is exact/idempotent.
const browserVerifierPath=path.join(sourceRoot,'verify-browser.mjs');
const oldStage02BrowserSequence="await openStage(cdp,2);await evalValue(cdp,`document.querySelector('.app-help details').open=true`);let text=(await snapshot(cdp)).text;";
const newStage02BrowserSequence="await openStage(cdp,2);await fill(cdp,'#fresh-context-id','BROWSER-STAGE-02-AUTHOR-CONTEXT');await click(cdp,'#add-fresh-context');await waitExpr(cdp,`Boolean(document.querySelector('#reserve-external-prompt'))`);await click(cdp,'#reserve-external-prompt');await waitExpr(cdp,`document.body.innerText.includes('PROMPT IDENTITY')`);await evalValue(cdp,`document.querySelector('.app-help details').open=true`);let text=(await snapshot(cdp)).text;";
if(fs.existsSync(browserVerifierPath)){
  const browserVerifierSource=fs.readFileSync(browserVerifierPath,'utf8');
  const oldBrowserSequenceCount=browserVerifierSource.split(oldStage02BrowserSequence).length-1;
  const newBrowserSequenceCount=browserVerifierSource.split(newStage02BrowserSequence).length-1;
  if(oldBrowserSequenceCount===1&&newBrowserSequenceCount===0)fs.writeFileSync(browserVerifierPath,browserVerifierSource.replace(oldStage02BrowserSequence,newStage02BrowserSequence));
  else if(oldBrowserSequenceCount!==0||newBrowserSequenceCount!==1)throw new Error(`Stage 02 browser sequence must contain exactly one pre-reservation or normalized value; found old=${oldBrowserSequenceCount}, normalized=${newBrowserSequenceCount}.`);
}

fs.rmSync(target,{recursive:true,force:true,maxRetries:3,retryDelay:100});
fs.mkdirSync(target,{recursive:true});
for(const file of [...DEPLOYMENT_SOURCE_RUNTIME_PATHS,...DEPLOYMENT_CONTROL_PATHS]){
  const source=path.join(sourceRoot,file),destination=path.join(target,file);
  if(!fs.existsSync(source))throw new Error(`Required static deployment input is missing: ${file}`);
  fs.copyFileSync(source,destination);
}
const manifest=buildDeploymentManifest(target,{sourceRoot});
console.log(JSON.stringify({staticSiteBuild:'PASS',target,sourceCommit:manifest.sourceCommit,buildIdentity:manifest.buildIdentity,buildIdentityDerivationDigest:manifest.buildIdentityDerivation.digest,runtimeResources:manifest.runtimeResources.length,reproducibilityStatus:manifest.reproducibilityStatus,manifestDigest:manifest.overallManifestDigest},null,2));