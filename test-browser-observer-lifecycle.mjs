// Synthetic transport controls for the ACTUAL observer implementation. No
// Chromium, application execution, socket, HTTP server, or browser receipt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {setImmediate as realImmediate} from 'node:timers';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const mainScripts = ['workbook.js', 'hash.js', 'workflow-schema.js', 'test-runtime.js', 'workflow-engine.js', 'prompt-engine.js', 'response-ingestion.js', 'project-store.js', 'app-core.js'];
const pageUrl = 'http://127.0.0.1:12345/'; // A string only: nothing binds this port.
const workerUrl = new URL('project-store.js?storeWorker=1', pageUrl).href;
const missingSession = {code: -32001, message: 'Session with given id not found.'};
const flush = () => new Promise(resolve => realImmediate(resolve));

// Narrow deterministic scheduling shim. Every original requested delay is
// recorded, including the production 30000 ms command/observation deadlines.
// The shim runs only while one isolated control owns the global WebSocket.
class SyntheticClock {
  now = 1_800_000_000_000;
  initialNow = this.now;
  sequence = 0;
  timers = new Map();
  requestedDelays = [];
  firedTimers = [];
  install() {
    this.originals = {setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, now: Date.now};
    globalThis.setTimeout = (callback, milliseconds = 0, ...args) => {
      const delay = Number(milliseconds);
      assert.ok(Number.isFinite(delay) && delay >= 0 && delay <= 30000, 'unexpected synthetic timer delay: ' + delay);
      const id = ++this.sequence;
      this.requestedDelays.push(delay);
      this.timers.set(id, {due: this.now + delay, requestedMs: delay, callback: () => callback(...args)});
      return id;
    };
    globalThis.clearTimeout = id => this.timers.delete(id);
    Date.now = () => this.now;
  }
  restore() {
    globalThis.setTimeout = this.originals.setTimeout;
    globalThis.clearTimeout = this.originals.clearTimeout;
    Date.now = this.originals.now;
  }
  advanceBy(milliseconds) {
    assert.ok(Number.isInteger(milliseconds) && milliseconds > 0, 'HARNESS: positive synthetic time gap required');
    const nextDue = Math.min(Infinity, ...[...this.timers.values()].map(timer => timer.due));
    assert.ok(this.now + milliseconds < nextDue, 'HARNESS: synthetic time gap cannot skip a pending deadline');
    this.now += milliseconds;
  }
  async settle(promise, label) {
    let state = 'pending', value;
    Promise.resolve(promise).then(result => { state = 'fulfilled'; value = result; }, error => { state = 'rejected'; value = error; });
    for (let step = 0; step < 10000 && state === 'pending'; step++) {
      // Let actual ESM import, filesystem completion and promise reactions run
      // before advancing a deadline. Scripted WebSocket replies use microtasks.
      await flush();
      if (state !== 'pending') break;
      const next = [...this.timers.entries()].sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (next) {
        this.now = next[1].due;
        this.timers.delete(next[0]);
        this.firedTimers.push({requestedMs: next[1].requestedMs, virtualElapsedMs: this.now - this.initialNow});
        next[1].callback();
      }
      assert.ok(this.now - this.initialNow <= 120000, 'HARNESS: virtual time limit exceeded: ' + label);
    }
    assert.notEqual(state, 'pending', 'HARNESS: operation did not settle: ' + label);
    if (state === 'rejected') throw value;
    return value;
  }
  summary() {
    return {
      kind: 'SYNTHETIC_CLOCK_NO_REAL_WAIT',
      virtualElapsedMs: this.now - this.initialNow,
      requestedProductionCommandDeadlineMs: this.requestedDelays.filter(value => value === 30000),
      firedProductionDeadlineTimers: this.firedTimers.filter(row => row.requestedMs === 30000),
      firedTimerCount: this.firedTimers.length,
      requestedPollingDelayCount: this.requestedDelays.filter(value => value > 0 && value <= 25).length,
    };
  }
}

