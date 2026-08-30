import fs from 'node:fs';

{
  const path='verify-prompt-semantics.mjs';
  let text=fs.readFileSync(path,'utf8');
  const oldLine="if(!record.prompt.includes('RESPONSE CONTRACT DEFINITIONS')||!record.prompt.includes('closed-loop-response-contract/2.4'))throw new Error('The agent cannot inspect the exact contract descriptor whose hash it must echo.');";
  const newLine="if(!record.prompt.includes('RESPONSE CONTRACT DEFINITIONS')||!record.prompt.includes('closed-loop-response-contract/3.1'))throw new Error('The agent cannot inspect the exact current /3 contract descriptor whose hash it must echo.');";
  if(text.includes(oldLine))text=text.replace(oldLine,newLine);
  else if(!text.includes(newLine))throw new Error('Remaining response-contract prompt assertion anchor missing.');
  fs.writeFileSync(path,text);
}

{
  const path='.github/workflows/pages.yml';
  let text=fs.readFileSync(path,'utf8');
  const before="'appendOnlyHistoryRewritesAccepted','unsupportedTestIrTreatedAsExecutable'";
  const after="'appendOnlyHistoryRewritesAccepted','favorableAgentVerdictsOverridingContradictoryObservations','structurallyInsufficientEvidenceProducingMandatorySatisfaction','externallySupportedUnestablishedIndependenceTreatedAsProven','unsupportedTestIrTreatedAsExecutable'";
  if(text.includes(before))text=text.replace(before,after);
  for(const token of [
    'favorableAgentVerdictsOverridingContradictoryObservations',
    'structurallyInsufficientEvidenceProducingMandatorySatisfaction',
    'externallySupportedUnestablishedIndependenceTreatedAsProven'
  ])if(!text.includes(token))throw new Error('Acceptance reduction is missing required zero-loss invariant '+token+'.');
  fs.writeFileSync(path,text);
}
