// scripts/build-pdf.mjs
// Build a full-site PDF from the freshly built VitePress dist.
// Strategy:
//   1. Read docs/.vitepress/sidebar.generated.mts to get the canonical reading order.
//   2. Spin up a static HTTP server on the dist/ directory.
//   3. Use Puppeteer to load each URL and print it to a per-page PDF buffer.
//   4. Merge all PDF buffers into one with pdf-lib.
//   5. Write to docs/.vitepress/dist/gsy-flutter-book.pdf
//
// Designed to run inside GitHub Actions (ubuntu-latest) where chromium can be
// installed by puppeteer's installer.
//
// Run: node scripts/build-pdf.mjs

import { createServer } from 'node:http'
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises'
import { extname, join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer'
import { PDFDocument } from 'pdf-lib'

const DIST = resolve('docs/.vitepress/dist')
const OUT  = resolve('artifacts/gsy-flutter-book.pdf')
const PORT = 4173
// Must match vitepress config.mts `base`. Stripped from incoming request paths
// so the dist root maps to `/<base>/...` URLs.
const BASE = '/home/wx/'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.wasm': 'application/wasm',
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let urlPath = decodeURIComponent(req.url.split('?')[0])
      // Strip the configured site base so dist files resolve correctly.
      if (BASE !== '/' && urlPath.startsWith(BASE)) {
        urlPath = '/' + urlPath.slice(BASE.length)
      } else if (BASE !== '/' && urlPath === BASE.slice(0, -1)) {
        urlPath = '/'
      }
      if (urlPath.endsWith('/')) urlPath += 'index.html'
      let fp = join(DIST, urlPath)
      try {
        const s = await stat(fp)
        if (s.isDirectory()) fp = join(fp, 'index.html')
      } catch {
        // cleanUrls fallback: /foo -> /foo.html
        const candidate = fp + '.html'
        try { await stat(candidate); fp = candidate } catch {}
      }
      const data = await readFile(fp)
      const ct = MIME[extname(fp).toLowerCase()] || 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': ct })
      res.end(data)
    } catch (e) {
      res.writeHead(404).end('not found')
    }
  })
  return new Promise(r => server.listen(PORT, () => r(server)))
}

async function loadOrder() {
  const modUrl = pathToFileURL(resolve('docs/.vitepress/sidebar.generated.mts')).href
  // VitePress sidebar is .mts; use Node's experimental loader OR strip types manually.
  // Simpler approach: read as text, regex the link strings in order.
  const txt = await readFile('docs/.vitepress/sidebar.generated.mts', 'utf8')
  const links = []
  const re = /"link"\s*:\s*"([^"]+)"/g
  let m
  while ((m = re.exec(txt))) links.push(m[1])
  // De-duplicate while preserving order
  return [...new Set(links)]
}

async function main() {
  const links = await loadOrder()
  const limitArg = process.argv.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : links.length
  const subset = links.slice(0, limit)
  console.log(`[pdf] ${subset.length}/${links.length} pages to render`)

  const server = await startServer()
  console.log(`[pdf] static server up on :${PORT}`)

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.emulateMediaType('print')

  const merged = await PDFDocument.create()

  let i = 0
  for (const link of subset) {
    i++
    // sidebar links are like "/guide/Flutter-1"; prepend BASE for the live URL.
    const urlPath = (BASE !== '/' ? BASE.replace(/\/$/, '') : '') + link
    const url = `http://127.0.0.1:${PORT}${urlPath}`
    process.stdout.write(`[pdf] (${i}/${subset.length}) ${urlPath} ... `)
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 })
      // Hide nav/sidebar/footer for cleaner print
      await page.addStyleTag({ content: `
        .VPNav, .VPSidebar, .VPLocalNav, .VPFooter, .VPDocFooter,
        .pf-search-trigger, [data-pagefind-ignore]{ display:none !important; }
        .VPContent, .VPDoc, .VPDoc .container { padding: 0 !important; margin: 0 !important; }
        body { background: #fff !important; }
      `})
      const buf = await page.pdf({
        format: 'A4',
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
        printBackground: false,
        preferCSSPageSize: false,
      })
      const sub = await PDFDocument.load(buf)
      const copied = await merged.copyPages(sub, sub.getPageIndices())
      copied.forEach(p => merged.addPage(p))
      console.log('ok')
    } catch (e) {
      console.log('SKIP (' + e.message + ')')
    }
  }

  const out = await merged.save()
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, out)
  console.log(`[pdf] wrote ${OUT} (${(out.byteLength / 1024 / 1024).toFixed(2)} MB)`)

  await browser.close()
  server.close()
}

main().catch(e => { console.error(e); process.exit(1) })
