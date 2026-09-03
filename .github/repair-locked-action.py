from pathlib import Path

p=Path('app-core.js')
text=p.read_text(encoding='utf-8')
old="function displayedStageAction(n){const stage=Number(n||canonicalCurrentStage()),lock=stageLocked(stage);if(stage!==canonicalCurrentStage()&&lock)return {actionType:'BLOCKED',heading:'This stage is not ready',explanation:`${lock} Complete the prerequisite stages in order. Do not send a prompt or select a response file for this stage yet.`,primaryButton:null,secondaryAction:null,filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],blockingReason:lock,canonicalStateChanged:false,acceptedChange:null,downstreamInvalidated:[],newPromptRequired:false};return currentNextAction();}"
new="function displayedStageAction(n){const stage=Number(n||canonicalCurrentStage()),lock=stageLocked(stage);if(stage!==canonicalCurrentStage()&&lock)return {actionType:'BLOCKED',heading:'This stage is not ready',explanation:`${lock} Complete the prerequisite stages in order. Do not send a prompt or select a response file for this stage yet.`,primaryButton:null,secondaryAction:null,filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],operatorChecks:[`Complete the prerequisite stages in order before acting on Stage ${String(stage).padStart(2,'0')}.`,'Do not send a prompt, package, or response for this locked stage.','Return to the current required stage and follow its structured next action.'],blockingReason:lock,canonicalStateChanged:false,acceptedChange:null,downstreamInvalidated:[],newPromptRequired:false};return currentNextAction();}"
count=text.count(old)
if count!=1: raise SystemExit(f'app-core.js locked-action contract expected once, found {count}')
p.write_text(text.replace(old,new),encoding='utf-8',newline='\n')
