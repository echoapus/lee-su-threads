import { it, expect } from 'vitest';
import { mkdtempSync, cpSync, symlinkSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { JSDOM, VirtualConsole } from 'jsdom';

it('packages extensions and a standalone userscript, and builds self-hosted Firefox', async () => {
  const root = resolve(import.meta.dirname, '..');
  const dir = mkdtempSync(join(tmpdir(), 'threads-package-'));
  const env = { ...process.env, NODE_ENV: 'production', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_') && !key.startsWith('GIT_CONFIG_')) delete env[key];
  delete env.FIREFOX_BUILD_TYPE;
  const run = (command, args, overrides = {}) => execFileSync(command, args, {
    cwd: dir, env: { ...env, ...overrides }, encoding: 'utf8', stdio: 'pipe', timeout: 30000
  });
  let dom;
  try {
    for (const path of ['src', 'scripts', 'data', '_locales', 'icons', 'fonts', 'esbuild.config.js', 'package.json', 'LICENSE', 'NOTICE.md']) {
      cpSync(join(root, path), join(dir, path), { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
    run('git', ['init', '-q']);
    run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', 'fixture']);
    run('git', ['-c', 'tag.gpgsign=false', 'tag', 'v1.2.3']);
    run('bash', ['scripts/package.sh']);
    for (const browser of ['chrome', 'firefox-amo']) {
      const zip = join(dir, 'dist-zip', browser === 'chrome'
        ? 'MetaThreadsCountryInfo-chrome-v1.2.3.zip' : 'MetaThreadsCountryInfo-firefox-v1.2.3-amo.zip');
      expect(existsSync(zip)).toBe(true);
      const manifest = JSON.parse(run('unzip', ['-p', zip, 'manifest.json']));
      expect(manifest.version).toBe('1.2.3');
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.default_locale).toBe('en');
      const messages = JSON.parse(run('unzip', ['-p', zip, '_locales/en/messages.json']));
      expect(messages.extName.message).toBe('MetaThreadsCountryInfo');
      expect(messages.noLocationData.message).toBe('No location data');
      const localeFiles = run('unzip', ['-Z1', zip]).split('\n').filter(path => /^_locales\/[^/]+\/messages\.json$/.test(path));
      expect(localeFiles).toEqual(['_locales/en/messages.json']);
      expect(run('unzip', ['-p', zip, 'LICENSE'])).toBe(readFileSync(join(root, 'LICENSE'), 'utf8'));
      expect(run('unzip', ['-p', zip, 'NOTICE.md'])).toBe(readFileSync(join(root, 'NOTICE.md'), 'utf8'));
    }
    const userscript = readFileSync(join(dir, 'dist-zip/MetaThreadsCountryInfo.user.js'), 'utf8');
    expect(userscript.startsWith('// ==UserScript==')).toBe(true);
    expect(userscript).toContain('// @version 1.2.3');
    expect(userscript).toContain('// @inject-into page');
    expect(userscript).toContain('// @run-at document-start');
    expect(userscript).toContain('Copyright (c) 2025');
    expect(userscript).toContain('CC BY 4.0');
    expect(userscript).toContain('base64,');
    expect(userscript).not.toMatch(/^\/\/ @(?:require|resource) /m);
    dom = new JSDOM('', { url: 'https://www.threads.com', runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
    const page = dom.window;
    const store = new Map();
    page.unsafeWindow = page;
    page.GM_getValue = key => store.get(key);
    page.GM_setValue = (key, value) => store.set(key, value);
    page.GM_listValues = () => [...store.keys()];
    page.GM_deleteValue = key => store.delete(key);
    page.GM_addStyle = css => {
      const style = page.document.createElement('style');
      style.textContent = css;
      page.document.head.appendChild(style);
    };
    page.IntersectionObserver = class { observe() {} unobserve() {} };
    page.HTMLCanvasElement.prototype.getContext = () => ({
      scale() {}, clearRect() {}, fillText() {}, getImageData: () => ({ data: [0, 0, 0, 0] })
    });
    const originalFetch = async () => ({ clone: () => ({ text: async () => JSON.stringify({ user: { username: 'alice', pk: '123' } }) }) });
    page.fetch = originalFetch;
    page.eval(userscript);
    await new Promise(resolve => setImmediate(resolve));
    expect(page.fetch).not.toBe(originalFetch);
    await page.fetch('/graphql/query');
    await new Promise(resolve => setImmediate(resolve));
    expect(page.__threadsGetUserIdMap().alice).toBe('123');
    page.document.body.innerHTML = '<button class="threads-fetch-btn" data-username="alice"></button>';
    page.dispatchEvent(new page.CustomEvent('threads-profile-extracted', {
      detail: { username: 'alice', location: 'Taiwan' }
    }));
    expect(store.get('profile:alice').location).toBe('Taiwan');
    expect(page.document.querySelector('.threads-profile-info-badge').textContent).toContain('Taiwan');
    expect(page.document.querySelector('style').textContent).toContain('.threads-fetch-btn');
    expect(page.document.querySelector('script[src]')).toBeNull();
    expect(existsSync(join(dir, 'dist/safari'))).toBe(false);
    mkdirSync(join(dir, 'dist/chrome/_locales/zh_TW'), { recursive: true });
    writeFileSync(join(dir, 'dist/chrome/_locales/zh_TW/messages.json'), '{}');
    run(process.execPath, ['esbuild.config.js'], { FIREFOX_BUILD_TYPE: 'self-hosted' });
    expect(readdirSync(join(dir, 'dist/chrome/_locales'))).toEqual(['en']);
    const direct = JSON.parse(readFileSync(join(dir, 'dist/firefox-direct/manifest.json'), 'utf8'));
    expect(direct.browser_specific_settings.gecko.update_url).toBe('https://github.com/echoapus/lee-su-threads/releases/latest/download/updates.json');
    expect(direct.version).toBe('1.2.3');
    expect(direct.default_locale).toBe('en');
    expect(readdirSync(join(dir, 'dist/firefox-direct/_locales'))).toEqual(['en']);
    expect(readFileSync(join(dir, 'dist/firefox-direct/LICENSE'), 'utf8')).toContain('Copyright (c) 2025');
    expect(readFileSync(join(dir, 'dist/firefox-direct/NOTICE.md'), 'utf8')).toContain('CC BY 4.0');
    expect(run(process.execPath, ['scripts/check-versions.js'])).toContain('All present version sources match');
    writeFileSync(join(dir, 'dist/userscript/MetaThreadsCountryInfo.user.js'), userscript.replace('// @version 1.2.3', '// @version 1.2.4'));
    expect(() => run(process.execPath, ['scripts/check-versions.js'])).toThrow(/MetaThreadsCountryInfo\.user\.js/);
  } finally {
    dom?.window.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);
