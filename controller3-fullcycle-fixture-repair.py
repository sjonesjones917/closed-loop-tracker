from pathlib import Path
p=Path('verify-full-cycle.mjs')
s=p.read_text()
needle="const stage6Tests=engine.recordsForCurrentScope(p,'tests'),testId=engine.recordId(stage6Tests.find(t=>engine.recordValue(t,'TEST_TYPE')==='DETERMINISTIC'),'tests'),meaningTestId=engine.recordId(stage6Tests.find(t=>engine.recordValue(t,'TEST_TYPE')==='MEANING'),'tests'),adversarialTestId=engine.recordId(stage6Tests.find(t=>engine.recordValue(t,'TEST_TYPE')==='ADVERSARIAL'),'tests');assert(testId&&meaningTestId&&adversarialTestId,'Stage 6 did not preserve all controlled verification modes.');complete(6);"
addition="const capabilityId='CAPABILITY-FULL-CYCLE-EXTERNAL',capabilityFields={CAPABILITY_ID:capabilityId,CAPABILITY_CLAIM:'fixture-required_capability',FRESHNESS_STATUS:'CURRENT',STATUS:'CURRENT',AUTHORIZED:true,PERMISSIONS_READY:true,INPUTS_TRANSFERABLE:true,ROUTE_USABLE:true,EVIDENCE_OBTAINABLE:true};p.projectData.externalCapabilities.push({id:capabilityId,stage:6,active:true,scope:{...engine.currentScope(p)},fields:capabilityFields,...capabilityFields});assert(engine.evaluateCapabilityReadiness(p,'fixture-required_capability').truthValue==='TRUE','Full-cycle fixture failed to establish the canonical external capability record.');"
if addition in s:
    raise SystemExit(0)
if needle not in s:
    raise SystemExit('expected Stage 6 full-cycle fixture anchor not found')
s=s.replace(needle,needle+addition,1)
p.write_text(s)
