import { useEffect, useState } from 'react'
import { useProjectUpdateReload } from '../../hooks/useProjectUpdateReload'
import { fetchSymbols } from '../../api'

type Symbol = {
  _id: string
  name: string
  type: string
  parentSymbol?: string | null
  isSeed?: boolean
  order?: string
  status?: string
}

const TYPE_COLOR: Record<string, string> = {
  Sujeto: '#3B82F6', Objeto: '#8B5CF6', Verbo: '#10B981', Estado: '#F59E0B',
}

interface TreeNode {
  sym: Symbol
  children: TreeNode[]
  depth: number
  index: number
  totalSiblings: number
}

function buildTree(symbols: Symbol[]): TreeNode[] {
  const roots = symbols.filter(s => !s.parentSymbol)
  function buildNode(sym: Symbol, depth: number, index: number, total: number): TreeNode {
    const children = symbols.filter(s => s.parentSymbol === sym._id)
    return {
      sym,
      depth,
      index,
      totalSiblings: total,
      children: children.map((c, i) => buildNode(c, depth + 1, i, children.length)),
    }
  }
  return roots.map((r, i) => buildNode(r, 0, i, roots.length))
}

interface NodePos { id: string; x: number; y: number; sym: Symbol }

function layoutTree(roots: TreeNode[]): { positions: NodePos[]; edges: [string, string][] } {
  const positions: NodePos[] = []
  const edges: [string, string][] = []
  const H_GAP = 210
  const V_GAP = 120
  const X_OFFSET = 100

  // Global leaf counter — each leaf gets a unique column regardless of depth
  let leafCol = 0
  const nodeXMap: Map<string, number> = new Map()

  function computeX(node: TreeNode): number {
    if (node.children.length === 0) {
      const col = leafCol++
      nodeXMap.set(node.sym._id, col)
      return col
    }
    const childXs = node.children.map(c => computeX(c))
    const x = (childXs[0] + childXs[childXs.length - 1]) / 2
    nodeXMap.set(node.sym._id, x)
    return x
  }

  roots.forEach(r => computeX(r))

  function walk(node: TreeNode, depth: number) {
    const x = nodeXMap.get(node.sym._id) ?? 0
    positions.push({ id: node.sym._id, x: x * H_GAP + X_OFFSET, y: depth * V_GAP + 60, sym: node.sym })
    node.children.forEach(child => {
      edges.push([node.sym._id, child.sym._id])
      walk(child, depth + 1)
    })
  }

  roots.forEach(r => walk(r, 0))
  return { positions, edges }
}

