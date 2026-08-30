from pathlib import Path
p=Path('test-worker.js')
t=p.read_text()
t=t.replace("\\\\'use strict\\\\';","'use strict';").replace("\\'use strict\\';","'use strict';")
p.write_text(t)
