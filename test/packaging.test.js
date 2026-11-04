import { it, expect } from 'vitest';
import { mkdtempSync, cpSync, symlinkSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

it('packages Chrome and Firefox and builds the self-hosted Firefox variant', () => {
  const root = resolve(import.meta.dirname, '..');
  const dir = mkdtempSync(join(tmpdir(), 'threads-package-'));
  const env = { ...process.env, NODE_ENV: 'production', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_') && !key.startsWith('GIT_CONFIG_')) delete env[key];
  delete env.FIREFOX_BUILD_TYPE;
  const run = (command, args, overrides = {}) => execFileSync(command, args, {
    cwd: dir, env: { ...env, ...overrides }, encoding: 'utf8', stdio: 'pipe', timeout: 30000
  });
  try {
    for (const path of ['src', 'scripts', 'data', '_locales', 'icons', 'fonts', 'esbuild.config.js', 'package.json']) {
      cpSync(join(root, path), join(dir, path), { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
    run('git', ['init', '-q']);
    run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', 'fixture']);
    run('git', ['-c', 'tag.gpgsign=false', 'tag', 'v1.2.3']);
    run('bash', ['scripts/package.sh']);
    for (const browser of ['chrome', 'firefox-amo']) {
      const zip = join(dir, 'dist-zip', browser === 'chrome'
        ? 'lee-su-threads-chrome-v1.2.3.zip' : 'lee-su-threads-firefox-v1.2.3-amo.zip');
      expect(existsSync(zip)).toBe(true);
      const manifest = JSON.parse(run('unzip', ['-p', zip, 'manifest.json']));
      expect(manifest.version).toBe('1.2.3');
      expect(manifest.manifest_version).toBe(3);
    }
    expect(existsSync(join(dir, 'dist/safari'))).toBe(false);
    run(process.execPath, ['esbuild.config.js'], { FIREFOX_BUILD_TYPE: 'self-hosted' });
    const direct = JSON.parse(readFileSync(join(dir, 'dist/firefox-direct/manifest.json'), 'utf8'));
    expect(direct.browser_specific_settings.gecko.update_url).toBeTruthy();
    expect(direct.version).toBe('1.2.3');
    expect(run(process.execPath, ['scripts/check-versions.js'])).toContain('All present version sources match');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);