class ScriptedTransport {
  commands = [];
  events = [];
  sourceReplies = [];
  workerParsedSequence = [];
  held = [];
  holdEnable = new Set();
  scripts = new Map();
  constructor({manifest, bytes, clock}) { this.manifest = manifest; this.bytes = bytes; this.clock = clock; }
  webSocketClass() {
    const transport = this;
    return class ScriptedWebSocket {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      readyState = 0;
      constructor(url) {
        assert.equal(url, 'ws://scripted-observer.invalid/no-network');
        assert.equal(transport.ws, undefined, 'one scripted WebSocket per control');
        transport.ws = this;
        queueMicrotask(() => { this.readyState = 1; this.onopen?.({type: 'open'}); });
      }
      send(data) {
        // Standard WebSocket behavior: sends on a closed socket are discarded.
        if (this.readyState >= 2) return;
        assert.equal(this.readyState, 1, 'WebSocket was not opened');
        transport.onCommand(JSON.parse(data));
      }
      close() { this.readyState = 3; queueMicrotask(() => this.onclose?.({type: 'close', code: 1000, reason: 'control cleanup', wasClean: true})); }
    };
  }
  emit(message) {
    assert.equal(this.ws.readyState, 1, 'cannot emit event after transport closure');
    this.events.push(structuredClone(message));
    if (message.method === 'Debugger.scriptParsed' && message.sessionId && message.params.url) {
      this.workerParsedSequence.push({kind: 'parsed', sessionId: message.sessionId, url: message.params.url, scriptId: message.params.scriptId, at: Date.now()});
    }
    this.ws.onmessage?.({data: JSON.stringify(message)});
  }
  reply(command, result = {}) {
    queueMicrotask(() => this.ws.onmessage?.({data: JSON.stringify({id: command.id, ...(command.sessionId ? {sessionId: command.sessionId} : {}), result})}));
  }
  fail(command, error = missingSession) {
    queueMicrotask(() => this.ws.onmessage?.({data: JSON.stringify({id: command.id, ...(command.sessionId ? {sessionId: command.sessionId} : {}), error})}));
  }
  takeHeld(method, sessionId) {
    const index = this.held.findIndex(row => row.method === method && row.sessionId === sessionId);
    assert.notEqual(index, -1, 'HARNESS: expected pending ' + method + ' for ' + sessionId);
    return this.held.splice(index, 1)[0];
  }
  failHeldIfPresent(method, sessionId, error = missingSession) {
    // A stricter observer may reject a malformed identity event before issuing
    // a source command. Do not turn that correct early rejection into a harness
    // failure. finish() must still reject for the production observer's reason.
    const index = this.held.findIndex(row => row.method === method && row.sessionId === sessionId);
    if (index < 0) { this.identityRejectedBeforeCommand = true; return false; }
    this.fail(this.held.splice(index, 1)[0], error);
    return true;
  }
  onCommand(command) {
    this.commands.push({id: command.id, method: command.method, sessionId: command.sessionId ?? null, sentAt: Date.now(), params: command.method === 'Runtime.evaluate' ? {scriptedExpression: true} : structuredClone(command.params)});
    if (command.method === 'Debugger.enable' && this.holdEnable.has(command.sessionId)) { this.held.push(command); return; }
    if (command.method === 'Debugger.getScriptSource') {
      const spec = this.scripts.get((command.sessionId || 'PAGE') + ':' + command.params.scriptId);
      assert.ok(spec, 'HARNESS: unexpected script request ' + JSON.stringify(command));
      if (spec.hold) { this.held.push(command); return; }
      const source = this.bytes.get(spec.path).toString('utf8') + (spec.corrupt ? '\n// corrupted synthetic source bytes\n' : '');
      this.sourceReplies.push({sessionId: command.sessionId ?? null, scriptId: command.params.scriptId, path: spec.path, sha256: sha(Buffer.from(source)), corrupted: Boolean(spec.corrupt)});
      this.reply(command, {scriptSource: source}); return;
    }
    if (command.method === 'Network.getResponseBody') { this.reply(command, {body: this.bytes.get('index.html').toString('base64'), base64Encoded: true}); return; }
    if (command.method === 'Runtime.evaluate') {
      const expression = command.params.expression;
      if (expression.startsWith('({url:location.href')) {
        this.reply(command, {result: {value: {url: pageUrl, origin: new URL(pageUrl).origin, ready: true, buildIdentity: this.manifest.buildIdentity}}}); return;
      }
      assert.ok(expression.startsWith('(async()=>{const paths='), 'HARNESS: unrecognized evaluation expression');
      this.reply(command, {result: {value: this.manifest.runtimeResources.map(row => ({path: row.path, responseUrl: new URL(row.path, pageUrl).href, status: 200, base64: this.bytes.get(row.path).toString('base64')}))}}); return;
    }
    if (command.method === 'Browser.getVersion') { this.reply(command, {product: 'SCRIPTED_WEBSOCKET_CONTROL_ONLY'}); return; }
    assert.ok(['Runtime.enable', 'Network.enable', 'Debugger.enable', 'Target.setAutoAttach'].includes(command.method), 'HARNESS: unrecognized method ' + command.method);
    this.reply(command);
  }
  async seedPage() {
    this.emit({method: 'Network.responseReceived', params: {type: 'Document', requestId: 'document-1', response: {url: pageUrl, status: 200}}});
    this.emit({method: 'Network.loadingFinished', params: {requestId: 'document-1'}});
    for (const [index, name] of mainScripts.entries()) this.source(null, 'page-script-' + index, {path: name, url: new URL(name, pageUrl).href});
    await flush();
  }
  async attach(sessionId = 'session-a', options = {}) {
    if (options.holdEnable) this.holdEnable.add(sessionId);
    this.emit({method: 'Target.attachedToTarget', params: {sessionId, targetInfo: {targetId: options.targetId || 'target-' + sessionId, type: options.type || 'worker', url: options.url || workerUrl}, waitingForDebugger: false}});
    await flush();
  }
  source(sessionId = 'session-a', scriptId = 'worker-script-1', options = {}) {
    const spec = {path: 'project-store.js', url: workerUrl, ...options};
    this.scripts.set((sessionId || 'PAGE') + ':' + scriptId, spec);
    this.emit({method: 'Debugger.scriptParsed', ...(sessionId ? {sessionId} : {}), params: {scriptId, url: spec.url, executionContextId: spec.executionContextId ?? 1, startLine: 0, startColumn: 0, endLine: 1, endColumn: 0, hash: 'synthetic-protocol-field'}});
  }
  detach(sessionId = 'session-a', targetId = 'target-' + sessionId) {
    this.emit({method: 'Target.detachedFromTarget', params: {sessionId, targetId}});
  }
  unexpectedClose() {
    this.transportCloseAt = Date.now();
    this.ws.readyState = 3;
    this.ws.onclose?.({type: 'close', code: 1006, reason: 'synthetic unexpected transport close', wasClean: false});
  }
}

