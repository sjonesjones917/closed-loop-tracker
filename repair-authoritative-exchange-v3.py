from pathlib import Path
import re
import runpy

root=Path('.')
for candidate in ('repair-authoritative-exchange-v2.py','repair-authoritative-exchange.py'):
    path=root/candidate
    if path.exists():
        runpy.run_path(str(path),run_name='__main__')
        break

prompt=root/'prompt-engine.js'
text=prompt.read_text()
old="    'Continue normal concise human conversation only when genuinely required. When ready, return one authoritative UTF-8 response.json file plus any required returned files in the named attachment slots.',"
new="    'Continue normal concise human conversation only when genuinely required. Return the final response as response.json and any required files. Use the named attachment slots for every returned file.',"
if old in text: text=text.replace(old,new,1)
if 'Return the final response as response.json and any required files.' not in text: raise RuntimeError('prompt response.json instruction missing')
prompt.write_text(text)

app=root/'app-core.js'
text=app.read_text()
text=re.sub(r"new Blob\(\[([A-Za-z_$][\w$]*)\.prompt\],\{type:'text/plain;charset=utf-8'\}\)",r"new Blob([\1.authoritativeBytes||new TextEncoder().encode(\1.prompt)],{type:\1.mediaType||'text/plain;charset=utf-8'})",text)
text=re.sub(r"navigator\.clipboard\.writeText\([^;\n]*?\.prompt\)","navigator.clipboard.writeText(globalThis.closedLoopPromptEngine.EXTERNAL_CHAT_LAUNCHER)",text)
app.write_text(text)

response_keys="['schema','contractProfileId','jobId','stage','operation','promptIdentity','packageId','operationReservationId','challengeNonce','scope','responseType','humanInputRequests','humanAuthorityCandidates','stageData','records','evidence','unresolved','warnings','attachments']"
old_keys="['schema','jobId','stage','operation','promptIdentity','scope','responseType','humanInputRequests','stageData','records','evidence','unresolved','warnings','attachments']"
for path in root.glob('*.mjs'):
    text=path.read_text()
    text=text.replace(old_keys,response_keys)
    text=re.sub(r"schema:(core\.)?RESPONSE_SCHEMA,(\s*)jobId:",lambda m:f"schema:{m.group(1) or ''}RESPONSE_SCHEMA,{m.group(2)}contractProfileId:'closed-loop-completion-profile/1',{m.group(2)}packageId:'PKG-TEST-CURRENT',{m.group(2)}operationReservationId:'OPRES-TEST-CURRENT',{m.group(2)}challengeNonce:'0123456789abcdef0123456789abcdef',{m.group(2)}jobId:",text)
    text=re.sub(r"schema:'closed-loop-stage-response/3',(\s*)jobId:",lambda m:f"schema:'closed-loop-stage-response/3',{m.group(1)}contractProfileId:'closed-loop-completion-profile/1',{m.group(1)}packageId:'PKG-TEST-CURRENT',{m.group(1)}operationReservationId:'OPRES-TEST-CURRENT',{m.group(1)}challengeNonce:'0123456789abcdef0123456789abcdef',{m.group(1)}jobId:",text)
    def repair_attachments(match):
        block=match.group(0)
        block=block.replace('temporaryKey:','attachmentSlotId:').replace(',required:true',",semanticRole:'RETURNED_ARTIFACT'").replace(',required:false',",semanticRole:'RETURNED_ARTIFACT'")
        if 'attachmentSlotId:' in block and 'semanticRole:' not in block:
            block=block[:-1]+",semanticRole:'RETURNED_ARTIFACT'}"
        return block
    text=re.sub(r"attachments\s*:\s*\[\s*\{[^\n\]]*\}\s*\]",repair_attachments,text)
    path.write_text(text)

regression=root/'verify-file-first-response.mjs'
text=regression.read_text().replace("assert.equal(descriptor.contractProfileId,schema.CONTRACT_PROFILE_ID,'Response contract is not bound to the current contract profile.');","assert.equal(descriptor.contractProfileId,core.CONTRACT_PROFILE,'Response contract is not bound to the current contract profile.');")
regression.write_text(text)
