import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { pagePaths } from './src/routes.ts';

type Chunk = { file: string; imports?: string[]; css?: string[] };
const publicPages = new Set(['LandingPage', 'AuthPage', 'OnboardingPage', 'NotFoundPage']);

function routePattern(path: string) {
  const source = path
    .replace(/\/*\*?$/, '')
    .replace(/^\/*/, '/')
    .replace(/[\\.*+^${}|()[\]]/g, '\\$&')
    .replace(/\/:([\w-]+)/g, '/([^/]+)');
  return `^${source}${path.endsWith('*') ? '(?:\\/(.+)|\\/*)$' : '\\/*$'}`;
}

export function routePreload(): Plugin {
  let dist = '';
  let base = '/';
  return {
    name: 'academy-route-preload',
    apply: 'build',
    configResolved(config) {
      dist = resolve(config.root, config.build.outDir);
      base = config.base;
    },
    async writeBundle() {
      const manifest: Record<string, Chunk> = JSON.parse(
        await readFile(resolve(dist, '.vite/manifest.json'), 'utf8')
      );
      const assets = Object.fromEntries(
        [...new Set([...pagePaths.map(([, page]) => page), 'NotFoundPage'])].map((page) => {
          const visited = new Set<string>();
          const js = new Set<string>();
          const css = new Set<string>();
          const visit = (key: string) => {
            if (visited.has(key)) return;
            const chunk = manifest[key];
            if (!chunk?.file.endsWith('.js')) throw new Error(`Missing route chunk: ${key}`);
            visited.add(key);
            js.add(`${base}${chunk.file}`);
            for (const dependency of chunk.imports ?? []) visit(dependency);
            for (const file of chunk.css ?? []) css.add(`${base}${file}`);
          };
          if (!publicPages.has(page)) visit('src/components/AppShell.tsx');
          visit(`src/pages/${page}.tsx`);
          return [page, { css: [...css], js: [...js] }];
        })
      );
      const payload = JSON.stringify({
        routes: pagePaths.map(([path, page]) => [routePattern(path), page]),
        assets,
      }).replace(/</g, '\\u003c');
      const script = `<script>(()=>{
const {routes,assets}=${payload};
let path=location.pathname;
try{path=path.split('/').map(part=>decodeURIComponent(part).replace(/\\//g,'%2F')).join('/')}catch{}
const page=routes.find(([pattern])=>new RegExp(pattern,'i').test(path))?.[1]??'NotFoundPage';
const existing=new Set([...document.head.querySelectorAll('link[href],script[src]')].map(link=>link.getAttribute('href')??link.getAttribute('src')));
for(const [type,files] of Object.entries(assets[page]))for(const file of files){
if(existing.has(file))continue;
const link=document.createElement('link');link.rel=type==='js'?'modulepreload':'stylesheet';
if(type==='js')link.crossOrigin='';link.href=file;document.head.appendChild(link);existing.add(file);
}
})()</script>`;
      const index = resolve(dist, 'index.html');
      const html = await readFile(index, 'utf8');
      if (!html.includes('</head>')) throw new Error('Built HTML must contain a head element.');
      await writeFile(index, html.replace('</head>', `${script}</head>`));
    },
  };
}
