from pathlib import Path
p=Path('workflow-engine.js');s=p.read_text()
old="const contexts=recordsForCurrentScope(project,'freshContexts').filter(r=>noRun(recordValue(r,'RUN_ID'))),context=contexts.at(-1);if(!context)throw new Error('A current fresh production context is required.');"
new="const usedContextIds=new Set(records(project,'products').filter(isActiveRecord).map(r=>String(recordValue(r,'PRODUCTION_CONTEXT_ID')||''))),contexts=recordsForCurrentScope(project,'freshContexts').filter(r=>noRun(recordValue(r,'RUN_ID'))&&!usedContextIds.has(recordId(r,'freshContexts'))),context=contexts.at(-1);if(!context)throw new Error('A current unused fresh production context is required.');"
if old not in s: raise SystemExit('product context selector anchor missing')
p.write_text(s.replace(old,new,1))
p=Path('verify-full-cycle.mjs');s=p.read_text()
old="const productId=engine.recordId(product,'products');data(21,{records:{products:"
new="const productId=engine.recordId(product,'products');let reusedProductionContext=false;try{engine.reserveProductExecution(p,{operatorLabel:'FULL_CYCLE'});}catch(error){reusedProductionContext=/unused fresh production context/i.test(String(error.message||error));}assert(reusedProductionContext,'Stage 21 reused a production context that had already been reserved for an active product execution.');data(21,{records:{products:"
if old not in s: raise SystemExit('full-cycle product reservation anchor missing')
p.write_text(s.replace(old,new,1))
