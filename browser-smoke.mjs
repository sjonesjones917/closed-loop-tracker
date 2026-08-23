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

const pageErrors = [];
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
page.on('pageerror', error => pageErrors.push(String(error)));
page.on('console', message => {
  if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/i.test(message.text())) pageErrors.push(message.text());
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
  if (loadedRetainedProject.schema !== 'closed-loop-project/1') throw new Error('Retained application project is not using the current application schema.');
  if (!Array.isArray(loadedRetainedProject.stages) || loadedRetainedProject.stages.length !== 31 || loadedRetainedProject.stages.some((stage, index) => stage.number !== index + 1 || stage.status !== 'COMPLETE')) throw new Error('Retained application project does not preserve all 31 completed stages.');
  if (loadedRetainedProject.stages[0]?.assignedActorType !== 'HUMAN_AGENT_TEAM') throw new Error('Retained application project does not preserve first-class human participation.');
  if (!/Closed-Loop Agent Reliability application/i.test(`${loadedRetainedProject.name} ${loadedRetainedProject.job?.exactUserObjective || ''}`)) throw new Error('Retained application project is not about the complete application itself.');
  if (/\bv13\b|version 13|sidecar-filename defect|repair-task tracker|fix stage/i.test(JSON.stringify(loadedRetainedProject.job || {}))) throw new Error('Retained application project still contains obsolete repair or application-number framing.');

  await page.click('.topNav [data-view="projects"]');
  const projectsText = await page.locator('#projectsView').innerText();
  if (!projectsText.includes(retainedProject.name) && !projectsText.includes(retainedProject.projectId)) throw new Error('Retained application project is not visible in the normal Projects view.');

  const visibleText = await page.locator('body').innerText();
  for (const forbidden of ['Agent response', 'Paste agent response', 'Copy stage prompt', 'PROMPT_RULESET:']) {
    if (visibleText.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Visible prompt-relay text remains: ${forbidden}`);
  }
  if (pageErrors.length) throw new Error(`Retained project load errors: ${pageErrors.join(' | ')}`);

  await page.click('#newProjectBtn');
  await page.fill('#newName', 'Arbitrary engineering job');
  await page.fill('#newObjective', 'Determine and deliver a verified engineering result from user intent and independent external authority.');
  await page.fill('#newDeliverables', 'A completed, verified, accepted, and releasable result.');
  await page.selectOption('#newOwnerType', 'HUMAN');
  await page.fill('#newOwnerName', 'Human project owner');
  await page.click('#newProjectForm button[type="submit"]');

  await page.waitForFunction(() => {
    try {
      return JSON.parse(localStorage.getItem('closedLoopReliability.projects') || '[]').some(project => project.name === 'Arbitrary engineering job');
    } catch {
      return false;
    }
  });
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
  if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join(' | ')}`);

  const staleProject = structuredClone(retainedProject);
  staleProject.updatedAt = '2000-01-01T00:00:00.000Z';
  staleProject.legacyProjectMetadata = { ...(staleProject.legacyProjectMetadata || {}), releaseHash: '0'.repeat(64) };
  const staleProduct = staleProject.products?.find(record => Number(record.stageNumber) === 22);
  if (staleProduct) staleProduct.computedSha256 = '0'.repeat(64);
  const unrelatedProject = structuredClone(retainedProject);
  unrelatedProject.projectId = 'PROJECT-UNRELATED-PRESERVATION-TEST';
  unrelatedProject.name = 'Unrelated preserved project';

  const staleErrors = [];
  const staleContext = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
  const stalePage = await staleContext.newPage();
  stalePage.on('pageerror', error => staleErrors.push(String(error)));
  stalePage.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/i.test(message.text())) staleErrors.push(message.text());
  });
  await stalePage.addInitScript(({ stale, unrelated }) => {
    if (!sessionStorage.getItem('closedLoopReliability.staleSeeded')) {
      localStorage.setItem('closedLoopReliability.projects', JSON.stringify([stale, unrelated]));
      sessionStorage.setItem('closedLoopReliability.staleSeeded', '1');
    }
  }, { stale: staleProject, unrelated: unrelatedProject });
  await stalePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await stalePage.waitForFunction(({ retainedId, expectedUpdatedAt, unrelatedId }) => {
    try {
      const projects = JSON.parse(localStorage.getItem('closedLoopReliability.projects') || '[]');
      const retained = projects.filter(project => project.projectId === retainedId);
      return retained.length === 1 && retained[0].updatedAt === expectedUpdatedAt && projects.some(project => project.projectId === unrelatedId);
    } catch {
      return false;
    }
  }, {
    retainedId: retainedProject.projectId,
    expectedUpdatedAt: retainedProject.updatedAt,
    unrelatedId: unrelatedProject.projectId
  }, { timeout: 7000 });
  const refreshedProjects = await stalePage.evaluate(() => JSON.parse(localStorage.getItem('closedLoopReliability.projects') || '[]'));
  const refreshed = refreshedProjects.find(project => project.projectId === retainedProject.projectId);
  if (!refreshed) throw new Error('Stale retained project was not replaced.');
  if (refreshed.updatedAt !== retainedProject.updatedAt) throw new Error('Stale retained project did not refresh to the current project revision.');
  if (!refreshedProjects.some(project => project.projectId === unrelatedProject.projectId)) throw new Error('Refreshing the retained project deleted an unrelated project.');
  if (refreshedProjects.filter(project => project.projectId === retainedProject.projectId).length !== 1) throw new Error('Refreshing the retained project created a duplicate.');
  if (staleErrors.length) throw new Error(`Stale-project refresh errors: ${staleErrors.join(' | ')}`);
  await staleContext.close();

  const report = {
    status: 'PASS',
    title: await page.title(),
    retainedApplicationProjectVisible: true,
    retainedApplicationProjectNative: true,
    retainedApplicationProjectName: retainedProject.name,
    retainedApplicationProjectStagesComplete: 31,
    retainedApplicationProjectHumanParticipation: true,
    staleRetainedProjectRefreshed: true,
    unrelatedProjectsPreserved: true,
    duplicateRetainedProjects: false,
    newHumanProjectCreated: true,
    newHumanProjectStartsAtZero: true,
    stagesRendered: await page.locator('.stageButton').count(),
    stage1ScopesRendered: await scopeFields.count(),
    externalSourceGuardRendered: true,
    informationClassesRendered: 3,
    promptRelayVisible: false,
    phoneWidthsTested: [393, 320],
    browserErrors: [...pageErrors, ...staleErrors]
  };
  fs.writeFileSync('BROWSER_SMOKE_REPORT.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
