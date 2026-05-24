#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const DOCS = path.join(ROOT, 'docs')
const SUMMARY = path.join(ROOT, 'SUMMARY.md')

const CATEGORY_MAP = {
  CORE: { dir: 'guide', label: 'Flutter 完整开发实战详解' },
  UPDATE_FLUTTER: { dir: 'flutter-updates', label: 'Flutter SDK 更新集锦' },
  UPDATE_DART: { dir: 'dart-updates', label: 'Dart 更新集锦' },
  EXTRA: { dir: 'extra', label: '番外篇' },
  ENGINEERING: { dir: 'engineering', label: 'Flutter 工程化选择' },
  ROOT_FRONT: { dir: 'guide', label: '前言' }
}

function slugify(filename) {
  return filename
    .replace(/\.md$/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._\-+]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function exists(p) {
  try { await fs.access(p); return true } catch { return false }
}

async function readSourceFile(name) {
  const decoded = decodeURIComponent(name)
  const candidates = [decoded, name]
  const typoFixed = decoded.replace(/^Fluttter-/, 'Flutter-')
  if (typoFixed !== decoded) candidates.push(typoFixed)
  for (const c of candidates) {
    const p = path.join(ROOT, c)
    if (await exists(p)) return { src: p, content: await fs.readFile(p, 'utf8') }
  }
  return null
}

function parseSummary(text) {
  const lines = text.split(/\r?\n/)
  const linkRe = /\[(.+?)\]\((.+?\.md)\)/
  const subHeaderRe = /^\s*-\s*\*\*(.+?)\*\*\s*$/
  const items = []
  let currentTopGroup = null
  let currentSubGroup = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const sub = line.match(subHeaderRe)
    if (sub) {
      const name = sub[1].trim()
      if (name === 'Flutter') currentSubGroup = 'UPDATE_FLUTTER'
      else if (name === 'Dart') currentSubGroup = 'UPDATE_DART'
      else currentSubGroup = null
      continue
    }

    const m = line.match(linkRe)
    if (!m) continue

    const title = m[1].trim()
    const file = m[2].trim()

    const indent = line.match(/^(\s*)/)[1].length
    const isTopLevel = /^\*\s/.test(line.trimStart()) && indent === 0
    const isStarChild = /^\s+\*\s/.test(line)
    const isDashChild = /^\s+-\s/.test(line)

    let category
    if (file === 'README.md') {
      category = 'ROOT_FRONT'
      currentTopGroup = 'CORE'
      currentSubGroup = null
    } else if (file === 'UPDATE.md') {
      category = 'CORE'
      currentTopGroup = 'CORE'
      currentSubGroup = null
    } else if (isTopLevel) {
      currentSubGroup = null
      if (file === 'GCH.md') {
        currentTopGroup = 'ENGINEERING'
        category = 'ENGINEERING'
      } else if (file === 'FWREADME.md') {
        currentTopGroup = 'EXTRA'
        category = 'EXTRA'
      } else {
        currentTopGroup = 'CORE'
        category = 'CORE'
      }
    } else if (isDashChild) {
      category = currentSubGroup || 'CORE'
    } else if (isStarChild) {
      category = currentTopGroup === 'ENGINEERING' ? 'ENGINEERING'
        : currentTopGroup === 'EXTRA' ? 'EXTRA'
        : 'EXTRA'
    } else {
      category = 'EXTRA'
    }

    items.push({ title, file, category })
  }

  return items
}

function rewriteRelativeLinks(content, allFilesByName) {
  return content.replace(/\[([^\]]+)\]\(([^)\s]+\.md)([^)]*)\)/g, (full, text, link, anchor) => {
    if (/^https?:\/\//i.test(link)) return full
    const decoded = decodeURIComponent(link).replace(/^\.\//, '')
    const target = allFilesByName.get(decoded) || allFilesByName.get(link)
    if (!target) return full
    return `[${text}](${target}${anchor || ''})`
  })
}