const definitions = [
  {name: 'live-worker-with-verified-source', expect: 'resolve', async arrange(t) { await t.attach(); t.source(); await flush(); }},
  {name: 'verified-worker-clean-detach', expect: 'resolve', async arrange(t) { await t.attach(); t.source(); await flush(); t.detach(); }},
  {name: 'retired-session-reused-without-new-source', expect: 'reject', error: /identity|session|retired|detach|source/i, async arrange(t) { await t.attach(); t.source(); await flush(); t.detach(); await t.attach(); }},
  // Synthetic compatibility preservation, not a native navigation reproduction.
  // A new root-page context can reuse a scriptId at another valid source URL;
  // worker-session identity restrictions must not be imposed on that page path.
  {name: 'root-page-navigation-script-id-reuse-preserves-source-validation', expect: 'resolve', requiresRootReuseSources: true, async arrange(t) {
    t.emit({method: 'Runtime.executionContextsCleared', params: {}});
    t.emit({method: 'Debugger.globalObjectCleared', params: {}});
    t.emit({method: 'Runtime.executionContextCreated', params: {context: {id: 2, origin: new URL(pageUrl).origin, name: 'synthetic-new-root-page', uniqueId: 'synthetic-new-context-2', auxData: {isDefault: true, type: 'default', frameId: 'synthetic-root-frame'}}}});
    t.emit({method: 'Network.responseReceived', params: {type: 'Document', requestId: 'document-navigation-2', response: {url: pageUrl, status: 200}}});
    t.emit({method: 'Network.loadingFinished', params: {requestId: 'document-navigation-2'}});
    t.source(null, 'page-script-0', {path: 'hash.js', url: new URL('hash.js', pageUrl).href, executionContextId: 2});
    await flush();
  }},
  {name: 'same-session-primary-verified-enable-missing-session-after-detach', expect: 'resolve', async arrange(t) { await t.attach('session-a', {holdEnable: true}); t.source(); await flush(); t.detach(); t.fail(t.takeHeld('Debugger.enable', 'session-a')); }},
  {name: 'same-session-same-script-verified-retry-missing-session-after-detach', expect: 'resolve', async arrange(t) { await t.attach(); t.source(); await flush(); t.source('session-a', 'worker-script-1', {hold: true}); await flush(); t.detach(); t.fail(t.takeHeld('Debugger.getScriptSource', 'session-a')); }},
  {name: 'detach-before-any-source', expect: 'reject', error: /session|source|detach|observation/i, async arrange(t) { await t.attach('session-a', {holdEnable: true}); t.detach(); t.fail(t.takeHeld('Debugger.enable', 'session-a')); }},
  {name: 'detach-during-first-pending-getScriptSource', expect: 'reject', error: /session|source|detach|observation/i, async arrange(t) { await t.attach(); t.source('session-a', 'worker-script-1', {hold: true}); await flush(); t.detach(); t.fail(t.takeHeld('Debugger.getScriptSource', 'session-a')); }},
  {name: 'same-url-new-script-id-is-not-verified', expect: 'reject', error: /session|source|detach|observation/i, async arrange(t) { await t.attach(); t.source(); await flush(); t.source('session-a', 'worker-script-2', {hold: true}); await flush(); t.detach(); t.fail(t.takeHeld('Debugger.getScriptSource', 'session-a')); }},
  {name: 'reused-script-id-with-changed-url-cannot-inherit-verified-source', expect: 'reject', error: /session|source|detach|target|identity/i, async arrange(t) { await t.attach(); t.source(); await flush(); t.source('session-a', 'worker-script-1', {path: 'test-worker.js', url: new URL('test-worker.js', pageUrl).href, hold: true}); await flush(); t.detach(); t.failHeldIfPresent('Debugger.getScriptSource', 'session-a'); }},
  {name: 'reused-session-and-script-id-with-changed-target-cannot-inherit-source', expect: 'reject', error: /session|source|detach|target|identity/i, async arrange(t) { await t.attach(); t.source(); await flush(); await t.attach('session-a', {targetId: 'target-replacement'}); t.source('session-a', 'worker-script-1', {hold: true}); await flush(); t.detach('session-a', 'target-replacement'); t.failHeldIfPresent('Debugger.getScriptSource', 'session-a'); }},
  {name: 'enable-detach-with-unsettled-script-obligation', expect: 'reject', error: /session|source|detach|observation|timed out/i, async arrange(t) { await t.attach('session-a', {holdEnable: true}); t.source(); await flush(); t.source('session-a', 'worker-script-2', {hold: true}); await flush(); t.detach(); t.fail(t.takeHeld('Debugger.enable', 'session-a')); }},
  {name: 'same-url-unobserved-replacement-session', expect: 'reject', error: /source|session|observation|timed out/i, async arrange(t) { await t.attach(); t.source(); await flush(); t.detach(); await t.attach('session-b'); }},
  {name: 'missing-session-without-matching-detach', expect: 'reject', error: /session/i, async arrange(t) { await t.attach('session-a', {holdEnable: true}); t.source(); await flush(); t.fail(t.takeHeld('Debugger.enable', 'session-a')); }},
  {name: 'wrong-session-detach-cannot-retire-command', expect: 'reject', error: /session|detach|target/i, async arrange(t) { await t.attach('session-a', {holdEnable: true}); t.source(); await flush(); t.detach('session-other'); t.fail(t.takeHeld('Debugger.enable', 'session-a')); }},
  {name: 'wrong-target-detach-cannot-retire-command', expect: 'reject', error: /session|detach|target/i, async arrange(t) { await t.attach('session-a', {holdEnable: true}); t.source(); await flush(); t.detach('session-a', 'target-other'); t.fail(t.takeHeld('Debugger.enable', 'session-a')); }},
  {name: 'source-from-unknown-session-does-not-cover-attached-worker', expect: 'reject', error: /source|session|observation|timed out/i, async arrange(t) { await t.attach(); t.source('session-other'); await flush(); }},
  {name: 'page-target-session-cannot-claim-worker-source', expect: 'reject', error: /source|session|worker|target/i, async arrange(t) { await t.attach('session-a', {type: 'page'}); t.source(); await flush(); }},
  {name: 'corrupted-worker-source-bytes', expect: 'reject', error: /loaded script bytes differ/i, async arrange(t) { await t.attach(); t.source('session-a', 'worker-script-1', {corrupt: true}); await flush(); }},
  {name: 'parsed-logging-preserves-duplicates-and-prevalidation-rejections', expect: 'reject', error: /script outside expected runtime graph/i, async arrange(t) {
    await t.attach(); t.source('session-a', 'parsed-duplicate'); await flush();
    t.clock.advanceBy(3); t.source('session-a', 'parsed-duplicate'); await flush();
    t.clock.advanceBy(5); t.source('session-a', 'parsed-outside-runtime', {url: new URL('not-runtime.js', pageUrl).href});
    t.clock.advanceBy(7); t.source('session-a', 'parsed-malformed-url', {url: 'not a valid URL'});
    t.clock.advanceBy(11); t.source('session-a', 'parsed-empty-url', {url: ''}); await flush();
  }},
  {name: 'malformed-worker-url-remains-fatal-after-primary-source-verification', expect: 'reject', error: /malformed worker script URL/i, async arrange(t) {
    await t.attach(); t.source(); await flush();
    t.source('session-a', 'malformed-worker-script', {url: 'not a valid URL'}); await flush();
  }},
  {name: 'unrelated-protocol-error-after-matching-detach', expect: 'reject', error: /Debugger is not enabled/, async arrange(t) { await t.attach('session-a', {holdEnable: true}); t.source(); await flush(); t.detach(); t.fail(t.takeHeld('Debugger.enable', 'session-a'), {code: -32000, message: 'Debugger is not enabled'}); }},
  {name: 'pending-source-command-times-out', expect: 'reject', error: /timed out.*Debugger.getScriptSource/i, expectCommandDeadline: true, async arrange(t) { await t.attach(); t.source('session-a', 'worker-script-1', {hold: true}); await flush(); }},
  {name: 'source-timeout-preserves-command-specific-metadata', expect: 'reject', error: /timed out.*Debugger.getScriptSource/i, expectCommandDeadline: true, metadataControl: 'TIMEOUT', async arrange(t) {
    await t.attach(); t.source('session-a', 'worker-timeout-script', {hold: true}); await flush();
    t.expectedMetadataCommands = t.commands.filter(command => command.method === 'Debugger.getScriptSource' && command.sessionId === 'session-a');
  }},
  {name: 'transport-close-keeps-two-session-errors-distinct', expect: 'reject', error: /closed|transport/i, metadataControl: 'TRANSPORT', async arrange(t) {
    await t.attach('session-a', {holdEnable: true});
    t.clock.advanceBy(7); // Deliberately distinct sentAt values, no timer fires.
    await t.attach('session-b');
    t.source('session-b', 'worker-transport-script-b', {hold: true}); await flush();
    t.expectedMetadataCommands = t.commands.filter(command => (command.method === 'Debugger.enable' && command.sessionId === 'session-a') || (command.method === 'Debugger.getScriptSource' && command.sessionId === 'session-b'));
    assert.equal(t.held.length, 2, 'HARNESS: exactly two commands must be pending at transport failure');
    t.clock.advanceBy(11);
    t.unexpectedClose(); await flush();
  }},
  {name: 'unexpected-transport-close-rejects-promptly', expect: 'reject', error: /closed|transport/i, maximumVirtualElapsedMs: 0, async arrange(t) { await t.attach(); t.source('session-a', 'worker-script-1', {hold: true}); await flush(); t.unexpectedClose(); }},
  // Reproductions supplied by the independent reviewer. Both arrive inside
  // Browser.getVersion.send(), after the observer's former final drain.
  {name: 'late-unobserved-worker-during-browser-version', expect: 'reject', error: /source|session|observation|timed out/i, async arrange(t) {
    await t.attach(); t.source(); await flush(); const original = t.onCommand.bind(t);
    t.onCommand = command => {
      if (command.method === 'Browser.getVersion') t.emit({method: 'Target.attachedToTarget', params: {sessionId: 'late-session', targetInfo: {targetId: 'late-target', type: 'worker', url: workerUrl + '&late=1'}, waitingForDebugger: false}});
      original(command);
    };
  }},
  {name: 'late-corrupt-source-during-browser-version', expect: 'reject', error: /loaded script bytes differ/i, async arrange(t) {
    await t.attach(); t.source(); await flush(); const original = t.onCommand.bind(t);
    t.onCommand = command => {
      if (command.method === 'Browser.getVersion') {
        t.emit({method: 'Target.attachedToTarget', params: {sessionId: 'late-session', targetInfo: {targetId: 'late-target', type: 'worker', url: workerUrl}, waitingForDebugger: false}});
        t.source('late-session', 'late-corrupt-script', {corrupt: true});
      }
      original(command);
    };
  }},
];

