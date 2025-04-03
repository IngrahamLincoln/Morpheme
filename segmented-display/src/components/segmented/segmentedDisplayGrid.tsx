'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Point, SegmentedDisplayGridProps } from './segmentedDisplayTypes';
import { BASE_OUTER_RADIUS, BASE_INNER_RADIUS, BASE_SPACING_FACTOR, MARGIN, COLORS } from './segmentedDisplayConstants';
import {
    calculateLensPath,
    calculateQuadrantPath,
    calculateDiamondPath,
    getHorizontalConnectorPath
} from './segmentedDisplayUtils';
import { useSegmentedDisplayState } from './useSegmentedDisplayState';
// Import only the WebGL renderer
import SegmentedDisplayRendererWebGL from './SegmentedDisplayRendererWebGL';
import SegmentedDisplayControls from './SegmentedDisplayControls';

// Create a client-side only component for WebGL detection
const WebGLStatusCheck = () => {
  const [webGLStatus, setWebGLStatus] = useState<string>('Checking...');
  const [statusColor, setStatusColor] = useState<string>('inherit');

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGLStatus('Not supported - using fallback');
        setStatusColor('red');
      } else {
        setWebGLStatus('Supported');
        setStatusColor('green');
      }
    } catch (e) {
      setWebGLStatus(`Error detecting WebGL: ${e}`);
      setStatusColor('red');
    }
  }, []);

  return (
    <div className="bg-yellow-100 p-2 mb-4 rounded text-sm">
      <p>WebGL Status: <span id="webgl-status" style={{ color: statusColor }}>{webGLStatus}</span></p>
    </div>
  );
};

