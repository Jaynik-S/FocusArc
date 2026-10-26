// Real local API checks for every randomly selectable artwork and logical study boundaries.
// Requires disposable API :8002 and Vite :5175; never targets production.
async page => {
  const origin = page.url().split('/').slice(0, 3).join('/');
  if (origin !== 'http://localhost:5175') throw new Error('Use the local frontend on port 5175.');
  const api = 'http://localhost:8002/api';
  const seed = page.context().request;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const username = 'wallpaper-qa-' + Date.now().toString(36);
  const registration = await seed.post(api + '/auth/register', { data: { username, password: 'disposable-local-only123', confirm: true } });
  assert(registration.ok(), 'Disposable registration failed: ' + await registration.text());
  const create = async name => {
    const response = await seed.post(api + '/timers', { data: { name, color: '#FFFFFF', icon: 'book' } });
    assert(response.ok(), 'Could not create QA timer'); return response.json();
  };
  const course = await create('Wallpaper Study A'); await create('Wallpaper Study B');
  const cookies = (await page.context().storageState()).cookies;
  const wallpapers = await page.evaluate(async () => (await import('/src/utils/screensaverWallpapers.ts')).SCREENSAVER_WALLPAPERS);
  const state = async () => (await seed.get(api + '/study-state')).json();
  const report = { username, cases: [], browserErrors: [] };
  const browser = page.context().browser();
  for (let index = 0; index < wallpapers.length; index++) {
    const wallpaper = wallpapers[index];
    await seed.patch(api + '/timers/' + course.id, { data: { color: '#FFFFFF' } });
    const context = await browser.newContext({ viewport: { width: 900, height: 700 }, storageState: { cookies, origins: [] } });
    await context.addInitScript(value => { Math.random = () => value; }, (index + 0.1) / wallpapers.length);
    const view = await context.newPage();
    view.on('pageerror', error => report.browserErrors.push(error.message));
    const screen = view.locator('.screensaver');
    const ready = async () => {
      await view.getByRole('dialog', { name: 'Timer screensaver' }).waitFor();
      await view.locator('.screensaver-wallpaper[data-render-state="ready"]').waitFor();
      await view.waitForFunction(() => getComputedStyle(document.querySelector('.screensaver')).opacity === '1');
    };
    const choose = name => view.getByRole('button', { name: new RegExp('^' + name + ' ') }).click();
    const pause = async () => {
      await view.getByRole('button', { name: 'Pause timer', exact: true }).click();
      await view.getByRole('button', { name: 'Play', exact: true }).waitFor();
    };
    try {
      await view.goto(origin);
      await choose('Wallpaper Study A');
      await view.getByRole('button', { name: 'Play', exact: true }).click(); await ready();
      assert(await screen.getAttribute('data-wallpaper') === wallpaper.id, 'Uniform first-choice interval failed: ' + wallpaper.id);
      assert(await screen.getAttribute('data-ink') === wallpaper.ink, 'Overlay ink does not match actual scene');
      assert(await view.locator('.screensaver-wallpaper').evaluate((el, source) => getComputedStyle(el).backgroundImage.includes(source), wallpaper.source), 'Wrong image source');
      await view.screenshot({ path: '.deployment-private/wallpaper-' + wallpaper.id + '-white-900.png' });
      const firstSession = (await state()).active_session.id;
      await seed.patch(api + '/timers/' + course.id, { data: { color: '#42216F' } });
      await view.locator('.screensaver-wallpaper[data-color="#42216F"][data-render-state="ready"]').waitFor();
      assert(await screen.getAttribute('data-wallpaper') === wallpaper.id, 'HEX edit rerolled artwork');
      assert((await state()).active_session.id === firstSession, 'Color change reset timer');
      await view.screenshot({ path: '.deployment-private/wallpaper-' + wallpaper.id + '-purple-900.png' });
      await view.setViewportSize({ width: 320, height: 568 });
      const fits = await view.locator('.screensaver-body, .screensaver button').evaluateAll(elements => elements.every(el => {
        const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
      }));
      assert(fits, 'Controls overflow narrow view: ' + wallpaper.id);
      await view.screenshot({ path: '.deployment-private/wallpaper-' + wallpaper.id + '-320.png' });
      await view.setViewportSize({ width: 900, height: 700 });
      await pause();
      await view.getByRole('button', { name: 'Play', exact: true }).click(); await ready();
      assert(await screen.getAttribute('data-wallpaper') === wallpaper.id, 'Pause/resume changed artwork');
      assert((await state()).active_session.id !== firstSession, 'Existing saved-session resume semantics changed');
      await view.getByRole('button', { name: 'Exit screensaver', exact: true }).click();
      const running = (await state()).active_session.id;
      await view.reload();
      await view.getByRole('button', { name: 'Pause', exact: true }).waitFor();
      assert(await screen.getAttribute('data-open') === 'false', 'Refresh reopened screensaver');
      assert(await screen.getAttribute('data-wallpaper') === wallpaper.id, 'Refresh lost saved artwork');
      assert((await state()).active_session.id === running, 'Refresh changed running session');
      await view.getByRole('button', { name: 'Pause', exact: true }).click();
      await view.getByRole('button', { name: 'Play', exact: true }).waitFor();
      await view.getByRole('button', { name: 'Play', exact: true }).click(); await ready();
      assert(await screen.getAttribute('data-wallpaper') === wallpaper.id, 'Exit/refresh/re-entry changed artwork');
      await pause();
      if (index === 0) {
        await choose('Wallpaper Study B');
        await view.getByRole('button', { name: 'Play', exact: true }).click(); await ready();
        const next = await screen.getAttribute('data-wallpaper');
        assert(next !== wallpaper.id, 'Timer switch repeated previous wallpaper');
        await view.getByRole('button', { name: 'Exit screensaver', exact: true }).click();
        await view.getByRole('button', { name: 'Reset cycle counters', exact: true }).click();
        await view.getByRole('button', { name: 'Confirm', exact: true }).click();
        await view.getByRole('button', { name: 'Play', exact: true }).waitFor();
        await view.getByRole('button', { name: 'Play', exact: true }).click(); await ready();
        assert(await screen.getAttribute('data-wallpaper') !== next, 'Reset did not begin a new artwork choice');
        await pause();
      }
      report.cases.push({ id: wallpaper.id, whiteAndPurple: true, narrowFits: true, sameTimerResumeStable: true, refreshStableAndNormal: true });
    } catch (error) {
      await view.screenshot({ path: '.deployment-private/wallpaper-rotation-failure.png' });
      throw new Error(String(error) + ' Completed: ' + JSON.stringify(report));
    } finally {
      const snapshot = await state();
      if (snapshot.active_session) await seed.post(api + '/stop', { data: { expected_revision: snapshot.revision, expected_active_session_id: snapshot.active_session.id } });
      await context.close();
    }
  }
  assert(report.browserErrors.length === 0, 'Browser errors: ' + report.browserErrors.join('; '));
  report.timerSwitchAndResetExcludePrevious = true;
  return report;
}
