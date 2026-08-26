from pathlib import Path

def one(path, old, new):
    p=Path(path); s=p.read_text(); n=s.count(old)
    if n != 1: raise SystemExit(f'{path}: expected exactly one match, found {n}: {old[:100]!r}')
    p.write_text(s.replace(old,new))

one('workbook.js',"'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','KNOWN_AUTHORITATIVE_SOURCES'","'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES'")
one('workbook.js',"2:['SOURCE_SET_VERSION','AUTHORITY_HIERARCHY','SOURCE_RECORDS'","2:['SOURCE_SET_VERSION','AUTHORITY_HIERARCHY','SOURCE_APPLICABILITY_DETERMINATION','SOURCE_RECORDS'")
one('workbook.js','      "DEADLINE_OR_TEMPORAL_SCOPE",\n      "KNOWN_AUTHORITATIVE_SOURCES",','      "DEADLINE_OR_TEMPORAL_SCOPE",\n      "DESIRED_SOURCE_COUNT",\n      "KNOWN_AUTHORITATIVE_SOURCES",')
one('workbook.js','      "AUTHORITY_HIERARCHY",\n      "KNOWN_CONTROLLING_SOURCES_EXAMINED"','      "AUTHORITY_HIERARCHY",\n      "SOURCE_APPLICABILITY_DETERMINATION",\n      "KNOWN_CONTROLLING_SOURCES_EXAMINED"')

one('workflow-schema.js',"  'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','KNOWN_AUTHORITATIVE_SOURCES',","  'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES',")
p=Path('workflow-schema.js'); s=p.read_text(); marker='function ownerFromPartition(partition,name,label)'
if 'const STAGE_FIELD_TYPE_OVERRIDES=' not in s:
    insert="const STAGE_FIELD_TYPE_OVERRIDES=Object.freeze({\n  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null})}),\n  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})})\n});\n"
    if marker not in s: raise SystemExit('workflow-schema.js: owner marker missing')
    s=s.replace(marker,insert+marker,1)
    old="const producer=stageFieldProducer(stage,name),type=EXPLICIT_STAGE_FIELD_TYPES[String(stage)]?.[name];"
    new="const producer=stageFieldProducer(stage,name),type=STAGE_FIELD_TYPE_OVERRIDES[String(stage)]?.[name]||EXPLICIT_STAGE_FIELD_TYPES[String(stage)]?.[name];"
    if old not in s: raise SystemExit('workflow-schema.js: stage field type expression missing')
    s=s.replace(old,new,1)
    p.write_text(s)

one('app-core.js',"DEADLINE_OR_TEMPORAL_SCOPE:raw.userJobInput?.deadlineOrTemporalScope||'',KNOWN_AUTHORITATIVE_SOURCES:","DEADLINE_OR_TEMPORAL_SCOPE:raw.userJobInput?.deadlineOrTemporalScope||'',DESIRED_SOURCE_COUNT:raw.userJobInput?.desiredSourceCount??null,KNOWN_AUTHORITATIVE_SOURCES:")
one('app-core.js',"['DEADLINE_OR_TEMPORAL_SCOPE','Temporal scope','input'],['KNOWN_AUTHORITATIVE_SOURCES'","['DEADLINE_OR_TEMPORAL_SCOPE','Temporal scope','input'],['DESIRED_SOURCE_COUNT','Desired / suggested number of sources','number'],['KNOWN_AUTHORITATIVE_SOURCES'")
one('app-core.js',"deadlineOrTemporalScope:next.job.DEADLINE_OR_TEMPORAL_SCOPE,knownAuthorities:","deadlineOrTemporalScope:next.job.DEADLINE_OR_TEMPORAL_SCOPE,desiredSourceCount:next.job.DESIRED_SOURCE_COUNT,knownAuthorities:")
one('app-core.js',"${t==='textarea'?`<textarea data-job=\"${k}\">${esc(current.job[k]||'')}</textarea>`:`<input data-job=\"${k}\" value=\"${esc(current.job[k]||'')}\">`}","${t==='textarea'?`<textarea data-job=\"${k}\">${esc(current.job[k]||'')}</textarea>`:`<input data-job=\"${k}\" type=\"${t==='number'?'number':'text'}\" value=\"${esc(current.job[k]??'')}\">`}")

