from pathlib import Path
p=Path('workflow-engine.js')
s=p.read_text()
old="const COLLECTION_SCOPE_KEYS=Object.freeze({regressions:Object.freeze(['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion'])});"
new="const VERSION_SCOPE_KEYS=Object.freeze(['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion']);\nconst COLLECTION_SCOPE_KEYS=Object.freeze({regressions:VERSION_SCOPE_KEYS,changes:VERSION_SCOPE_KEYS});"
assert old in s
p.write_text(s.replace(old,new,1))
