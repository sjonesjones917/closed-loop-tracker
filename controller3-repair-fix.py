from pathlib import Path
p=Path('controller3-repair.py')
s=p.read_text()
old="import {webcrypto} from 'node:crypto';\nglobalThis.crypto=webcrypto;"
new="import {webcrypto} from 'node:crypto';\nif(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});"
if old not in s: raise SystemExit('crypto verifier anchor missing')
s=s.replace(old,new,1)
old2="const cap={id:'CAPABILITY-TEST',active:true,scope:{},fields:{CAPABILITY_ID:'CAPABILITY-TEST'"
new2="const cap={id:'CAPABILITY-TEST',active:true,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION},fields:{CAPABILITY_ID:'CAPABILITY-TEST'"
if old2 not in s: raise SystemExit('capability scope fixture anchor missing')
s=s.replace(old2,new2,1)
anchor='Path("verify-capability-readiness.mjs").write_text(r\'\'\''
insert="""replace_once(\n    \"verify-complete.mjs\",\n    \"const p=project('JOB-RELIABILITY-V2');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';p.job.AVAILABLE_TOOLS='CAP-EXTERNAL_AGENT_TOOL; CAP-EXTERNAL_SYSTEM';const scope=engine.currentScope(p);\",\n    \"const p=project('JOB-RELIABILITY-V2');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';p.job.AVAILABLE_TOOLS='CAP-EXTERNAL_AGENT_TOOL; CAP-EXTERNAL_SYSTEM';const scope=engine.currentScope(p);for(const capability of ['CAP-EXTERNAL_AGENT_TOOL','CAP-EXTERNAL_SYSTEM']){const c=record('externalCapabilities',0,{CAPABILITY_ID:capability,CAPABILITY_CLAIM:capability,FRESHNESS_STATUS:'CURRENT',STATUS:'CURRENT',AUTHORIZED:true,PERMISSIONS_READY:true,INPUTS_TRANSFERABLE:true,ROUTE_USABLE:true,EVIDENCE_OBTAINABLE:true},capability);c.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.externalCapabilities.push(c);}\",\n)\n\n"""
if anchor not in s: raise SystemExit('capability verifier insertion anchor missing')
s=s.replace(anchor,insert+anchor,1)
p.write_text(s)
