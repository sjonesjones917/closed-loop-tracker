import fs from 'node:fs';
let s=fs.readFileSync('apply-v3-current.mjs','utf8');
s=s.replace("contractVersion:'closed-loop-response-contract/2.4'","contractVersion:'closed-loop-response-contract/2.5'");
const oldRuntime=` t=one(t,'<script defer src="workflow-schema.js?v=runtime-c2144fb2d4d5b4c5"></script>\\n<script defer src="workflow-engine.js?v=runtime-c2144fb2d4d5b4c5"></script>','<script defer src="workflow-schema.js?v=runtime-c2144fb2d4d5b4c5"></script>\\n<script defer src="test-runtime.js?v=runtime-c2144fb2d4d5b4c5"></script>\\n<script defer src="workflow-engine.js?v=runtime-c2144fb2d4d5b4c5"></script>','runtime order');`;
const newRuntime=` t=reOne(t,/<script defer src="workflow-schema\\.js\\?v=([^\"]+)"><\\/script>\\n<script defer src="workflow-engine\\.js\\?v=([^\"]+)"><\\/script>/,'<script defer src="workflow-schema.js?v=$1"></script>\\n<script defer src="test-runtime.js?v=$1"></script>\\n<script defer src="workflow-engine.js?v=$1"></script>','runtime order');`;
if(!s.includes(oldRuntime))throw new Error('Driver could not locate runtime-order transform statement.');
s=s.replace(oldRuntime,newRuntime);
fs.writeFileSync('/tmp/apply-v3-current.mjs',s);
await import('file:///tmp/apply-v3-current.mjs');
