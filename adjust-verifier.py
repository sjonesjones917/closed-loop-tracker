from pathlib import Path
p=Path('verify-hash.mjs')
s=p.read_text()
old="assert(appCore.includes(\"function artifactControlMarkup(n,locked){if(n===19)\"),'Stage 04 artifact controls must retain the established visual rendering; repeat-input prevention belongs to canonical data flow, not UI suppression.');\nassert(!appCore.includes(\"function artifactControlMarkup(n,locked){if(n===4)return '';\"),'Stage 04 visual controls must not be hidden as a substitute for canonical intent reuse.');"
new="assert(appCore.includes(\"if([2,3,4].includes(n))return files.length?\"),'Stages 02-04 must consume captured project authority without soliciting the original Stage 01 intent file again.');\nassert(appCore.includes('No project-intent file should be attached or resent here.'),'Stages 02-04 must make one-time intent reuse explicit when previously captured stage files are displayed.');\nassert(!appCore.includes(\"if(n===4)return '';\"),'Stage 04 must not use a special hard-coded suppression branch in place of canonical intent reuse.');"
if old not in s: raise SystemExit('verify-hash Stage 04 assertion block missing')
p.write_text(s.replace(old,new,1))
