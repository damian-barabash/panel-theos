import { useMemo } from 'react'
import { ReactFlow, Background, Controls, Handle, Position } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force'
import { graphLinks } from './hashtags'

function GNode({ data }) {
  return (
    <div
      title={data.label}
      onClick={data.onPick}
      className="flex items-center justify-center rounded-full border-2 px-3 py-2 text-[12px] font-semibold"
      style={{
        background: data.color || '#2E1C52',
        borderColor: '#160C2A',
        color: data.color ? '#1A1030' : '#F2EAD3',
        opacity: data.dim ? 0.45 : 1,
        maxWidth: 160,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <span className="truncate">{data.label}</span>
    </div>
  )
}
const nodeTypes = { g: GNode }

export function GraphView({ sheets, onClose, onPick }) {
  const { nodes, edges } = useMemo(() => {
    const links = graphLinks(sheets) // [{source,target}]
    const degree = new Map()
    for (const l of links) {
      degree.set(l.source, (degree.get(l.source) || 0) + 1)
      degree.set(l.target, (degree.get(l.target) || 0) + 1)
    }
    const simNodes = sheets.map((s) => ({ id: s.id }))
    const simLinks = links.map((l) => ({ source: l.source, target: l.target }))
    const sim = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-320))
      .force('link', forceLink(simLinks).id((d) => d.id).distance(130))
      .force('center', forceCenter(0, 0))
      .force('collide', forceCollide(46))
      .stop()
    for (let i = 0; i < 300; i++) sim.tick()

    const rfNodes = simNodes.map((n) => {
      const s = sheets.find((x) => x.id === n.id)
      return {
        id: n.id,
        type: 'g',
        position: { x: n.x, y: n.y },
        data: {
          label: s.title,
          color: s.color,
          dim: !(degree.get(n.id) > 0),
          onPick: () => onPick(n.id),
        },
      }
    })
    const rfEdges = links.map((l, i) => ({
      id: `g${i}`,
      source: l.source,
      target: l.target,
      style: { stroke: '#6A4FA0', strokeWidth: 1.5 },
    }))
    return { nodes: rfNodes, edges: rfEdges }
  }, [sheets, onPick])

  return (
    <div className="fixed inset-0 z-50 bg-bgDeep">
      <div className="flex items-center justify-between border-b-2 border-line bg-bg px-4 py-2.5">
        <span className="pixel-title text-[11px] xs:text-xs">ГРАФ СВЯЗЕЙ</span>
        <button onClick={onClose} className="pixel-btn pixel-btn-ghost !px-3 !py-1.5">Закрыть</button>
      </div>
      <div style={{ height: 'calc(100% - 49px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#2E1C52" gap={22} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {nodes.length === 0 && (
        <p className="absolute inset-0 flex items-center justify-center text-muted">Нет листов</p>
      )}
    </div>
  )
}
