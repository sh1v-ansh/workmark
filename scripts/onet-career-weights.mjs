// One-off: how often each Workmark skill appears in O*NET's software lists
// for the occupations behind each career track, with hot / in-demand flags.
// Informs the importance values in src/lib/careers/tracks.ts; the app never
// reads O*NET. Run: node scripts/onet-career-weights.mjs
import { readFileSync } from 'node:fs'

const OCCUPATIONS = {
  backend: ['15-1252.00', '15-1251.00', '15-1243.00'],
  frontend: ['15-1254.00', '15-1255.00'],
  fullstack: ['15-1252.00', '15-1254.00'],
  'ai-ml': ['15-2051.00', '15-1221.00'],
  data: ['15-2051.00', '15-2051.01', '15-1243.01'],
  devops: ['15-1244.00', '15-1299.08', '15-1241.00'],
  security: ['15-1212.00', '15-1299.04', '15-1299.05'],
}

// O*NET "Workplace Example" (lowercased substring) → Workmark skill id.
const MATCH = [
  ['javascript', 'javascript'], ['typescript', 'typescript'], ['python', 'python'], ['oracle java', 'java'],
  ['c++', 'cpp'], ['go', 'go'], ['rust', 'rust'], ['structured query language', 'sql'], ['r', 'r-lang'],
  ['react', 'react'], ['angular', 'angular'], ['vue', 'vue'], ['node.js', 'nodejs'], ['django', 'django'],
  ['flask', 'flask'], ['spring', 'spring'], ['.net', 'dotnet'], ['cascading style sheets', 'html-css'],
  ['hypertext markup language', 'html-css'], ['postgresql', 'postgresql'], ['mysql', 'mysql'],
  ['mongodb', 'mongodb'], ['redis', 'redis'], ['elasticsearch', 'elasticsearch'], ['dynamodb', 'dynamodb'],
  ['amazon web services', 'aws'], ['google cloud', 'gcp'], ['azure', 'azure'], ['docker', 'docker'],
  ['kubernetes', 'kubernetes'], ['jenkins', 'ci-cd'], ['terraform', 'terraform'], ['ansible', 'config-management'],
  ['chef', 'config-management'], ['puppet', 'config-management'], ['linux', 'linux-admin'], ['bash', 'shell-scripting'],
  ['shell script', 'shell-scripting'], ['kafka', 'message-queues'], ['rabbitmq', 'message-queues'],
  ['spark', 'big-data'], ['hadoop', 'big-data'], ['airflow', 'data-pipelines'], ['pandas', 'pandas'],
  ['numpy', 'numpy'], ['tensorflow', 'tensorflow'], ['pytorch', 'pytorch'], ['keras', 'deep-learning'],
  ['scikit-learn', 'machine-learning'], ['xgboost', 'machine-learning'], ['mlflow', 'mlops'], ['kubeflow', 'mlops'],
  ['spacy', 'nlp'], ['graphql', 'graphql'], ['restful', 'rest-apis'], ['junit', 'unit-testing'], ['jest', 'unit-testing'],
  ['selenium', 'e2e-testing'], ['figma', 'figma'], ['snowflake', 'data-warehousing'], ['redshift', 'data-warehousing'],
  ['bigquery', 'data-warehousing'], ['splunk', 'monitoring-observability'], ['grafana', 'monitoring-observability'],
  ['nagios', 'monitoring-observability'], ['wireshark', 'network-security'], ['nmap', 'network-security'],
  ['encryption', 'cryptography'], ['microservices', 'microservices'], ['nosql', 'mongodb'],
]
const matchSkill = (name) => {
  const n = name.toLowerCase()
  for (const [needle, id] of MATCH) {
    const re = new RegExp(`(^|[^a-z])${needle.replace(/[.+]/g, (c) => '\\' + c)}([^a-z]|$)`)
    if (re.test(n)) return id
  }
  return null
}

const lines = readFileSync('onet/software_skills.csv', 'utf8').split('\n').slice(1).filter(Boolean)
const rows = lines.map((l) => {
  const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''))
  return { code: cells[0], example: cells[2], hot: cells[5] === 'Y', demand: cells[6] === 'Y' }
})

for (const [track, codes] of Object.entries(OCCUPATIONS)) {
  const score = new Map()
  for (const r of rows) {
    if (!codes.includes(r.code)) continue
    const id = matchSkill(r.example)
    if (!id) continue
    const s = score.get(id) ?? 0
    score.set(id, s + 1 + (r.hot ? 1 : 0) + (r.demand ? 2 : 0))
  }
  const top = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)
  console.log(`${track}: ${top.map(([id, s]) => `${id}(${s})`).join(' ')}`)
}
