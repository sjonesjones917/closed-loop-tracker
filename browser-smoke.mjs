import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const executablePath = candidates.find(candidate => fs.existsSync(candidate));
if (!executablePath) throw new Error(`No Chromium executable found. Checked: ${candidates.join(', ')}`);

const retainedProject = JSON.parse(fs.readFileSync('SELF_VERIFIED_PROJECT.json', 'utf8'));
const port = 4173;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise(resolve => setTimeout(resolve, 700));

const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => {
  if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/i.test(message.text())) errors.push(message.text());
});

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  if ((await page.title()) !== 'Closed-Loop Agent Reliability') throw new Error('Wrong browser title.');
  if ((await page.locator('h1').innerText()) !== 'Closed-Loop Agent Reliability') throw new Error('Wrong browser heading.');

  await page.waitForFunction(({ name, id }) => {
    try {
      return JSON.parse(localStorage.getItem('closedLoopReliability.projects') || '[]').some(project => project.projectId === id && project.name === name);
    } catch {
      return false;
    }
  }, { name: retainedProject.name, id: retainedProject.projectId }, { timeout: 7000 });

  const loadedRetainedProject = await page.evaluate(id => {
    const projects = JSON.parse(localStorage.getItem('closedLoopReliability.projects') || '[]');
    return projects.find(project => project.projectId === id) || null;
  }, retainedProject.projectId);
  if (!loadedRetainedProject) throw new Error('Retained application project is not loaded as a native application project.');
  if (loadedRetainedProject.schema !== 'closed-loop-project/1') throw new Error('Retained application project does not use the current project schema.');
  if (!Array.isArray(loadedRetainedProject.stages) || loadedRetainedProject.stages.length !== 31 || loadedRetainedProject.stages.some((stage, index) => stage.number !== index + 1 || stage.status !== 'COMPLETE')) throw new Error('Retained application project does not preserve all 31 completed stages.');
  if (loadedRetainedProject.stages[0]?.assignedActorType !== 'HUMAN_AGENT_TEAM') throw new Error('Retained application project omits first-class human participation.');
  if (!loadedRetainedProject.retainedProjectPurpose || !loadedRetainedProject.retainedProjectBehavior) throw new Error('Retained application project is not identified as a normal project.');
  if (!/Closed-Loop Agent Reliability application/i.test(`${loadedRetainedProject.name} ${loadedRetainedProject.job?.exactUserObjective || ''}`)) throw new Error('Retained project is not about the application itself.');
  if (/\b(?:v13|version 13|sidecar|sidecar-filename defect|repair-task tracker|fix stage)\b/i.test(JSON.stringify(loadedRetainedProject.job || {}))) throw new Error('Retained project still contains obsolete application-number, filename, or repair framing.');

  await page.click('.topNav [data-view="projects"]');
  const projectsText = await page.locator('#projectsView').innerText();
  if (!projectsText.includes(retainedProject.name) && !projectsText.includes(retainedProject.projectId)) throw new Error('Retained application project is not visible in the normal Projects view.');
  if (!projectsText.includes('normal completed project about the entire Closed-Loop Agent Reliability application')) throw new Error('Retained project scope is not explained correctly in the Projects view.');
  await page.waitForFunction(() => /available in the normal Projects list/i.test(document.querySelector('[data-self-project-status]')?.textContent || ''), null, { timeout: 3000 });

  const visibleText = await page.locator('body').innerText();
  for (const forbidden of ['Agent response', 'Paste agent response', 'PROMPT_RULESET:', 'Reload verified self-project export']) {
    if (visibleText.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Visible prompt-relay text remains: ${forbidden}`);
  }
  if (errors.length) throw new Error(`Retained project load errors: ${errors.join(' | ')}`);

  await page.click('#newProjectBtn');
  await page.fill('#newName', 'Arbitrary engineering job');
  await page.fill('#newObjective', 'Determine and deliver a verified engineering result from user intent and independent external authority.');
  await page.fill('#newDeliverables', 'A completed, verified, accepted, and releasable result.');
  await page.selectOption('#newOwnerType', 'HUMAN');
  await page.fill('#newOwnerName', 'Human project owner');
  await page.click('#newProjectForm button[type="submit"]');

  const humanProject = await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('closedLoopReliability.projects') || '[]');
    return projects.find(project => project.name === 'Arbitrary engineering job') || null;
  });
  if (!humanProject) throw new Error('Human-owned project was not created.');
  if (!/HUMAN/.test(JSON.stringify(humanProject)) || !/Human project owner/.test(JSON.stringify(humanProject))) throw new Error('Human owner type and name were not retained by the application.');
  if ((humanProject.stages || []).some(stage => stage.status === 'COMPLETE')) throw new Error('A new user project did not begin at 0 of 31 complete.');

  const scopeFields = page.locator('[data-job-field]');
  if ((await scopeFields.count()) !== 20) throw new Error('Stage 1 does not render all 20 scopes.');
  await scopeFields.evaluateAll(elements => elements.forEach((element, index) => {
    if (!element.value) element.value = `Explicit scope value ${index + 1}; NONE where not applicable.`;
  }));
  await page.click('[data-complete-stage="1"]');
  await page.waitForTimeout(100);
  await page.click('.topNav [data-view="workflow"]');
  if ((await page.locator('.stagePanel h2').innerText()) !== 'INVENTORY SOURCES') throw new Error('Stage 1 did not advance to Stage 2.');
  if ((await page.locator('.stageButton').count()) !== 31) throw new Error('Workflow does not render exactly 31 stages.');

  await page.click('.stagePanel [data-add-record="externalSources"]');
  if ((await page.locator('#recordDialogTitle').innerText()) !== 'Add external source') throw new Error('External source editor did not open.');
  if ((await page.locator('#rf-externallyAccessed').count()) !== 1 || (await page.locator('#rf-independentOfArtifact').count()) !== 1) throw new Error('External source non-circularity controls are missing.');
  await page.click('[data-close-dialog="recordDialog"]');

  await page.click('[data-view="records"]');
  const recordsText = await page.locator('#recordsView').innerText();
  for (const label of ['USER JOB INPUT', 'EXTERNAL RESEARCH SOURCE', 'WORKFLOW-GENERATED ARTIFACT']) {
    if (!recordsText.includes(label)) throw new Error(`Information-class UI is missing ${label}.`);
  }

  await page.screenshot({ path: 'PHONE_SMOKE_393.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.click('[data-view="workflow"]');
  await page.screenshot({ path: 'PHONE_SMOKE_320.png', fullPage: false });
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);

  const report = {
    status: 'PASS',
    title: await page.title(),
    retainedApplicationProjectVisible: true,
    retainedApplicationProjectNative: true,
    retainedApplicationProjectName: retainedProject.name,
    retainedApplicationProjectStagesComplete: 31,
    retainedApplicationProjectHumanParticipation: true,
    retainedApplicationProjectNormalBehavior: true,
    newHumanProjectCreated: true,
    newHumanProjectStartsAtZero: true,
    stagesRendered: await page.locator('.stageButton').count(),
    stage1ScopesRendered: await scopeFields.count(),
    externalSourceGuardRendered: true,
    informationClassesRendered: 3,
    promptRelayVisible: false,
    phoneWidthsTested: [393, 320],
    browserErrors: errors
  };
  fs.writeFileSync('BROWSER_SMOKE_REPORT.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
