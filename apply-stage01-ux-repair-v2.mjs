import fs from 'node:fs';

const path = 'apply-stage01-ux-repair.mjs';
let source = fs.readFileSync(path, 'utf8');

const pagesMarker = "replaceOnce(\n  '.github/workflows/pages.yml',";
const pagesStart = source.indexOf(pagesMarker);
if (pagesStart < 0) throw new Error('pages.yml replacement marker not found in one-time repair script.');
source = source.slice(0, pagesStart) + source.slice(pagesStart).replaceAll('\\\\n', '\\n');

const artifactBefore = "engine.registerArtifactBytes(project,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:128,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});\nconst manifest=engine.intakeCoverageManifest(project);";
const artifactAfter = "engine.registerArtifactBytes(project,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:128,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});\nfor(const artifact of project.projectData.artifacts){artifact.fields={...(artifact.fields||{}),AVAILABILITY:'AVAILABLE'};artifact.AVAILABILITY='AVAILABLE';}\nconst manifest=engine.intakeCoverageManifest(project);";
if (!source.includes(artifactBefore)) throw new Error('Stage 01 artifact fixture insertion point not found.');
source = source.replace(artifactBefore, artifactAfter);

fs.writeFileSync(path, source, 'utf8');
await import(`./${path}?v2`);

const promptPath = 'prompt-engine.js';
let promptSource = fs.readFileSync(promptPath, 'utf8');
const legacyPhrase = 'never ask the user to repeat available project facts';
if (!promptSource.includes(legacyPhrase)) {
  const insertionPoint = 'common domain knowledge, canonical context, or authorized research/tools.';
  if (!promptSource.includes(insertionPoint)) throw new Error('Generated prompt legacy phrase insertion point not found.');
  promptSource = promptSource.replace(insertionPoint, 'common domain knowledge, canonical context, or authorized research/tools; never ask the user to repeat available project facts.');
}

const prerequisiteStart = promptSource.indexOf('function assertPromptPrerequisites(stage,state){');
const prerequisiteEnd = promptSource.indexOf('\nfunction ', prerequisiteStart + 1);
if (prerequisiteStart < 0 || prerequisiteEnd < 0) throw new Error('Prompt prerequisite function boundary not found.');
const cumulativePrerequisites = [
  'function assertPromptPrerequisites(stage,state){',
  '  if(stage<=1)return true;',
  '  for(let upstreamStage=1;upstreamStage<stage;upstreamStage+=1){',
  '    const upstream=state?.stages?.[upstreamStage];',
  "    if(String(upstream?.status||'').toUpperCase()!=='COMPLETE'||upstream?.gate?.complete!==true){",
  '      const error=new Error(`Stage ${String(stage).padStart(2,\'0\')} controlling instruction cannot be generated until Stage ${String(upstreamStage).padStart(2,\'0\')} is deterministically complete. Missing upstream work must be completed at its responsible stage; the human must not be asked to repeat or resupply captured project information.`);',
  "      error.code='UPSTREAM_STAGE_INCOMPLETE';",
  '      error.upstreamStage=upstreamStage;',
  '      throw error;',
  '    }',
  '    if(upstreamStage===1){',
  '      const intake=workflow.evaluateIntakeAccounting(state);',
  '      if(!intake.complete){',
  "        const error=new Error('A later-stage controlling instruction cannot be generated because current Stage 01 controlled-input accounting is incomplete: '+intake.reasons.join('; '));",
  "        error.code='STAGE1_INTAKE_INCOMPLETE';",
  '        error.upstreamStage=1;',
  '        error.intakeReasons=[...intake.reasons];',
  '        throw error;',
  '      }',
  '    }',
  '  }',
  '  return true;',
  '}'
].join('\n');
promptSource = promptSource.slice(0, prerequisiteStart) + cumulativePrerequisites + promptSource.slice(prerequisiteEnd);
const prerequisiteOrderBefore = 'assertPromptPrerequisites(stage,state);if(stage===4)assertStage4UpstreamExhausted(state);';
const prerequisiteOrderAfter = 'if(stage===4)assertStage4UpstreamExhausted(state);assertPromptPrerequisites(stage,state);';
if (!promptSource.includes(prerequisiteOrderBefore)) throw new Error('Prompt prerequisite call order not found.');
promptSource = promptSource.replace(prerequisiteOrderBefore, prerequisiteOrderAfter);
fs.writeFileSync(promptPath, promptSource, 'utf8');

