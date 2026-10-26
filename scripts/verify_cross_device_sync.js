// Run with playwright-cli run-code --filename=scripts/verify_cross_device_sync.js.
// Requires the disposable local API on 8002 and frontend on 5175; never targets production.
async page => {
  const origin = page.url().split('/').slice(0, 3).join('/');
  if (origin !== 'http://localhost:5175') throw new Error('Use the isolated local frontend on port 5175.');
  const includeIdleExpiry = !page.url().includes('skip_idle=1');
  const api = 'http://localhost:8002/api';
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const seed = page.context().request;
  const username = 'sync-' + Date.now().toString(36);
  const password = 'disposable-local-only123';
  const registration = await seed.post(api + '/auth/register', { data: { username, password, confirm: true } });
  assert(registration.status() === 201, 'Disposable account registration failed: ' + await registration.text());
  const create = async (name) => {
    const response = await seed.post(api + '/timers', { data: { name, color: '#7c83ff', icon: 'book' } });
    assert(response.status() === 201, 'Course creation failed');
    return response.json();
  };
  const algorithms = await create('Algorithms');
  const physics = await create('Physics');
  const browser = page.context().browser();
  const contextA = await browser.newContext({ viewport: { width: 900, height: 700 }, timezoneId: 'Asia/Tokyo' });
  const contextB = await browser.newContext({ viewport: { width: 900, height: 700 }, timezoneId: 'America/Los_Angeles' });
  const errors = [];
  const report = { username, separateProfiles: true, clockSkewMinutes: [10, -10], operatingSystemZones: ['Asia/Tokyo', 'America/Los_Angeles'], screenshots: [], includeIdleExpiry };
  const state = async () => (await seed.get(api + '/study-state')).json();
  const latest = async (id) => (await seed.get(api + '/timers/' + id + '/latest-session')).json();
  const seconds = async (view) => {
    const value = await view.getByRole('timer', { name: 'Elapsed time' }).textContent();
    return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  };
  const eventually = async (predicate, message, timeout = 10000) => {
    const until = Date.now() + timeout;
    do { if (await predicate()) return; await page.waitForTimeout(100); } while (Date.now() < until);
    throw new Error(message);
  };
  try {
    for (const [context, skew] of [[contextA, 600000], [contextB, -600000]]) {
      await context.addInitScript((milliseconds) => {
        const NativeDate = Date;
        window.Date = class extends NativeDate {
          constructor(...args) { if (args.length) super(...args); else super(NativeDate.now() + milliseconds); }
          static now() { return NativeDate.now() + milliseconds; }
        };
      }, skew);
    }
    const a = await contextA.newPage(); const b = await contextB.newPage();
    const leaveScreensavers = async () => Promise.all([a, b].map(async view => {
      await view.getByRole('dialog', { name: 'Timer screensaver' }).waitFor();
      await view.getByRole('button', { name: 'Exit screensaver', exact: true }).click();
    }));
    for (const view of [a, b]) view.on('pageerror', error => errors.push(error.message));
    const login = async (view) => {
      await view.goto(origin);
      await view.getByLabel('Username', { exact: true }).fill(username);
      await view.getByLabel('Password', { exact: true }).fill(password);
      await view.getByRole('button', { name: 'Continue', exact: true }).click();
      await view.getByRole('heading', { name: 'Algorithms', exact: true }).waitFor();
      await view.getByRole('button', { name: 'Play', exact: true }).waitFor();
    };
    await Promise.all([login(a), login(b)]);
    assert(await seconds(a) === 0 && await seconds(b) === 0, 'Fresh account did not show shared zero daily totals');
    const startedAt = Date.now();
    await a.getByRole('button', { name: 'Play', exact: true }).click();
    await leaveScreensavers();
    await b.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    report.startPropagationMs = Date.now() - startedAt;
    await a.getByRole('button', { name: '+10 min', exact: true }).click();
    await eventually(async () => (await seconds(b)) >= 600, 'Remote running adjustment did not arrive');
    assert(Math.abs(await seconds(a) - await seconds(b)) <= 1, 'Device wall clocks changed the live study duration');
    const active = (await state()).active_session;
    report.activeSessionId = active.id;
    report.liveTimerDifferenceSeconds = Math.abs(await seconds(a) - await seconds(b));
    await a.getByRole('button', { name: 'Pause', exact: true }).click();
    await Promise.all([a.getByRole('button', { name: 'Play', exact: true }).waitFor(), b.getByRole('button', { name: 'Play', exact: true }).waitFor()]);
    const completed = await latest(algorithms.id);
    const fixedEnd = completed.end_at;
    await b.getByRole('link', { name: 'History', exact: true }).click();
    await b.getByRole('button', { name: 'Add 10 minutes to session' }).waitFor();
    await a.getByRole('link', { name: 'Schedule', exact: true }).click();
    const block = a.locator('[data-session="' + completed.id + '"]');
    await block.waitFor();
    const oldBottom = await block.evaluate(el => parseFloat(el.style.top) + parseFloat(el.style.height));
    const oldTop = await block.evaluate(el => el.style.top);
    const editStartedAt = Date.now();
    await b.getByRole('button', { name: 'Add 10 minutes to session' }).click();
    await eventually(async () => (await block.evaluate(el => el.style.top)) !== oldTop, 'History edit did not refresh the other profile Schedule');
    report.historyPropagationMs = Date.now() - editStartedAt;
    const grown = await latest(algorithms.id);
    assert(Date.parse(grown.end_at) === Date.parse(fixedEnd), 'History adjustment moved the end');
    assert(Math.abs((await block.evaluate(el => parseFloat(el.style.top) + parseFloat(el.style.height))) - oldBottom) < 0.01, 'Schedule block end moved');
    await block.click();
    await a.getByRole('button', { name: 'Subtract 5 minutes from session' }).click();
    const target = grown.duration_seconds - 300;
    await eventually(async () => (await latest(algorithms.id)).duration_seconds === target, 'Schedule adjustment did not persist');
    const hms = (value) => [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60].map(part => String(part).padStart(2, '0')).join(':');
    await b.locator('.session-time').filter({ hasText: hms(target) }).waitFor();
    report.historyScheduleBothDirections = true;
    report.completedEndFixed = true;
    await a.screenshot({ path: '.deployment-private/cross-device-schedule-900.png' }); report.screenshots.push('schedule');
    await b.screenshot({ path: '.deployment-private/cross-device-history-900.png' }); report.screenshots.push('history');
    const stale = await state();
    await b.getByRole('link', { name: 'Timers', exact: true }).click();
    await a.getByRole('link', { name: 'Timers', exact: true }).click();
    await a.getByRole('button', { name: /^Physics / }).click();
    await a.getByRole('button', { name: 'Play', exact: true }).click();
    await leaveScreensavers();
    await b.getByRole('heading', { name: 'Physics', exact: true }).waitFor();
    await b.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    const rejected = await seed.post(api + '/stop', { data: { expected_revision: stale.revision, expected_active_session_id: null } });
    assert(rejected.status() === 409 && (await state()).active_session.timer_id === physics.id, 'Stale stop affected a newer session');
    report.staleCommandRejected = true;
    await a.getByRole('button', { name: 'Reset cycle counters', exact: true }).click();
    await a.getByRole('button', { name: 'Confirm', exact: true }).click();
    await b.getByRole('button', { name: 'Play', exact: true }).waitFor();
    await a.getByRole('button', { name: /^Algorithms / }).click();
    await b.getByRole('button', { name: /^Algorithms / }).click();
    const reset = await state();
    const completedToday = reset.timers.find(timer => timer.id === algorithms.id).completed_today_seconds;
    assert(reset.timers.every(timer => timer.cycle_total_seconds === 0), 'Cycle counters were not reset');
    await eventually(async () => await seconds(a) === completedToday && await seconds(b) === completedToday, 'Cycle reset erased or desynchronized today totals');
    report.resetPreservesToday = true;
    await a.getByRole('button', { name: 'Play', exact: true }).click();
    await leaveScreensavers();
    await b.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    await a.getByRole('button', { name: '+10 min', exact: true }).click();
    await eventually(async () => await seconds(b) >= completedToday + 600, 'Second active adjustment missing');
    const live = (await state()).active_session;
    let observerStops = 0;
    b.on('request', request => { if (request.url().split('?')[0].endsWith('/stop') && request.method() === 'POST') observerStops++; });
    await b.evaluate(({ account, session }) => {
      localStorage.setItem(`coursetimers.accounts.${account}.lastActiveAt`, JSON.stringify({ sessionId: session.id, lastActiveAt: Date.now() - 3600000 }));
      localStorage.setItem(`coursetimers.accounts.${account}.activeSession`, JSON.stringify({ activeSession: session, elapsedSeconds: 0 }));
    }, { account: username, session: live });
    await b.reload();
    await b.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    assert((await state()).active_session.id === live.id && observerStops === 0, 'Stale sleeping observer stopped the shared timer');
    report.sleepingObserverSafe = true;
    await a.screenshot({ path: '.deployment-private/cross-device-timer-A-900.png' }); report.screenshots.push('timer A');
    await b.screenshot({ path: '.deployment-private/cross-device-timer-B-900.png' }); report.screenshots.push('timer B');
    assert(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'A overflowed 900px');
    assert(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'B overflowed 900px');
    if (includeIdleExpiry) {
      // Real five-minute expiry, with no client test hooks or accelerated server clock.
      await Promise.all([contextA.setOffline(true), contextB.setOffline(true)]);
      await page.waitForTimeout(1000);
      const idle = await state();
      const leaseEnd = Date.parse(idle.lease_expires_at);
      const lastHeartbeat = leaseEnd - 300000;
      const waitMs = Math.max(0, leaseEnd - Date.parse(idle.server_now)) + 17000;
      assert(waitMs <= 320000, 'Unexpected inactivity deadline');
      await page.waitForTimeout(waitMs);
      // Unguarded legacy list read does not run request-time expiry: this proves the server sweeper acted.
      const previous = new Date(Date.parse(idle.day_date + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
      const records = (await (await seed.get(api + `/sessions?from=${previous}&to=${idle.day_date}`)).json()).sessions;
      const expired = records.find(session => session.id === live.id);
      assert(expired?.end_at && Date.parse(expired.end_at) === Math.max(Date.parse(live.start_at), lastHeartbeat), 'Server did not expire the timer at its last account heartbeat');
      await Promise.all([contextA.setOffline(false), contextB.setOffline(false)]);
      await Promise.all([a.getByRole('button', { name: 'Play', exact: true }).waitFor(), b.getByRole('button', { name: 'Play', exact: true }).waitFor()]);
      await eventually(async () => await seconds(a) === await seconds(b), 'Devices did not converge after real inactivity expiry');
      report.realInactivityExpiry = { waitedMs: waitMs, endAt: expired.end_at, recordedSeconds: expired.duration_seconds };
    } else {
      await a.getByRole('button', { name: 'Pause', exact: true }).click();
      await b.getByRole('button', { name: 'Play', exact: true }).waitFor();
    }
    const bob = 'other-' + Date.now().toString(36);
    const switchAccount = await contextA.request.post(api + '/auth/register', { data: { username: bob, password, confirm: true } });
    assert(switchAccount.status() === 201, 'Second account registration failed');
    await a.getByRole('button', { name: 'Continue', exact: true }).waitFor();
    assert((await (await contextB.request.get(api + '/auth/session')).json()).username === username, 'Separate profile lost its account');
    report.cookieAccountSwitchIsolated = true;
    assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
    return report;
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
  }
}
