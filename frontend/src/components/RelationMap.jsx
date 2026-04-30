function RelationMap({ symbols }) {
  if (!symbols || symbols.length === 0) {
    return <div className="alert alert-secondary">No hay símbolos para mapear.</div>;
  }

  const nodes = [];
  const links = [];
  const symbolMap = Object.fromEntries(symbols.map((symbol) => [symbol._id, symbol]));
  const roots = symbols.filter((symbol) => !symbol.parentSymbol);

  function buildTree(items, depth = 0, xOffset = 0) {
    let x = xOffset;
    return items.map((symbol) => {
      const children = symbols.filter((item) => item.parentSymbol === symbol._id);
      const subtree = buildTree(children, depth + 1, x);
      const node = {
        ...symbol,
        x: x + 120,
        y: depth * 140 + 60,
        depth
      };
      if (children.length > 0) {
        x += subtree.length * 160;
        subtree.forEach((child) => {
          links.push({ source: node, target: child });
        });
      } else {
        x += 160;
      }
      nodes.push(node);
      return node;
    });
  }

  buildTree(roots);

  const baseWidth = Math.max(600, nodes.length * 180);
  const width = Math.max(baseWidth, Math.max(...nodes.map((node) => node.x + 120)));
  const height = Math.max(300, ...nodes.map((node) => node.y + 80));

  const levelBounds = nodes.reduce((acc, node) => {
    const depthKey = node.depth;
    const left = node.x - 60;
    const right = node.x + 60;
    if (!acc[depthKey]) {
      acc[depthKey] = { min: left, max: right };
    } else {
      acc[depthKey].min = Math.min(acc[depthKey].min, left);
      acc[depthKey].max = Math.max(acc[depthKey].max, right);
    }
    return acc;
  }, {});

  const levelOffsets = Object.fromEntries(
    Object.entries(levelBounds).map(([depth, bounds]) => {
      const levelCenter = (bounds.min + bounds.max) / 2;
      return [depth, width / 2 - levelCenter];
    })
  );

  nodes.forEach((node) => {
    const offset = levelOffsets[node.depth] || 0;
    node.x += offset;
  });

  return (
    <div className="overflow-auto border rounded p-3 bg-white" style={{ minHeight: '400px', minWidth: '100%' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {links.map((link, index) => (
          <line
            key={index}
            x1={link.source.x}
            y1={link.source.y + 30}
            x2={link.target.x}
            y2={link.target.y - 10}
            stroke="#6c757d"
            strokeWidth="2"
          />
        ))}
        {nodes.map((node) => (
          <g key={node._id}>
            <rect
              x={node.x - 60}
              y={node.y - 20}
              width="120"
              height="50"
              rx="12"
              fill={node.status === 'complete' ? '#d1e7dd' : '#f8d7da'}
              stroke={node.status === 'complete' ? '#0f5132' : '#842029'}
              strokeWidth="1.5"
            />
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="14"
              fill="#212529"
            >
              {node.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default RelationMap;
