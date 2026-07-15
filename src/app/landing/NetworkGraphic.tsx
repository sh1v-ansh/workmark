import { C } from './tokens'

/**
 * Decorative constellation of connected nodes — the "database of verified
 * records" made into a visual. Sits behind the hero headline as a signature
 * texture moment. Hand-placed points (not random) so it reads as intentional.
 */
export function NetworkGraphic() {
  const nodes: [number, number, number][] = [
    [80, 60, 3], [220, 30, 2], [360, 90, 4], [520, 40, 2.5], [660, 100, 3],
    [140, 160, 2], [300, 190, 3], [460, 170, 2], [610, 210, 3.5], [760, 140, 2],
    [40, 250, 2.5], [200, 300, 3], [400, 280, 2], [580, 300, 2.5], [720, 260, 3],
  ]
  const edges: [number, number][] = [
    [0, 2], [2, 4], [1, 2], [2, 5], [5, 6], [6, 7], [7, 8], [3, 7], [8, 9],
    [5, 10], [10, 11], [6, 11], [11, 12], [12, 13], [13, 14], [9, 14],
  ]

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 340"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}
    >
      {edges.map(([a, b], i) => {
        const [x1, y1] = nodes[a]
        const [x2, y2] = nodes[b]
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={C.accentBorder}
            strokeWidth="1"
          />
        )
      })}
      {nodes.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 4 === 0 ? C.accent : C.accentBorder} />
      ))}
    </svg>
  )
}
