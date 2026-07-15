import { C, F } from './tokens'

const stats = [
  ['46%', 'of the U.S. private workforce is employed by small businesses (SBA, 2023)'],
  ['15–25%', 'typical staffing agency placement fee, as a % of first-year salary'],
  ['$0', 'Workmark placement fee — ever'],
]

export function TheStat() {
  return (
    <section style={{ background: C.bgDeep, borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '100px 24px', textAlign: 'center' }}>
      <div className="reveal-item" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ fontFamily: F.mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
          The opportunity
        </h2>
        <div style={{ fontFamily: F.serif, fontSize: 96, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: '#fff', marginBottom: 16 }}>
          33.2M
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 15, color: 'rgba(255,255,255,0.75)', marginBottom: 12 }}>
          small businesses in the U.S. — most have real CS needs and no affordable way to meet them
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 40 }}>
          Source: SBA Office of Advocacy, 2023
        </div>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 48px' }}>
          Workmark connects them to motivated CS students who need real project experience. Both sides get what they need — without an agency in the middle.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 56, flexWrap: 'wrap' }}>
          {stats.map(([stat, label]) => (
            <div key={stat} style={{ textAlign: 'center', maxWidth: 160 }}>
              <div style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{stat}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
