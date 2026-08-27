from pathlib import Path
import re, hashlib

p=Path('app-core.js')
text=p.read_text()
anchor="function currentPromptRecord(n){const options=promptOptions(n);return safe(current.projectData.generatedPrompts).filter(x=>promptMatches(x,n,options)&&promptVersionCurrent(x)).at(-1)||null;}\n"
insert=anchor+"function responsePromptRecord(n,text){let envelope=null;try{envelope=ingestion.strictParse(text);}catch{}const instructionId=String(envelope?.promptIdentity?.instructionId||'').trim();if(instructionId){const referenced=safe(current.projectData.generatedPrompts).find(x=>Number(x.stage)===Number(n)&&(x.instructionId||x.promptId)===instructionId);if(referenced)return referenced;}return currentPromptRecord(n);}\n"
if text.count(anchor)!=1: raise SystemExit(f'currentPromptRecord anchor count={text.count(anchor)}')
text=text.replace(anchor,insert,1)
old="  const n=current.activeStage,text=$('#stage-output')?.value||'';let prompt;try{prompt=await savePromptRecord(n);}catch(error){alert(error.message||error);return;}let captured;"
new="  const n=current.activeStage,text=$('#stage-output')?.value||'',prompt=responsePromptRecord(n,text);if(!prompt){alert('No saved instruction matches this response. Save and copy the current instruction, run that exact instruction in ChatGPT, then paste its final JSON here. Parse / validate does not create a new instruction.');return;}let captured;"
if text.count(old)!=1: raise SystemExit(f'prepareStageResponse anchor count={text.count(old)}')
text=text.replace(old,new,1)
p.write_text(text)

v=Path('verify.mjs')
vt=v.read_text()
marker="const appSourceForStatus=fs.readFileSync('app-core.js','utf8');\n"
reg="""const appSourceForStatus=fs.readFileSync('app-core.js','utf8');
const prepareSource=appSourceForStatus.match(/async function prepareStageResponse\\(\\)\\{[\\s\\S]*?\\n\\}/)?.[0]||'';
if(!prepareSource||prepareSource.includes('savePromptRecord(n)'))throw new Error('Parse / validate still creates a new controlling instruction before validation.');
for(const token of ['function responsePromptRecord(n,text)','ingestion.strictParse(text)','Parse / validate does not create a new instruction.'])if(!appSourceForStatus.includes(token))throw new Error(`Returned-instruction validation regression missing ${token}.`);
"""
if vt.count(marker)!=1: raise SystemExit(f'verify marker count={vt.count(marker)}')
vt=vt.replace(marker,reg,1)
v.write_text(vt)

runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data=Path(path).read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
manifest=''.join(f'{name}:{git_blob_sha(name)}\n' for name in runtime_files).encode()
runtime_id='runtime-'+hashlib.sha256(manifest).hexdigest()[:16]
i=Path('index.html')
it=i.read_text()
it2=re.sub(r'runtime-[0-9a-f]{16}',runtime_id,it)
if it2==it: raise SystemExit('runtime token not replaced')
i.write_text(it2)
