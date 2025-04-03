import React, { useEffect, useRef, useState, useCallback } from 'react';

// Define initial base constants (can be used for resetting)
const INITIAL_BASE_INNER_RADIUS = 32;
const INITIAL_BASE_OUTER_RADIUS = 47;
const INITIAL_BASE_SPACING_FACTOR = 1.70; 
const PADDING = 60; // Updated to match original SVG

// Define segment types
type SegmentType = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i';
type SegmentKey = `${number},${number},${SegmentType}`; // row,col,type

// Segment color definitions
const COLORS: Record<string, string> = {
  a: "#3498db", // Inner circle - blue
  b: "#e74c3c", // Vertical oval - red
  c: "#2ecc71", // Horizontal oval - green
  d: "#8e44ad", // Center diamond - purple
  e: "#9b59b6", // Top-left quadrant - light purple
  f: "#f39c12", // Top-right quadrant - orange
  g: "#1abc9c", // Bottom-left quadrant - teal
  h: "#e67e22", // Bottom-right quadrant - dark orange
  i: "#2c3e50"  // Horizontal connector - dark blue/grey
};

// --- Geometry Utility Functions (Adapted from segmentedDisplayUtils.ts) ---

// Calculates the path for an annular quadrant
const calculateQuadrantPath = (cx: number, cy: number, outerR: number, innerR: number, quadrant: string): Path2D | null => {
  const angles: Record<string, { start: number; end: number }> = {
    e: { start: -Math.PI, end: -Math.PI / 2 },     // Top-left
    f: { start: -Math.PI / 2, end: 0 },            // Top-right
    g: { start: Math.PI / 2, end: Math.PI },        // Bottom-left
    h: { start: 0, end: Math.PI / 2 }             // Bottom-right (Note: Utils used h for bottom-right, aligning here)
  };
  if (!angles[quadrant]) return null;

  const { start: startAngle, end: endAngle } = angles[quadrant];

  const outerStartX = cx + outerR * Math.cos(startAngle);
  const outerStartY = cy + outerR * Math.sin(startAngle);
  const outerEndX = cx + outerR * Math.cos(endAngle);
  const outerEndY = cy + outerR * Math.sin(endAngle);

  const innerStartX = cx + innerR * Math.cos(endAngle);
  const innerStartY = cy + innerR * Math.sin(endAngle);
  const innerEndX = cx + innerR * Math.cos(startAngle); 
  const innerEndY = cy + innerR * Math.sin(startAngle);

  const largeArcFlag = 0;
  const sweepFlagOuter = 1;
  const sweepFlagInner = 0;

  // Use Path2D for easier drawing on canvas
  const path = new Path2D();
  path.moveTo(outerStartX, outerStartY);
  path.arc(cx, cy, outerR, startAngle, endAngle, false); // Outer arc (false = counter-clockwise)
  path.lineTo(innerStartX, innerStartY);
  path.arc(cx, cy, innerR, endAngle, startAngle, true); // Inner arc (true = clockwise)
  path.closePath();
  return path; // Return Path2D object
};

// Calculates a simple rectangular path for the horizontal connector ('i')
const getHorizontalConnectorPath = (centerX: number, centerY: number, cellWidth: number, innerRadius: number): Path2D => {
  const connectorWidth = cellWidth + .7 * innerRadius; // Width is space between circle centers
  const connectorHeight = innerRadius * 2; // Height matches inner circle diameter
  const startX = centerX - connectorWidth / 2;
  const startY = centerY - connectorHeight / 2;
  
  const path = new Path2D();
  path.rect(startX, startY, connectorWidth, connectorHeight);
  return path;
};

// Calculates a simple rectangular path for the vertical connector ('h')
const getVerticalConnectorPath = (centerX: number, centerY: number, cellHeight: number, innerRadius: number): Path2D => {
  const connectorHeight = cellHeight - 2 * innerRadius; // Height is space between circles
  const connectorWidth = innerRadius * 0.6; // Arbitrary width
  const startX = centerX - connectorWidth / 2;
  const startY = centerY - connectorHeight / 2;
  
  const path = new Path2D();
  path.rect(startX, startY, connectorWidth, connectorHeight);
  return path;
};

