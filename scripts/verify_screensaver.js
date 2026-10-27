// playwright-cli run-code --filename=scripts/verify_screensaver.js
// Uses a disposable account on the isolated local API/frontend only.
async page => {
  const origin = page.url().split('/').slice(0, 3).join('/');
  if (origin !== 'http://localhost:5175') throw new Error('Use the local frontend on port 5175.');
  const api = 'http://localhost:8002/api';
  const seed = page.context().request;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  // Optional qa_account reuses a disposable account when local registration is rate limited.
  const reuse = page.url().match(/[?&]qa_account=([^&]+)/);
  const username = reuse ? decodeURIComponent(reuse[1]) : 'screensaver-qa-' + Date.now().toString(36);
  assert(username.startsWith('screensaver-qa-'), 'Only disposable screensaver QA accounts may be reused');
  const password = 'disposable-local-only123';
  const authentication = await seed.post(api + (reuse ? '/auth/login' : '/auth/register'), { data: { username, password, ...(reuse ? {} : { confirm: true }) } });
  assert(authentication.ok(), 'Disposable authentication failed: ' + await authentication.text());
  if (reuse) {
    const old = (await (await seed.get(api + '/timers')).json()).timers;
    for (const timer of old) {
      const archived = await seed.delete(api + '/timers/' + timer.id);
      assert(archived.ok(), 'Could not archive previous disposable QA timer');
    }
  }
  const create = async (name, color) => {
    const response = await seed.post(api + '/timers', { data: { name: reuse ? name + ' ' + Date.now().toString(36).slice(-4) : name, color, icon: 'book' } });
    assert(response.status() === 201, 'Timer creation failed: ' + await response.text());
    return response.json();
  };
  const purple = await create('Creative Focus', '#a56de2');
  const orange = await create('Evening Flow', '#ff8855');
  const browser = page.context().browser();
  const contextA = await browser.newContext({ viewport: { width: 900, height: 700 }, timezoneId: 'Asia/Tokyo' });
  const contextB = await browser.newContext({ viewport: { width: 900, height: 700 }, timezoneId: 'America/Los_Angeles' });
  for (const context of [contextA, contextB]) await context.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.screensaverWorkerJobs = 0;
    window.Worker = class extends NativeWorker {
      postMessage(...args) { window.screensaverWorkerJobs++; super.postMessage(...args); }
    };
  });
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  const errors = [];
  for (const view of [a, b]) view.on('pageerror', error => errors.push(error.message));
  const report = { username, separateProfiles: true, checks: [], screenshots: [] };
  const state = async () => (await seed.get(api + '/study-state')).json();
  const dialog = view => view.getByRole('dialog', { name: 'Timer screensaver' });
  const eventually = async (predicate, message) => {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) { if (await predicate()) return; await a.waitForTimeout(100); }
    throw new Error(message);
  };
  const choose = (view, name) => view.getByRole('button', { name: new RegExp('^' + name + ' ') }).click();
  const normal = async view => {
    await eventually(async () => !(await dialog(view).isVisible()), 'Expected normal view');
    assert(await view.locator('.app-layout').evaluate(el => !el.inert && el.getAttribute('aria-hidden') !== 'true'), 'Normal view remained inert');
  };
  const seconds = async view => (await view.getByRole('timer').textContent()).split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const ready = async view => {
    await view.goto(origin);
    await view.getByLabel('Username', { exact: true }).fill(username);
    await view.getByLabel('Password', { exact: true }).fill(password);
    await view.getByRole('button', { name: 'Continue', exact: true }).click();
    await view.getByRole('button', { name: /^Creative Focus / }).waitFor();
    await choose(view, 'Creative Focus');
    await view.getByRole('button', { name: 'Play', exact: true }).waitFor();
  };
  const screenshot = async (view, name) => {
    await view.waitForFunction(() => getComputedStyle(document.querySelector('.screensaver')).opacity === '1');
    await view.locator('.screensaver-wallpaper[data-render-state="ready"]').waitFor();
    const path = '.deployment-private/screensaver-' + name + '.png';
    await view.screenshot({ path }); report.screenshots.push(path);
  };
  try {
    await Promise.all([ready(a), ready(b)]);
    await a.getByRole('button', { name: 'Play', exact: true }).click();
    await Promise.all([dialog(a).waitFor(), dialog(b).waitFor()]);
    assert(await a.locator('.app-layout').evaluate(el => el.inert && el.getAttribute('aria-hidden') === 'true'), 'Background not isolated');
    const first = (await state()).active_session;
    assert(first.timer_id === purple.id, 'Wrong active course');
    assert(Math.abs(await seconds(a) - await seconds(b)) <= 1, 'Shared elapsed differs');
    report.checks.push('Local and remote activation enter; shared time; background inert');

    await a.getByRole('button', { name: 'Add 10 minutes', exact: true }).click();
    await eventually(async () => Date.parse((await state()).active_session.start_at) === Date.parse(first.start_at) - 600000, '+10 did not persist');
    await a.getByRole('button', { name: 'Subtract 5 minutes', exact: true }).click();
    await eventually(async () => Date.parse((await state()).active_session.start_at) === Date.parse(first.start_at) - 300000, '−5 did not persist');
    assert((await state()).active_session.id === first.id, 'Adjustment duplicated session');
    report.checks.push('Shared +10/−5 persist without new session');
    await screenshot(a, 'purple-900');
    const steadyJobs = await a.evaluate(() => window.screensaverWorkerJobs);
    await a.waitForTimeout(2500);
    assert(await a.evaluate(() => window.screensaverWorkerJobs) === steadyJobs, 'Timer ticks reprocessed wallpaper');
    report.checks.push('Timer ticks and shared adjustments do not reprocess artwork');

    await a.getByRole('button', { name: 'Exit screensaver', exact: true }).click();
    await normal(a);
    await a.waitForTimeout(4200);
    assert(!(await dialog(a).isVisible()), 'Sync reopened manually dismissed view');
    assert((await state()).active_session.id === first.id, 'Exit interrupted timer');
    await choose(a, 'Evening Flow');
    assert(!(await dialog(a).isVisible()), 'Browsing changed view mode');
    await b.reload(); await normal(b);
    await b.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    assert((await state()).active_session.id === first.id, 'Refresh duplicated timer');
    report.checks.push('Exit survives polling and browsing; refresh normal with same active session');

    await b.getByRole('button', { name: 'Pause', exact: true }).click();
    await eventually(async () => (await state()).active_session === null, 'Normal pause failed');
    await b.getByRole('button', { name: 'Play', exact: true }).click();
    await Promise.all([dialog(a).waitFor(), dialog(b).waitFor()]);
    const resumed = (await state()).active_session;
    assert(resumed.id !== first.id, 'Resume did not create normal session');
    await a.keyboard.press('Escape'); await normal(a);
    assert((await state()).active_session.id === resumed.id, 'Escape stopped timer');
    await b.getByRole('button', { name: 'Pause timer', exact: true }).click();
    await Promise.all([normal(a), normal(b)]);
    // A was already manually dismissed: wait for its remote pause snapshot too.
    await choose(a, 'Creative Focus');
    await a.getByRole('button', { name: 'Play', exact: true }).waitFor();
    const savedDay = (await state()).day_date;
    const historyResponse = await seed.get(api + '/sessions?from=' + savedDay + '&to=' + savedDay);
    assert(historyResponse.ok(), 'History read failed: ' + await historyResponse.text());
    const history = await historyResponse.json();
    assert(history.sessions.filter(session => session.timer_id === purple.id).length === 2, 'View changes created extra sessions');
    report.checks.push('Resume re-enters on both profiles; Escape preserves timer; screensaver pause exits; exactly two saved sessions');

    await choose(a, 'Evening Flow');
    await a.getByRole('button', { name: 'Play', exact: true }).click();
    await Promise.all([dialog(a).waitFor(), dialog(b).waitFor()]);
    await eventually(async () => await b.locator('.screensaver-wallpaper').getAttribute('data-color') === '#FF8855', 'Active color not synchronized');
    await screenshot(a, 'orange-900');
    const orangeSession = (await state()).active_session.id;
    const patch = await seed.patch(api + '/timers/' + orange.id, { data: { color: '#2299dd' } });
    assert(patch.ok(), 'Color update failed');
    await eventually(async () => await b.locator('.screensaver-wallpaper').getAttribute('data-color') === '#2299DD', 'HEX color edit not reflected');
    assert((await state()).active_session.id === orangeSession, 'Theme change reset session');
    await screenshot(b, 'blue-900');
    report.checks.push('New timer selects correct wallpaper; remote HEX edit updates artwork without reset');

    const rename = await seed.patch(api + '/timers/' + orange.id, { data: { name: 'Advanced Algorithms Study ' + Date.now().toString(36).slice(-6) } });
    assert(rename.ok(), 'Long name update failed: ' + await rename.text());
    await eventually(async () => (await b.getByRole('heading').textContent()).startsWith('Advanced Algorithms'), 'Long timer name did not sync');
    const resizeJobs = await b.evaluate(() => window.screensaverWorkerJobs);
    for (const viewport of [{ width: 320, height: 568 }, { width: 900, height: 400 }]) {
      await b.setViewportSize(viewport);
      await b.waitForTimeout(100);
      const bounds = await b.locator('.screensaver button, .screensaver-body').evaluateAll(elements => elements.map(el => {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }));
      assert(bounds.every(rect => rect.left >= 0 && rect.top >= 0 && rect.right <= viewport.width && rect.bottom <= viewport.height), 'Controls or long name outside viewport ' + JSON.stringify(viewport));
      await screenshot(b, viewport.width + 'x' + viewport.height);
    }
    assert(await b.evaluate(() => window.screensaverWorkerJobs) === resizeJobs, 'Viewport resize reprocessed artwork');
    await b.emulateMedia({ reducedMotion: 'reduce' });
    // The app-wide reduced-motion rule uses an effectively instant 0.01ms duration.
    assert(await b.locator('.screensaver').evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(value => parseFloat(value) <= 0.001)), 'Reduced motion not respected');
    await contextB.setOffline(true);
    await eventually(async () => await b.getByRole('button', { name: 'Pause timer', exact: true }).isDisabled(), 'Offline controls enabled');
    await eventually(async () => await b.getByRole('button', { name: 'Exit screensaver', exact: true }).evaluate(el => el === document.activeElement), 'Offline transition lost keyboard focus');
    await b.evaluate(() => document.activeElement.blur());
    await b.keyboard.press('Escape');
    await normal(b);
    await contextB.setOffline(false);
    await b.waitForTimeout(2500);
    assert(!(await dialog(b).isVisible()), 'Reconnect reopened dismissed mode');
    assert((await state()).active_session.id === orangeSession, 'Offline view exit affected timer');
    await b.setViewportSize({ width: 900, height: 700 });
    for (const route of ['History', 'Schedule', 'Stats']) {
      await b.getByRole('link', { name: route, exact: true }).click();
      await b.getByRole('heading', { name: route, exact: true }).waitFor();
      assert(!(await dialog(b).isVisible()), 'Route navigation reopened dismissed mode');
    }
    report.checks.push('Long name and controls fit 320×568 and900×400; reduced motion; offline exit and reconnect');
    report.checks.push('History, Schedule and Stats accessible while timer continues after Exit');
    const fallbackContext = await browser.newContext({ storageState: await contextB.storageState(), viewport: { width: 900, height: 700 } });
    try {
      await fallbackContext.addInitScript(() => { window.Worker = undefined; });
      const fallback = await fallbackContext.newPage();
      fallback.on('pageerror', error => errors.push(error.message));
      await fallback.goto(origin);
      await fallback.getByRole('button', { name: 'Pause', exact: true }).click();
      await fallback.getByRole('button', { name: 'Play', exact: true }).click();
      await fallback.locator('.screensaver-wallpaper[data-render-state="error"]').waitFor({ state: 'attached' });
      assert(!(await dialog(fallback).isVisible()), 'Unavailable worker admitted unrecolored artwork');
      assert(await fallback.locator('.app-layout').evaluate(el => !el.inert), 'Unavailable worker blocked normal timer controls');
      await fallback.getByRole('button', { name: 'Pause', exact: true }).click();
      await normal(fallback);
      report.checks.push('Unavailable worker keeps normal timer controls available without exposing unrecolored artwork');
    } finally { await fallbackContext.close(); }
    assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
    report.browserErrors = errors;
    return report;
  } catch (error) {
    await a.screenshot({ path: '.deployment-private/screensaver-failure-a.png' });
    await b.screenshot({ path: '.deployment-private/screensaver-failure-b.png' });
    throw new Error(String(error) + '\nCompleted checks: ' + JSON.stringify(report) + '\nBrowser errors: ' + errors.join('; ') + '\nSnapshot: ' + JSON.stringify(await state()));
  } finally {
    await contextB.setOffline(false);
    const snapshot = await state();
    if (snapshot.active_session) await seed.post(api + '/stop', { data: { expected_revision: snapshot.revision, expected_active_session_id: snapshot.active_session.id } });
    await Promise.all([contextA.close(), contextB.close()]);
  }
}