const SegmentedDisplayGrid: React.FC<SegmentedDisplayGridProps> = ({ rows = 20, cols = 40 }) => {
  // --- Core State Hook ---
  const {
    activeSegments,
    dSegmentClickState,
    isAddOnlyMode,
    showInactiveDotGrid,
    adjacencyListOutput,
    adjacencyListInput,
    setAdjacencyListInput,
    toggleSegment,
    clearAllSegments,
    activateAllSegments,
    handleSave,
    handleLoad,
    toggleAddOnlyMode,
    toggleInactiveDotGrid,
  } = useSegmentedDisplayState({ rows, cols });

  // --- UI/Display State (managed here) ---
  const [showLabels, setShowLabels] = useState(false);
  const [useColors, setUseColors] = useState(true);
  const [showOutlines, setShowOutlines] = useState(true);
  const [scale, setScale] = useState(1.0);
  
  // --- Derived Values (based on props and state) ---
  const effectiveOuterRadius = BASE_OUTER_RADIUS * scale;
  const effectiveInnerRadius = BASE_INNER_RADIUS * scale;
  const effectiveSpacing = effectiveOuterRadius * BASE_SPACING_FACTOR;

  const centers = useMemo(() => {
    const result: Point[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        result.push({
          x: MARGIN + col * effectiveSpacing + effectiveOuterRadius,
          y: MARGIN + row * effectiveSpacing + effectiveOuterRadius,
          row,
          col
        });
      }
    }
    return result;
  }, [effectiveSpacing, effectiveOuterRadius, rows, cols]);

  const svgWidth = MARGIN * 2 + effectiveSpacing * (cols > 1 ? cols - 1 : 0) + effectiveOuterRadius * 2;
  const svgHeight = MARGIN * 2 + effectiveSpacing * (rows > 1 ? rows - 1 : 0) + effectiveOuterRadius * 2;

  // --- Event Handlers / Callbacks for Controls ---
  const toggleLabels = useCallback(() => setShowLabels(prev => !prev), []);
  const toggleColors = useCallback(() => setUseColors(prev => !prev), []);
  const toggleShowOutlines = useCallback(() => setShowOutlines(prev => !prev), []);
  const resetScale = useCallback(() => setScale(1.0), []);

  // --- Color Logic ---
  const getFillColor = useCallback((id: string): string => {
    if (!activeSegments.has(id)) {
        // Special handling for inactive 'c' and 'b' segments which should act as masks
        if (id.startsWith('c-') || id.startsWith('b-')) {
            // Fill with white (or background color) to mask underlying quadrants
            return 'white';
        }
        // Inactive 'a' and quadrants are white
        return "white";
    }

    // --- Handle Active Segments ---
    if (!useColors) return "black"; // Monochrome active

    // Specific color logic for active segments
    if (id.startsWith('i-')) return COLORS.i;

    const type = id.split('-')[0];

    // 'c' and 'b' segments themselves should not display a color when active,
    // as their activation state is visually represented by the 'i' segment or implied.
    // If they were somehow active, make them transparent so the active 'i' shows through correctly.
    if (type === 'c' || type === 'b') {
        return 'transparent'; // Ensure lens area is clear when connector 'i' might be active
    }

    // Return color for active a, d, e, f, g, h
    return COLORS[type] || "gray"; // Fallback color
  }, [activeSegments, useColors]);

  // --- Pass Geometry functions to Renderer ---
  const memoizedCalculateLensPath = useCallback(calculateLensPath, []);
  const memoizedCalculateQuadrantPath = useCallback(calculateQuadrantPath, []);
  const memoizedCalculateDiamondPath = useCallback(calculateDiamondPath, []);
  const memoizedGetHorizontalConnectorPath = useCallback(
      (center: Point) => getHorizontalConnectorPath(center, effectiveSpacing, effectiveInnerRadius),
      [effectiveSpacing, effectiveInnerRadius]
  );

  // Renderer props
  const rendererProps = {
    rows,
    cols,
    centers,
    activeSegments,
    dSegmentClickState,
    effectiveOuterRadius,
    effectiveInnerRadius,
    effectiveSpacing,
    showOutlines,
    showInactiveDotGrid,
    showLabels,
    useColors,
    svgWidth,
    svgHeight,
    onSegmentClick: toggleSegment,
    getFillColor,
    calculateLensPath: memoizedCalculateLensPath,
    calculateQuadrantPath: memoizedCalculateQuadrantPath,
    calculateDiamondPath: memoizedCalculateDiamondPath,
    getHorizontalConnectorPath: memoizedGetHorizontalConnectorPath
  };
  
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{rows}x{cols} Segmented Display</h1>

      {/* WebGL support diagnostic using client-side component */}
      <WebGLStatusCheck />

      {/* --- Controls Component --- */}
      <SegmentedDisplayControls
        rows={rows} cols={cols}
        showLabels={showLabels} toggleLabels={toggleLabels}
        useColors={useColors} toggleColors={toggleColors}
        showOutlines={showOutlines} toggleShowOutlines={toggleShowOutlines}
        isAddOnlyMode={isAddOnlyMode} toggleAddOnlyMode={toggleAddOnlyMode}
        showInactiveDotGrid={showInactiveDotGrid} toggleInactiveDotGrid={toggleInactiveDotGrid}
        scale={scale} setScale={setScale} resetScale={resetScale}
        adjacencyListOutput={adjacencyListOutput}
        adjacencyListInput={adjacencyListInput} setAdjacencyListInput={setAdjacencyListInput}
        handleSave={handleSave} handleLoad={handleLoad}
        clearAllSegments={clearAllSegments} activateAllSegments={activateAllSegments}
        effectiveOuterRadius={effectiveOuterRadius} effectiveInnerRadius={effectiveInnerRadius} effectiveSpacing={effectiveSpacing}
      />

      {/* Display WebGL renderer info */}
      <div className="my-4">
        <span className="text-sm text-gray-500">
          Powered by WebGL hardware acceleration for optimal performance
        </span>
      </div>
      
      {/* --- WebGL Renderer Component --- */}
      <div className="mt-6 border border-gray-300 rounded p-4 bg-white overflow-auto">
        <SegmentedDisplayRendererWebGL {...rendererProps} />
      </div>
    </div>
  );
};

export default SegmentedDisplayGrid; 