// Calculate intersection points between two circles
const calculateIntersectionPoints = (x1: number, y1: number, x2: number, y2: number, radius: number): { p1: { x: number, y: number }, p2: { x: number, y: number } } | null => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.sqrt(dx * dx + dy * dy);
  
  // Check if circles intersect
  if (d > 2 * radius || d < 0.001) return null;
  
  const a = (radius * radius - radius * radius + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, radius * radius - a * a));
  
  const x3 = x1 + (a * dx) / d;
  const y3 = y1 + (a * dy) / d;
  
  return {
    p1: { x: x3 + (h * dy) / d, y: y3 - (h * dx) / d },
    p2: { x: x3 - (h * dy) / d, y: y3 + (h * dx) / d }
  };
};

// Calculate lens path between two circles
const calculateLensPath = (cx1: number, cy1: number, cx2: number, cy2: number, radius: number): Path2D | null => {
  const intersections = calculateIntersectionPoints(cx1, cy1, cx2, cy2, radius);
  if (!intersections) return null;

  const { p1, p2 } = intersections;
  const path = new Path2D();
  
  // Move to first intersection point
  path.moveTo(p1.x, p1.y);
  
  // Draw arc around first center
  const angle1 = Math.atan2(p1.y - cy1, p1.x - cx1);
  const angle2 = Math.atan2(p2.y - cy1, p2.x - cx1);
  path.arc(cx1, cy1, radius, angle1, angle2, false);
  
  // Draw arc around second center
  const angle3 = Math.atan2(p2.y - cy2, p2.x - cx2);
  const angle4 = Math.atan2(p1.y - cy2, p1.x - cx2);
  path.arc(cx2, cy2, radius, angle3, angle4, false);
  
  path.closePath();
  return path;
};

// Calculates the path for a diamond shape centered between four circles
const calculateDiamondPath = (centers: { x: number, y: number }[], outerRadius: number): Path2D | null => {
  if (centers.length !== 4) return null;

  const [tl, tr, bl, br] = centers;
  const path = new Path2D();

  // Calculate the center of the diamond
  const centerX = (tl.x + tr.x + bl.x + br.x) / 4;
  const centerY = (tl.y + tr.y + bl.y + br.y) / 4;

  // Calculate the vertices of the diamond
  const top = { x: centerX, y: centerY - outerRadius * 0.7 };
  const right = { x: centerX + outerRadius * 0.7, y: centerY };
  const bottom = { x: centerX, y: centerY + outerRadius * 0.7 };
  const left = { x: centerX - outerRadius * 0.7, y: centerY };

  // Create the diamond path with curved sides
  path.moveTo(top.x, top.y);
  path.quadraticCurveTo(centerX, centerY, right.x, right.y);
  path.quadraticCurveTo(centerX, centerY, bottom.x, bottom.y);
  path.quadraticCurveTo(centerX, centerY, left.x, left.y);
  path.quadraticCurveTo(centerX, centerY, top.x, top.y);
  path.closePath();

  return path;
};