const retirementCases = new Set([
  'same-session-primary-verified-enable-missing-session-after-detach',
  'same-session-same-script-verified-retry-missing-session-after-detach',
]);

// Observe the actual rejection objects delivered to the production observer's
// catch callbacks. This temporary shim does not replace errors or settlements,
// and does not expose or edit ObserverConnection. Captures are test-local only.
function observeCommandRejections(captures, captureFailures = []) {
  const original = Promise.prototype.catch;
  Promise.prototype.catch = function (onRejected) {
    if (typeof onRejected !== 'function') return original.call(this, onRejected);
    return original.call(this, function (error) {
      try {
        if (error?.observerCommand) captures.push({error, metadataAtCatch: structuredClone(error.observerCommand)});
      } catch (captureError) {
        captureFailures.push(String(captureError?.message || captureError));
      }
      // Preserve the receiver, original Error object, and return/throw behavior.
      // Capture failure must never prevent the original callback from running.
      return Reflect.apply(onRejected, this, [error]);
    });
  };
  return () => { Promise.prototype.catch = original; };
}

// Capture parsed-event rows while forwarding every ordinary console.error call
// to the original function with unchanged receiver, arguments and return/throw.
function observeParsedLogging(captures, captureFailures = []) {
  const original = console.error;
  console.error = function (...args) {
    try {
      const prefix = 'BROWSER_EXECUTION_OBSERVER_EVENT ';
      for (const arg of args) {
        if (typeof arg !== 'string' || !arg.startsWith(prefix)) continue;
        const row = JSON.parse(arg.slice(prefix.length));
        if (row.kind === 'parsed') captures.push(structuredClone(row));
      }
    } catch (error) { captureFailures.push(String(error?.message || error)); }
    return Reflect.apply(original, this, args);
  };
  return () => { console.error = original; };
}

