import fs from 'node:fs';

const engineFile='workflow-engine.js';
let engine=fs.readFileSync(engineFile,'utf8');
const old=`      conversationMaterials.push({
        label:reference.label,
        type:reference.type,
        transferMode:reference.transferMode,
        externalAccessStatus:'NOT_OBSERVABLE_BY_APPLICATION',
        operatorAction:reference.transferMode==='AUTHORIZED_REFERENCE'?'Provide this reference with the Stage 04 instruction.':'Attach or provide the original material with the Stage 04 instruction.',
        applicationUploadRequired:false,
        optionalApplicationArtifactId:copy?.artifactId||null
      });
      if(copy)optionalApplicationCopies.set(copy.artifactId,copy);`;
const replacement=`      if(copy){
        optionalApplicationCopies.set(copy.artifactId,copy);
        continue;
      }
      conversationMaterials.push({
        label:reference.label,
        type:reference.type,
        transferMode:reference.transferMode,
        externalAccessStatus:reference.transferMode==='AUTHORIZED_REFERENCE'?'REFERENCE_MUST_BE_PROVIDED_TO_EXECUTOR':'BYTES_NOT_CAPTURED_BY_APPLICATION',
        operatorAction:reference.transferMode==='AUTHORIZED_REFERENCE'?'Provide this reference with the Stage 04 instruction.':'Attach the original material once so the application can capture, hash, and retain its bytes for subsequent stages.',
        applicationUploadRequired:reference.transferMode!=='AUTHORIZED_REFERENCE',
        optionalApplicationArtifactId:null
      });`;
if(!engine.includes(old))throw new Error('Stage 04 handoff block not found.');
engine=engine.replace(old,replacement);
fs.writeFileSync(engineFile,engine);

const promptFile='prompt-engine.js';
let prompt=fs.readFileSync(promptFile,'utf8');
prompt=prompt.replace("4:'Compile atomic requirement proposals for this current job from authorized User Job Input, supplied project materials sent with this Stage 04 instruction and actually readable in the executing context, and legitimately applicable Stage 03 external-source research, preserving provenance for each obligation.","4:'Compile atomic requirement proposals for this current job from the application-provided complete obligation universe: current User Job Input, accepted Stage 01 job definition and intake accounting, captured human-origin obligations, obligations extracted from application-retained supplied-material bytes when available, and legitimately applicable Stage 03 external-source research, preserving provenance for every obligation. Do not rediscover an unspecified input universe. Do not ask the human to repeat intent, facts, requirements, constraints, decisions, prohibitions, acceptance conditions, or material contents already captured in canonical human input, Stage 01 intake accounting, or application-retained artifact bytes.");
prompt=prompt.replace("These materials are not embedded in the prompt. Attach or provide them in the agent conversation where this Stage 04 instruction is run. Do not assume access to any earlier stage conversation.","Only materials listed here are not already captured by the application. If application-retained verified bytes exist, the application supplies those bytes through the Stage 04 handoff/package and the human must not reattach them. Do not assume access to an earlier external conversation.");
fs.writeFileSync(promptFile,prompt);

const uiFile='app-core.js';
let ui=fs.readFileSync(uiFile,'utf8');
ui=ui.replace("4:'The agent compiles the requirement specification from current human input, actually accessible supplied materials, and accepted external-source research. Keep the work in the external conversation that has the original material; no duplicate upload into this application is required.'","4:'The application compiles a closed obligation universe from the human input captured at Stage 01, retained supplied-material bytes, and accepted source research. Information already captured is reused; the operator is asked for a file again only when its bytes were never captured or are no longer verifiably available.'");
fs.writeFileSync(uiFile,ui);

const verifyFile='verify-stage04-capture.mjs';
fs.writeFileSync(verifyFile,`import fs from 'node:fs';\nconst engine=fs.readFileSync('workflow-engine.js','utf8'),prompt=fs.readFileSync('prompt-engine.js','utf8'),ui=fs.readFileSync('app-core.js','utf8');\nif(!engine.includes("if(copy){")||!engine.includes("continue;")||!engine.includes("BYTES_NOT_CAPTURED_BY_APPLICATION"))throw new Error('Stage 04 does not suppress repeat handoff for retained verified bytes.');\nif(!prompt.includes('Do not ask the human to repeat intent, facts, requirements, constraints, decisions, prohibitions, acceptance conditions, or material contents already captured'))throw new Error('Stage 04 prompt lacks captured-authority reuse rule.');\nif(!ui.includes('Information already captured is reused'))throw new Error('Stage 04 UI does not state capture-once behavior.');\nconsole.log('Stage 04 capture-once regression passed.');\n`);
console.log(JSON.stringify({stage04CaptureOnce:true}));
