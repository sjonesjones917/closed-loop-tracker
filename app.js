(()=>{'use strict';
const scripts=[
  'workflow-model.js?v=closed-loop-ingestion-20260825-r1',
  'workflow-engine.js?v=closed-loop-ingestion-20260825-r1',
  'project-store.js?v=closed-loop-ingestion-20260825-r1',
  'response-ingestion.js?v=closed-loop-ingestion-20260825-r1',
  'prompt-engine.js?v=closed-loop-ingestion-20260825-r1',
  'app-core.js?v=closed-loop-ingestion-20260825-r1'
];
for(const src of scripts)document.write(`<script src="${src}"><\\/script>`);
})();
