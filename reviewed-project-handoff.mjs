// Private test-only seam observation. This module never activates a project,
// creates a worker/checkpoint, writes metadata, navigates, retries, or delays.
// Store owners retain their normal byte-verification/integrity behavior.

export function handoffRequire(condition, check) {
  if (!condition) {
    const error = new Error('REVIEWED_PROJECT_HANDOFF: ' + check);
    error.code = 'REVIEWED_PROJECT_HANDOFF_MISMATCH'; error.check = check;
    throw error;
  }
}

export function handoffExpectedIdentity(expected) {
  handoffRequire(expected && typeof expected === 'object', 'expected-identity-missing');
  handoffRequire(typeof expected.jobId === 'string' && expected.jobId.trim().length > 0, 'expected-job-missing');
  handoffRequire(Number.isSafeInteger(expected.revision) && expected.revision >= 0, 'expected-revision-invalid');
  handoffRequire(typeof expected.projectSha256 === 'string' && /^[a-f0-9]{64}$/.test(expected.projectSha256), 'expected-project-digest-invalid');
  return {jobId: expected.jobId, revision: expected.revision, projectSha256: expected.projectSha256};
}

export function handoffSemanticView(view) {
  handoffRequire(view && typeof view === 'object' && !Array.isArray(view), 'view-missing');
  // Exactly these two cosmetic coordinates are excluded. No other key is
  // normalized or removed, including unknown keys and every workflow draft.
  const {scrollX, scrollY, ...semantic} = view;
  return semantic;
}

export function handoffBrowserSnapshot(runtime) {
  return {
    applicationReady: runtime.closedLoopAppReady === true,
    domProjectId: runtime.document?.querySelector('#current-project-summary')?.dataset?.projectId ?? null,
    url: runtime.location?.href ?? null,
    entry: structuredClone(runtime.history?.state ?? null),
  };
}

export async function collectReviewedProjectHandoffEvidence(expectedInput, runtime = globalThis) {
  const expected = handoffExpectedIdentity(expectedInput), store = runtime.closedLoopProjectStore;
  for (const method of ['metaGet', 'readProject', 'historyList', 'readHistoryView']) handoffRequire(typeof store?.[method] === 'function', 'store-read-api-missing:' + method);
  handoffRequire(runtime.closedLoopHash?.canonicalizationVersion === 'closed-loop-canonical-json/1' && typeof runtime.closedLoopHash.sha256Value === 'function', 'canonical-hash-authority-missing');
  const evidence = {schema: 'reviewed-project-handoff-observation/1', expected, browserBefore: handoffBrowserSnapshot(runtime), retainedBytesVerified: false};
  let phase = 'selected-project-before';
  try {
    evidence.selectedProjectBefore = structuredClone(await store.metaGet('selectedProject'));
    phase = 'canonical-project'; evidence.canonicalProject = structuredClone(await store.readProject(expected.jobId));
    phase = 'history-before'; evidence.historyBefore = structuredClone(await store.historyList(expected.jobId));
    phase = 'retained-byte-verification';
    // One argument is intentional: verify retained bytes, then use the store's
    // effective activeViewOverride semantics. Never pin an explicit checkpoint.
    evidence.retainedReadArguments = [expected.jobId];
    evidence.retainedView = structuredClone(await store.readHistoryView(expected.jobId));
    evidence.retainedBytesVerified = true;
    phase = 'canonical-project-after'; evidence.canonicalProjectAfter = structuredClone(await store.readProject(expected.jobId));
    phase = 'history-after'; evidence.historyAfter = structuredClone(await store.historyList(expected.jobId));
    phase = 'selected-project-after'; evidence.selectedProjectAfter = structuredClone(await store.metaGet('selectedProject'));
    phase = 'browser-after'; evidence.browserAfter = handoffBrowserSnapshot(runtime);
    return evidence;
  } catch (cause) {
    const error = new Error('REVIEWED_PROJECT_HANDOFF_READ_FAILED: ' + phase + ': ' + String(cause?.message || cause));
    error.code = 'REVIEWED_PROJECT_HANDOFF_READ_FAILED'; error.phase = phase; error.cause = cause; error.evidence = evidence;
    throw error;
  }
}

