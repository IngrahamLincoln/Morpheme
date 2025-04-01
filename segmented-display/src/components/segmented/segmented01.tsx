'use client';

import React, { useState, useMemo } from 'react';

interface Point {
  x: number;
  y: number;
  row?: number;
  col?: number;
}

interface IntersectionPoints {
  p1: Point;
  p2: Point;
}

const SegmentedDisplay: React.FC = () => {
  // Configuration state
  const [outerRadius, setOuterRadius] = useState(47);
  const [innerRadius, setInnerRadius] = useState(32);
  const [spacingFactor, setSpacingFactor] = useState(1.70);
  const margin = 60;
  
  // Display settings
  const [showLabels, setShowLabels] = useState(true);
  const [useColors, setUseColors] = useState(true);
  
  // Active segments state
  const [activeSegments, setActiveSegments] = useState<Set<string>>(new Set());
  
  // Spacing calculated from factor and radius
  const spacing = outerRadius * spacingFactor;
  
  // Segment color definitions
  const COLORS: Record<string, string> = {
    a: "#3498db", // Inner circle - blue
    b: "#e74c3c", // Vertical oval - red
    c: "#2ecc71", // Horizontal oval - green
    d: "#8e44ad", // Center diamond - purple
    e: "#9b59b6", // Top-left quadrant - light purple
    f: "#f39c12", // Top-right quadrant - orange
    g: "#1abc9c", // Bottom-left quadrant - teal
    h: "#e67e22" // Bottom-right quadrant - dark orange
  };
  
  // Segment helpers
  const segmentHelpers = {
    // Toggle a segment's active state
    toggleSegment: (id: string) => {
      setActiveSegments(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    },
    
    // Get filled state for a segment
    getFill: (id: string) => {
      if (!activeSegments.has(id)) return "white";
      if (!useColors) return "black";
      return COLORS[id.split('-')[0]];
    },
    
    // Calculate intersection points between two circles
    calculateIntersectionPoints: (x1: number, y1: number, x2: number, y2: number, radius: number): IntersectionPoints | null => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance >= 2 * radius || distance < 0.001) return null;
      
      const a = (radius * radius - radius * radius + distance * distance) / (2 * distance);
      const h = Math.sqrt(radius * radius - a * a);
      
      const x3 = x1 + (a * dx) / distance;
      const y3 = y1 + (a * dy) / distance;
      
      const x4 = x3 + (h * dy) / distance;
      const y4 = y3 - (h * dx) / distance;
      
      const x5 = x3 - (h * dy) / distance;
      const y5 = y3 + (h * dx) / distance;
      
      return { 
        p1: { x: x4, y: y4 }, 
        p2: { x: x5, y: y5 }
      };
    },
    
    // Calculate a lens path between two circles
    calculateLensPath: (x1: number, y1: number, x2: number, y2: number, radius: number): string => {
      const intersections = segmentHelpers.calculateIntersectionPoints(x1, y1, x2, y2, radius);
      if (!intersections) return "";
      
      const { p1, p2 } = intersections;
      
      return `
        M ${p1.x} ${p1.y}
        A ${radius} ${radius} 0 0 1 ${p2.x} ${p2.y}
        A ${radius} ${radius} 0 0 1 ${p1.x} ${p1.y}
      `;
    },
    
    // Calculate a quadrant segment path
    calculateQuadrant: (center: Point, outerR: number, innerR: number, quadrant: string): string => {
      const angles: Record<string, { start: number; end: number }> = {
        e: { start: -Math.PI, end: -Math.PI/2 },     // Top-left
        f: { start: -Math.PI/2, end: 0 },            // Top-right
        h: { start: 0, end: Math.PI/2 },             // Bottom-right
        g: { start: Math.PI/2, end: Math.PI }        // Bottom-left
      };
      
      const { start: startAngle, end: endAngle } = angles[quadrant];
      
      // Calculate points on the outer circle
      const outerStartX = center.x + outerR * Math.cos(startAngle);
      const outerStartY = center.y + outerR * Math.sin(startAngle);
      const outerEndX = center.x + outerR * Math.cos(endAngle);
      const outerEndY = center.y + outerR * Math.sin(endAngle);
      
      // Calculate points on the inner circle
      const innerStartX = center.x + innerR * Math.cos(startAngle);
      const innerStartY = center.y + innerR * Math.sin(startAngle);
      const innerEndX = center.x + innerR * Math.cos(endAngle);
      const innerEndY = center.y + innerR * Math.sin(endAngle);
      
      return `
        M ${outerStartX} ${outerStartY}
        A ${outerR} ${outerR} 0 0 1 ${outerEndX} ${outerEndY}
        L ${innerEndX} ${innerEndY}
        A ${innerR} ${innerR} 0 0 0 ${innerStartX} ${innerStartY}
        Z
      `;
    },
    
    // Calculate the diamond path
    calculateDiamond: (centers: Point[], outerRadius: number): string => {
      if (centers.length !== 4) return "";
      
      // Find intersections between adjacent circles
      const intersections: Record<string, { corner: Point }> = {};
      
      const pairs = [
        { name: 'top', c1: centers[0], c2: centers[1] },
        { name: 'bottom', c1: centers[2], c2: centers[3] },
        { name: 'left', c1: centers[0], c2: centers[2] },
        { name: 'right', c1: centers[1], c2: centers[3] }
      ];
      
      for (const pair of pairs) {
        const points = segmentHelpers.calculateIntersectionPoints(
          pair.c1.x, pair.c1.y, pair.c2.x, pair.c2.y, outerRadius
        );
        
        if (!points) return "";
        
        intersections[pair.name] = {
          corner: {
            x: (points.p1.x + points.p2.x) / 2,
            y: (points.p1.y + points.p2.y) / 2
          }
        };
      }
      
      // Calculate the center of the diamond
      const centerX = (centers[0].x + centers[1].x + centers[2].x + centers[3].x) / 4;
      const centerY = (centers[0].y + centers[1].y + centers[2].y + centers[3].y) / 4;
      
      // Make the diamond slightly larger to account for gaps
      const concavity = -0.15; // Negative value makes it convex
      
      // Adjust corners to make diamond slightly convex
      const adjusted: Record<string, Point> = {};
      for (const side in intersections) {
        const corner = intersections[side].corner;
        adjusted[side] = {
          x: corner.x + (centerX - corner.x) * concavity,
          y: corner.y + (centerY - corner.y) * concavity
        };
      }
      
      // Create the diamond path with curved sides
      return `
        M ${adjusted.top.x} ${adjusted.top.y}
        Q ${centerX} ${centerY} ${adjusted.right.x} ${adjusted.right.y}
        Q ${centerX} ${centerY} ${adjusted.bottom.x} ${adjusted.bottom.y}
        Q ${centerX} ${centerY} ${adjusted.left.x} ${adjusted.left.y}
        Q ${centerX} ${centerY} ${adjusted.top.x} ${adjusted.top.y}
        Z
      `;
    }
  };
  
  // Grid centers calculated once per render
  const centers = useMemo(() => {
    const result: Point[] = [];
    
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        result.push({
          x: margin + col * spacing + outerRadius,
          y: margin + row * spacing + outerRadius,
          row,
          col
        });
      }
    }
    
    return result;
  }, [margin, spacing, outerRadius]);
  
  // SVG dimensions
  const svgWidth = margin * 2 + spacing + outerRadius * 2;
  const svgHeight = margin * 2 + spacing + outerRadius * 2;
  
  // Generate SVG elements
  const gridElements = useMemo(() => {
    const elements: JSX.Element[] = [];
    
    // Draw reference circles (dotted)
    centers.forEach((center) => {
      elements.push(
        <circle
          key={`ref-outer-${center.row}-${center.col}`}
          cx={center.x}
          cy={center.y}
          r={outerRadius}
          fill="none"
          stroke="gray"
          strokeWidth="1"
          strokeDasharray="4"
          pointerEvents="none"
        />
      );
      
      elements.push(
        <circle
          key={`ref-inner-${center.row}-${center.col}`}
          cx={center.x}
          cy={center.y}
          r={innerRadius}
          fill="none"
          stroke="gray"
          strokeWidth="1"
          strokeDasharray="4"
          pointerEvents="none"
        />
      );
    });
    
    // Draw center diamond (bottom layer)
    const diamondId = "d-0-0";
    const diamondPath = segmentHelpers.calculateDiamond(centers, outerRadius);
    
    if (diamondPath) {
      elements.push(
        <path
          key={diamondId}
          d={diamondPath}
          fill={segmentHelpers.getFill(diamondId)}
          stroke="black"
          strokeWidth="1"
          onClick={() => segmentHelpers.toggleSegment(diamondId)}
          className="cursor-pointer hover:opacity-80"
        />
      );
    }
    
    // Draw outer ring quadrants with e, f, g, h labels
    const quadrantTypes = ['e', 'f', 'h', 'g']; // Top-left, top-right, bottom-right, bottom-left
    
    centers.forEach((center) => {
      quadrantTypes.forEach(quadrant => {
        const id = `${quadrant}-${center.row}-${center.col}`;
        const path = segmentHelpers.calculateQuadrant(center, outerRadius, innerRadius, quadrant);
        
        elements.push(
          <path
            key={id}
            d={path}
            fill={segmentHelpers.getFill(id)}
            stroke="black"
            strokeWidth="1"
            onClick={() => segmentHelpers.toggleSegment(id)}
            className="cursor-pointer hover:opacity-80"
          />
        );
      });
    });
    
    // Draw lens shapes
    // Horizontal lenses (c)
    centers.forEach((center) => {
      if (center.col! < 1) {
        const rightCenter = centers.find(c => c.row === center.row && c.col === center.col! + 1);
        const id = `c-${center.row}-${center.col}`;
        const path = segmentHelpers.calculateLensPath(center.x, center.y, rightCenter!.x, rightCenter!.y, outerRadius);
        
        elements.push(
          <path
            key={id}
            d={path}
            fill={segmentHelpers.getFill(id)}
            stroke="black"
            strokeWidth="1"
            onClick={() => segmentHelpers.toggleSegment(id)}
            className="cursor-pointer hover:opacity-80"
          />
        );
      }
    });
    
    // Vertical lenses (b)
    centers.forEach((center) => {
      if (center.row! < 1) {
        const belowCenter = centers.find(c => c.row === center.row! + 1 && c.col === center.col);
        const id = `b-${center.row}-${center.col}`;
        const path = segmentHelpers.calculateLensPath(center.x, center.y, belowCenter!.x, belowCenter!.y, outerRadius);
        
        elements.push(
          <path
            key={id}
            d={path}
            fill={segmentHelpers.getFill(id)}
            stroke="black"
            strokeWidth="1"
            onClick={() => segmentHelpers.toggleSegment(id)}
            className="cursor-pointer hover:opacity-80"
          />
        );
      }
    });
    
    // Inner circles (a)
    centers.forEach((center) => {
      const id = `a-${center.row}-${center.col}`;
      elements.push(
        <circle
          key={id}
          cx={center.x}
          cy={center.y}
          r={innerRadius}
          fill={segmentHelpers.getFill(id)}
          stroke="black"
          strokeWidth="1"
          onClick={() => segmentHelpers.toggleSegment(id)}
          className="cursor-pointer hover:opacity-80"
        />
      );
    });
    
    // Add all segment labels (always on top) if enabled
    if (showLabels) {
      // Diamond label
      if (diamondPath) {
        const centerX = (centers[0].x + centers[1].x + centers[2].x + centers[3].x) / 4;
        const centerY = (centers[0].y + centers[1].y + centers[2].y + centers[3].y) / 4;
        
        elements.push(
          <text
            key={`label-${diamondId}`}
            x={centerX}
            y={centerY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12"
            pointerEvents="none"
          >
            d
          </text>
        );
      }
      
      // Inner circle labels
      centers.forEach((center) => {
        const id = `a-${center.row}-${center.col}`;
        elements.push(
          <text
            key={`label-${id}`}
            x={center.x}
            y={center.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12"
            pointerEvents="none"
          >
            a
          </text>
        );
      });
      
      // Horizontal lens labels
      centers.forEach((center) => {
        if (center.col! < 1) {
          const rightCenter = centers.find(c => c.row === center.row && c.col === center.col! + 1);
          const id = `c-${center.row}-${center.col}`;
          elements.push(
            <text
              key={`label-${id}`}
              x={(center.x + rightCenter!.x) / 2}
              y={(center.y + rightCenter!.y) / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              pointerEvents="none"
            >
              c
            </text>
          );
        }
      });
      
      // Vertical lens labels
      centers.forEach((center) => {
        if (center.row! < 1) {
          const belowCenter = centers.find(c => c.row === center.row! + 1 && c.col === center.col);
          const id = `b-${center.row}-${center.col}`;
          elements.push(
            <text
              key={`label-${id}`}
              x={(center.x + belowCenter!.x) / 2}
              y={(center.y + belowCenter!.y) / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              pointerEvents="none"
            >
              b
            </text>
          );
        }
      });
      
      // Quadrant labels
      centers.forEach((center) => {
        // Calculate label positions based on the center point and outer/inner radius
        const midRadius = (outerRadius + innerRadius) / 2;
        
        // Calculate positions for each quadrant label
        const labelPositions: Record<string, Point> = {
          e: { // Top-left
            x: center.x - midRadius * 0.7,
            y: center.y - midRadius * 0.7
          },
          f: { // Top-right
            x: center.x + midRadius * 0.7,
            y: center.y - midRadius * 0.7
          },
          g: { // Bottom-left
            x: center.x - midRadius * 0.7,
            y: center.y + midRadius * 0.7
          },
          h: { // Bottom-right
            x: center.x + midRadius * 0.7,
            y: center.y + midRadius * 0.7
          }
        };
        
        // Add labels for each quadrant
        for (const quadrant of ['e', 'f', 'g', 'h']) {
          const id = `${quadrant}-${center.row}-${center.col}`;
          const position = labelPositions[quadrant];
          
          elements.push(
            <text
              key={`label-${id}`}
              x={position.x}
              y={position.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              pointerEvents="none"
            >
              {quadrant}
            </text>
          );
        }
      });
    }
    
    return elements;
  }, [centers, outerRadius, innerRadius, activeSegments, showLabels, useColors]);
  
  // Toggle all segments of a specific type
  const toggleSegmentType = (segmentType: string) => {
    setActiveSegments(prev => {
      const newSet = new Set(prev);
      
      // Handle center diamond
      if (segmentType === 'd') {
        const id = `${segmentType}-0-0`;
        if (prev.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
      }
      
      // Handle quadrants (e, f, g, h)
      if (['e', 'f', 'g', 'h'].includes(segmentType)) {
        let allActive = true;
        
        // Check if all are active
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
            const id = `${segmentType}-${row}-${col}`;
            if (!prev.has(id)) {
              allActive = false;
              break;
            }
          }
          if (!allActive) break;
        }
        
        // Toggle accordingly
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
            const id = `${segmentType}-${row}-${col}`;
            if (allActive) newSet.delete(id);
            else newSet.add(id);
          }
        }
        return newSet;
      }
      
      // Handle a, b, c segments
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const id = `${segmentType}-${row}-${col}`;
          
          // Skip vertical overlaps on bottom row
          if (segmentType === 'b' && row === 1) continue;
          // Skip horizontal overlaps on right column
          if (segmentType === 'c' && col === 1) continue;
          
          if (prev.has(id)) newSet.delete(id);
          else newSet.add(id);
        }
      }
      
      return newSet;
    });
  };
  
  // Legend items configuration
  const legendItems = [
    { id: 'a', label: 'Inner Circle', color: COLORS.a },
    { id: 'b', label: 'Vertical Oval', color: COLORS.b },
    { id: 'c', label: 'Horizontal Oval', color: COLORS.c },
    { id: 'd', label: 'Center Diamond', color: COLORS.d },
    { id: 'e', label: 'Top-Left Quadrant', color: COLORS.e },
    { id: 'f', label: 'Top-Right Quadrant', color: COLORS.f },
    { id: 'g', label: 'Bottom-Left Quadrant', color: COLORS.g },
    { id: 'h', label: 'Bottom-Right Quadrant', color: COLORS.h },
  ];
  
  // Clear all segments
  const clearAllSegments = () => setActiveSegments(new Set());
  
  // Activate all segments
  const activateAllSegments = () => {
    const allSegments = new Set<string>();
    
    // Activate all segments
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        // Add inner circles
        allSegments.add(`a-${row}-${col}`);
        
        // Add quadrant segments
        allSegments.add(`e-${row}-${col}`);
        allSegments.add(`f-${row}-${col}`);
        allSegments.add(`g-${row}-${col}`);
        allSegments.add(`h-${row}-${col}`);
        
        // Add vertical overlaps (only for top row)
        if (row === 0) {
          allSegments.add(`b-${row}-${col}`);
        }
        
        // Add horizontal overlaps (only for left column)
        if (col === 0) {
          allSegments.add(`c-${row}-${col}`);
        }
      }
    }
    
    // Add center diamond
    allSegments.add('d-0-0');
    
    setActiveSegments(allSegments);
  };
  
  // Toggle display settings
  const toggleLabels = () => setShowLabels(prev => !prev);
  const toggleColors = () => setUseColors(prev => !prev);
  
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Advanced Segmented Display</h1>
      <p className="mb-4">
        A complete implementation with all segments labeled (a-h) and fully functional.
      </p>
      
      {/* Display Settings */}
      <div className="mb-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <label className="font-medium">Show Labels:</label>
          <button
            className={`px-3 py-1 rounded ${showLabels ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={toggleLabels}
          >
            {showLabels ? 'On' : 'Off'}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="font-medium">Use Colors:</label>
          <button
            className={`px-3 py-1 rounded ${useColors ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={toggleColors}
          >
            {useColors ? 'On' : 'Off'}
          </button>
        </div>
      </div>
      
      {/* SVG Display */}
      <div className="border border-gray-300 rounded p-4 bg-gray-100">
        <svg 
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          {gridElements}
        </svg>
      </div>
      
      {/* Active Segments List */}
      <div className="mt-4">
        <h2 className="text-lg font-semibold mb-2">Active Segments:</h2>
        <div className="flex flex-wrap gap-2">
          {Array.from(activeSegments).map(id => (
            <span key={id} className="px-2 py-1 bg-blue-100 rounded">{id}</span>
          ))}
        </div>
      </div>
      
      {/* Segment Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {legendItems.map(item => (
          <div key={item.id} className="flex items-center">
            <div 
              className="w-4 h-4 mr-2" 
              style={{ backgroundColor: useColors ? item.color : "black" }}
            ></div>
            <span>{item.label} ({item.id})</span>
            <button
              className="ml-2 px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => toggleSegmentType(item.id)}
            >
              Toggle All
            </button>
          </div>
        ))}
      </div>
      
      {/* Action Buttons */}
      <div className="mt-6 flex gap-2">
        <button
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={clearAllSegments}
        >
          Clear All
        </button>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={activateAllSegments}
        >
          Activate All
        </button>
      </div>
      
      {/* Parameter Controls */}
      <div className="mt-6 p-4 border rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">Adjust Parameters</h2>
        
        <div className="grid gap-4">
          {/* Outer Radius Control */}
          <div>
            <label className="block mb-1">Outer Circle Radius: {outerRadius}px</label>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="30" 
                max="100" 
                value={outerRadius} 
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  setOuterRadius(newValue);
                  if (innerRadius >= newValue) {
                    setInnerRadius(newValue - 5);
                  }
                }}
                className="w-full"
              />
              <input 
                type="number" 
                min="30" 
                max="100" 
                value={outerRadius} 
                onChange={(e) => {
                  const newValue = parseInt(e.target.value) || 30;
                  setOuterRadius(Math.min(100, Math.max(30, newValue)));
                }}
                className="w-16 p-1 border rounded"
              />
            </div>
          </div>
          
          {/* Inner Radius Control */}
          <div>
            <label className="block mb-1">Inner Circle Radius: {innerRadius}px</label>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="10" 
                max={outerRadius - 5} 
                value={innerRadius} 
                onChange={(e) => setInnerRadius(parseInt(e.target.value))}
                className="w-full"
              />
              <input 
                type="number" 
                min="10" 
                max={outerRadius - 5} 
                value={innerRadius} 
                onChange={(e) => {
                  const newValue = parseInt(e.target.value) || 10;
                  setInnerRadius(Math.min(outerRadius - 5, Math.max(10, newValue)));
                }}
                className="w-16 p-1 border rounded"
              />
            </div>
          </div>
          
          {/* Spacing Factor Control */}
          <div>
            <label className="block mb-1">
              Spacing Factor: {spacingFactor.toFixed(2)} 
              <span className="text-sm text-gray-500 ml-1">
                (Spacing: {Math.round(spacing)}px)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="1.0" 
                max="2.0" 
                step="0.05"
                value={spacingFactor} 
                onChange={(e) => setSpacingFactor(parseFloat(e.target.value))}
                className="w-full"
              />
              <input 
                type="number" 
                min="1.0" 
                max="2.0" 
                step="0.05"
                value={spacingFactor} 
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value) || 1.0;
                  setSpacingFactor(Math.min(2.0, Math.max(1.0, newValue)));
                }}
                className="w-16 p-1 border rounded"
              />
            </div>
          </div>
          
          <div className="mt-2">
            <span className="block text-sm font-medium mb-2">Thickness of outer ring: {outerRadius - innerRadius}px</span>
          </div>
        </div>
        
        <div className="mt-4">
          <button
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => {
              setOuterRadius(47);
              setInnerRadius(32);
              setSpacingFactor(1.7);
            }}
          >
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
};

export default SegmentedDisplay; 