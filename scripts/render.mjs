// Renders the profile graphics in assets/ with headless Chrome.
//
//   node scripts/render.mjs           render with the commit counts in data/contributions.json
//   node scripts/render.mjs --fetch   refresh the commit counts first (needs the gh CLI and a token)
//
// The activity graphic counts my commits per day on the default branch of every repository the
// token can read, including private ones. Only the count per day is stored, never repository names.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const LOGIN = 'Larsj02'
const W = 846 // width of the README column on GitHub

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataFile = join(root, 'data/contributions.json')
const tmp = join(root, '.tmp')
mkdirSync(tmp, { recursive: true })
mkdirSync(join(root, 'assets'), { recursive: true })

const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find((p) => p && existsSync(p))
if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH.')

// ---------- data ----------
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })

const fetchContributions = () => {
  const since = new Date(Date.now() - 371 * 864e5).toISOString()
  const repos = gh(['api', 'user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=pushed',
    '--paginate', '--jq', `.[] | select(.pushed_at > "${since}") | .full_name`]).split('\n').filter(Boolean)
  const days = {}
  for (const repo of repos) {
    let dates = ''
    try {
      dates = gh(['api', `repos/${repo}/commits?author=${LOGIN}&since=${since}&per_page=100`, '--paginate', '--jq', '.[].commit.author.date'])
    } catch { continue } // empty repository or no access
    for (const d of dates.split('\n').filter(Boolean)) days[d.slice(0, 10)] = (days[d.slice(0, 10)] ?? 0) + 1
  }
  const total = Object.values(days).reduce((a, b) => a + b, 0)
  if (!repos.length || !total) throw new Error('No commits found. Check the token before overwriting the data.')
  const sorted = Object.fromEntries(Object.entries(days).sort())
  mkdirSync(dirname(dataFile), { recursive: true })
  writeFileSync(dataFile, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), days: sorted }, null, 1) + '\n')
  console.log(`fetched ${total} commits`)
}

if (process.argv.includes('--fetch')) fetchContributions()
const data = JSON.parse(readFileSync(dataFile, 'utf8'))

// ---------- rendering ----------
const url = (p) => pathToFileURL(join(root, p)).href
const face = (family, pkg, weight) =>
  `@font-face{font-family:'${family}';font-weight:${weight};src:url('${url(
    `node_modules/@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`
  )}') format('woff2');}`
const fonts = [500, 600, 700, 800].map((w) => face('PJS', 'plus-jakarta-sans', w)).join('') + face('SM', 'space-mono', 400)

const page = (h, body, css) => `<!doctype html><html><head><meta charset="utf-8"><style>
${fonts}
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;height:${h}px;overflow:hidden}
body{font-family:'PJS',system-ui,sans-serif;background:transparent;color:#fff;position:relative}
${css}
</style></head><body>${body}</body></html>`

const shot = (name, h, html) => {
  const htmlPath = join(tmp, name.replace(/\.png$/, '.html'))
  writeFileSync(htmlPath, html)
  execFileSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
    '--allow-file-access-from-files', '--virtual-time-budget=4000', '--default-background-color=00000000',
    `--window-size=${W},${h}`, `--screenshot=${join(root, 'assets', name)}`, pathToFileURL(htmlPath).href
  ], { stdio: 'ignore' })
  console.log('ok', name)
}

const card = 'background:#0B1120;border:1.5px solid rgba(148,163,184,.22);border-radius:26px'

const header = page(210, `
  <div class="card">
    <div class="glow"></div>
    <svg class="wave" viewBox="0 0 846 210" preserveAspectRatio="none">
      <path d="M0,168 C200,140 380,196 560,166 C690,144 780,156 846,168 L846,210 L0,210 Z" fill="#060913"/>
      <path d="M0,168 C200,140 380,196 560,166 C690,144 780,156 846,168" fill="none" stroke="#14B8A6" stroke-opacity=".7" stroke-width="2"/>
    </svg>
    <div class="text">
      <h1>Lars Johnen</h1>
      <p>Software developer from Siegen, Germany</p>
    </div>
  </div>`, `
  .card{position:absolute;inset:0;${card};overflow:hidden}
  .glow{position:absolute;right:-60px;top:-140px;width:420px;height:420px;border-radius:58% 42% 47% 53% / 46% 52% 48% 54%;background:linear-gradient(135deg,rgba(56,189,248,.5),rgba(20,184,166,.6));filter:blur(70px);opacity:.55}
  .wave{position:absolute;inset:0;width:100%;height:100%}
  .text{position:absolute;left:40px;top:38px}
  h1{font-size:52px;font-weight:800;letter-spacing:-.03em;line-height:1}
  p{font-size:20px;font-weight:500;color:#CBD5E1;margin-top:12px}`)

