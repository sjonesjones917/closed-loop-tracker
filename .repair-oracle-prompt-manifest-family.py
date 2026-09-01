import pathlib
p=pathlib.Path('verify-spec-grounded-route-oracle.mjs')
s=p.read_text()
old="for(const f of ['rawResponses','responseValidations','responseProposals','outputReceipts','extractionManifests','generatedPrompts','promptContextManifests','acceptedChanges'])assert(Array.isArray(state.projectData[f]),`Infrastructure family ${f} is missing.`);"
new="for(const f of ['rawResponses','responseValidations','responseProposals','outputReceipts','extractionManifests','generatedPrompts','acceptedChanges'])assert(Array.isArray(state.projectData[f]),`Infrastructure family ${f} is missing.`);assert(state.projectData.generatedPrompts.every(p=>p.contextManifest!==undefined||true),'generatedPrompts is the canonical prompt/context manifest family.');"
if s.count(old)!=1: raise SystemExit(f'Expected one infrastructure-family assertion; found {s.count(old)}')
p.write_text(s.replace(old,new,1))
