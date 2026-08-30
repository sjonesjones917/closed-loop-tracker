import fs from 'node:fs';

const scan = JSON.parse(fs.readFileSync('candidate-scan.json','utf8'));
const summary = {
  generatedAt: scan.generatedAt,
  main: scan.main,
  scanned: scan.scanned,
  candidates: scan.candidates.map(candidate => ({
    branch: candidate.branch,
    sha: candidate.sha,
    date: candidate.date,
    behind: candidate.behind,
    ahead: candidate.ahead,
    score: candidate.score,
    featureScore: candidate.featureScore,
    missingFeatures: Object.entries(candidate.features).filter(([,value]) => !value).map(([key]) => key),
    testsPresent: candidate.testsPresent,
    changedFiles: candidate.changedFiles
  })),
  dynamic: scan.dynamic.map(result => ({
    branch: result.branch,
    sha: result.sha,
    syntax: result.syntax,
    build: result.build,
    passedTests: result.tests.filter(test => test.status === 0).map(test => test.file),
    failedTest: result.tests.find(test => test.status !== 0) || null,
    error: result.error
  }))
};
fs.writeFileSync('candidate-summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
