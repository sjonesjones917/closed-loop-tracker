from pathlib import Path
P=Path('verify-browser-extra.mjs'); s=P.read_text()
if 'action-first verification/artifact UX' not in s:
 s+=r'''

// reliability-hardening-final: context-aware action-first verification and verified-byte transfer remain visible without architecture-first clutter.
{
 const source=fs.readFileSync('app-core.js','utf8'),engineSource=fs.readFileSync('workflow-engine.js','utf8');
 for(const token of ['What you need to do now','Advanced verification details','Exact handoff — send / do not send / return','Download exact bytes','data-download-artifact','stagePurposeMarkup','verified artifact ready for transfer'])if(!source.includes(token))throw new Error('Missing action-first verification/artifact UX: '+token);
 if(!engineSource.includes("[22,23,24,25].includes(stage)"))throw new Error('Stage 22 is still omitted from exact finished-product handoff.');
 if(!source.includes('Stored bytes no longer match the canonical filename, byte size, and SHA-256. Download was blocked.'))throw new Error('Artifact download does not fail closed on byte-identity mismatch.');
}
'''
P.write_text(s)
print('browser UX regressions staged')