export default function MapTab({ projectId }: { projectId: string }) {
  const [symbols, setSymbols] = useState<Symbol[]>([])
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<Symbol | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setError('')

    fetchSymbols(projectId)
      .then((data) => {
        setSymbols(Array.isArray(data) ? data : [])
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message || err?.message || 'No se pudieron cargar los símbolos.')
      })
      .finally(() => setLoading(false))
  }, [projectId])

  useProjectUpdateReload(projectId, async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchSymbols(projectId)
      setSymbols(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'No se pudieron cargar los símbolos.')
    } finally {
      setLoading(false)
    }
  })

  const matchIds = searchQuery.trim()
    ? new Set(symbols.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(s => s._id))
    : null

  const roots = buildTree(symbols)
  const { positions, edges } = layoutTree(roots)

  const maxX = positions.length ? Math.max(...positions.map(p => p.x)) + 160 : 0
  const maxY = positions.length ? Math.max(...positions.map(p => p.y)) + 80 : 0
  const NODE_W = 120
  const NODE_H = 44

  const posMap = new Map(positions.map(p => [p.id, p]))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 300px' : '1fr', gap: 0, height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Mapa de relaciones</h2>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', minWidth: 200 }}>
            <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>⌕</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar símbolo..."
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'inherit', width: '100%' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 14, padding: 0 }}>×</button>
            )}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
            {Object.entries(TYPE_COLOR).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
                <span style={{ color: 'var(--text-muted)' }}>{type}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-faint)' }}>
            <span>● Semilla</span>
            <span>○ Derivado</span>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {loading && (
            <div className="rt-card" style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
              Cargando símbolos...
            </div>
          )}
          {error && (
            <div className="rt-card" style={{ padding: 24, marginBottom: 16, textAlign: 'center', borderLeft: '4px solid var(--danger)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}
          {!loading && !error && symbols.length === 0 && (
            <div className="rt-card" style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
              No hay símbolos disponibles para este proyecto.
            </div>
          )}
          <div style={{ position: 'relative', width: Math.max(maxX + 80, 600), height: Math.max(maxY + 40, 400) }}>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {/* Depth level separators */}
              {Array.from(new Set(positions.map(p => p.y))).map(y => (
                <line key={y} x1={0} y1={y + NODE_H / 2 + 22} x2={maxX + 80} y2={y + NODE_H / 2 + 22}
                  stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" opacity={0.3} />
              ))}
              {/* Edges */}
              {edges.map(([aId, bId]) => {
                const a = posMap.get(aId)
                const b = posMap.get(bId)
                if (!a || !b) return null
                const ax = a.x + NODE_W / 2
                const ay = a.y + NODE_H
                const bx = b.x + NODE_W / 2
                const by = b.y
                const my = (ay + by) / 2
                const isHighlighted = hovered === aId || hovered === bId || selected?._id === aId || selected?._id === bId
                return (
                  <path key={`${aId}-${bId}`}
                    d={`M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`}
                    fill="none"
                    stroke={isHighlighted ? 'var(--accent)' : 'var(--border-2)'}
                    strokeWidth={isHighlighted ? 2 : 1.5}
                    opacity={isHighlighted ? 1 : 0.6}
                  />
                )
              })}
            </svg>

            {/* Depth labels */}
            {Array.from(new Set(positions.map(p => p.y))).map((y, depth) => (
              <div key={y} style={{
                position: 'absolute', left: 0, top: y + NODE_H / 2 - 8,
                fontSize: 10, fontWeight: 700, color: 'var(--text-faint)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                background: 'var(--bg)', padding: '0 4px', zIndex: 2,
              }}>
                N{depth}
              </div>
            ))}

            {/* Nodes */}
            {positions.map(({ id, x, y, sym }) => {
              const color = TYPE_COLOR[sym.type] ?? '#888'
              const isHov = hovered === id
              const isSel = selected?._id === id
              const isMatch = !matchIds || matchIds.has(id)
              const isDimmed = !!matchIds && !isMatch
              return (
                <div
                  key={id}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(isSel ? null : sym)}
                  style={{
                    position: 'absolute',
                    left: x, top: y,
                    width: NODE_W, height: NODE_H,
                    borderRadius: 8,
                    background: isSel ? color : isHov ? `${color}28` : `${color}14`,
                    border: `2px solid ${isSel || isHov ? color : isMatch ? `${color}55` : `${color}22`}`,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2,
                    transition: 'all 0.15s ease',
                    zIndex: isHov || isSel ? 10 : 1,
                    boxShadow: isSel ? `0 4px 16px ${color}40` : isHov ? `0 2px 8px ${color}30` : isMatch && matchIds ? `0 0 0 2px ${color}80` : 'none',
                    opacity: isDimmed ? 0.3 : 1,
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: isSel ? '#fff' : color, textAlign: 'center', lineHeight: 1.2, padding: '0 6px' }}>
                    {sym.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9.5, color: isSel ? 'rgba(255,255,255,0.7)' : `${color}99`, fontWeight: 600 }}>
                      {sym.type}
                    </span>
                    {sym.isSeed && <span style={{ fontSize: 9, color: isSel ? '#fff' : color }}>●</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: TYPE_COLOR[selected.type] }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: TYPE_COLOR[selected.type] }}>{selected.type}</span>
            </div>
            <button onClick={() => setSelected(null)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{ padding: '2px 8px' }}>×</button>
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{selected.name}</h3>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14 }}>SYM-{selected.order}</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {selected.status && <span className="badge badge-muted" style={{ fontSize: 11 }}>{selected.status.toUpperCase()}</span>}
            {selected.isSeed
              ? <span className="badge badge-blue" style={{ fontSize: 10 }}>SEMILLA</span>
              : <span className="badge badge-muted" style={{ fontSize: 10 }}>DERIVADO</span>
            }
          </div>
          {selected.parentSymbol && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 4 }}>DERIVA DE</div>
              <button onClick={() => setSelected(symbols.find(s => s._id === selected.parentSymbol) ?? null)} style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5,
                padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text)',
              }}>
                {symbols.find(s => s._id === selected.parentSymbol)?.name}
              </button>
            </div>
          )}
          {(() => {
            const children = symbols.filter(s => s.parentSymbol === selected._id)
            if (!children.length) return null
            return (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 6 }}>DERIVADOS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {children.map(c => (
                    <button key={c._id} onClick={() => setSelected(c)} style={{
                      background: `${TYPE_COLOR[c.type]}18`, border: `1px solid ${TYPE_COLOR[c.type]}55`,
                      borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', color: TYPE_COLOR[c.type] ?? 'var(--text)',
                    }}>{c.name}</button>
                  ))}
                </div>
              </div>
            )
          })()}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 5 }}>NOCIÓN</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{selected.notion}</p>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 5 }}>IMPACTO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {selected.impact.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} style={{ padding: '5px 10px', background: 'var(--surface-2)', borderRadius: 4, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{line}</div>
              ))}
            </div>
          </div>
          {selected.reviewNotes && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--warning)', textTransform: 'uppercase', marginBottom: 5 }}>NOTAS DE REVISIÓN</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: 5, padding: '7px 10px', margin: 0, lineHeight: 1.5 }}>{selected.reviewNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
