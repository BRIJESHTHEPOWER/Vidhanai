import React, { useEffect, useRef, useState, useCallback } from 'react';
import './LegalTopicGraph.css';

/**
 * LegalTopicGraph
 * A pure-SVG force-directed-style knowledge graph for legal topics.
 * Renders nodes (topic, IPC, BNS, concept) with animated edges and hover tooltips.
 */

const NODE_TYPES = {
  topic:   { icon: '⚖️', ring: '#6366f1', glow: '#818cf8' },
  ipc:     { icon: '📘', ring: '#22d3ee', glow: '#67e8f9' },
  bns:     { icon: '📗', ring: '#a78bfa', glow: '#c4b5fd' },
  concept: { icon: '🔑', ring: '#f59e0b', glow: '#fcd34d' },
};

function computeLayout(nodes, edges, width, height) {
  if (!nodes.length) return [];
  const cx = width / 2;
  const cy = height / 2;

  const positioned = nodes.map((n, i) => {
    if (n.type === 'topic') return { ...n, x: cx, y: cy };
    return { ...n, x: 0, y: 0 }; // placeholder
  });

  // Simple radial layout by type
  const ipcNodes     = positioned.filter(n => n.type === 'ipc');
  const bnsNodes     = positioned.filter(n => n.type === 'bns');
  const conceptNodes = positioned.filter(n => n.type === 'concept');

  const place = (arr, baseAngle, radius, spread) => {
    arr.forEach((n, i) => {
      const angle = baseAngle + (i - (arr.length - 1) / 2) * spread;
      n.x = cx + radius * Math.cos(angle);
      n.y = cy + radius * Math.sin(angle);
    });
  };

  place(ipcNodes,     -Math.PI / 3, 160, Math.PI / 5);
  place(bnsNodes,     Math.PI / 3,  160, Math.PI / 5);
  place(conceptNodes, Math.PI,      220, Math.PI / 6);

  return positioned;
}