one('prompt-engine.js','${show(open.slice(-20))}','${show(open)}')
one('prompt-engine.js',"EXPLICIT USER REQUIREMENTS:\n${show(j.EXPLICIT_USER_REQUIREMENTS)}\n\nAUTHORIZED BOUNDED CONTEXT FOR THIS STAGE","EXPLICIT USER REQUIREMENTS:\n${show(j.EXPLICIT_USER_REQUIREMENTS)}\n\n${stage===2?`STAGE 02 SOURCE DISCOVERY GUIDANCE\nDESIRED OR SUGGESTED SOURCE COUNT: ${show(j.DESIRED_SOURCE_COUNT)}\nTreat this count as guidance, not a quota. Prefer the most authoritative and reputable sources appropriate to the domain, prioritizing primary, official, controlling sources where they exist. Verify identity, currency, applicability, and authority before proposing a source. If no legitimate external governing source applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.\n`:''}\nAUTHORIZED BOUNDED CONTEXT FOR THIS STAGE")

p=Path('workflow-engine.js'); s=p.read_text()
old="""    case 2:{
      requireAccepted();
      const noApplicableSource=collection('sources').length===0&&upper(project.stages[2].agentData?.AUTHORITY_HIERARCHY)==='NO_APPLICABLE_EXTERNAL_SOURCE'&&String(project.stages[2].agentData?.KNOWN_CONTROLLING_SOURCES_EXAMINED||'').trim().length>0;
      if(!noApplicableSource)requireCount('sources',1,'At least one inspected independent external governing source or an evidence-supported NO_APPLICABLE_EXTERNAL_SOURCE determination is required.');
      for(const source of collection('sources'))reasons.push(...schema.sourceClassificationIssues(recordFields(source)).map(issue=>`${recordId(source,'sources')}: ${issue}`));
      if(collection('sourceConflicts').some(record=>['UNRESOLVED','BLOCKED','UNKNOWN','OPEN'].includes(upper(recordValue(record,'RESOLUTION_STATUS')))))reasons.push('An external-source conflict remains unresolved or blocked.');
      break;
    }
    case 3:{
      requireAccepted();
      const sourceIds=all('sources').map(record=>recordId(record,'sources'));
      const noApplicableSource=sourceIds.length===0&&upper(project.stages[2].agentData?.AUTHORITY_HIERARCHY)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!noApplicableSource)requireCount('research',1);
      const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||'')));
      const missing=sourceIds.filter(id=>!researched.has(id));
      if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);
      break;
    }"""
new="""    case 2:{
      requireAccepted();const determination=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION);const sources=collection('sources');
      if(!sources.length){if(determination!=='NO_APPLICABLE_EXTERNAL_SOURCE')reasons.push('Either at least one legitimate external governing source or an explicit NO_APPLICABLE_EXTERNAL_SOURCE determination is required.');else{const latest=changes.at(-1),proposal=safe(project.projectData.responseProposals).find(x=>x.proposalId===latest?.proposalId);if(!safe(proposal?.evidence).length)reasons.push('NO_APPLICABLE_EXTERNAL_SOURCE requires preserved supporting evidence.');}}
      else if(determination!=='APPLICABLE_SOURCES_ESTABLISHED')reasons.push('Established source records require SOURCE_APPLICABILITY_DETERMINATION = APPLICABLE_SOURCES_ESTABLISHED.');
      for(const source of sources)reasons.push(...schema.sourceClassificationIssues(recordFields(source)).map(issue=>`${recordId(source,'sources')}: ${issue}`));
      if(collection('sourceConflicts').some(record=>['UNRESOLVED','BLOCKED','UNKNOWN','OPEN'].includes(upper(recordValue(record,'RESOLUTION_STATUS')))))reasons.push('An external-source conflict remains unresolved or blocked.');
      break;
    }
    case 3:{
      requireAccepted();const sourceIds=all('sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length){if(!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');break;}
      requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);break;
    }"""
