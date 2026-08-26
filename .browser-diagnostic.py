from pathlib import Path
p=Path('verify-browser.mjs')
text=p.read_text()
old="await waitExpr(cdp,`document.readyState==='complete'`);await waitExpr(cdp,`globalThis.closedLoopAppReady===true`,20000);assert(!(await evalValue(cdp,`globalThis.closedLoopAppError`)),await evalValue(cdp,`globalThis.closedLoopAppError`));"
new="await waitExpr(cdp,`document.readyState==='complete'`);await waitExpr(cdp,`globalThis.closedLoopAppReady===true||!!globalThis.closedLoopAppError`,20000);const startupError=await evalValue(cdp,`globalThis.closedLoopAppError`);assert(!startupError,startupError);"
if text.count(old)!=1: raise SystemExit(f'expected startup wait target once, found {text.count(old)}')
p.write_text(text.replace(old,new,1))
