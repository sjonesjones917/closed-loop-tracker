from pathlib import Path

path = Path('workflow-engine.js')
text = path.read_text()

old = """  const executionId=resultExecutionIdentity(project,result),contextId=resultContextIdentity(project,result);\n  if(test&&mode!=='APPLICATION_DETERMINISTIC'&&!executionId)reasons.push('Execution identity is not established.');\n  if(test&&['INDEPENDENT_AGENT_REVIEW','EXTERNAL_AGENT_TOOL','HUMAN_INSPECTION','EXTERNAL_SYSTEM'].includes(mode)&&!contextId)reasons.push('Execution/reviewer context identity is not established.');\n  return {sufficient:reasons.length===0,reasons,evidenceIds:evidence.map(e=>recordId(e,'evidenceRecords')),executionId,contextId};\n"""
new = """  const executionId=resultExecutionIdentity(project,result),contextId=resultContextIdentity(project,result),humanObservationEvidence=mode==='HUMAN_INSPECTION'&&evidence.some(item=>item?.source==='HUMAN_OBSERVATION'||upper(recordValue(item,'AUTHORITY_TYPE'))==='HUMAN_OBSERVATION');\n  if(test&&mode!=='APPLICATION_DETERMINISTIC'&&!executionId&&!humanObservationEvidence)reasons.push('Execution identity is not established.');\n  if(test&&['INDEPENDENT_AGENT_REVIEW','EXTERNAL_AGENT_TOOL','EXTERNAL_SYSTEM'].includes(mode)&&!contextId)reasons.push('Execution/reviewer context identity is not established.');\n  if(test&&mode==='HUMAN_INSPECTION'&&!contextId&&!humanObservationEvidence)reasons.push('Human inspection requires a bound human-owned observation or execution context.');\n  return {sufficient:reasons.length===0,reasons,evidenceIds:evidence.map(e=>recordId(e,'evidenceRecords')),executionId,contextId};\n"""
if old not in text:
    raise AssertionError('Human-inspection evidence-contract fragment was not found.')
text = text.replace(old, new, 1)
path.write_text(text)
print('Bound HUMAN_INSPECTION sufficiency to explicit human-owned canonical observation evidence without requiring an AI-style reviewer context.')