function sanitizeBrokenImages(content) {
  return content.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (full, alt, src) => {
      const trimmed = src.trim()
      if (/^(https?:)?\/\//i.test(trimmed)) return full
      if (trimmed.startsWith('/') && !/^\/[A-Za-z]\//.test(trimmed) && !/^\/Users\//i.test(trimmed)) return full
      if (!trimmed.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(trimmed) && !/^\\\\/.test(trimmed)) return full
      return `<!-- broken local image: ${trimmed.replace(/-->/g, '--&gt;')} -->`
    }
  )
}

async function copyRootImages() {
  const ROOT = path.resolve(__dirname, '..')
  const PUBLIC = path.join(ROOT, 'docs', 'public')
  await fs.mkdir(PUBLIC, { recursive: true })
  const exts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'])
  const entries = await fs.readdir(ROOT, { withFileTypes: true })
  const copied = []
  for (const e of entries) {
    if (!e.isFile()) continue
    const ext = path.extname(e.name).toLowerCase()
    if (!exts.has(ext)) continue
    const src = path.join(ROOT, e.name)
    const dst = path.join(PUBLIC, e.name)
    await fs.copyFile(src, dst)
    copied.push(e.name)
  }
  return copied
}

function rewriteRootImageRefs(content, rootImages) {
  if (!rootImages.length) return content
  const set = new Set(rootImages)
  return content.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (full, alt, src) => {
      const trimmed = src.trim().replace(/^\.\//, '')
      if (set.has(trimmed)) return `![${alt}](/${trimmed})`
      return full
    }
  )
}

function ensureFrontmatter(content, title) {
  if (/^---\n[\s\S]*?\n---/.test(content)) return content
  const safeTitle = title.replace(/"/g, '\\"')
  return `---\ntitle: "${safeTitle}"\n---\n\n${content}`
}

async function main() {
  console.log('Reading SUMMARY.md...')
  const summaryRaw = await fs.readFile(SUMMARY, 'utf8')
  const items = parseSummary(summaryRaw)
  console.log(`Parsed ${items.length} entries from SUMMARY.md`)

  for (const key of Object.keys(CATEGORY_MAP)) {
    const dir = CATEGORY_MAP[key].dir
    if (dir !== '.') await fs.mkdir(path.join(DOCS, dir), { recursive: true })
  }

  const rootImages = await copyRootImages()
  console.log(`Copied ${rootImages.length} root images to docs/public/`)

  const targetMap = new Map()
  for (const item of items) {
    const cat = CATEGORY_MAP[item.category]
    const slug = slugify(item.file)
    const targetRel = cat.dir === '.' ? `/${slug}` : `/${cat.dir}/${slug}`
    targetMap.set(item.file, targetRel)
    targetMap.set(decodeURIComponent(item.file), targetRel)
  }

  const skipped = []
  const written = []

  for (const item of items) {
    const cat = CATEGORY_MAP[item.category]
    const src = await readSourceFile(item.file)
    if (!src) {
      skipped.push(item.file)
      continue
    }
    let content = src.content
    content = rewriteRelativeLinks(content, targetMap)
    content = rewriteRootImageRefs(content, rootImages)
    content = sanitizeBrokenImages(content)
    content = ensureFrontmatter(content, item.title)

    const slug = slugify(item.file)
    const outDir = cat.dir === '.' ? DOCS : path.join(DOCS, cat.dir)
    const outPath = path.join(outDir, `${slug}.md`)
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, content, 'utf8')
    written.push({ ...item, outPath, slug, link: cat.dir === '.' ? `/${slug}` : `/${cat.dir}/${slug}` })
  }

  console.log(`Migrated: ${written.length}, Skipped: ${skipped.length}`)
  if (skipped.length) console.log('  skipped:', skipped.slice(0, 10), skipped.length > 10 ? '...' : '')

  const groups = {
    CORE: [],
    UPDATE_FLUTTER: [],
    UPDATE_DART: [],
    EXTRA: [],
    ENGINEERING: [],
    ROOT_FRONT: []
  }
  for (const w of written) groups[w.category].push(w)

  const guideIndexLines = ['---', 'title: 全部文章', '---', '', '# 全部文章', '']
  const sidebarItems = []

  if (groups.ROOT_FRONT.length) {
    sidebarItems.push({
      text: CATEGORY_MAP.ROOT_FRONT.label,
      items: groups.ROOT_FRONT.map(w => ({ text: w.title, link: w.link }))
    })
  }
  if (groups.CORE.length) {
    sidebarItems.push({
      text: CATEGORY_MAP.CORE.label,
      collapsed: false,
      items: groups.CORE.map(w => ({ text: w.title, link: w.link }))
    })
    guideIndexLines.push(`## ${CATEGORY_MAP.CORE.label}`, '')
    for (const w of groups.CORE) guideIndexLines.push(`- [${w.title}](${w.link})`)
    guideIndexLines.push('')
  }
  if (groups.UPDATE_FLUTTER.length) {
    sidebarItems.push({
      text: CATEGORY_MAP.UPDATE_FLUTTER.label,
      collapsed: true,
      items: groups.UPDATE_FLUTTER.map(w => ({ text: w.title, link: w.link }))
    })
    guideIndexLines.push(`## ${CATEGORY_MAP.UPDATE_FLUTTER.label}`, '')
    for (const w of groups.UPDATE_FLUTTER) guideIndexLines.push(`- [${w.title}](${w.link})`)
    guideIndexLines.push('')
  }
  if (groups.UPDATE_DART.length) {
    sidebarItems.push({
      text: CATEGORY_MAP.UPDATE_DART.label,
      collapsed: true,
      items: groups.UPDATE_DART.map(w => ({ text: w.title, link: w.link }))
    })
    guideIndexLines.push(`## ${CATEGORY_MAP.UPDATE_DART.label}`, '')
    for (const w of groups.UPDATE_DART) guideIndexLines.push(`- [${w.title}](${w.link})`)
    guideIndexLines.push('')
  }
  if (groups.EXTRA.length) {
    sidebarItems.push({
      text: CATEGORY_MAP.EXTRA.label,
      collapsed: true,
      items: groups.EXTRA.map(w => ({ text: w.title, link: w.link }))
    })
    guideIndexLines.push(`## ${CATEGORY_MAP.EXTRA.label}`, '')
    for (const w of groups.EXTRA) guideIndexLines.push(`- [${w.title}](${w.link})`)
    guideIndexLines.push('')
  }
  if (groups.ENGINEERING.length) {
    sidebarItems.push({
      text: CATEGORY_MAP.ENGINEERING.label,
      collapsed: true,
      items: groups.ENGINEERING.map(w => ({ text: w.title, link: w.link }))
    })
    guideIndexLines.push(`## ${CATEGORY_MAP.ENGINEERING.label}`, '')
    for (const w of groups.ENGINEERING) guideIndexLines.push(`- [${w.title}](${w.link})`)
    guideIndexLines.push('')
  }

  const sidebarCode = `import type { DefaultTheme } from 'vitepress'

export const sidebar: DefaultTheme.Sidebar = ${JSON.stringify(sidebarItems, null, 2)}
`
  await fs.writeFile(path.join(DOCS, '.vitepress', 'sidebar.generated.mts'), sidebarCode, 'utf8')
  console.log('Wrote docs/.vitepress/sidebar.generated.mts')

  await fs.mkdir(path.join(DOCS, 'guide'), { recursive: true })
  await fs.writeFile(path.join(DOCS, 'guide', 'index.md'), guideIndexLines.join('\n'), 'utf8')
  console.log('Wrote docs/guide/index.md')

  console.log('\n✓ Migration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
