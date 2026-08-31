from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()
anchor="""function requirementId(record){return recordId(record,'requirements');}
function testRequirementId(record){return String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');}"""
insert="""function requirementId(record){return recordId(record,'requirements');}
function preflightCoverageManifest(project){
  ensureShape(project);
  const instruction=recordsForCurrentScope(project,'instructions').at(-1);
  const instructionId=recordId(instruction,'instructions');
  const units=[];
  const add=(kind,path,value,sourceId=instructionId)=>{const text=String(value??'').trim();if(!text)return;for(const part of text.split(/\\n+|(?<=[.!?])\\s+/).map(v=>v.trim()).filter(Boolean)){const textSha256=hash.sha256Value(part),unitId='PREFLIGHT-UNIT-'+hash.sha256Value({instructionId,kind,path,sourceId,textSha256}).slice(0,20).toUpperCase();units.push({unitId,kind,path,sourceId,text:part,textSha256});}};
  const walk=(value,path)=>{if(value===null||value===undefined)return;if(Array.isArray(value)){value.forEach((v,i)=>walk(v,`${path}[${i}]`));return;}if(typeof value==='object'){Object.keys(value).sort().forEach(k=>walk(value[k],path?`${path}.${k}`:k));return;}add('INSTRUCTION_CLAUSE',path,value);};
  if(instruction){const fields=recordFields(instruction),definition=schema.RECORD_SCHEMAS.instructions;for(const field of definition?.required||[])walk(fields[field],field);}
  for(const trace of recordsForCurrentScope(project,'instructionTraces')){const traceId=recordId(trace,'instructionTraces'),fields=recordFields(trace);add('INSTRUCTION_TRACE',`instructionTraces.${traceId}.IMPLEMENTED_BEHAVIOR`,fields.IMPLEMENTED_BEHAVIOR,traceId);add('INSTRUCTION_TRACE',`instructionTraces.${traceId}.INSTRUCTION_LOCATION`,fields.INSTRUCTION_LOCATION,traceId);}
  units.sort((a,b)=>a.unitId.localeCompare(b.unitId));
  return {instructionId,instructionVersion:project.job.CURRENT_INSTRUCTION_VERSION||'NONE',unitCount:units.length,units,manifestSha256:hash.sha256Value({instructionId,instructionVersion:project.job.CURRENT_INSTRUCTION_VERSION||'NONE',units:units.map(({unitId,kind,path,sourceId,textSha256})=>({unitId,kind,path,sourceId,textSha256}))})};
}
function evaluatePreflightCoverage(project){const manifest=preflightCoverageManifest(project),reviews=recordsForCurrentScope(project,'preflightRecords'),expected=new Set(manifest.units.map(u=>u.unitId)),counts=new Map(),unknown=[],wrongInstruction=[];for(const review of reviews){const unitId=String(recordValue(review,'CLAUSE')||'').trim();counts.set(unitId,(counts.get(unitId)||0)+1);if(!expected.has(unitId))unknown.push(unitId||recordId(review,'preflightRecords'));const instructionId=String(recordValue(review,'INSTRUCTION_ID')||review.relationships?.INSTRUCTION_ID||'').trim();if(instructionId!==manifest.instructionId)wrongInstruction.push(recordId(review,'preflightRecords'));}const missing=manifest.units.filter(u=>(counts.get(u.unitId)||0)===0).map(u=>u.unitId),duplicates=[...counts.entries()].filter(([id,count])=>expected.has(id)&&count!==1).map(([id,count])=>({unitId:id,count}));return {manifest,reviews,missing,duplicates,unknown,wrongInstruction,complete:manifest.unitCount>0&&missing.length===0&&duplicates.length===0&&unknown.length===0&&wrongInstruction.length===0&&reviews.length===manifest.unitCount};}
function testRequirementId(record){return String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');}"""
if anchor not in s: raise SystemExit('preflight helper anchor missing')
s=s.replace(anchor,insert,1)
old="""    case 9:{
      requireAccepted();requireCount('preflightRecords',1);
      if(collection('preflightRecords').some(record=>['VIOLATED','UNDETERMINED','BLOCKED','REJECTED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Instruction preflight contains an unresolved material finding.');
      const preflightChange=changes.at(-1),preflightReviewer=String(preflightChange?.scope?.contextId||''),preflightIndependence=evaluateContextIndependence(project,{role:'PREFLIGHT_REVIEW',reviewerContextId:preflightReviewer});
      if(!['APPLICATION_ESTABLISHED','EXTERNALLY_SUPPORTED'].includes(preflightIndependence.determination))reasons.push('Preflight reviewer independence is not established: '+preflightIndependence.reasons.join(' '));
      break;
    }"""