function checkParsedLogging(expected, actual, captureFailures) {
  const failures = [...captureFailures];
  try { assert.deepEqual(actual, expected); }
  catch { failures.push('parsed log rows differ from the actual scripted nonempty-URL worker event sequence'); }
  return {conforms: failures.length === 0, failures, expected, actual, preservesDuplicatesAndOrder: failures.length === 0};
}

export function verifyParsedLoggingObserverSemantics() {
  const original = console.error, calls = [], captured = [], captureFailures = [], receiver = {}, argumentObject = {}, returned = {};
  const row = {kind: 'parsed', sessionId: 'synthetic', url: 'synthetic:source', scriptId: 'script-1', at: 1};
  const thrown = new Error('SYNTHETIC_CONSOLE_THROW');
  let restore;
  try {
    console.error = function (...args) { calls.push({receiver: this, args}); if (args[0] === 'THROW') throw thrown; return returned; };
    const sink = console.error;
    restore = observeParsedLogging(captured, captureFailures);
    assert.equal(Reflect.apply(console.error, receiver, ['plain log', argumentObject]), returned);
    assert.equal(calls.length, 1); assert.equal(calls[0].receiver, receiver); assert.equal(calls[0].args[0], 'plain log'); assert.equal(calls[0].args[1], argumentObject);
    console.error('BROWSER_EXECUTION_OBSERVER_EVENT ' + JSON.stringify(row));
    assert.deepEqual(captured, [row]);
    let propagated; try { console.error('THROW'); } catch (error) { propagated = error; }
    assert.equal(propagated, thrown);
    assert.equal(calls.length, 3);
    assert.equal(captureFailures.length, 0);
    restore(); assert.equal(console.error, sink);
  } finally { restore?.(); console.error = original; }
  assert.equal(console.error, original);
  return {ordinaryLoggingForwardedOnce: true, receiverAndArgumentsPreserved: true, returnAndThrowPreserved: true, parsedCaptureExact: true, consoleRestored: true};
}

function checkCommandErrorMetadata({kind, captures, captureFailures, transport, finishError, timing}) {
  const failures = [], expectedCommands = transport.expectedMetadataCommands || [];
  const captured = captures.filter(row => row.error.observerCommand?.failure === kind);
  const require = (condition, description) => { if (!condition) failures.push(description); };
  require(captureFailures.length === 0, 'synthetic rejection observer could not capture metadata');
  require(expectedCommands.length === (kind === 'TRANSPORT' ? 2 : 1), 'wrong expected command count');
  require(captured.length === expectedCommands.length, 'each pending command must have one captured command-specific Error');
  require(new Set(captured.map(row => row.error)).size === expectedCommands.length, 'pending commands shared an Error object');
  require(new Set(captured.map(row => row.error.observerCommand)).size === expectedCommands.length, 'pending commands shared a metadata object');
  for (const command of expectedCommands) {
    const matches = captured.filter(row => row.error.observerCommand.commandId === command.id);
    require(matches.length === 1, 'missing or duplicate error for commandId ' + command.id);
    if (matches.length !== 1) continue;
    const {error, metadataAtCatch} = matches[0], actual = error.observerCommand;
    require(error instanceof Error, 'rejection is not an actual Error');
    require(actual.method === command.method, 'wrong method for commandId ' + command.id);
    require(actual.sessionId === command.sessionId, 'wrong sessionId for commandId ' + command.id);
    require(actual.sentAt === command.sentAt, 'wrong sentAt for commandId ' + command.id);
    require(actual.errorAt === (kind === 'TIMEOUT' ? command.sentAt + 30000 : transport.transportCloseAt), 'wrong errorAt for commandId ' + command.id);
    require(actual.failure === kind, 'wrong failure for commandId ' + command.id);
    require(JSON.stringify(actual.params) === JSON.stringify(command.params), 'wrong params for commandId ' + command.id);
    require(JSON.stringify(actual) === JSON.stringify(metadataAtCatch), 'error metadata mutated after rejection for commandId ' + command.id);
  }
  if (kind === 'TIMEOUT') {
    require(captured.length === 1 && captured[0].error === finishError, 'finish did not preserve the timed-out source command Error');
  } else {
    require(new Set(expectedCommands.map(command => command.sessionId)).size === 2, 'transport fixture must use different sessions');
    require(new Set(expectedCommands.map(command => command.sentAt)).size === 2, 'transport fixture must use distinct send times');
    require(timing.firedTimerCount === 0, 'transport rejection waited for a timer');
  }
  return {
    conforms: failures.length === 0, failures,
    observation: 'ACTUAL_REJECTION_OBJECTS_CAPTURED_WITH_TEMPORARY_PROMISE_CATCH_OBSERVER',
    expectedCommands,
    errorObjectsDistinct: new Set(captured.map(row => row.error)).size === expectedCommands.length,
    metadataObjectsDistinct: new Set(captured.map(row => row.error.observerCommand)).size === expectedCommands.length,
    capturedErrors: captured.map(row => ({message: row.error.message, observerCommand: structuredClone(row.error.observerCommand), metadataAtCatch: row.metadataAtCatch})),
    finishCommandMetadata: finishError?.observerCommand ? structuredClone(finishError.observerCommand) : null,
  };
}

