import { createContext, useContext, useCallback, useMemo, useState, useRef } from 'react'
import {
  ReactFlow, Background, Controls, Handle, Position,
  applyNodeChanges, applyEdgeChanges, addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PASTELS } from './constants'
import { splitWithTags } from './hashtags'

const Ctx = createContext(null)

function CardNode({ id, data }) {
  const { setText, setColor, removeNode, index, goToSheet } = useContext(Ctx)
  const [editing, setEditing] = useState(false)
  return (
    <div
      className="min-w-[120px] max-w-[240px] border-2 border-bgDeep px-3 py-2 text-[13px] shadow-md"
      style={{ background: data.color || '#D6C8F2', color: '#1A1030' }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#160C2A' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#160C2A' }} />
      {editing ? (
        <textarea
          autoFocus
          defaultValue={data.text}
          onBlur={(e) => { setText(id, e.target.value); setEditing(false) }}
          className="w-full resize-none bg-transparent outline-none"
          rows={2}
        />
      ) : (
        <div onDoubleClick={() => setEditing(true)} className="whitespace-pre-wrap break-words">
          {splitWithTags(data.text || 'Карточка', index).map((p, i) =>
            p.tag != null ? (
              <span key={i}
                onMouseDown={(e) => { if (p.sheetId) { e.stopPropagation(); goToSheet(p.sheetId) } }}
                className={p.sheetId ? 'cursor-pointer font-bold underline decoration-dotted' : ''}
                style={p.sheetId ? { color: '#5a2a9a' } : undefined}
              >{p.raw}</span>
            ) : <span key={i}>{p.text}</span>,
          )}
        </div>
      )}
      {/* mini palette + delete */}
      <div className="mt-1.5 flex items-center gap-1 border-t border-black/15 pt-1.5">
        {PASTELS.slice(0, 6).map((p) => (
          <button key={p.hex} onClick={() => setColor(id, p.hex)} title={p.name}
            style={{ background: p.hex }} className="h-3.5 w-3.5 rounded-full border border-black/25" />
        ))}
        <button onClick={() => removeNode(id)} title="Удалить" className="ml-auto text-black/45 hover:text-black text-xs leading-none">✕</button>
      </div>
    </div>
  )
}

const nodeTypes = { card: CardNode }

export default function MindmapSheet({ sheet, index, onChange, goToSheet }) {
  const toRf = (c) => ({
    nodes: (c?.nodes || []).map((n) => ({ id: n.id, type: 'card', position: { x: n.x, y: n.y }, data: { text: n.text, color: n.color } })),
    edges: (c?.edges || []).map((e) => ({ id: e.id, source: e.source, target: e.target })),
  })
  const init = useMemo(() => toRf(sheet.content), [sheet.id]) // eslint-disable-line
  const [nodes, setNodes] = useState(init.nodes)
  const [edges, setEdges] = useState(init.edges)
  const idxRef = useRef(index); idxRef.current = index
  const goRef = useRef(goToSheet); goRef.current = goToSheet

  const persist = useCallback((nds, eds) => {
    onChange({
      nodes: nds.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, text: n.data.text, color: n.data.color })),
      edges: eds.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    })
  }, [onChange])

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => { const next = applyNodeChanges(changes, nds); persist(next, edges); return next })
  }, [edges, persist])
  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => { const next = applyEdgeChanges(changes, eds); persist(nodes, next); return next })
  }, [nodes, persist])
  const onConnect = useCallback((conn) => {
    setEdges((eds) => { const next = addEdge({ ...conn, id: `e${Date.now()}` }, eds); persist(nodes, next); return next })
  }, [nodes, persist])

  const mutateNode = (id, patch) => setNodes((nds) => {
    const next = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    persist(next, edges); return next
  })
  const ctx = {
    index, goToSheet,
    setText: (id, text) => mutateNode(id, { text }),
    setColor: (id, color) => mutateNode(id, { color }),
    removeNode: (id) => setNodes((nds) => {
      const next = nds.filter((n) => n.id !== id)
      const e2 = edges.filter((e) => e.source !== id && e.target !== id)
      setEdges(e2); persist(next, e2); return next
    }),
  }

  function addCard() {
    const id = `n${Date.now()}`
    const node = { id, type: 'card', position: { x: 120 + Math.round((nodes.length * 37) % 320), y: 100 + Math.round((nodes.length * 53) % 240) }, data: { text: 'Новая идея', color: '#Bcdcf0' } }
    setNodes((nds) => { const next = [...nds, node]; persist(next, edges); return next })
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b-2 border-line bg-bg/60 px-2 py-1.5">
          <button onClick={addCard} className="border-2 border-line px-2 py-1 text-xs text-muted hover:text-ink">+ Карточка</button>
          <span className="label ml-2 hidden sm:block">Тяни от правого края карточки к другой — связь · #ИмяЛиста — ссылка</span>
        </div>
        <div className="min-h-0 flex-1" style={{ background: '#160C2A' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ style: { stroke: '#E8B547', strokeWidth: 2 } }}
          >
            <Background color="#3A2A60" gap={20} />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </Ctx.Provider>
  )
}