new="""    case 9:{
      requireAccepted();const coverage=evaluatePreflightCoverage(project);if(!coverage.manifest.instructionId)reasons.push('Stage 09 requires exactly one current production instruction.');if(!coverage.manifest.unitCount)reasons.push('The current production instruction has no application-enumerated preflight units.');if(coverage.missing.length)reasons.push(`Preflight coverage is missing ${coverage.missing.length} application-enumerated instruction/trace units: ${coverage.missing.join(', ')}.`);if(coverage.duplicates.length)reasons.push(`Preflight contains duplicate unit reviews: ${coverage.duplicates.map(x=>x.unitId+' x'+x.count).join(', ')}.`);if(coverage.unknown.length)reasons.push(`Preflight contains unknown or invented unit identities: ${coverage.unknown.join(', ')}.`);if(coverage.wrongInstruction.length)reasons.push(`Preflight records are bound to the wrong instruction identity: ${coverage.wrongInstruction.join(', ')}.`);
      if(coverage.reviews.some(record=>['VIOLATED','UNDETERMINED','BLOCKED','REJECTED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Instruction preflight contains an unresolved material finding.');
      const preflightChange=changes.at(-1),preflightReviewer=String(preflightChange?.scope?.contextId||''),preflightIndependence=evaluateContextIndependence(project,{role:'PREFLIGHT_REVIEW',reviewerContextId:preflightReviewer});
      if(!['APPLICATION_ESTABLISHED','EXTERNALLY_SUPPORTED'].includes(preflightIndependence.determination))reasons.push('Preflight reviewer independence is not established: '+preflightIndependence.reasons.join(' '));
      break;
    }"""
if old not in s: raise SystemExit('Stage9 gate anchor missing')
s=s.replace(old,new,1)
old2="""case 9:{const reviews=recordsForCurrentScope(project,'preflightRecords'),change=acceptedChanges(project,9).at(-1),contextId=String(change?.scope?.contextId||''),ind=evaluateContextIndependence(project,{role:'PREFLIGHT_REVIEW',reviewerContextId:contextId});Object.assign(derived,{INPUT_INSTRUCTION_VERSION:project.job.CURRENT_INSTRUCTION_VERSION||'NONE',OUTPUT_INSTRUCTION_VERSION:project.job.CURRENT_INSTRUCTION_VERSION||'NONE',PREFLIGHT_REVIEWER_ID:contextId||'UNKNOWN',REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR:ind.determination,SENTENCE_REVIEW_RECORDS:reviews.map(r=>recordId(r,'preflightRecords')),PREFLIGHT_ITERATION_RECORDS:safe(project.projectData.acceptedChanges).filter(c=>Number(c.stage)===9&&!c.invalidatedBy).map(c=>c.changeId)});break;}"""
new2="""case 9:{const reviews=recordsForCurrentScope(project,'preflightRecords'),coverage=evaluatePreflightCoverage(project),change=acceptedChanges(project,9).at(-1),contextId=String(change?.scope?.contextId||''),ind=evaluateContextIndependence(project,{role:'PREFLIGHT_REVIEW',reviewerContextId:contextId});Object.assign(derived,{INPUT_INSTRUCTION_VERSION:project.job.CURRENT_INSTRUCTION_VERSION||'NONE',OUTPUT_INSTRUCTION_VERSION:project.job.CURRENT_INSTRUCTION_VERSION||'NONE',PREFLIGHT_REVIEWER_ID:contextId||'UNKNOWN',REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR:ind.determination,SENTENCE_REVIEW_RECORDS:reviews.map(r=>recordId(r,'preflightRecords')),PREFLIGHT_ITERATION_RECORDS:safe(project.projectData.acceptedChanges).filter(c=>Number(c.stage)===9&&!c.invalidatedBy).map(c=>c.changeId),EVERY_SENTENCE_REVIEWED:coverage.complete,PREFLIGHT_EXPECTED_UNIT_COUNT:coverage.manifest.unitCount,PREFLIGHT_MISSING_UNIT_IDS:coverage.missing,PREFLIGHT_DUPLICATE_UNIT_IDS:coverage.duplicates,PREFLIGHT_MANIFEST_SHA256:coverage.manifest.manifestSha256});break;}"""
if old2 not in s: raise SystemExit('Stage9 derived anchor missing')
s=s.replace(old2,new2,1)
export_anchor="""  currentScope,recordsForScope,recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics"""
export_new="""  currentScope,recordsForScope,recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,preflightCoverageManifest,evaluatePreflightCoverage,DERIVATIONS,coverageMetrics"""
if export_anchor not in s: raise SystemExit('engine export anchor missing')
s=s.replace(export_anchor,export_new,1)
p.write_text(s)

q=Path('prompt-engine.js')
t=q.read_text()
marker=";const humanInspectionEvidence=workflow.recordsForCurrentScope(state,'evidenceRecords')"
if marker not in t: raise SystemExit('generic context insertion marker missing')
t=t.replace(marker,";if(stage===9)parts.push(`APPLICATION PREFLIGHT COVERAGE MANIFEST — REVIEW EVERY UNIT EXACTLY ONCE\\n${show(workflow.preflightCoverageManifest(state))}`)"+marker,1)
marker2="${stage===4?`STAGE 04 ACCOUNTING OUTPUT"
if marker2 not in t: raise SystemExit('Stage 4 output marker missing')
insert2="${stage===9?`STAGE 09 PREFLIGHT COVERAGE OUTPUT\\nReview every unitId in APPLICATION PREFLIGHT COVERAGE MANIFEST exactly once. Each preflightRecords record must set CLAUSE to the exact application unitId and INSTRUCTION_ID to the current manifest instructionId. Do not combine multiple unitIds into one review, omit a unit, invent a unit, or substitute free-form clause text for the unitId. Use the manifest text/path as the content being reviewed. If any unit is defective, report the material finding and exact correction; a corrected instruction requires a new instruction version and a completely new preflight manifest/review.\\n\\n`:''}"
t=t.replace(marker2,insert2+marker2,1)
q.write_text(t)
for name in ['index.html','app-core.js','test-runtime.js']:
    f=Path(name); f.write_text(f.read_text().replace('runtime-20260830-live-operator-61','runtime-20260830-live-operator-62'))