export async function verifyCommandRejectionObserverSemantics() {
  const originalCatch = Promise.prototype.catch, captures = [], captureFailures = [];
  const error = new Error('SYNTHETIC_REJECTION_OBSERVER_SELF_CHECK');
  error.observerCommand = {commandId: 1, method: 'Synthetic.check', sessionId: 'synthetic', sentAt: 1, errorAt: 2, failure: 'SYNTHETIC_ONLY'};
  const returned = {}, thrown = new Error('SYNTHETIC_CALLBACK_THROW'), fixtureFailure = new Error('SYNTHETIC_FIXTURE_FAILURE');
  let returnedCount = 0, thrownCount = 0, callbackReceiver, receivedError;
  let restore = observeCommandRejections(captures, captureFailures);
  try {
    const value = await Promise.reject(error).catch(function (received) {
      returnedCount++; callbackReceiver = this; receivedError = received; return returned;
    });
    assert.equal(value, returned);
    assert.equal(returnedCount, 1);
    assert.equal(callbackReceiver, undefined);
    assert.equal(receivedError, error);
    let propagated;
    try { await Promise.reject(error).catch(function (received) { thrownCount++; assert.equal(this, undefined); assert.equal(received, error); throw thrown; }); }
    catch (caught) { propagated = caught; }
    assert.equal(propagated, thrown);
    assert.equal(thrownCount, 1);
    let passthrough;
    try { await Promise.reject(error).catch(undefined); } catch (caught) { passthrough = caught; }
    assert.equal(passthrough, error);
    assert.equal(captures.length, 2);
    assert.ok(captures.every(row => row.error === error));
    assert.equal(captureFailures.length, 0);
  } finally { restore(); }
  assert.equal(Promise.prototype.catch, originalCatch);
  let propagatedFixtureFailure;
  restore = observeCommandRejections([], []);
  try { try { throw fixtureFailure; } finally { restore(); } }
  catch (caught) { propagatedFixtureFailure = caught; }
  assert.equal(propagatedFixtureFailure, fixtureFailure);
  assert.equal(Promise.prototype.catch, originalCatch);
  return {sameErrorObject: true, sameUndefinedReceiver: true, callbacksExactlyOnce: true, returnAndThrowPreserved: true, nonfunctionPassthrough: true, restoredAfterSuccess: true, restoredAfterFixtureFailure: true};
}

export function observerLifecycleControlNames() { return definitions.map(row => row.name); }

/**
 * Call from a serial verifier after an out-of-tree synthetic artifact build.
 * mode='baseline' records discrepancies without pretending they are passes.
 * mode='strict' runs every control, then throws with the full report attached
 * if any desired fail-closed lifecycle property is absent.
 * mode='strict-no-retirement' additionally requires the two retirement cases
 * to reject: no CDP protocol error is approved for suppression in this mode.
 */
