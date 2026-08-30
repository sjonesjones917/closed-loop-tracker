import fs from 'node:fs';

{
  const path='verify-ingestion.mjs';
  let text=fs.readFileSync(path,'utf8');
  const from="INPUT_SET_CONTENTS:'Human request and invention-packet.zip'";
  const to="INPUT_SET_CONTENTS:JSON.stringify(completeIntakeCapture(p))";
  if(!text.includes(from))throw new Error('Smart-quote Stage 01 fixture anchor missing.');
  text=text.replace(from,to);
  fs.writeFileSync(path,text);
}

{
  const path='verify-full-cycle.mjs';
  let text=fs.readFileSync(path,'utf8');
  const stage1Anchor="const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'Verbatim job input plus clarification.'}});";
  if(!text.includes(stage1Anchor))throw new Error('Full-cycle Stage 01 fixture anchor missing.');
  const stage1Replacement="const intake1=engine.intakeCoverageManifest(p);const capture1={schema:'closed-loop-intake-capture/1',inputVersion:intake1.inputVersion,manifestSha256:intake1.manifestSha256,units:intake1.units.map((unit,index)=>({sourceUnitId:unit.unitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'full-cycle-'+String(index+1),text:String(unit.label||unit.unitId),statementClass:unit.label==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUESTED_OUTPUT':'FACT'}]})),conversationStatements:[]};const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture1)}});";
  text=text.replace(stage1Anchor,stage1Replacement);

  const stage4Anchor="data(4,{records:{requirements:[recordProposal(schema,'requirements',{tempKey:'req',overrides:{OBLIGATION:'The deliverable must contain the required verified content.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User Job Input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Required content is present.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW',EXPECTED_EVIDENCE:'Canonical verification evidence',FAILURE_CONDITION:'Required content absent',SEVERITY:'MAJOR'}})]}});";
  if(!text.includes(stage4Anchor))throw new Error('Full-cycle Stage 04 fixture anchor missing.');
  const stage4Replacement="const obligation4=engine.obligationManifest(p);assert(obligation4.items.length>0,'Stage 04 full-cycle fixture has no controlling obligations.');data(4,{records:{requirements:[recordProposal(schema,'requirements',{tempKey:'req',overrides:{OBLIGATION:obligation4.items.map(item=>item.text).join(' | '),REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:obligation4.items.map(item=>item.obligationId).join(', '),APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Every controlling obligation represented by this fixture is demonstrably satisfied.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW',EXPECTED_EVIDENCE:'Canonical verification evidence',FAILURE_CONDITION:'Any represented controlling obligation is not satisfied.',SEVERITY:'MAJOR'}})]}});";
  text=text.replace(stage4Anchor,stage4Replacement);
  fs.writeFileSync(path,text);
}
