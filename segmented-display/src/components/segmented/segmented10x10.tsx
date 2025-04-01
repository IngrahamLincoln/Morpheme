'use client';

import React, { useState, useMemo } from 'react';
import type { JSX } from 'react';
import { getDiagonalSegments, getHorizontalSegments, parseSegmentId, isInnerCircle } from './behaviors';

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

const SegmentedDisplay10x10: React.FC = () => {
  // Configuration state - using smaller default values for the 10x10 grid
  const [outerRadius, setOuterRadius] = useState(47); // Original radius
  const [innerRadius, setInnerRadius] = useState(32); // Original inner radius
  const [spacingFactor, setSpacingFactor] = useState(1.70); // Original spacing factor
  const margin = 40; // Margin for the grid
  
  // Display settings
  const [showLabels, setShowLabels] = useState(false); // Default to false for less clutter
  const [useColors, setUseColors] = useState(true);
  const [showOutlines, setShowOutlines] = useState(true); // New state for outlines
  
  // Active segments state
  const [activeSegments, setActiveSegments] = useState<Set<string>>(new Set());
  const [lastSelectedDot, setLastSelectedDot] = useState<string | null>(null);
  const [doubleActivatedB, setDoubleActivatedB] = useState<Set<string>>(new Set());
  
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
  
  // Reuse all the helper functions from the original component
  const segmentHelpers = {
    // ... existing helper functions ...
    toggleSegment: (id: string) => {
      setActiveSegments(prev => {
        const newSet = new Set(prev);
        
        // Handle c segment special case (horizontal lens)
        if (id.startsWith('c-')) {
          const [_, row, col] = id.split('-');
          const iSegment = `i-${row}-${col}`;

          if (!newSet.has(id) && !newSet.has(iSegment)) {
            // First click - activate c
            newSet.add(id);
          } else if (newSet.has(id) && !newSet.has(iSegment)) {
            // Second click - deactivate c and activate i
            newSet.delete(id);
            newSet.add(iSegment);
          } else {
            // Third click (or clicking c when i is active) - deactivate i
            newSet.delete(iSegment);
          }
          
          setLastSelectedDot(null);
          return newSet;
        }
        
        // If this is an inner circle (dot)
        if (isInnerCircle(id)) {
          // If we already have a last selected dot
          if (lastSelectedDot) {
            const startPoint = parseSegmentId(lastSelectedDot);
            const endPoint = parseSegmentId(id);
            
            // Try horizontal connection first
            const horizontalSegments = getHorizontalSegments(startPoint, endPoint);
            if (horizontalSegments.length > 0) {
              horizontalSegments.forEach(segment => newSet.add(segment));
              newSet.add(id); // Add the current dot
              setLastSelectedDot(null); // Reset last selected dot
              return newSet;
            }
            
            // If not horizontal, try diagonal
            const diagonalSegments = getDiagonalSegments(startPoint, endPoint);
            if (diagonalSegments.length > 0) {
              diagonalSegments.forEach(segment => newSet.add(segment));
              newSet.add(id); // Add the current dot
              setLastSelectedDot(null); // Reset last selected dot
              return newSet;
            }
          }
          
          // Toggle the current dot and update last selected
          if (newSet.has(id)) {
            newSet.delete(id);
            setLastSelectedDot(null);
          } else {
            newSet.add(id);
            setLastSelectedDot(id);
          }
        } else {
          // For non-dot segments, just toggle normally
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          setLastSelectedDot(null);
        }
        
        return newSet;
      });
    },
    
    getFill: (id: string) => {
      if (!activeSegments.has(id)) return "white";
      if (!useColors) return "black";
      return COLORS[id.split('-')[0]];
    },
    
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
    
    calculateQuadrant: (center: Point, outerR: number, innerR: number, quadrant: string): string => {
      const angles: Record<string, { start: number; end: number }> = {
        e: { start: -Math.PI, end: -Math.PI/2 },     // Top-left
        f: { start: -Math.PI/2, end: 0 },            // Top-right
        h: { start: 0, end: Math.PI/2 },             // Bottom-right
        g: { start: Math.PI/2, end: Math.PI }        // Bottom-left
      };
      
      const { start: startAngle, end: endAngle } = angles[quadrant];
      
      const outerStartX = center.x + outerR * Math.cos(startAngle);
      const outerStartY = center.y + outerR * Math.sin(startAngle);
      const outerEndX = center.x + outerR * Math.cos(endAngle);
      const outerEndY = center.y + outerR * Math.sin(endAngle);
      
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
    
    calculateDiamond: (centers: Point[], outerRadius: number): string => {
      if (centers.length !== 4) return "";
      
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
      
      const centerX = (centers[0].x + centers[1].x + centers[2].x + centers[3].x) / 4;
      const centerY = (centers[0].y + centers[1].y + centers[2].y + centers[3].y) / 4;
      
      const concavity = -0.15;
      
      const adjusted: Record<string, Point> = {};
      for (const side in intersections) {
        const corner = intersections[side].corner;
        adjusted[side] = {
          x: corner.x + (centerX - corner.x) * concavity,
          y: corner.y + (centerY - corner.y) * concavity
        };
      }
      
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
  
  // Grid centers calculated once per render - modified for 10x10
  const centers = useMemo(() => {
    const result: Point[] = [];
    
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
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
  
  // SVG dimensions - adjusted for 10x10 grid
  const svgWidth = margin * 2 + spacing * 9 + outerRadius * 2;
  const svgHeight = margin * 2 + spacing * 9 + outerRadius * 2;
  
  // Function to generate the SVG path for horizontal connector
  const getHorizontalConnectorPath = (center: Point): string => {
    const x1 = center.x;
    const x2 = center.x + spacing;
    const y = center.y;
    const height = innerRadius * 2; // Make the connector the same height as the inner circle diameter
    
    return `
      M ${x1} ${y - height/2}
      L ${x2} ${y - height/2}
      L ${x2} ${y + height/2}
      L ${x1} ${y + height/2}
      Z
    `;
  };
  
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
          stroke={showOutlines ? "gray" : "none"}
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
          stroke={showOutlines ? "gray" : "none"}
          strokeWidth="1"
          strokeDasharray="4"
          pointerEvents="none"
        />
      );
    });
    
    // Draw diamonds between every 2x2 group
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const diamondCenters = [
          centers[row * 10 + col],
          centers[row * 10 + col + 1],
          centers[(row + 1) * 10 + col],
          centers[(row + 1) * 10 + col + 1]
        ];
        
        const diamondId = `d-${row}-${col}`;
        const diamondPath = segmentHelpers.calculateDiamond(diamondCenters, outerRadius);
        
        if (diamondPath) {
          elements.push(
            <path
              key={diamondId}
              d={diamondPath}
              fill={segmentHelpers.getFill(diamondId)}
              stroke={showOutlines ? "black" : "none"}
              strokeWidth="1"
              onClick={() => segmentHelpers.toggleSegment(diamondId)}
              className="cursor-pointer hover:opacity-80"
            />
          );
        }
      }
    }
    
    // Draw quadrants for each circle
    centers.forEach((center) => {
      ['e', 'f', 'h', 'g'].forEach(quadrant => {
        const id = `${quadrant}-${center.row}-${center.col}`;
        const path = segmentHelpers.calculateQuadrant(center, outerRadius, innerRadius, quadrant);
        
        elements.push(
          <path
            key={id}
            d={path}
            fill={segmentHelpers.getFill(id)}
            stroke={showOutlines ? "black" : "none"}
            strokeWidth="1"
            onClick={() => segmentHelpers.toggleSegment(id)}
            className="cursor-pointer hover:opacity-80"
          />
        );
      });
    });
    
    // Draw horizontal lenses
    centers.forEach((center) => {
      if (typeof center.col === 'number' && center.col < 9) {
        const rightCenter = centers.find(c => c.row === center.row && c.col === center.col! + 1);
        const id = `c-${center.row}-${center.col}`;
        const path = segmentHelpers.calculateLensPath(center.x, center.y, rightCenter!.x, rightCenter!.y, outerRadius);
        
        elements.push(
          <path
            key={id}
            d={path}
            fill={segmentHelpers.getFill(id)}
            stroke={showOutlines ? "black" : "none"}
            strokeWidth="1"
            onClick={() => segmentHelpers.toggleSegment(id)}
            className="cursor-pointer hover:opacity-80"
          />
        );
      }
    });
    
    // Draw vertical lenses
    centers.forEach((center) => {
      if (center.row! < 9) {
        const belowCenter = centers.find(c => c.row === center.row! + 1 && c.col === center.col);
        const id = `b-${center.row}-${center.col}`;
        const path = segmentHelpers.calculateLensPath(center.x, center.y, belowCenter!.x, belowCenter!.y, outerRadius);
        
        elements.push(
          <path
            key={id}
            d={path}
            fill={segmentHelpers.getFill(id)}
            stroke={showOutlines ? "black" : "none"}
            strokeWidth="1"
            onClick={() => segmentHelpers.toggleSegment(id)}
            className="cursor-pointer hover:opacity-80"
          />
        );
      }
    });
    
    // Draw inner circles
    centers.forEach((center) => {
      const id = `a-${center.row}-${center.col}`;
      elements.push(
        <circle
          key={id}
          cx={center.x}
          cy={center.y}
          r={innerRadius}
          fill={segmentHelpers.getFill(id)}
          stroke={showOutlines ? "black" : "none"}
          strokeWidth="1"
          onClick={() => segmentHelpers.toggleSegment(id)}
          className="cursor-pointer hover:opacity-80"
        />
      );
    });
    
    // Draw horizontal connectors - only draw them if they're active
    centers.forEach((center) => {
      if (typeof center.col === 'number' && center.col < 9) {
        const id = `i-${center.row}-${center.col}`;
        if (activeSegments.has(id)) {
          const parentId = `c-${center.row}-${center.col}`; // Get the parent c segment ID
          elements.push(
            <path
              key={id}
              d={getHorizontalConnectorPath(center)}
              fill={segmentHelpers.getFill(id)}
              stroke={showOutlines ? "black" : "none"}
              strokeWidth="1"
              className="cursor-pointer hover:opacity-80"
              onClick={() => segmentHelpers.toggleSegment(parentId)} // Click on i triggers parent c
            />
          );
        }
      }
    });
    
    // Add labels if enabled
    if (showLabels) {
      // Add labels for diamonds
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const centerX = (centers[row * 10 + col].x + centers[row * 10 + col + 1].x +
                          centers[(row + 1) * 10 + col].x + centers[(row + 1) * 10 + col + 1].x) / 4;
          const centerY = (centers[row * 10 + col].y + centers[row * 10 + col + 1].y +
                          centers[(row + 1) * 10 + col].y + centers[(row + 1) * 10 + col + 1].y) / 4;
          
          elements.push(
            <text
              key={`label-d-${row}-${col}`}
              x={centerX}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              pointerEvents="none"
            >
              d
            </text>
          );
        }
      }
      
      // Add labels for other segments
      centers.forEach((center) => {
        // Inner circle label
        elements.push(
          <text
            key={`label-a-${center.row}-${center.col}`}
            x={center.x}
            y={center.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="8"
            pointerEvents="none"
          >
            a
          </text>
        );
        
        // Quadrant labels
        const midRadius = (outerRadius + innerRadius) / 2;
        const labelPositions = {
          e: { x: center.x - midRadius * 0.7, y: center.y - midRadius * 0.7 },
          f: { x: center.x + midRadius * 0.7, y: center.y - midRadius * 0.7 },
          g: { x: center.x - midRadius * 0.7, y: center.y + midRadius * 0.7 },
          h: { x: center.x + midRadius * 0.7, y: center.y + midRadius * 0.7 }
        };
        
        ['e', 'f', 'g', 'h'].forEach(quadrant => {
          elements.push(
            <text
              key={`label-${quadrant}-${center.row}-${center.col}`}
              x={labelPositions[quadrant as keyof typeof labelPositions].x}
              y={labelPositions[quadrant as keyof typeof labelPositions].y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              pointerEvents="none"
            >
              {quadrant}
            </text>
          );
        });
        
        // Horizontal lens labels
        if (typeof center.col === 'number' && center.col < 9) {
          const rightCenter = centers.find(c => c.row === center.row && c.col === center.col! + 1);
          elements.push(
            <text
              key={`label-c-${center.row}-${center.col}`}
              x={(center.x + rightCenter!.x) / 2}
              y={(center.y + rightCenter!.y) / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              pointerEvents="none"
            >
              c
            </text>
          );
        }
        
        // Vertical lens labels
        if (center.row! < 9) {
          const belowCenter = centers.find(c => c.row === center.row! + 1 && c.col === center.col);
          elements.push(
            <text
              key={`label-b-${center.row}-${center.col}`}
              x={(center.x + belowCenter!.x) / 2}
              y={(center.y + belowCenter!.y) / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              pointerEvents="none"
            >
              b
            </text>
          );
        }
      });
    }
    
    return elements;
  }, [centers, outerRadius, innerRadius, activeSegments, showLabels, useColors, showOutlines]);
  
  // Clear all segments
  const clearAllSegments = () => setActiveSegments(new Set());
  
  // Activate all segments
  const activateAllSegments = () => {
    const allSegments = new Set<string>();
    
    // Add all possible segments
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        // Inner circles and quadrants for all positions
        allSegments.add(`a-${row}-${col}`);
        allSegments.add(`e-${row}-${col}`);
        allSegments.add(`f-${row}-${col}`);
        allSegments.add(`g-${row}-${col}`);
        allSegments.add(`h-${row}-${col}`);
        
        // Vertical lenses (except last row)
        if (row < 9) {
          allSegments.add(`b-${row}-${col}`);
        }
        
        // Horizontal lenses (except last column)
        if (col < 9) {
          allSegments.add(`c-${row}-${col}`);
        }
        
        // Diamonds (for valid positions)
        if (row < 9 && col < 9) {
          allSegments.add(`d-${row}-${col}`);
        }
      }
    }
    
    setActiveSegments(allSegments);
  };
  
  // Toggle display settings
  const toggleLabels = () => setShowLabels(prev => !prev);
  const toggleColors = () => setUseColors(prev => !prev);
  
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">10x10 Segmented Display Grid</h1>
      
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

        <div className="flex items-center gap-2">
          <label className="font-medium">Show Outlines:</label>
          <button
            className={`px-3 py-1 rounded ${showOutlines ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setShowOutlines(prev => !prev)}
          >
            {showOutlines ? 'On' : 'Off'}
          </button>
        </div>
      </div>
      
      {/* SVG Display */}
      <div className="border border-gray-300 rounded p-4 bg-gray-100 overflow-auto">
        <svg 
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          {gridElements}
        </svg>
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
          <div>
            <label className="block mb-1">Outer Circle Radius: {outerRadius}px</label>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="20" 
                max="60" 
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
                min="20" 
                max="60" 
                value={outerRadius} 
                onChange={(e) => {
                  const newValue = parseInt(e.target.value) || 20;
                  setOuterRadius(Math.min(60, Math.max(20, newValue)));
                }}
                className="w-16 p-1 border rounded"
              />
            </div>
          </div>
          
          <div>
            <label className="block mb-1">Inner Circle Radius: {innerRadius}px</label>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="15" 
                max={outerRadius - 5} 
                value={innerRadius} 
                onChange={(e) => setInnerRadius(parseInt(e.target.value))}
                className="w-full"
              />
              <input 
                type="number" 
                min="15" 
                max={outerRadius - 5} 
                value={innerRadius} 
                onChange={(e) => {
                  const newValue = parseInt(e.target.value) || 15;
                  setInnerRadius(Math.min(outerRadius - 5, Math.max(15, newValue)));
                }}
                className="w-16 p-1 border rounded"
              />
            </div>
          </div>
          
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
                min="1.5" 
                max="2.0" 
                step="0.05"
                value={spacingFactor} 
                onChange={(e) => setSpacingFactor(parseFloat(e.target.value))}
                className="w-full"
              />
              <input 
                type="number" 
                min="1.5" 
                max="2.0" 
                step="0.05"
                value={spacingFactor} 
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value) || 1.5;
                  setSpacingFactor(Math.min(2.0, Math.max(1.5, newValue)));
                }}
                className="w-16 p-1 border rounded"
              />
            </div>
          </div>
          
          <div className="mt-2">
            <span className="block text-sm font-medium mb-2">
              Thickness of outer ring: {outerRadius - innerRadius}px
            </span>
          </div>
        </div>
        
        <div className="mt-4">
          <button
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => {
              setOuterRadius(47);
              setInnerRadius(32);
              setSpacingFactor(1.70);
            }}
          >
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
};

export default SegmentedDisplay10x10; 