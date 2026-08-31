from pathlib import Path

path = Path('verify-full-cycle.mjs')
text = path.read_text()
old = "data(9,{records:{preflightRecords:[recordProposal(schema,'preflightRecords',{tempKey:'preflight',relationships:{INSTRUCTION_ID:{recordId:instructionId}},overrides:{CLAUSE:'Full instruction',DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity',EVIDENCE:'Independent preflight evidence'}})]}});complete(9);"
new = "const preflightContext=engine.registerFreshContext(p,{stage:9,externalContextIdentifier:'FULL-CYCLE-PREFLIGHT-REVIEWER',operatorLabel:'FULL_CYCLE',purpose:'REVIEWER'});data(9,{scope:{contextId:engine.recordId(preflightContext,'freshContexts')},records:{preflightRecords:[recordProposal(schema,'preflightRecords',{tempKey:'preflight',relationships:{INSTRUCTION_ID:{recordId:instructionId}},overrides:{CLAUSE:'Full instruction',DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity',EVIDENCE:'Independent preflight evidence'}})]}});complete(9);"
if old not in text:
    raise AssertionError('Full-cycle Stage 09 preflight fixture was not found.')
path.write_text(text.replace(old,new,1))
print('Full-cycle Stage 09 now registers and binds an explicit independent reviewer context before prompt generation.')
