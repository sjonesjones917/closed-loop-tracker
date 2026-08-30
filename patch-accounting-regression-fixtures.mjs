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
  const anchor="const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'Verbatim job input plus clarification.'}});";
  if(!text.includes(anchor))throw new Error('Full-cycle Stage 01 fixture anchor missing.');
  const replacement="const intake1=engine.intakeCoverageManifest(p);const capture1={schema:'closed-loop-intake-capture/1',inputVersion:intake1.inputVersion,manifestSha256:intake1.manifestSha256,units:intake1.units.map((unit,index)=>({sourceUnitId:unit.unitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'full-cycle-'+String(index+1),text:String(unit.label||unit.unitId),statementClass:unit.label==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUESTED_OUTPUT':'FACT'}]})),conversationStatements:[]};const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture1)}});";
  text=text.replace(anchor,replacement);
  fs.writeFileSync(path,text);
}