export function handoffHistoryBinding(history, expected, label) {
  handoffRequire(history && typeof history === 'object', label + ':history-missing');
  handoffRequire(history.schema === 'closed-loop-recovery/1', label + ':history-schema');
  handoffRequire(history.jobId === expected.jobId, label + ':history-owner');
  handoffRequire(typeof history.activeId === 'string' && history.activeId.trim().length > 0, label + ':active-checkpoint-missing');
  handoffRequire(history.activeRevision === expected.revision, label + ':active-revision');
  handoffRequire(history.activeProjectSha256 === expected.projectSha256, label + ':active-project-digest');
  handoffRequire(history.removed !== true, label + ':history-project-removed');
  handoffRequire(Array.isArray(history.entries), label + ':checkpoint-list-missing');
  const active = history.entries.filter(row => row?.id === history.activeId);
  handoffRequire(active.length === 1, label + ':active-checkpoint-not-unique');
  handoffRequire(active[0].projectSha256 === expected.projectSha256, label + ':checkpoint-project-digest');
  // A checkpoint descriptor has no revision field. The canonical revision and
  // history.activeRevision above are the revision authorities.
  return {
    jobId: history.jobId, activeId: history.activeId, activeRevision: history.activeRevision,
    activeProjectSha256: history.activeProjectSha256, generation: history.generation ?? null,
    checkpoint: active[0], activeViewOverride: history.activeViewOverride ?? null,
  };
}

export function handoffAssertBrowser(browser, expected, binding, label) {
  handoffRequire(browser && typeof browser === 'object', label + ':browser-observation-missing');
  handoffRequire(browser.applicationReady === true, label + ':application-not-ready');
  handoffRequire(browser.domProjectId === expected.jobId, label + ':dom-project');
  const entry = browser.entry;
  handoffRequire(entry?.closedLoopHistory === 1, label + ':history-entry-marker');
  handoffRequire(typeof entry.entryId === 'string' && entry.entryId.trim().length > 0, label + ':entry-id-missing');
  handoffRequire(typeof entry.sessionId === 'string' && entry.sessionId.trim().length > 0, label + ':session-id-missing');
  handoffRequire(entry.jobId === expected.jobId && entry.jobId === binding.jobId, label + ':entry-owner');
  handoffRequire(entry.checkpointId === binding.activeId, label + ':entry-checkpoint');
  handoffRequire(entry.view && typeof entry.view === 'object' && !Array.isArray(entry.view), label + ':entry-view-missing');
  handoffRequire(Number.isSafeInteger(entry.view.activeStage) && entry.view.activeStage >= 1 && entry.view.activeStage <= 30, label + ':entry-stage-invalid');
  handoffRequire(typeof entry.view.activeView === 'string' && entry.view.activeView.length > 0, label + ':entry-active-view-missing');
  let url; try { url = new URL(browser.url); } catch { handoffRequire(false, label + ':url-invalid'); }
  handoffRequire(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, label + ':url-origin-invalid');
  for (const [key, value] of Object.entries({project: entry.jobId, version: entry.checkpointId, stage: String(entry.view.activeStage), view: entry.view.activeView})) {
    handoffRequire(url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value, label + ':url-' + key);
  }
  return entry;
}

export function reviewedProjectHandoffDigests(evidence, sha256Value) {
  const browserView = (evidence?.browserAfter || evidence?.browserBefore)?.entry?.view, retainedView = evidence?.retainedView;
  const digest = value => value && typeof value === 'object' ? sha256Value(value) : null;
  return {
    retainedViewSha256: digest(retainedView), browserViewSha256: digest(browserView),
    retainedSemanticViewSha256: retainedView && typeof retainedView === 'object' ? sha256Value(handoffSemanticView(retainedView)) : null,
    browserSemanticViewSha256: browserView && typeof browserView === 'object' ? sha256Value(handoffSemanticView(browserView)) : null,
  };
}

