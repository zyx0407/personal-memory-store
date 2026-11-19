/**
 * Personal Memory Store tools for DSH.
 * Registers `memory_init` (create the three-item skeleton) and
 * `memory_doctor` (structural check per Personal Memory Store Specification 1.0).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const name = 'personal-memory-store'
export const inject = ['tools']

const ALLOWED = new Set(['key', 'type', 'src', 'valid', 'status', 'superseded'])
const TYPES = new Set(['fact', 'preference', 'decision', 'event'])
const STATUSES = new Set(['active', 'archived'])
const DATE = /^\d{4}-\d{2}-\d{2}$/
const ENTRY = /^- (\d{4}-\d{2}-\d{2})(?: (.+?))?(?: \{([^{}]*)\})?$/
const FENCE = /^ {0,3}(`{3,}|~{3,})/
const SECRETS = [
  /sk-[A-Za-z0-9]{10,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /(?:password|token|secret|api[_-]?key)\s*=/i,
]
const ABS = [
  /(?<![A-Za-z0-9])[A-Za-z]:[\\/]/,
  /(^|[\s(（\[\]"'=,<*:：`])\\[A-Za-z0-9._-]/,
  /(^|[\s(（\[\]"'=,<*:：`])[\\/][A-Za-z0-9._-]/,
  /\bfile:(?=\/\/)/i,
]
const DOTDOT = /(^|\/|\\)\.\.(?=\/|\\|$)/
const LEVEL = { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S8: 0, S11: 0, S13: 0, S6: 1, S7: 2, S9: 2, S12: 2, S10: 3, P1: -1, X1: -1 }

function unescapeText(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length && '\\{}'.includes(s[i + 1])) {
      out += s[i + 1]
      i++
    } else {
      out += c
    }
  }
  return out
}

function parseMeta(raw) {
  const meta = {}
  for (const part of raw.split(', ')) {
    if (!part.includes('=')) return null
    const i = part.indexOf('=')
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (!k || !v || k in meta) return null
    meta[k] = v
  }
  return meta
}

async function scanFile(file, kind, root) {
  const data = await fs.readFile(file)
  const text = data.toString('utf8')
  const issues = []
  const entries = []
  let timeline = 0
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) issues.push(['S8', 'BOM'])
  if (data.includes(13)) issues.push(['S8', 'CRLF/CR'])
  const label = kind === 'timeline' ? 'S4' : 'S5'
  let fence = null
  let fenceLen = 0
  const lines = text.split('\n')
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    const no = n + 1
    const m = FENCE.exec(line)
    if (fence === null && m) {
      fence = m[1][0]
      fenceLen = m[1].length
      continue
    }
    if (fence !== null) {
      if (m && m[1][0] === fence && m[1].length >= fenceLen) fence = null
      continue
    }
    if (line.startsWith('- ')) {
      const em = ENTRY.exec(line)
      if (!em) {
        issues.push([label, `${no} line format`])
        continue
      }
      const [, date, body, metaraw] = em
      if (body !== undefined && body.trim() !== body) issues.push([label, `${no} body whitespace`])
      if (kind === 'timeline') timeline++
      const meta = metaraw === undefined ? {} : parseMeta(metaraw)
      if (meta === null) {
        issues.push([label, `${no} metadata syntax`])
        continue
      }
      for (const k of Object.keys(meta)) if (!ALLOWED.has(k)) issues.push([label, `${no} unknown key ${k}`])
      if ('key' in meta && !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(meta.key)) issues.push([label, `${no} key domain`])
      if ((meta.type ?? 'fact') !== undefined && !TYPES.has(meta.type ?? 'fact')) issues.push([label, `${no} type domain`])
      if (!STATUSES.has(meta.status ?? 'active')) issues.push([label, `${no} status domain`])
      for (const k of ['valid', 'superseded']) if (k in meta && !DATE.test(meta[k])) issues.push([label, `${no} ${k} shape`])
      if ('src' in meta) {
        const src = meta.src.replace(/:\d+$/, '')
        if (src.includes('\\') || src.startsWith('/') || src.split('/').includes('..')) {
          issues.push([label, `${no} src domain`])
          issues.push(['S10', `${no} src invalid`])
        } else {
          try {
            const st = await fs.stat(path.join(root, src))
            if (!st.isFile()) issues.push(['S10', `${no} src not a file`])
          } catch {
            issues.push(['S10', `${no} src missing ${src}`])
          }
        }
      } else if (kind !== 'timeline') {
        issues.push(['S10', `${no} missing src`])
      }
      entries.push({ no, date, body: unescapeText(body ?? ''), meta })
    }
    const probe = line.startsWith('- ') ? unescapeText(line) : line
    if (ABS.some(r => r.test(probe)) || DOTDOT.test(probe)) issues.push(['S9', `${no} local absolute/escape path`])
    if (SECRETS.some(r => r.test(line))) issues.push(['P1', `${no} possible credential`])
  }
  return { entries, issues, timeline, unclosed: fence !== null }
}

async function listTopics(root) {
  const dir = path.join(root, 'memory')
  const out = []
  async function walk(d) {
    let items
    try {
      items = await fs.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const it of items) {
      if (it.name.startsWith('.')) continue
      const p = path.join(d, it.name)
      if (it.isDirectory()) await walk(p)
      else if (it.isFile() && it.name.endsWith('.md')) out.push(p)
    }
  }
  await walk(dir)
  return out.sort()
}

async function safeStat(p) {
  try {
    return await fs.stat(p)
  } catch {
    return null
  }
}

async function doctor(root) {
  const issues = []
  const core = path.join(root, 'MEMORY.md')
  const changelog = path.join(root, 'CHANGELOG.md')
  const mssPath = path.join(root, 'mss.json')
  const coreStat = await safeStat(core)
  const clStat = await safeStat(changelog)
  const memStat = await safeStat(path.join(root, 'memory'))
  const mssStat = await safeStat(mssPath)

  let declared = null
  let mss = null
  if (mssStat && mssStat.isFile()) {
    try {
      mss = JSON.parse((await fs.readFile(mssPath, 'utf8')).replace(/^\uFEFF/, ''))
    } catch {
      issues.push(['S11', 'mss.json invalid JSON'])
    }
    if (mss && typeof mss === 'object') {
      if (typeof mss.mss !== 'string' || !/^[0-9]+\.[0-9]+$/.test(mss.mss)) issues.push(['S11', 'mss missing/invalid'])
      if ('store' in mss) {
        if (['L0', 'L1', 'L2', 'L3'].includes(mss.store)) declared = mss.store
        else issues.push(['S11', 'store domain'])
      }
      if ('limits' in mss) {
        if (!mss.limits || typeof mss.limits !== 'object' || Array.isArray(mss.limits)) issues.push(['S11', 'limits not object'])
        else {
          for (const [k, v] of Object.entries(mss.limits)) {
            if (!['core', 'topic'].includes(k)) issues.push(['S11', `limits unknown key ${k}`])
            else if (!Number.isInteger(v) || v < 1 || v > 1000000) issues.push(['S11', `limits.${k} invalid`])
          }
        }
      }
    }
  } else if (mssStat && !mssStat.isFile()) {
    issues.push(['S11', 'mss.json not a regular file'])
  }

  const topics = (memStat && memStat.isDirectory()) ? await listTopics(root) : []
  const allEntries = []
  let timeline = 0
  let unclosed = false
  const files = []
  if (coreStat && coreStat.isFile()) files.push([core, 'main'])
  for (const t of topics) files.push([t, 'main'])
  if (clStat && clStat.isFile()) files.push([changelog, 'timeline'])
  for (const [f, kind] of files) {
    const r = await scanFile(f, kind, root)
    issues.push(...r.issues.map(([id, d]) => [id, `${path.relative(root, f)}:${d}`]))
    allEntries.push(...r.entries.map(e => ({ ...e, file: path.relative(root, f) })))
    timeline += r.timeline
    unclosed = unclosed || r.unclosed
  }

  // S1: _state must not hold parsable entries
  const state = path.join(root, '_state')
  const stateStat = await safeStat(state)
  if (stateStat && stateStat.isDirectory()) {
    const walkState = async (d) => {
      for (const it of await fs.readdir(d, { withFileTypes: true })) {
        const p = path.join(d, it.name)
        if (it.isDirectory()) await walkState(p)
        else if (it.isFile()) {
          const data = await fs.readFile(p)
          if (data.includes(0)) continue
          const text = data.toString('utf8')
          for (const [i, line] of text.split('\n').entries()) {
            if (line.startsWith('- ') && DATE.test(line.slice(2, 12))) issues.push(['S1', `${path.relative(root, p)}:${i + 1} entry-like line`])
          }
        }
      }
    }
    await walkState(state)
  }

  const keys = new Map()
  for (const e of allEntries) {
    const m = e.meta
    if (m.key && (m.status ?? 'active') !== 'archived' && !('superseded' in m)) {
      if (!keys.has(m.key)) keys.set(m.key, [])
      keys.get(m.key).push(e.no)
    }
  }
  const dupKeys = [...keys].filter(([, v]) => v.length > 1).map(([k]) => k)

  const coreBytes = coreStat && coreStat.isFile()
    ? (await fs.readFile(core)).length - ((await fs.readFile(core))[0] === 0xef ? 3 : 0)
    : 0
  const topicSizes = await Promise.all(topics.map(async t => {
    const d = await fs.readFile(t)
    return d.length - (d[0] === 0xef ? 3 : 0)
  }))

  const has = (id) => issues.some(([i]) => i === id)
  const detail = (id) => issues.filter(([i]) => i === id).map(([, d]) => d).join('; ').slice(0, 180)

  const checks = [
    ['S1', !has('S1'), detail('S1')],
    ['S2', Boolean(coreStat && coreStat.isFile()), ''],
    ['S3', Boolean(memStat && memStat.isDirectory()), ''],
    ['S4', Boolean(clStat && clStat.isFile()) && !has('S4'), detail('S4')],
    ['S5', !has('S5'), detail('S5')],
    ['S6', dupKeys.length === 0, dupKeys.join(',')],
    ['S7', coreBytes <= 10240, `${coreBytes} bytes`],
    ['S8', !has('S8'), detail('S8')],
    ['S9', !has('S9'), detail('S9')],
    ['S10', !has('S10'), detail('S10')],
    ['S11', !has('S11'), detail('S11')],
    ['S12', Math.max(0, ...topicSizes) <= 12288, `max ${Math.max(0, ...topicSizes)} bytes`],
    ['S13', !unclosed, ''],
    ['P1', !has('P1'), detail('P1')],
  ]

  const order = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'P1']
  const byId = Object.fromEntries(checks.map(([id, ok, d]) => [id, { id, ok, detail: d }]))
  let verified = 'none'
  for (const [lvl, rules] of [['L0', ['S1', 'S2', 'S3', 'S4', 'S5', 'S8', 'S11', 'S13']], ['L1', ['S6']], ['L2', ['S7', 'S9', 'S12']], ['L3', ['S10']]]) {
    if (rules.every(r => byId[r].ok)) verified = lvl
    else break
  }
  const base = declared ? Number(declared[1]) : 0
  const x1ok = declared === null || (verified !== 'none' && declared <= verified)
  byId.X1 = { id: 'X1', ok: x1ok, detail: x1ok ? '' : `declared ${declared} > verified ${verified}` }
  order.push('X1')

  const report = {
    reportVersion: '1',
    spec: 'mss/1.0',
    store: { declared, verified },
    conformant: false,
    errors: 0,
    warns: 0,
    checks: [],
    metrics: {
      coreBytes,
      coreLimit: 10240,
      topicLimit: 12288,
      topicBytesMax: Math.max(0, ...topicSizes),
      entries: allEntries.length,
      topics: topics.length,
      timelineEntries: timeline,
    },
  }
  report.checks = order.map(id => {
    const c = byId[id]
    const applicable = LEVEL[id] <= base || id === 'P1' || id === 'X1'
    return { id, severity: applicable ? 'error' : 'info', ok: c.ok, detail: c.detail }
  })
  report.errors = report.checks.filter(c => c.severity === 'error' && !c.ok).length
  report.conformant = report.errors === 0 && (declared === null || declared <= verified)
  return report
}

function formatText(report) {
  const lines = [
    `store: ${report.store.declared ?? 'undeclared'} declared, ${report.store.verified} verified`,
    `errors: ${report.errors}  conformant: ${report.conformant}`,
    `entries: ${report.metrics.entries}  topics: ${report.metrics.topics}  core: ${report.metrics.coreBytes}B`,
  ]
  for (const c of report.checks) {
    if (!c.ok) lines.push(`[x] ${c.id} ${c.detail}`)
  }
  if (report.errors === 0) lines.push('[ok] all applicable rules pass')
  return lines.join('\n')
}

export function apply(ctx) {
  ctx.tools.register({
    name: 'memory_init',
    description: 'Create a personal memory store skeleton (MEMORY.md, memory/, CHANGELOG.md) at an absolute directory path; never overwrites existing files.',
    parameters: {
      type: 'object',
      properties: {
        root: { type: 'string', description: 'Absolute path of the store root' },
      },
      required: ['root'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute({ root }) {
      const abs = path.resolve(root)
      await fs.mkdir(abs, { recursive: true })
      const created = []
      const ensure = async (p, content) => {
        try {
          await fs.writeFile(p, content, { flag: 'wx' })
          created.push(path.relative(abs, p))
        } catch (e) {
          if (e.code !== 'EEXIST') throw e
        }
      }
      await ensure(path.join(abs, 'MEMORY.md'), '# Memory\n')
      await fs.mkdir(path.join(abs, 'memory'), { recursive: true })
      await ensure(path.join(abs, 'CHANGELOG.md'), '# Changelog\n')
      return `store ready at ${abs}${created.length ? `; created: ${created.join(', ')}` : '; nothing to create'}`
    },
  })

  ctx.tools.register({
    name: 'memory_doctor',
    description: 'Check a personal memory store against Personal Memory Store Specification 1.0 (levels L0-L3, rules S1-S13, P1, X1) and return the report. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        root: { type: 'string', description: 'Absolute path of the store root' },
        format: {
          type: 'string',
          enum: ['json', 'text'],
          description: 'json (default) returns the full report; text returns a short summary',
        },
      },
      required: ['root'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute({ root, format }) {
      const abs = path.resolve(root)
      const st = await safeStat(abs)
      if (!st || !st.isDirectory()) throw new Error(`not a directory: ${abs}`)
      const report = await doctor(abs)
      return format === 'text' ? formatText(report) : JSON.stringify(report, null, 2)
    },
  })
}
