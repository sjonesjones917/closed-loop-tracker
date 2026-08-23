import fs from 'node:fs';
import { chromium } from 'playwright-core';

const html = fs.readFileSync('index.html', 'utf8');
const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const executablePath = candidates.find(path => fs.existsSync(path));
if (!executablePath) throw new Error(`No Chromium executable found. Checked: ${candidates.join(', ')}`);

const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.setContent(html, { waitUntil: 'load' });

if ((await page.title()) !== 'Closed-Loop Agent Reliability') throw new Error('Wrong browser title.');
if ((await page.locator('h1').innerText()) !== 'Closed-Loop Agent Reliability') throw new Error('Wrong browser heading.');
if ((await page.locator('.stageButton').count()) !== 0) {
  throw new Error('A project or workflow was seeded before project creation.');
}
if (!(await page.locator('#projectsView').innerText()).includes('No current project exists')) throw new Error('Empty-project state is missing.');

await page.click('#newProjectBtn');
await page.fill('#newName', 'Arbitrary engineering job');
await page.fill('#newObjective', 'Determine and deliver a verified engineering result from user intent and independent external authority.');
await page.fill('#newDeliverables', 'A completed, verified, accepted, and releasable result.');
await page.selectOption('#newOwnerType', 'HUMAN');
await page.fill('#newOwnerName', 'Human project owner');
await page.click('#newProjectForm button[type="submit"]');

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
if ((await page.locator('#rf-externallyAccessed').count()) !== 1 || (await page.locator('#rf-independentOfArtifact').count()) !== 1) {
  throw new Error('External source non-circularity controls are missing.');
}
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
  stagesRendered: await page.locator('.stageButton').count(),
  stage1ScopesRendered: await scopeFields.count(),
  seededProject: false,
  humanOwnerCreated: true,
  externalSourceGuardRendered: true,
  informationClassesRendered: 3,
  phoneWidthsTested: [393, 320],
  browserErrors: errors
};
fs.writeFileSync('BROWSER_SMOKE_REPORT.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
