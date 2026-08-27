import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const replaceOnce = (text, oldText, newText, label) => {
  const first = text.indexOf(oldText);
  if (first < 0) throw new Error(`Missing target: ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`Non-unique target: ${label}`);
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
};

let workflow = read('.github/workflows/pages.yml');
workflow = replaceOnce(workflow,
`      - uses: actions/upload-pages-artifact@v3
        with: {path: .}
      - id: deployment
        uses: actions/deploy-pages@v4`,
`      - uses: actions/upload-pages-artifact@v3
        with:
          name: github-pages-\${{ github.run_id }}-\${{ github.run_attempt }}
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
        with:
          artifact_name: github-pages-\${{ github.run_id }}-\${{ github.run_attempt }}`,
'Pages artifact identity');
write('.github/workflows/pages.yml', workflow);

let verify = read('verify.mjs');
const target = "const html=fs.readFileSync('index.html','utf8'),orderedScripts=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];";
const replacement = target + `\nif(fs.existsSync('.github/workflows/pages.yml')){const pagesWorkflow=fs.readFileSync('.github/workflows/pages.yml','utf8');const uniquePagesArtifact='github-pages-\${{ github.run_id }}-\${{ github.run_attempt }}';if(!pagesWorkflow.includes('name: '+uniquePagesArtifact)||!pagesWorkflow.includes('artifact_name: '+uniquePagesArtifact))throw new Error('Pages upload and deploy must share one run-attempt-unique artifact identity.');}`;
verify = replaceOnce(verify, target, replacement, 'deployment artifact regression guard');
write('verify.mjs', verify);