export async function runObserverLifecycleControls({observerModulePath, artifactDirectory, sourceCommit = '1'.repeat(40), mode = 'strict', only} = {}) {
  assert.ok(observerModulePath && artifactDirectory, 'observerModulePath and artifactDirectory are required');
  assert.ok(['baseline', 'strict', 'strict-no-retirement'].includes(mode), 'mode must be baseline, strict, or strict-no-retirement');
  const modulePath = path.resolve(observerModulePath);
  const artifactPath = path.resolve(artifactDirectory);
  const sourceHashBefore = sha(fs.readFileSync(modulePath));
  const {createBrowserExecutionObserver} = await import(pathToFileURL(modulePath).href);
  assert.equal(typeof createBrowserExecutionObserver, 'function');
  const manifest = JSON.parse(fs.readFileSync(path.join(artifactPath, 'closed-loop-deployment-manifest.json'), 'utf8'));
  assert.equal(manifest.sourceCommit, sourceCommit, 'synthetic source identity mismatch');
  const bytes = new Map(manifest.runtimeResources.map(row => {
    const value = fs.readFileSync(path.join(artifactPath, row.path));
    assert.equal(value.length, row.byteSize);
    assert.equal(sha(value), row.digest);
    return [row.path, value];
  }));
  const cases = [];
  const selected = only ? definitions.filter(row => only.includes(row.name)) : definitions;
  if (only) assert.equal(selected.length, new Set(only).size, 'unknown control name');
  for (const definition of selected) {
    const noRetirementOverride = mode === 'strict-no-retirement' && retirementCases.has(definition.name);
    const expectedOutcome = noRetirementOverride ? 'reject' : definition.expect;
    const expectedError = noRetirementOverride ? /Session with given id not found/i : definition.error;
    const clock = new SyntheticClock(), transport = new ScriptedTransport({manifest, bytes, clock});
    const capturedCommandErrors = [], commandCaptureFailures = [];
    const capturedParsedLogs = [], parsedLogCaptureFailures = [], originalConsoleError = console.error;
    const restoreParsedLoggingObserver = observeParsedLogging(capturedParsedLogs, parsedLogCaptureFailures);
    const originalPromiseCatch = Promise.prototype.catch;
    const restoreCommandObserver = definition.metadataControl ? observeCommandRejections(capturedCommandErrors, commandCaptureFailures) : () => {};
    const originalWebSocket = globalThis.WebSocket;
    let observer, actual = 'unstarted', errorMessage = null, harnessFailure = null, transportClosedBeforeCleanup = null, finishError = null;
    globalThis.WebSocket = transport.webSocketClass();
    clock.install();
    try {
      observer = await clock.settle(createBrowserExecutionObserver({
        webSocketDebuggerUrl: 'ws://scripted-observer.invalid/no-network', pageUrl,
        suite: 'synthetic-scripted-observer-lifecycle-control.mjs',
        environment: {CLOSED_LOOP_BROWSER_SCOPE: 'LOCAL', STATIC_SITE_ROOT: artifactPath, CLOSED_LOOP_BROWSER_SOURCE_COMMIT: sourceCommit},
      }), 'create observer');
      await transport.seedPage();
      await definition.arrange(transport);
      await flush();
      try {
        // Deliberately discard the returned in-memory carrier. Its inputs came
        // from a scripted transport; it is never persisted as browser evidence.
        await clock.settle(observer.finish(), definition.name);
        actual = 'resolve';
      } catch (error) {
        actual = 'reject'; errorMessage = error.message; finishError = error;
        if (errorMessage.includes('HARNESS:')) harnessFailure = errorMessage;
      }
    } catch (error) {
      actual = 'harness-error'; errorMessage = error.message; harnessFailure = error.message;
    } finally {
      transportClosedBeforeCleanup = transport.ws?.readyState === 3;
      try { observer?.close(); await flush(); }
      finally {
        restoreCommandObserver();
        restoreParsedLoggingObserver();
        clock.restore();
        globalThis.WebSocket = originalWebSocket;
        assert.equal(Promise.prototype.catch, originalPromiseCatch, 'HARNESS: Promise.catch was not restored');
        assert.equal(console.error, originalConsoleError, 'HARNESS: console.error was not restored');
      }
    }
    const timing = clock.summary();
    const outcomeMatches = actual === expectedOutcome;
    const errorMatches = actual !== 'reject' || !expectedError || expectedError.test(errorMessage);
    const earlyIdentityReasonMatches = !transport.identityRejectedBeforeCommand || (actual === 'reject' && /identity|reus|chang|binding/i.test(errorMessage));
    const rootReuseSourceReads = !definition.requiresRootReuseSources || JSON.stringify(transport.sourceReplies.filter(row => !row.sessionId && row.scriptId === 'page-script-0').map(row => row.path)) === JSON.stringify(['workbook.js', 'hash.js']);
    const timeMatches = definition.maximumVirtualElapsedMs === undefined || timing.virtualElapsedMs <= definition.maximumVirtualElapsedMs;
    const deadlineObserved = !definition.expectCommandDeadline || (timing.requestedProductionCommandDeadlineMs.includes(30000) && timing.firedProductionDeadlineTimers.some(row => row.requestedMs === 30000 && row.virtualElapsedMs === 30000));
    const commandErrorMetadata = definition.metadataControl ? checkCommandErrorMetadata({kind: definition.metadataControl, captures: capturedCommandErrors, captureFailures: commandCaptureFailures, transport, finishError, timing}) : undefined;
    const parsedLogging = checkParsedLogging(transport.workerParsedSequence, capturedParsedLogs, parsedLogCaptureFailures);
    cases.push({
      name: definition.name, expected: expectedOutcome, actual, noRetirementOverride,
      conforms: outcomeMatches && errorMatches && earlyIdentityReasonMatches && rootReuseSourceReads && timeMatches && deadlineObserved && (commandErrorMetadata?.conforms ?? true) && parsedLogging.conforms && !harnessFailure,
      error: errorMessage, harnessFailure, timing, transportClosedBeforeCleanup,
      identityRejectedBeforeCommand: Boolean(transport.identityRejectedBeforeCommand),
      commandErrorMetadata,
      parsedLogging,
      rootReuseSourceReads: definition.requiresRootReuseSources ? rootReuseSourceReads : undefined,
      commandCount: transport.commands.length,
      commands: transport.commands,
      events: transport.events.filter(row => row.method.startsWith('Target.')),
      rootNavigationEvents: definition.requiresRootReuseSources ? transport.events.filter(row => ['Runtime.executionContextsCleared', 'Debugger.globalObjectCleared', 'Runtime.executionContextCreated'].includes(row.method)) : undefined,
      rootReusedScriptSourceReplies: definition.requiresRootReuseSources ? transport.sourceReplies.filter(row => !row.sessionId && row.scriptId === 'page-script-0') : undefined,
      workerSourceReplies: transport.sourceReplies.filter(row => row.sessionId),
    });
  }
  const sourceHashAfter = sha(fs.readFileSync(modulePath));
  assert.equal(sourceHashAfter, sourceHashBefore, 'observer source changed while controls ran');
  const report = {
    schema: 'scripted-observer-lifecycle-controls/5',
    basis: 'SYNTHETIC_SCRIPTED_WEBSOCKET_ACTUAL_OBSERVER_LIFECYCLE_WITH_TEST_LOCAL_REJECTION_AND_LOG_OBSERVATION_ONLY',
    rejectionObservationCases: selected.filter(row => row.metadataControl).map(row => row.name),
    parsedLogObservation: 'CONSOLE_ERROR_FORWARDING_OBSERVER_EXACT_SCRIPTED_WORKER_EVENT_SEQUENCE',
    actualBrowser: false, applicationExecuted: false, socketOpened: false, browserReceiptWritten: false,
    observerModulePath: modulePath, observerSourceSha256: sourceHashBefore,
    artifactDirectory: artifactPath, syntheticSourceCommit: sourceCommit,
    artifactManifestDigest: manifest.manifestDigest.digest,
    sourceBytes: 'GENUINE_LOCALLY_BUILT_ARTIFACT_BYTES',
    sourceUnchanged: true, mode, retirementPolicy: mode === 'strict-no-retirement' ? 'NO_CDP_ERROR_RETIREMENT' : 'CONDITIONAL_RETIREMENT_EXPECTATIONS_NOT_APPROVAL', total: cases.length,
    conforming: cases.filter(row => row.conforms).length,
    discrepancies: cases.filter(row => !row.conforms).map(row => row.name), cases,
  };
  if (mode !== 'baseline' && report.discrepancies.length) {
    const error = new Error('Observer lifecycle controls failed: ' + report.discrepancies.join(', '));
    error.report = report;
    throw error;
  }
  return report;
}