function EdgeLayer({ edges, nodeMap, animTick }) {
  return (
    <g className="ltg-edges">
      {edges.map((e, i) => {
        const from = nodeMap[e.from];
        const to   = nodeMap[e.to];
        if (!from || !to) return null;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        // Curved path
        const cx2 = mx - dy * 0.2;
        const cy2 = my + dx * 0.2;
        const path = `M${from.x},${from.y} Q${cx2},${cy2} ${to.x},${to.y}`;
        const dashLen = 6;
        const offset = (animTick * 1.2) % 18;
        return (
          <g key={i}>
            <path
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={2}
            />
            <path
              d={path}
              fill="none"
              stroke={nodeMap[e.from]?.color || '#6366f1'}
              strokeWidth={1.5}
              strokeDasharray={`${dashLen} 12`}
              strokeDashoffset={-offset}
              opacity={0.55}
            />
            {e.label && (
              <text
                x={mx}
                y={my - 8}
                textAnchor="middle"
                fontSize="9"
                fill="rgba(255,255,255,0.35)"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {e.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function NodeCircle({ node, onHover, activeNode }) {
  const typeInfo = NODE_TYPES[node.type] || NODE_TYPES.concept;
  const isActive = activeNode?.id === node.id;
  const r = node.size || 18;

  return (
    <g
      className="ltg-node"
      transform={`translate(${node.x},${node.y})`}
      onMouseEnter={() => onHover(node)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      {/* Glow ring */}
      <circle
        r={r + 8}
        fill="none"
        stroke={typeInfo.glow}
        strokeWidth={isActive ? 2.5 : 0.8}
        opacity={isActive ? 0.7 : 0.25}
        className={isActive ? 'ltg-node-pulse' : ''}
      />
      {/* Main circle */}
      <circle
        r={r}
        fill={`${node.color}22`}
        stroke={node.color}
        strokeWidth={isActive ? 2.5 : 1.8}
        filter={isActive ? 'url(#glow)' : undefined}
      />
      {/* Icon */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={r * 0.85}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {typeInfo.icon}
      </text>
      {/* Label below */}
      <text
        y={r + 14}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill={node.color}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {node.label}
      </text>
      {node.sublabel && (
        <text
          y={r + 26}
          textAnchor="middle"
          fontSize="8"
          fill="rgba(255,255,255,0.4)"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {node.sublabel}
        </text>
      )}
    </g>
  );
}

function Tooltip({ node }) {
  if (!node || !node.detail) return null;
  const { punishment, category, keywords } = node.detail;
  return (
    <div className="ltg-tooltip">
      <div className="ltg-tooltip-title">{node.label}</div>
      {node.sublabel && <div className="ltg-tooltip-sub">{node.sublabel}</div>}
      {punishment && (
        <div className="ltg-tooltip-row">
          <span className="ltg-tooltip-key">Punishment</span>
          <span className="ltg-tooltip-val">{punishment}</span>
        </div>
      )}
      {category && (
        <div className="ltg-tooltip-row">
          <span className="ltg-tooltip-key">Category</span>
          <span className="ltg-tooltip-val">{category.replace(/_/g, ' ')}</span>
        </div>
      )}
      {keywords?.length > 0 && (
        <div className="ltg-tooltip-tags">
          {keywords.map(k => <span key={k} className="ltg-tag">{k}</span>)}
        </div>
      )}
    </div>
  );
}

export default function LegalTopicGraph({ graphData, isLoading }) {
  const svgRef      = useRef(null);
  const [dim, setDim]     = useState({ w: 600, h: 340 });
  const [nodes, setNodes] = useState([]);
  const [animTick, setAnimTick] = useState(0);
  const [activeNode, setActiveNode] = useState(null);
  const rafRef = useRef(null);

  // Measure container
  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setDim({ w: Math.max(width, 320), h: 340 });
    });
    if (svgRef.current) obs.observe(svgRef.current.parentElement);
    return () => obs.disconnect();
  }, []);

  // Layout nodes when data or size changes
  useEffect(() => {
    if (!graphData?.nodes?.length) { setNodes([]); return; }
    const laid = computeLayout(graphData.nodes, graphData.edges || [], dim.w, dim.h);
    setNodes(laid);
  }, [graphData, dim]);

  // Animate edges
  useEffect(() => {
    const tick = () => {
      setAnimTick(t => t + 1);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  const legend = [
    { type: 'topic',   label: 'Topic' },
    { type: 'ipc',     label: 'IPC Section' },
    { type: 'bns',     label: 'BNS Section' },
    { type: 'concept', label: 'Concept' },
  ];

  if (isLoading) {
    return (
      <div className="ltg-root ltg-loading">
        <div className="ltg-spinner" />
        <p>Building topic graph…</p>
      </div>
    );
  }

  if (!graphData?.nodes?.length) return null;

  return (
    <div className="ltg-root">
      {/* Header */}
      <div className="ltg-header">
        <div className="ltg-header-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M3 12h3m12 0h3M12 3v3m0 12v3"/></svg>
          <span>Legal Topic Graph</span>
          <span className="ltg-badge">{graphData.law_count} laws found</span>
        </div>
        <div className="ltg-legend">
          {legend.map(l => (
            <div key={l.type} className="ltg-legend-item">
              <span
                className="ltg-legend-dot"
                style={{ background: NODE_TYPES[l.type]?.ring }}
              />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* SVG Graph */}
      <div className="ltg-canvas-wrap" ref={svgRef}>
        <svg width={dim.w} height={dim.h} className="ltg-svg">
          <defs>
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="bg-grad" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background glow */}
          <ellipse cx={dim.w / 2} cy={dim.h / 2} rx={dim.w * 0.4} ry={dim.h * 0.45} fill="url(#bg-grad)" />

          {/* Edges */}
          <EdgeLayer edges={graphData.edges || []} nodeMap={nodeMap} animTick={animTick} />

          {/* Nodes */}
          {nodes.map(n => (
            <NodeCircle
              key={n.id}
              node={n}
              onHover={setActiveNode}
              activeNode={activeNode}
            />
          ))}
        </svg>

        {/* Hover Tooltip */}
        {activeNode && <Tooltip node={activeNode} />}
      </div>

      <p className="ltg-hint">Hover nodes to explore details · IPC → BNS connections shown</p>
    </div>
  );
}