export function assertReviewedProjectHandoffEvidence(evidence, sha256Value) {
  handoffRequire(typeof sha256Value === 'function', 'canonical-hash-function-missing');
  handoffRequire(evidence?.schema === 'reviewed-project-handoff-observation/1', 'observation-schema');
  const expected = handoffExpectedIdentity(evidence.expected);
  for (const [label, project] of [['before', evidence.canonicalProject], ['after', evidence.canonicalProjectAfter]]) {
    handoffRequire(project?.job?.JOB_ID === expected.jobId, label + ':canonical-project-owner');
    handoffRequire(project.revision === expected.revision, label + ':canonical-project-revision');
    handoffRequire(project.projectSha256 === expected.projectSha256, label + ':canonical-project-digest');
    const {projectSha256, ...canonical} = project;
    handoffRequire(sha256Value(canonical) === expected.projectSha256, label + ':canonical-project-bytes');
  }
  handoffRequire(evidence.selectedProjectBefore === expected.jobId && evidence.selectedProjectAfter === expected.jobId, 'selected-project-metadata');
  const before = handoffHistoryBinding(evidence.historyBefore, expected, 'before'), after = handoffHistoryBinding(evidence.historyAfter, expected, 'after');
  handoffRequire(sha256Value(before) === sha256Value(after), 'history-changed-during-read');
  const initial = handoffAssertBrowser(evidence.browserBefore, expected, before, 'before'), entry = handoffAssertBrowser(evidence.browserAfter, expected, after, 'after');
  handoffRequire(initial.entryId === entry.entryId && initial.sessionId === entry.sessionId && evidence.browserBefore.url === evidence.browserAfter.url, 'browser-entry-changed-during-read');
  handoffRequire(sha256Value(handoffSemanticView(initial.view)) === sha256Value(handoffSemanticView(entry.view)), 'browser-view-changed-during-read');
  handoffRequire(evidence.retainedBytesVerified === true && Array.isArray(evidence.retainedReadArguments) && evidence.retainedReadArguments.length === 1 && evidence.retainedReadArguments[0] === expected.jobId, 'retained-byte-verification-not-established');
  handoffRequire(evidence.retainedView && typeof evidence.retainedView === 'object' && !Array.isArray(evidence.retainedView), 'retained-view-missing');
  handoffRequire(evidence.retainedView.activeStage === entry.view.activeStage && evidence.retainedView.activeView === entry.view.activeView, 'retained-stage-or-view');
  const digests = reviewedProjectHandoffDigests(evidence, sha256Value);
  handoffRequire(digests.retainedSemanticViewSha256 === digests.browserSemanticViewSha256, 'retained-browser-semantic-view');
  return {
    basis: 'READ_ONLY_REVIEWED_PROJECT_STORE_DOM_HISTORY_URL_HANDOFF',
    jobId: expected.jobId, revision: expected.revision, projectSha256: expected.projectSha256,
    entryId: entry.entryId, sessionId: entry.sessionId, checkpointId: after.activeId,
    activeStage: entry.view.activeStage, activeView: entry.view.activeView,
    ...digests, viewEquality: 'EXACT_EXCEPT_SCROLL_X_AND_SCROLL_Y', retainedBytesVerified: true,
    readCalls: {readProject: 2, historyList: 2, readHistoryView: 1, selectedProjectMetaGet: 2},
  };
}

export async function observeReviewedProjectHandoff(expected, runtime = globalThis) {
  let evidence;
  try {
    evidence = await collectReviewedProjectHandoffEvidence(expected, runtime);
    const result = assertReviewedProjectHandoffEvidence(evidence, runtime.closedLoopHash.sha256Value);
    runtime.console.log('BROWSER_REVIEWED_PROJECT_HANDOFF ' + JSON.stringify({status: 'PASS', ...result}));
    return result;
  } catch (error) {
    evidence ||= error.evidence;
    let digests = {retainedViewSha256: null, browserViewSha256: null, retainedSemanticViewSha256: null, browserSemanticViewSha256: null};
    try { if (runtime.closedLoopHash?.sha256Value) digests = reviewedProjectHandoffDigests(evidence, runtime.closedLoopHash.sha256Value); } catch {}
    runtime.console?.error?.('BROWSER_REVIEWED_PROJECT_HANDOFF ' + JSON.stringify({status: 'FAIL', expected: evidence?.expected || expected, ...digests, check: error.check || null, phase: error.phase || null, error: String(error.message || error), causeCode: error.cause?.code || null}));
    throw error;
  }
}

// Node/CDP callers may inject this self-contained expression without installing
// a browser module or changing the application. Constructing it has no effects.
export function reviewedProjectHandoffBrowserExpression(expected) {
  const identity = handoffExpectedIdentity(expected);
  const definitions = [handoffRequire, handoffExpectedIdentity, handoffSemanticView, handoffBrowserSnapshot, collectReviewedProjectHandoffEvidence, handoffHistoryBinding, handoffAssertBrowser, reviewedProjectHandoffDigests, assertReviewedProjectHandoffEvidence, observeReviewedProjectHandoff];
  return '(async()=>{' + definitions.map(fn => fn.toString()).join('\n') + '\nreturn observeReviewedProjectHandoff(' + JSON.stringify(identity) + ',globalThis);})()';
}