const stat = (value, label) => `<div class="tile"><b>${value}</b><span>${label}</span></div>`
const stats = page(124, `
  <div class="row">
    ${stat('1.4M', 'addon downloads')}
    ${stat('2014', 'coding since')}
    ${stat('r/wowaddons', 'community owner')}
    ${stat('3×', 'Hall of Fame')}
  </div>`, `
  .row{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr 1.25fr 1fr;gap:12px}
  .tile{${card};display:flex;flex-direction:column;justify-content:center;padding:0 24px}
  b{font-size:32px;font-weight:800;letter-spacing:-.03em;color:#2DD4BF;line-height:1.1;white-space:nowrap}
  span{font-size:15px;font-weight:600;color:#94A3B8;margin-top:6px;white-space:nowrap}`)

const contributions = () => {
  const end = new Date(data.updated + 'T00:00:00Z')
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 52 * 7 - end.getUTCDay()) // 53 weeks, starting on a Sunday
  const level = (n) => (n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 10 ? 3 : 4)
  const colors = ['#162033', '#0F4F4A', '#0F766E', '#14B8A6', '#5EEAD4']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  let cells = ''
  let labels = ''
  let total = 0
  let active = 0
  let lastMonth = -1
  for (let week = 0; week < 53; week++) {
    for (let day = 0; day < 7; day++) {
      const d = new Date(start)
      d.setUTCDate(d.getUTCDate() + week * 7 + day)
      if (d > end) continue
      const n = data.days[d.toISOString().slice(0, 10)] ?? 0
      total += n
      if (n) active++
      cells += `<i style="grid-column:${week + 1};grid-row:${day + 1};background:${colors[level(n)]}"></i>`
      if (day === 0 && d.getUTCMonth() !== lastMonth) {
        if (d.getUTCDate() <= 7) labels += `<span style="left:${week * 15}px">${months[d.getUTCMonth()]}</span>`
        lastMonth = d.getUTCMonth()
      }
    }
  }
  const updated = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return page(236, `
  <div class="card">
    <div class="head">
      <h2><b>${total.toLocaleString('en-US')}</b> commits in the last 12 months</h2>
      <p>on ${active} days · public and private repositories</p>
    </div>
    <div class="months">${labels}</div>
    <div class="grid">${cells}</div>
    <div class="foot">
      <span>Updated ${updated}</span>
      <span class="legend">Less ${colors.map((c) => `<i style="background:${c}"></i>`).join('')} More</span>
    </div>
  </div>`, `
  .card{position:absolute;inset:0;${card};padding:22px 26px}
  .head{display:flex;justify-content:space-between;align-items:baseline}
  h2{font-size:19px;font-weight:700;color:#E2E8F0}
  h2 b{color:#2DD4BF;font-weight:800}
  p{font-size:13px;font-weight:500;color:#94A3B8}
  .months{position:relative;height:18px;margin-top:16px;font-size:12px;font-weight:600;color:#94A3B8}
  .months span{position:absolute;top:0}
  .grid{display:grid;grid-template-columns:repeat(53,12px);grid-template-rows:repeat(7,12px);gap:3px;margin-top:4px}
  .grid i{border-radius:4px}
  .foot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:12px;font-weight:500;color:#94A3B8}
  .legend{display:flex;align-items:center;gap:4px}
  .legend i{width:12px;height:12px;border-radius:4px}`)
}

shot('header.png', 210, header)
shot('stats.png', 124, stats)
shot('contributions.png', 236, contributions())