const stage01TestPath = 'verify-stage01-user-experience.mjs';
let stage01Test = fs.readFileSync(stage01TestPath, 'utf8');
const stage01SuccessBefore = "console.log(JSON.stringify({conversationPrecedence:true,namedFileRequest:true,noEarlyJson:true,patentAskNow:true,sparseIntakeRejected:true,completeIntakeAccepted:true}));";
const downstreamGateTest = [
  "const downstream=core.createBlankState('JOB-STAGE01-DOWNSTREAM-GATE');",
  "Object.assign(downstream.job,{EXACT_USER_OBJECTIVE_VERBATIM:'A later prompt must not exist until the complete Stage 01 intake is accepted.',CURRENT_INPUT_VERSION:'INPUT-v001'});",
  'engine.ensureShape(downstream);',
  "for(let stage=1;stage<=5;stage+=1){downstream.stages[stage].status='COMPLETE';downstream.stages[stage].gate={complete:true,blocked:false,reasons:[]};}",
  'let downstreamBlocked=false;',
  "try{prompts.buildPromptRecord(6,downstream,{operation:'COMPLETE'});}catch(error){downstreamBlocked=error?.code==='STAGE1_INTAKE_INCOMPLETE'&&Number(error?.upstreamStage)===1;}",
  "assert(downstreamBlocked,'Stage 06 prompt generated while Stage 01 current intake accounting was incomplete.');",
  "console.log(JSON.stringify({conversationPrecedence:true,namedFileRequest:true,noEarlyJson:true,patentAskNow:true,sparseIntakeRejected:true,completeIntakeAccepted:true,downstreamPromptsBlocked:true}));"
].join('\n');
if (!stage01Test.includes(stage01SuccessBefore)) throw new Error('Stage 01 success output marker not found.');
stage01Test = stage01Test.replace(stage01SuccessBefore, downstreamGateTest);
fs.writeFileSync(stage01TestPath, stage01Test, 'utf8');

const semanticsPath = 'verify-prompt-semantics.mjs';
let semantics = fs.readFileSync(semanticsPath, 'utf8');
const brittlePreviewCheck = "assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'),'Prompt preview/collapse sizing changed.');";
const actualPreviewCheck = "assert(html.includes('.expandable-prompt{height:280px;max-height:280px}')&&html.includes('.expandable-prompt.expanded{height:auto;max-height:none}'),'Prompt preview/collapse sizing changed.');";
if (!semantics.includes(brittlePreviewCheck)) throw new Error('Brittle prompt-preview check not found in prompt semantics test.');
semantics = semantics.replace(brittlePreviewCheck, actualPreviewCheck);
fs.writeFileSync(semanticsPath, semantics, 'utf8');

const userInvariantPath = 'verify-user-prompt-invariants.mjs';
let userInvariant = fs.readFileSync(userInvariantPath, 'utf8');
const brittleUserPreviewCheck = "assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'),'Prompt expansion visual changed.');";
const actualUserPreviewCheck = "assert(html.includes('.expandable-prompt{height:280px;max-height:280px}')&&html.includes('.expandable-prompt.expanded{height:auto;max-height:none}'),'Prompt expansion visual changed.');";
if (!userInvariant.includes(brittleUserPreviewCheck)) throw new Error('Brittle prompt-preview check not found in user invariant test.');
userInvariant = userInvariant.replace(brittleUserPreviewCheck, actualUserPreviewCheck);
fs.writeFileSync(userInvariantPath, userInvariant, 'utf8');
