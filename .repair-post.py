from pathlib import Path
p=Path('test-worker.js')
t=p.read_text()
t=t.replace("\\\\'use strict\\\\';","'use strict';").replace("\\'use strict\\';","'use strict';")
p.write_text(t)
v=Path('verify-controlling-spec.mjs')
s=v.read_text()
s=s.replace("includes('FILES YOU MUST RECEIVE\n- ORIGINAL')","includes('FILES YOU MUST RECEIVE\\n- ORIGINAL')")
old="const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'];const ctx={console,TextEncoder,TextDecoder,crypto:crypto.webcrypto,structuredClone,Event:class Event{constructor(type){this.type=type}},dispatchEvent:()=>{}};ctx.globalThis=ctx;vm.createContext(ctx);for(const f of files)vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});\nconst core=ctx.closedLoopCore,schema=ctx.closedLoopWorkflowSchema,engine=ctx.closedLoopWorkflowEngine,prompts=ctx.closedLoopPromptEngine,ingestion=ctx.closedLoopResponseIngestion,runtime=ctx.closedLoopTestRuntime;"
new="const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'];globalThis.Event=class Event{constructor(type){this.type=type}};globalThis.dispatchEvent=()=>{};for(const f of files)vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});\nconst core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,runtime=globalThis.closedLoopTestRuntime;"
if old not in s: raise SystemExit('verifier VM bootstrap marker missing')
s=s.replace(old,new,1)
v.write_text(s)