const SimpleCircleRenderer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State for base dimensions and view parameters
  const [baseInnerRadius, setBaseInnerRadius] = useState(INITIAL_BASE_INNER_RADIUS);
  const [baseOuterRadius, setBaseOuterRadius] = useState(INITIAL_BASE_OUTER_RADIUS);
  const [scale, setScale] = useState(1.0);
  const [spacingFactor, setSpacingFactor] = useState(INITIAL_BASE_SPACING_FACTOR);
  const [selectedSegments, setSelectedSegments] = useState<Set<SegmentKey>>(new Set());
  const [showLabels, setShowLabels] = useState(true); // New state for label visibility
  const [showGrid, setShowGrid] = useState(true);
  const [showDots, setShowDots] = useState(true);
  const [showColors, setShowColors] = useState(true);

  // Define grid dimensions
  const gridRows = 2;
  const gridCols = 2;

  // Calculate effective values based on state
  // Ensure outer radius is not smaller than inner radius in effective calculation
  const effectiveOuterRadius = Math.max(baseInnerRadius * scale, baseOuterRadius * scale);
  const effectiveInnerRadius = baseInnerRadius * scale;
  const effectiveSpacing = effectiveOuterRadius * spacingFactor;
  const effectiveCellWidth = effectiveSpacing;
  const effectiveCellHeight = effectiveSpacing;

  // --- Handlers for Radius Sliders (with constraints) ---
  const handleInnerRadiusChange = (value: number) => {
    const newInner = Math.max(1, value); // Ensure minimum radius
    setBaseInnerRadius(newInner);
    // Ensure outer is always >= inner
    if (newInner > baseOuterRadius) {
      setBaseOuterRadius(newInner);
    }
  };

  const handleOuterRadiusChange = (value: number) => {
    const newOuter = Math.max(1, value); // Ensure minimum radius
    setBaseOuterRadius(newOuter);
    // Ensure outer is always >= inner
    if (newOuter < baseInnerRadius) {
      setBaseInnerRadius(newOuter);
    }
  };
  
  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check each cell and segment
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const centerX = PADDING + col * effectiveCellWidth + effectiveCellWidth / 2;
        const centerY = PADDING + row * effectiveCellHeight + effectiveCellHeight / 2;

        // Check inner circle (a)
        const distanceToCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        if (distanceToCenter <= effectiveInnerRadius) {
          const key: SegmentKey = `${row},${col},a`;
          setSelectedSegments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
              newSet.delete(key);
            } else {
              newSet.add(key);
            }
            return newSet;
          });
          return;
        }

        // Check lens segments (b, c)
        if (col < gridCols - 1) {
          const rightCenter = { x: centerX + effectiveCellWidth, y: centerY };
          const lensPath = calculateLensPath(centerX, centerY, rightCenter.x, rightCenter.y, effectiveOuterRadius);
          if (lensPath && isPointInPath(canvas, x, y, lensPath)) {
            const key: SegmentKey = `${row},${col},c`;
            setSelectedSegments(prev => {
              const newSet = new Set(prev);
              if (newSet.has(key)) {
                newSet.delete(key);
              } else {
                newSet.add(key);
              }
              return newSet;
            });
            return;
          }
        }

        if (row < gridRows - 1) {
          const belowCenter = { x: centerX, y: centerY + effectiveCellHeight };
          const lensPath = calculateLensPath(centerX, centerY, belowCenter.x, belowCenter.y, effectiveOuterRadius);
          if (lensPath && isPointInPath(canvas, x, y, lensPath)) {
            const key: SegmentKey = `${row},${col},b`;
            setSelectedSegments(prev => {
              const newSet = new Set(prev);
              if (newSet.has(key)) {
                newSet.delete(key);
              } else {
                newSet.add(key);
              }
              return newSet;
            });
            return;
          }
        }

        // Check quadrants (e, f, g, h)
        const quadrants: SegmentType[] = ['e', 'f', 'g', 'h'];
        for (const quad of quadrants) {
          const path = calculateQuadrantPath(centerX, centerY, effectiveOuterRadius, effectiveInnerRadius, quad);
          if (path && isPointInPath(canvas, x, y, path)) {
            const key: SegmentKey = `${row},${col},${quad}`;
            setSelectedSegments(prev => {
              const newSet = new Set(prev);
              if (newSet.has(key)) {
                newSet.delete(key);
              } else {
                newSet.add(key);
              }
              return newSet;
            });
            return;
          }
        }
      }
    }
  }, [effectiveInnerRadius, effectiveOuterRadius, effectiveCellWidth, effectiveCellHeight]);

  // Helper function to check if point is in path
  const isPointInPath = (canvas: HTMLCanvasElement, x: number, y: number, path: Path2D): boolean => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    return ctx.isPointInPath(path, x, y);
  };

  // Memoized drawGrid function 
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.lineWidth = 0.5;

    // 1. Draw outer circles (bottom layer)
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const centerX = PADDING + col * effectiveCellWidth + effectiveCellWidth / 2;
        const centerY = PADDING + row * effectiveCellHeight + effectiveCellHeight / 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, effectiveOuterRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#AAAAAA';
        ctx.stroke();

        // Draw grid lines if enabled
        if (showGrid) {
          ctx.beginPath();
          ctx.strokeStyle = '#999999'; // Darker color for better visibility
          ctx.lineWidth = 1; // Slightly thicker lines
          // Vertical lines
          ctx.moveTo(centerX, PADDING);
          ctx.lineTo(centerX, PADDING + gridRows * effectiveCellHeight);
          // Horizontal lines
          ctx.moveTo(PADDING, centerY);
          ctx.lineTo(PADDING + gridCols * effectiveCellWidth, centerY);
          ctx.stroke();
        }

        // Draw center dots if enabled
        if (showDots) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#000000';
          ctx.fill();
        }
      }
    }

    // 2. Draw center diamond (d) if we have a 2x2 grid
    if (gridRows > 1 && gridCols > 1) {
      const diamondCenters = [
        { x: PADDING, y: PADDING },
        { x: PADDING + effectiveCellWidth, y: PADDING },
        { x: PADDING, y: PADDING + effectiveCellHeight },
        { x: PADDING + effectiveCellWidth, y: PADDING + effectiveCellHeight }
      ];
      const diamondPath = calculateDiamondPath(diamondCenters, effectiveOuterRadius);
      if (diamondPath) {
        const isSelected = selectedSegments.has('0,0,d');
        ctx.fillStyle = showColors ? (isSelected ? COLORS.d : '#FFFFFF') : '#FFFFFF';
        ctx.strokeStyle = isSelected ? '#000000' : '#AAAAAA';
        ctx.lineWidth = isSelected ? 2 : 0.5;
        ctx.fill(diamondPath);
        ctx.stroke(diamondPath);

        // Draw label if enabled
        if (showLabels) {
          const centerX = diamondCenters.reduce((sum, c) => sum + c.x, 0) / 4;
          const centerY = diamondCenters.reduce((sum, c) => sum + c.y, 0) / 4;
          const fontSize = Math.max(8, Math.min(30, 12 * scale));
          ctx.font = `${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isSelected ? '#FFFFFF' : '#000000';
          ctx.fillText('d', centerX, centerY);
        }
      }
    }

    // 3. Draw quadrants (e, f, g, h) - third layer
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const centerX = PADDING + col * effectiveCellWidth + effectiveCellWidth / 2;
        const centerY = PADDING + row * effectiveCellHeight + effectiveCellHeight / 2;

        // Draw each quadrant independently
        const quadrants = ['e', 'f', 'g', 'h'] as const;
        quadrants.forEach(quad => {
          const isSelected = selectedSegments.has(`${row},${col},${quad}`);
          const quadrantPath = calculateQuadrantPath(centerX, centerY, effectiveOuterRadius, effectiveInnerRadius, quad);
          
          if (quadrantPath) {
            // Set fill and stroke styles
            ctx.fillStyle = showColors ? (isSelected ? COLORS[quad] : '#FFFFFF') : '#FFFFFF';
            ctx.strokeStyle = isSelected ? '#000000' : '#AAAAAA';
            ctx.lineWidth = isSelected ? 2 : 0.5;
            
            // Draw the quadrant
            ctx.fill(quadrantPath);
            ctx.stroke(quadrantPath);
            
            // Draw label if enabled
            if (showLabels) {
              const midR = (effectiveOuterRadius + effectiveInnerRadius) / 2;
              const lblPos = {
                e: { x: centerX - midR * 0.7, y: centerY - midR * 0.7 },
                f: { x: centerX + midR * 0.7, y: centerY - midR * 0.7 },
                g: { x: centerX - midR * 0.7, y: centerY + midR * 0.7 },
                h: { x: centerX + midR * 0.7, y: centerY + midR * 0.7 }
              } as const;
              
              const fontSize = Math.max(8, Math.min(30, 12 * scale));
              ctx.font = `${fontSize}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = isSelected ? '#FFFFFF' : '#000000';
              ctx.fillText(quad, lblPos[quad].x, lblPos[quad].y);
            }
          }
        });
      }
    }

    // 4. Draw lens segments (middle layer)
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const centerX = PADDING + col * effectiveCellWidth + effectiveCellWidth / 2;
        const centerY = PADDING + row * effectiveCellHeight + effectiveCellHeight / 2;

        // Draw horizontal lens (c) if not last column
        if (col < gridCols - 1) {
          const rightCenterX = centerX + effectiveCellWidth;
          const lensPath = calculateLensPath(centerX, centerY, rightCenterX, centerY, effectiveOuterRadius);
          if (lensPath) {
            const isSelected = selectedSegments.has(`${row},${col},c`);
            ctx.fillStyle = showColors ? (isSelected ? COLORS.c : '#FFFFFF') : '#FFFFFF';
            ctx.strokeStyle = isSelected ? '#000000' : '#AAAAAA';
            ctx.lineWidth = isSelected ? 2 : 0.5;
            ctx.fill(lensPath);
            ctx.stroke(lensPath);

            // Draw label if enabled
            if (showLabels) {
              const fontSize = Math.max(8, Math.min(30, 12 * scale));
              ctx.font = `${fontSize}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = isSelected ? '#FFFFFF' : '#000000';
              ctx.fillText('c', centerX + effectiveCellWidth / 2, centerY);
            }
          }
        }

        // Draw vertical lens (b) if not last row
        if (row < gridRows - 1) {
          const belowCenterY = centerY + effectiveCellHeight;
          const lensPath = calculateLensPath(centerX, centerY, centerX, belowCenterY, effectiveOuterRadius);
          if (lensPath) {
            const isSelected = selectedSegments.has(`${row},${col},b`);
            ctx.fillStyle = showColors ? (isSelected ? COLORS.b : '#FFFFFF') : '#FFFFFF';
            ctx.strokeStyle = isSelected ? '#000000' : '#AAAAAA';
            ctx.lineWidth = isSelected ? 2 : 0.5;
            ctx.fill(lensPath);
            ctx.stroke(lensPath);

            // Draw label if enabled
            if (showLabels) {
              const fontSize = Math.max(8, Math.min(30, 12 * scale));
              ctx.font = `${fontSize}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = isSelected ? '#FFFFFF' : '#000000';
              ctx.fillText('b', centerX, centerY + effectiveCellHeight / 2);
            }
          }
        }
      }
    }

    // 5. Draw horizontal connectors (i) - tied to 'c' segments
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        if (col < gridCols - 1) {
          const centerX = PADDING + col * effectiveCellWidth + effectiveCellWidth / 2;
          const centerY = PADDING + row * effectiveCellHeight + effectiveCellHeight / 2;
          const connectorCenterX = centerX + effectiveCellWidth / 2;
          
          const isSelected = selectedSegments.has(`${row},${col},c`); // 'i' is tied to 'c'
          const connectorPath = getHorizontalConnectorPath(connectorCenterX, centerY, effectiveCellWidth, effectiveInnerRadius);
          
          if (isSelected) {
            ctx.fillStyle = showColors ? COLORS.i : '#FFFFFF';
            ctx.fill(connectorPath);
          }
          ctx.strokeStyle = '#AAAAAA';
          ctx.lineWidth = 0.5;
          ctx.stroke(connectorPath);

          // Draw label if enabled
          if (showLabels) {
            const fontSize = Math.max(8, Math.min(30, 12 * scale));
            ctx.font = `${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isSelected ? '#FFFFFF' : '#000000';
            ctx.fillText('i', connectorCenterX, centerY);
          }
        }
      }
    }

    // 6. Draw inner circles (top layer)
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const centerX = PADDING + col * effectiveCellWidth + effectiveCellWidth / 2;
        const centerY = PADDING + row * effectiveCellHeight + effectiveCellHeight / 2;
        
        const isSelected = selectedSegments.has(`${row},${col},a`);
        ctx.beginPath();
        ctx.arc(centerX, centerY, effectiveInnerRadius, 0, Math.PI * 2);
        ctx.fillStyle = showColors ? (isSelected ? COLORS.a : '#FFFFFF') : '#FFFFFF';
        ctx.strokeStyle = isSelected ? '#000000' : '#AAAAAA';
        ctx.lineWidth = isSelected ? 2 : 0.5;
        ctx.fill();
        ctx.stroke();

        // Draw label if enabled
        if (showLabels) {
          const fontSize = Math.max(8, Math.min(30, 12 * scale));
          ctx.font = `${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isSelected ? '#FFFFFF' : '#000000';
          ctx.fillText('a', centerX, centerY);
        }
      }
    }
  }, [scale, spacingFactor, effectiveOuterRadius, effectiveInnerRadius, effectiveCellWidth, effectiveCellHeight, selectedSegments, showLabels, showGrid, showDots, showColors]); 

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Adjust canvas size based on effective dimensions
    const canvasWidth = PADDING * 2 + (gridCols * effectiveCellWidth);
    const canvasHeight = PADDING * 2 + (gridRows * effectiveCellHeight);
    canvas.width = Math.max(100, Math.min(2000, canvasWidth));
    canvas.height = Math.max(100, Math.min(2000, canvasHeight));

    // Redraw the grid whenever relevant state changes
    drawGrid(ctx);
    
  // Update dependencies to include base radii state and visibility toggles
  }, [baseInnerRadius, baseOuterRadius, scale, spacingFactor, drawGrid, effectiveCellWidth, effectiveCellHeight, showGrid, showDots]); 

  // --- Reset Handlers ---
  const resetScale = useCallback(() => setScale(1.0), []);
  const resetSpacing = useCallback(() => setSpacingFactor(INITIAL_BASE_SPACING_FACTOR), []);
  const resetInnerRadius = useCallback(() => {
      setBaseInnerRadius(INITIAL_BASE_INNER_RADIUS);
      // Also reset outer if it was forced smaller than initial inner
      if (baseOuterRadius < INITIAL_BASE_INNER_RADIUS) {
          setBaseOuterRadius(INITIAL_BASE_OUTER_RADIUS); 
      }
  }, [baseOuterRadius]); // Need baseOuterRadius dependency here
  const resetOuterRadius = useCallback(() => {
      setBaseOuterRadius(INITIAL_BASE_OUTER_RADIUS);
      // Also reset inner if it was forced larger than initial outer
      if (baseInnerRadius > INITIAL_BASE_OUTER_RADIUS) {
          setBaseInnerRadius(INITIAL_BASE_INNER_RADIUS);
      }
  }, [baseInnerRadius]); // Need baseInnerRadius dependency here

  return (
    <div className="border border-gray-300 rounded p-4 mt-4 bg-white">
      <h2 className="text-lg font-semibold mb-2">Simple 2x2 Segment Base Structure</h2>
      
      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Scale Control */}
        <div className="flex items-center gap-2">
          <label className="font-medium">Scale:</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-sm text-gray-600">{scale.toFixed(1)}x</span>
        </div>

        {/* Spacing Control */}
        <div className="flex items-center gap-2">
          <label className="font-medium">Spacing:</label>
          <input
            type="range"
            min="1.2"
            max="2.5"
            step="0.1"
            value={spacingFactor}
            onChange={(e) => setSpacingFactor(parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-sm text-gray-600">{spacingFactor.toFixed(1)}x</span>
        </div>

        {/* Color Toggle */}
        <div className="flex items-center gap-2">
          <label className="font-medium">Show Colors:</label>
          <button
            className={`px-3 py-1 rounded ${showColors ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setShowColors(prev => !prev)}
          >
            {showColors ? 'On' : 'Off'}
          </button>
        </div>

        {/* Label Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showLabels"
            checked={showLabels}
            onChange={() => setShowLabels(!showLabels)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="showLabels" className="text-sm text-gray-700">Show Labels</label>
        </div>

        {/* Grid Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showGrid"
            checked={showGrid}
            onChange={() => setShowGrid(prev => !prev)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="showGrid" className="text-sm text-gray-700">Show Grid</label>
        </div>

        {/* Dot Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showDots"
            checked={showDots}
            onChange={() => setShowDots(!showDots)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="showDots" className="text-sm text-gray-700">Show Dots</label>
        </div>

        {/* Reset Button */}
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded bg-red-500 text-white"
            onClick={() => {
              resetScale();
              resetSpacing();
              resetInnerRadius();
              resetOuterRadius();
              setShowGrid(true);
              setShowDots(true);
              setShowColors(true);
              setShowLabels(true);
            }}
          >
            Reset to Default
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas 
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          border: '1px solid #000',
          backgroundColor: '#f0f0f0',
          maxWidth: '100%', 
          display: 'block',
          margin: '0 auto' 
        }}
      />
    </div>
  );
};

export default SimpleCircleRenderer; 