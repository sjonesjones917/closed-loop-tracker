from pathlib import Path
p=Path('test-worker.js')
t=p.read_text()
t=t.replace("\\\\'use strict\\\\';","'use strict';").replace("\\'use strict\\';","'use strict';")
p.write_text(t)
v=Path('verify-controlling-spec.mjs')
s=v.read_text()
s=s.replace("includes('FILES YOU MUST RECEIVE\n- ORIGINAL')","includes('FILES YOU MUST RECEIVE\\n- ORIGINAL')")
v.write_text(s)
