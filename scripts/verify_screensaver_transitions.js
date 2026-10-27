// Run with playwright-cli run-code --filename=... against local Vite :5175.
// Only API traffic is mocked; images, recoloring Worker, Canvas, CSS and timer UI are real.
async page => {
  if (!page.url().startsWith('http://localhost:5175')) throw new Error('Use local Vite on :5175.');
  const origin = page.url().includes('production=1') ? 'http://localhost:5176' : 'http://localhost:5175';
  const caseFilter = page.url().match(/[?#&]case=([^&]+)/)?.[1];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wallpapers = await page.evaluate(async () => (await import('/src/utils/screensaverWallpapers.ts')).SCREENSAVER_WALLPAPERS);
  const effects = ['portal', 'parallax', 'stardust'];
  const colors = ['#A8D5BA', '#FF5733', '#3B82F6', '#FFFFFF', '#000000'];
  const report = { cases: [], errors: [] };
  for (let scene = 0; scene < wallpapers.length; scene++) for (let effect = 0; effect < effects.length; effect++) {
    if (caseFilter && caseFilter !== wallpapers[scene].id + '-' + effects[effect]) continue;
    const context = await page.context().browser().newContext({ viewport: { width: 900, height: 700 } });
    await context.addInitScript(({ wallpapers }) => {
      window.transitionDraws = [];
      Math.random = () => window.transitionDraws.shift() ?? .1;
      window.transitionMetrics = { frames: [], mismatches: [], jobs: 0, entrances: 0 };
      document.addEventListener('animationstart', event => { if (['screensaver-portal', 'screensaver-depth-back', 'screensaver-dust-reveal'].includes(event.animationName)) window.transitionMetrics.entrances++; });
      const NativeWorker = Worker;
      window.Worker = class extends NativeWorker { postMessage(...args) { window.transitionMetrics.jobs++; super.postMessage(...args); } };
      let last = 0;
      const check = stamp => {
        const root = document.querySelector('.screensaver');
        if (root?.dataset.open === 'true') {
          if (last) window.transitionMetrics.frames.push(stamp - last);
          const art = root.querySelector('.screensaver-wallpaper');
          const ambient = root.querySelector('.screensaver-environment');
          const source = wallpapers.find(item => item.source === art?.dataset.source)?.id;
          if (!art?.dataset.color || source !== ambient?.dataset.scene || art.dataset.color !== ambient?.dataset.color) {
            window.transitionMetrics.mismatches.push({ source, art: art?.dataset.color, scene: ambient?.dataset.scene, color: ambient?.dataset.color });
          }
        }
        last = root?.dataset.open === 'true' ? stamp : 0;
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }, { wallpapers });
    const view = await context.newPage();
    view.on('pageerror', error => report.errors.push(error.message));
    let active = null; let revision = 1; let serial = 0; let starts = 0; let stops = 0;
    const day = new Date().toISOString().slice(0, 10);
    const timer = { id: 'transition-study', name: 'Transition Study', color: colors[(scene + effect) % colors.length], icon: 'book', cycle_total_seconds: 0, completed_today_seconds: 0, is_archived: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    await context.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = route.request().url(); let body = {};
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (path.includes('/auth/session')) body = { username: 'transition-preview' };
      else if (path.includes('/start')) { starts++; active = { id: 'entry-' + (++serial), timer_id: timer.id, start_at: new Date().toISOString(), end_at: null, duration_seconds: null, client_tz: 'America/Toronto', day_date: day, day_of_week: 0 }; revision++; body = { active_session: active, stopped_session: null }; }
      else if (path.includes('/stop')) { stops++; body = { stopped_session: active }; active = null; revision++; }
      else if (path.includes('/study-state')) body = { username: 'transition-preview', changed: true, revision, server_now: new Date().toISOString(), study_timezone: 'America/Toronto', day_date: day, day_start_at: day + 'T00:00:00Z', day_end_at: new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString(), lease_expires_at: null, active_session: active, timers: [timer] };
      await route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    });
    // Force a cold load to expose the old-frame race rather than just testing cache hits.
    await context.route('**/screensaver/*.png', async route => { await view.waitForTimeout(350); await route.continue(); });
    try {
      await view.goto(origin);
      await view.getByRole('button', { name: /^Transition Study / }).click();
      await view.evaluate(draws => { window.transitionDraws = draws; }, [(scene + .1) / 5, (effect + .1) / 3]);
      await view.getByRole('button', { name: 'Play', exact: true }).click();
      await view.locator('.screensaver-wallpaper[data-render-state="loading"]').waitFor({ state: 'attached' });
      assert(await view.locator('.app-layout').evaluate(el => !el.inert && el.getAttribute('aria-hidden') !== 'true'), 'Normal timer unavailable while preparing');
      assert(await view.locator('.screensaver').getAttribute('data-open') === 'false', 'Entered before selected frame was ready');
      await view.getByRole('dialog', { name: 'Timer screensaver' }).waitFor();
      const root = view.locator('.screensaver');
      assert(await root.getAttribute('data-wallpaper') === wallpapers[scene].id, 'Wrong selected wallpaper');
      assert(await root.getAttribute('data-transition') === effects[effect], 'Independent transition draw failed for ' + wallpapers[scene].id + '/' + effects[effect] + ': ' + await root.getAttribute('data-transition'));
      assert(await view.locator('.screensaver-wallpaper').getAttribute('data-color') === timer.color, 'Entrance HEX mismatch');
      // Sample the exact middle of each real CSS animation for visual inspection.
      await view.evaluate(() => {
        for (const animation of document.querySelector('.screensaver').getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 350; }
      });
      await view.screenshot({ path: '.deployment-private/entry-' + wallpapers[scene].id + '-' + effects[effect] + '.png' });
      const middle = await root.evaluate(el => ({ mask: getComputedStyle(el.querySelector('.screensaver-scene')).maskImage, filter: getComputedStyle(el.querySelector('.screensaver-scene')).filter }));
      if (effect === 0) assert(middle.mask !== 'none' && middle.filter !== 'none', 'Portal lost its watercolor mask/blur before filling');
      await view.evaluate(() => { for (const animation of document.querySelector('.screensaver').getAnimations({ subtree: true })) animation.play(); });
      await view.waitForTimeout(1200);
      const chosen = await root.getAttribute('data-transition');
      const jobs = await view.evaluate(() => window.transitionMetrics.jobs);
      const entranceCount = await view.evaluate(() => window.transitionMetrics.entrances);
      assert(entranceCount === 1, 'Entrance did not run exactly once');
      timer.color = colors[(scene + effect + 2) % colors.length]; revision++;
      await view.evaluate(() => window.dispatchEvent(new Event('focus')));
      await view.locator('.screensaver-wallpaper[data-render-state="ready"][data-color="' + timer.color + '"]').waitFor();
      assert(await root.getAttribute('data-transition') === chosen, 'HEX update rerolled transition');
      await view.waitForTimeout(1050);
      assert(await view.evaluate(() => window.transitionMetrics.jobs) === jobs + 1, 'Ticks unnecessarily recolor artwork');
      assert(await view.evaluate(() => window.transitionMetrics.entrances) === entranceCount, 'HEX update or timer tick replayed the entrance');
      await view.getByRole('button', { name: 'Exit screensaver', exact: true }).click();
      assert(stops === 0 && active !== null, 'Manual exit changed the timer');
      assert(await view.locator('.app-layout').evaluate(el => !el.inert), 'Exit delayed normal timer controls');
      assert(await view.evaluate(() => !!document.activeElement?.closest('.app-layout')), 'Exit failed to restore keyboard focus to normal timer');
      await view.waitForTimeout(60);
      const exitOpacity = await root.evaluate(el => +getComputedStyle(el).opacity);
      assert(exitOpacity > 0 && exitOpacity < 1, 'Exit did not use a quick independent fade');
      await view.getByRole('button', { name: 'Pause', exact: true }).click();
      await view.getByRole('button', { name: 'Play', exact: true }).click();
      await view.getByRole('dialog', { name: 'Timer screensaver' }).waitFor();
      assert(await root.getAttribute('data-transition') !== chosen, 'Consecutive entrance repeated');
      if (scene === 0) {
        // Interrupt the resumed entrance, then pause/resume before the exit fade completes.
        await view.getByRole('button', { name: 'Pause timer', exact: true }).click({ force: true });
        await view.getByRole('button', { name: 'Play', exact: true }).waitFor();
        assert(await view.evaluate(() => !!document.activeElement?.closest('.app-layout')), 'Pause failed to restore normal keyboard focus');
        await view.getByRole('button', { name: 'Play', exact: true }).click();
        await view.getByRole('dialog', { name: 'Timer screensaver' }).waitFor();
        await view.emulateMedia({ reducedMotion: 'reduce' });
        const reduced = await root.evaluate(el => ({ animation: getComputedStyle(el.querySelector('.screensaver-scene')).animationName, duration: getComputedStyle(el).transitionDuration, dust: getComputedStyle(el.querySelector('.screensaver-stardust') ?? el.querySelector('.screensaver-environment')).display }));
        assert(reduced.animation === 'none' && reduced.duration.includes('0.1s') && reduced.dust === 'none', 'Reduced motion retained elaborate entrance');
        await view.keyboard.press('Escape');
        assert(active !== null, 'Keyboard exit stopped timer');
      }
      const metrics = await view.evaluate(() => window.transitionMetrics);
      assert(metrics.mismatches.length === 0, 'Visible stale/mismatched frames: ' + JSON.stringify(metrics.mismatches));
      const intervals = metrics.frames.filter(ms => ms > 0 && ms < 500).sort((a, b) => a - b);
      report.cases.push({ scene: wallpapers[scene].id, transition: chosen, colors: [colors[(scene + effect) % colors.length], timer.color], frames: intervals.length, medianFrameMs: intervals[Math.floor(intervals.length / 2)], p95FrameMs: intervals[Math.floor(intervals.length * .95)], starts, stops, noMismatches: true });
    } finally { await context.close(); }
  }
  assert(report.errors.length === 0, 'Browser errors: ' + report.errors.join('; '));
  return report;
}
