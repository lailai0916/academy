import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repository = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(repository, 'apps/web/dist');
const budgetPath = resolve(repository, 'scripts/performance-budgets.json');
const format = { version: 1, metric: 'gzip-bytes', compressionLevel: 9 };
const publicPages = new Set(['LandingPage', 'AuthPage', 'OnboardingPage', 'NotFoundPage']);

function measure(manifest, roots, sizes) {
  const visited = new Set();
  const files = new Set();
  const visit = (key) => {
    if (visited.has(key)) return;
    const chunk = manifest[key];
    if (!chunk || !chunk.file?.endsWith('.js')) throw new Error(`Missing JavaScript chunk: ${key}`);
    visited.add(key);
    files.add(chunk.file);
    for (const file of chunk.css ?? []) files.add(file);
    for (const dependency of chunk.imports ?? []) visit(dependency);
  };
  roots.forEach(visit);
  const totals = { js: 0, css: 0 };
  for (const file of files) {
    const path = resolve(dist, file);
    if (!path.startsWith(`${dist}${sep}`)) throw new Error(`Asset escapes dist: ${file}`);
    const type = file.endsWith('.js') ? 'js' : file.endsWith('.css') ? 'css' : null;
    if (!type) throw new Error(`Unexpected asset: ${file}`);
    if (!sizes.has(file)) sizes.set(file, gzipSync(readFileSync(path), { level: 9 }).length);
    totals[type] += sizes.get(file);
  }
  return totals;
}

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--init', '--update'].includes(args[0]))) {
    throw new Error('Usage: node scripts/check-performance.mjs [--init|--update]');
  }
  const manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8'));
  const entries = Object.keys(manifest)
    .filter((key) => manifest[key].isEntry || manifest[key].isDynamicEntry)
    .sort();
  const shell = 'src/components/AppShell.tsx';
  if (!manifest['index.html']?.isEntry || !manifest[shell]?.isDynamicEntry) {
    throw new Error('Manifest must contain the main entry and lazy AppShell.');
  }
  const sizes = new Map();
  const modules = Object.fromEntries(
    entries.map((key) => {
      const roots = ['index.html', key];
      const page = key.match(/^src\/pages\/(\w+)\.tsx$/)?.[1];
      if (page && !publicPages.has(page)) roots.push(shell);
      return [key, measure(manifest, roots, sizes)];
    })
  );
  const html = gzipSync(readFileSync(resolve(dist, 'index.html')), { level: 9 }).length;
  const current = { ...format, html, modules };
  if (args[0] !== '--init') {
    const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
    for (const [key, value] of Object.entries(format)) {
      if (budget[key] !== value) throw new Error(`Unsupported budget ${key}.`);
    }
    if (!Number.isSafeInteger(budget.html) || budget.html < 0) {
      throw new Error('Invalid HTML ceiling.');
    }
    if (html > budget.html) throw new Error(`HTML: ${html} gzip bytes exceeds ${budget.html}.`);
    if (JSON.stringify(Object.keys(budget.modules ?? {}).sort()) !== JSON.stringify(entries)) {
      throw new Error('Budget modules must match every entry and dynamic entry.');
    }
    for (const [key, totals] of Object.entries(modules)) {
      for (const type of ['js', 'css']) {
        const ceiling = budget.modules[key]?.[type];
        if (!Number.isSafeInteger(ceiling) || ceiling < 0) {
          throw new Error(`Invalid ${type} ceiling for ${key}.`);
        }
        if (totals[type] > ceiling) {
          throw new Error(`${key} ${type}: ${totals[type]} gzip bytes exceeds ${ceiling}.`);
        }
      }
    }
  }
  if (args[0]) {
    writeFileSync(budgetPath, `${JSON.stringify(current, null, 2)}\n`, {
      flag: args[0] === '--init' ? 'wx' : 'w',
    });
  }
  console.log(`Performance budgets passed: ${entries.length} modules, ${html} HTML gzip bytes.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
