from pathlib import Path

p=Path('verify-stage-prompts-complete.mjs')
s=p.read_text()
start=s.find('const semantic={')
end=s.find('\n};\nlet promptsChecked=0;',start)
if start<0 or end<0:
    raise SystemExit('verify-stage-prompts-complete.mjs: semantic block not found')
end+=3
replacement="""const semantic={
  1:['BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','APPLICATION INTAKE MANIFEST unit exactly once'],
  2:['until no new applicable controlling or correctness-relevant external source category is found','Do not stop at the first plausible source'],
  3:['Every current Stage 02 source must receive current research coverage','required conflict-and-exception pass','at least one second complete pass','Repeat until the latest complete pass finds no new material'],
  4:['APPLICATION OBLIGATION MANIFEST','Every obligationId','No obligation may disappear'],
  5:['Resolve the current job requirement set exhaustively','repeat the defect review against the resulting current requirement set'],
  6:['closed-loop-test-spec/1','TEST_IR','how a defective product could falsely appear compliant'],
  7:['Fixture definition is not execution','Record expected rejection, actual observed result, and evidence sufficient'],
  8:['Author the production instruction only','Create complete requirement-to-instruction trace records'],
  9:['re-review the entire current instruction from the beginning','Do not execute target production during preflight'],
  10:['the human selects authorized components where required','Do not invent candidate, iteration, byte hash, or version identities'],
  11:['Execute exactly one application-reserved run lane','Do not compare or verify runs here'],
  12:['REQ_ID × RUN_ID × TEST_ID','Execute each applicable test through its declared capable route','Do not self-validate'],
  13:['Cover all ten current runs for every mandatory requirement','Every correctness-affecting variance must result in a defect relationship'],
  14:['trace causality backward through product/output, execution, instruction, requirement, research, source, user input, tool/configuration, artifact, and audit/evidence layers','earliest defective layer'],
  15:['actually execute the pre-correction case','Do not claim post-correction success here'],
  16:['earliest defective layer already identified by Stage 14','create new versions rather than editing in place'],
  18:['Do not substitute narrative confidence for application calculations','application owns all metrics and the convergence determination'],
  20:['Human baseline authorization is required','The application assigns baseline identity'],
  21:['Generate the actual finished product only from the approved production baseline','The exact returned bytes become the product under test'],
  22:['never claim, imitate, fabricate, or substitute for an application-native execution','Native-ready tests require no external agent execution'],
  23:['independent meaning-based verification','source evidence where applicable'],
  24:['Perform independent adversarial verification only','Exercise every applicable attack category and active historical regression pattern'],
  25:['Inspect only the exact final representations, views, transformations, packages, and delivery artifacts','Do not invent human inspection'],
  26:['Establish process correctness and product correctness as separate semantic reviews','Do not hide contradictory evidence in aggregate counts'],
  27:['do not choose or write the release state','The application alone creates exactly one idempotent ACCEPTED, REJECTED, or BLOCKED'],
  28:['Compare by canonical ARTIFACT_ID and authorized filename, never array order','The application rehashes actual bytes'],
  29:['For every mandatory requirement use the supplied current authority','The application constructs the canonical evidence chain','do not fabricate it'],
  30:['append-only current defect','Do not rewrite or delete prior defect/regression history']
};"""
s=s[:start]+replacement+s[end:]
p.write_text(s)
