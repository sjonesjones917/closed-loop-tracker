from pathlib import Path
import re, hashlib
p=Path('prompt-engine.js'); s=p.read_text()
s=s.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/11';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/12';")
old='This stage owns job definition and clarification only.'
new=('This stage owns job definition and clarification only. Stage 01 also owns proactive human intake: before finalizing Stage 01, collect the human-specific facts and decisions that are already foreseeable as necessary to achieve the requested outcome, even when a later stage will use them. Ask only for facts or choices that must come from the human; do not ask the human for common domain knowledge, facts available in supplied materials, or facts the agent can obtain from authorized research/tools. If the human genuinely does not know a foreseeable item, record it as unresolved rather than inventing it.')
assert old in s
s=s.replace(old,new,1)
pat=re.compile(r'Do not (?:inventory the invention packet internally in Stage 01(?: and|\.)\s*)?do not require jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices merely to finish Stage 01;[^\n]*?Do not research patent authority',re.I)
replacement=('Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers. However, when any of these are foreseeable human-specific inputs for the requested patent outcome and are not already supplied, ask the human for them conversationally during Stage 01. If the human does not know or cannot decide yet, record that item as unresolved for the earliest later stage that actually requires it. Do not research patent authority')
s,n=pat.subn(replacement,s,count=1)
assert n==1, 'patent intake sentence not found'
s=s.replace('- Return exactly one JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.', '- When you have enough information to submit the current stage result, return exactly one final JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Before that final submission, normal concise human dialogue is allowed and required when human-only information is needed. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.')
s=s.replace('Do not ask conversational questions outside the JSON response.', 'Ask necessary human questions conversationally before the final JSON response; do not encode a question as JSON merely to talk to the human.')
marker='MANDATORY RESPONSE RULES'
insert='''HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE\nYou are working with a human in a normal ChatGPT conversation, commonly on a phone. Make the human experience simple. If the current stage needs a human-specific fact, preference, observation, authorization, or decision that is not already available, ask the smallest useful set of plain-language questions conversationally before producing the final machine response. Briefly explain why a question matters when that is not obvious. Do not make the human read or answer JSON. Do not ask for information already present in supplied materials or canonical context, and do not ask the human for facts you can reliably determine from authorized sources, tools, or ordinary domain knowledge. Continue the conversation until you have enough information for the current stage, or the human says an item is unknown/unavailable. Then produce the final JSON response only.\nStage 01 should collect all human-specific information already foreseeable as needed to achieve the requested outcome, not merely the minimum needed to name the job. Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision; when that happens, ask the human conversationally at that later stage rather than guessing. Keep human-facing explanations concise, complete, accurate, and action-oriented.\n\n'''+marker
assert marker in s
s=s.replace(marker,insert,1)
p.write_text(s)

p=Path('index.html'); h=p.read_text()
css='''.app-help{max-width:1180px;margin:8px auto 0;padding:0 10px}.app-help details{border:1px solid var(--line);border-radius:10px;background:#fff}.app-help summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;min-height:44px;padding:8px 10px;font-weight:800;font-size:12px}.app-help summary::-webkit-details-marker{display:none}.app-help summary b{display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:var(--accent-soft);color:var(--accent)}.app-help .help-body{padding:0 10px 10px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}.app-help ol{margin:8px 0 0;padding-left:20px}.app-help li+li{margin-top:5px}.app-help strong{color:var(--ink)}\n'''
assert '</style>' in h
h=h.replace('</style>',css+'</style>',1)
guide='''<div class="app-help"><details><summary><b>?</b> How to use this stage</summary><div class="help-body"><ol><li><strong>Copy or send the current instruction to ChatGPT.</strong> Keep using the same chat for that stage.</li><li><strong>Answer the agent normally.</strong> If it needs information only you can provide, it should ask short plain-language questions. Do not paste those questions into this app.</li><li><strong>Wait for the final JSON.</strong> When the agent has enough information, it should return one JSON object with no extra prose.</li><li><strong>Paste only that final JSON into the response box</strong>, then tap <em>Parse / validate response</em>. Review the proposed change before accepting it.</li></ol><p>If research or requirements reveal a new human-only decision later, the agent may ask you then. That is expected; it must not guess.</p></div></details></div>\n'''
needle='<nav class="view-tabs" id="view-tabs" aria-label="Project views"></nav>\n'
assert needle in h
h=h.replace(needle,needle+guide,1)
p.write_text(h)

p=Path('verify-browser.mjs'); b=p.read_text()
needle="await waitExpr(cdp,`globalThis.closedLoopAppReady===true`,20000);assert(!(await evalValue(cdp,`globalThis.closedLoopAppError`)),await evalValue(cdp,`globalThis.closedLoopAppError`));"
assert needle in b
b=b.replace(needle,needle+"\n assert(await evalValue(cdp,`Boolean(document.querySelector('.app-help details')&&!document.querySelector('.app-help details').open)`),'Human guide must exist and start collapsed.');",1)
p.write_text(b)

p=Path('verify-prompt-semantics.mjs'); v=p.read_text()
v=v.replace("!record.prompt.includes('Do not ask conversational questions outside the JSON response')","!record.prompt.includes('Ask necessary human questions conversationally before the final JSON response')")
needle="if(!record.prompt.includes('Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred'))issues.push('EXTERNAL_ACTION_HONESTY_RULE_MISSING');"
assert needle in v
collab="if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');\n  "+needle
v=v.replace(needle,collab,1)
p.write_text(v)

p=Path('index.html'); h=p.read_text(); files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']; manifest=''
for f in files:
    bb=Path(f).read_bytes(); blob=hashlib.sha1(b'blob '+str(len(bb)).encode()+b'\0'+bb).hexdigest(); manifest+=f'{f}:{blob}\n'
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
h=re.sub(r'(<script\s+defer\s+src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)[^"]+("\s*></script>)',lambda m:m.group(1)+token+m.group(2),h)
p.write_text(h)
