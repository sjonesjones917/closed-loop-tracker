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

{
  const path='verify-prompt-semantics.mjs';
  let text=fs.readFileSync(path,'utf8');
  const domainChecks=`  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');\n  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');\n  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC'))issues.push('BUILDING_DOMAIN_RULE_MISSING');\n  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n`;
  const neutralChecks=`  for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(record.prompt.includes(forbidden))issues.push('HARDCODED_SUBJECT_BRANCH_PRESENT_'+forbidden);\n`;
  if(!text.includes(domainChecks))throw new Error('Obsolete domain-specific prompt assertions missing.');
  text=text.replace(domainChecks,neutralChecks);

  const stage1Boundary="    if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');";
  const stage1BoundaryReplacement="    if(!record.prompt.includes('Perform complete human-authority intake only.')||!record.prompt.includes('Classify every supplied unit exactly once')||!record.prompt.includes('preserve every materially relevant fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue')||!record.prompt.includes('Do not perform source research, requirement atomization, test design, production, filing, simulation, manufacturing, or product verification'))issues.push('STAGE01_COMPLETE_SUBJECT_NEUTRAL_INTAKE_BOUNDARY_MISSING');";
  if(!text.includes(stage1Boundary))throw new Error('Obsolete Stage 01 domain boundary assertion missing.');
  text=text.replace(stage1Boundary,stage1BoundaryReplacement);

  const proactive="    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('intended jurisdiction(s)')||!record.prompt.includes('additional human-controlled invention materials exist'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');";
  const proactiveReplacement="    if(!record.prompt.includes('APPLICATION INTAKE MANIFEST')||!record.prompt.includes('closed-loop-intake-capture/1')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('accepted capture is the durable meaning-preserving handoff to every later stage')||!record.prompt.includes('original intent file must not be repeatedly requested'))issues.push('STAGE01_EXHAUSTIVE_DURABLE_INTAKE_GATE_MISSING');";
  if(!text.includes(proactive))throw new Error('Obsolete Stage 01 patent-fixture prompt assertion missing.');
  text=text.replace(proactive,proactiveReplacement);

  const artifactBoundary="    if(!record.prompt.includes('do not require the human to know those formats in advance')||!record.prompt.includes('absence of a downstream authoring, viewing, compiling, importing, simulation, manufacturing, filing, deployment, or other consuming system is not by itself a reason to downgrade an artifact to prose')||!record.prompt.includes('Only propose an implementation-ready'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');";
  const artifactBoundaryReplacement="    if(record.prompt.includes('Generate the finished product')||record.prompt.includes('produce the actual artifact now'))issues.push('STAGE01_LATER_STAGE_PRODUCTION_LEAK');";
  if(!text.includes(artifactBoundary))throw new Error('Obsolete Stage 01 artifact-production assertion missing.');
  text=text.replace(artifactBoundary,artifactBoundaryReplacement);

  const blanketArtifactAssertion="  }else if(!record.prompt.includes('ARTIFACT GENERATION VS DOWNSTREAM EXECUTION')||!record.prompt.includes('must not be represented as completed'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');";
  if(!text.includes(blanketArtifactAssertion))throw new Error('Obsolete blanket artifact prompt assertion missing.');
  text=text.replace(blanketArtifactAssertion,'  }');

  fs.writeFileSync(path,text);
}