// Permanent owner entry point: every control uses the strict rejection policy.
// The temporary site contains genuine current build bytes but is never served.
export async function verifyBrowserObserverLifecycleControls() {
  const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'observer-lifecycle-control-'));
  const artifactDirectory = path.join(temporary, 'site');
  try {
    execFileSync(process.execPath, [path.join(sourceDirectory, 'build-static-site.mjs'), '--out', artifactDirectory, '--source-commit', '1'.repeat(40)], {cwd: sourceDirectory, timeout: 30000, maxBuffer: 4 * 1024 * 1024});
    const before = {catch: Promise.prototype.catch, consoleError: console.error, WebSocket: globalThis.WebSocket, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, now: Date.now};
    const rejectionSemantics = await verifyCommandRejectionObserverSemantics();
    const loggingSemantics = verifyParsedLoggingObserverSemantics();
    const failedFixture = path.join(temporary, 'fixture-failure-observer.mjs');
    fs.writeFileSync(failedFixture, "export async function createBrowserExecutionObserver(){throw new Error('SYNTHETIC_FIXTURE_FAILURE_BEFORE_TRANSPORT');}\n");
    let failure;
    try { await runObserverLifecycleControls({observerModulePath: failedFixture, artifactDirectory, mode: 'strict-no-retirement', only: ['source-timeout-preserves-command-specific-metadata']}); }
    catch (error) { failure = error; }
    assert.ok(failure?.report, 'OBSERVER_SHIM_FAILURE_REPORT_ORACLE');
    assert.match(failure.report.cases[0].harnessFailure, /SYNTHETIC_FIXTURE_FAILURE_BEFORE_TRANSPORT/);
    assert.equal(Promise.prototype.catch, before.catch); assert.equal(console.error, before.consoleError); assert.equal(globalThis.WebSocket, before.WebSocket); assert.equal(globalThis.setTimeout, before.setTimeout); assert.equal(globalThis.clearTimeout, before.clearTimeout); assert.equal(Date.now, before.now);
    const shimChecks = {rejectionSemantics, loggingSemantics, actualFixtureFailureRestoresAllGlobals: true};
    const report = await runObserverLifecycleControls({observerModulePath: path.join(sourceDirectory, 'browser-execution-evidence.mjs'), artifactDirectory, mode: 'strict-no-retirement'});
    assert.equal(report.total, 28, 'OBSERVER_LIFECYCLE_POPULATION_ORACLE');
    assert.equal(report.conforming, report.total, 'OBSERVER_LIFECYCLE_CONFORMANCE_ORACLE');
    return {browserObserverLifecycleControls: 'PASS', synthetic: true, actualBrowser: false, applicationExecuted: false, socketOpened: false, browserReceiptWritten: false, mode: report.mode, retirementPolicy: report.retirementPolicy, observerSourceSha256: report.observerSourceSha256, sourceUnchanged: report.sourceUnchanged, shimChecks, cases: report.cases.map(row => ({name: row.name, expected: row.expected, actual: row.actual, conforms: row.conforms, parsedLogging: row.parsedLogging.conforms, commandErrorMetadata: row.commandErrorMetadata?.conforms ?? null}))};
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  assert.equal(process.argv.length, 2, 'OBSERVER_LIFECYCLE_DEFAULT_OWNER_ORACLE');
  console.log(JSON.stringify(await verifyBrowserObserverLifecycleControls()));
}
