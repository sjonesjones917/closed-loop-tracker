import fs from 'node:fs';
const path='.github/workflows/pages.yml';
let s=fs.readFileSync(path,'utf8');
const old="'appendOnlyHistoryRewritesAccepted','unsupportedTestIrTreatedAsExecutable'";
const neu="'appendOnlyHistoryRewritesAccepted','favorableAgentVerdictsOverridingContradictoryObservations','structurallyInsufficientEvidenceProducingMandatorySatisfaction','externallySupportedUnestablishedIndependenceTreatedAsProven','unsupportedTestIrTreatedAsExecutable'";
if(!s.includes(old))throw new Error('acceptance zero-invariant anchor missing');
s=s.replace(old,neu);
fs.writeFileSync(path,s);
fs.rmSync('.patch-ci.mjs');