if s.count(old)!=1: raise SystemExit(f'workflow-engine.js: expected Stage 2/3 gate block once, found {s.count(old)}')
p.write_text(s.replace(old,new,1))

one('verify-full-cycle.mjs',"data(2,{stageData:{AUTHORITY_HIERARCHY:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'Evidence-supported search found no applicable external governing source.'}});","data(2,{stageData:{AUTHORITY_HIERARCHY:'No external authority applies.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'Evidence-supported search found no applicable external governing source.'}});")

Path('README.md').write_text("""# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

One static, phone-first vanilla-JavaScript application implements exactly 30 closed-loop reliability stages. There is no Stage 31.

## Responsibility boundaries

| Responsibility | Final owner |
|---|---|
| Workflow stages, names, roles, declared completion conditions | `workbook.js` |
| Field ownership, types, enums, relationships, stage/operation contracts | `workflow-schema.js` |
| Canonical serialization and SHA-256 | `hash.js` |
| Prompt content, bounded context selection, prompt identity | `prompt-engine.js` |
| Parsing, validation, proposal planning, response disposition | `response-ingestion.js` |
| Derived values, current-scope selection, gates, invalidation, release logic | `workflow-engine.js` |
| Projects, revisions, artifact bytes, migration, integrity, import/export | `project-store.js` |
| Rendering and operator actions | `app-core.js` |
| Static shell, CSS, accessibility, ordered module loading | `index.html` |
| Source, lifecycle, browser, deployment, live verification | `.github/workflows/pages.yml` |

No second parser, store, workflow engine, prompt layer, application shell, runtime wrapper guard, MutationObserver, framework runtime, service worker, or backend is part of the supported architecture.

## Current contracts

- Project schema: `closed-loop-project/2`
- Workflow identity: `mobile-closed-loop/30`
- Stage count: `30`
- Response schema: `closed-loop-stage-response/2`
- Project package schema: `closed-loop-project-package/1`

Every accepted response is bound to the current project, stage, operation, project revision, instruction ID, instruction-body SHA-256, response-contract SHA-256, context signature, and operation-relevant scope.

## Persistence and backup

The application uses one IndexedDB database named `closed-loop-reliability` with `projects`, `artifacts`, and `meta` stores. Project writes use revision compare-and-swap. Actual artifact Blob bytes are stored and rehashed. Raw output is durably captured before parsing; proposal persistence and canonical acceptance are separate operations. Integrity failures fail closed or quarantine rather than silently becoming canonical state.

Browser-local persistence is not protection against device destruction, browser-profile deletion, private-mode eviction, or clearing site data. Retain verified complete exports outside the browser. There is no backend, cloud synchronization, authentication, or multi-device coordination.

## Migration policy

The deterministic legacy migration is `human-project/30 -> closed-loop-project/2`. It preserves identity, all 30 stages, raw outputs, receipts, history, unknown extension data, and the original payload in a non-operational migration archive.

## Supported browser contract

Current Chromium desktop and current Android Chrome, minimum 320 CSS px, with IndexedDB, Web Crypto, Blob, `CompressionStream`, and `DecompressionStream`. Safari, Firefox, service-worker offline operation, and multi-device synchronization are not claimed.

## Verification

```bash
node build-test-project.mjs
node verify.mjs
node verify-ingestion.mjs
node verify-complete.mjs
node verify-full-cycle.mjs
node verify-prompt-semantics.mjs
PAGE_URL=http://127.0.0.1:4173/ node verify-browser.mjs
PAGE_URL=http://127.0.0.1:4173/ node verify-browser-extra.mjs
```

The single Pages workflow runs source/schema/ownership, ingestion, gates, continuous lifecycle, semantic prompt contradiction, local Chromium, deployment, exact deployed-byte, and deployed Chromium verification before publishing acceptance status.

A green acceptance report supports only: `100% conformant to the tested deterministic invariants`. Operational reliability must be measured from real accepted operations; with zero observed silent failures across N materially independent accepted operations, the approximate 95% upper failure-rate bound is `3 / N`.
""")
