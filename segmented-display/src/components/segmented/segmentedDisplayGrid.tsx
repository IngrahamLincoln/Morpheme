'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { Point, SegmentedDisplayGridProps } from './segmentedDisplayTypes';
import { BASE_OUTER_RADIUS, BASE_INNER_RADIUS, BASE_SPACING_FACTOR, MARGIN, COLORS } from './segmentedDisplayConstants';
import {
    // parseSegmentId, // Now only used inside the hook or renderer potentially
    calculateLensPath,
    calculateQuadrantPath,
    calculateDiamondPath,
    getHorizontalConnectorPath
} from './segmentedDisplayUtils'; // Geometry helpers needed for rendering
import { useSegmentedDisplayState } from './useSegmentedDisplayState';
import SegmentedDisplayRendererSVG from './SegmentedDisplayRendererSVG';
import SegmentedDisplayControls from './SegmentedDisplayControls';

const SegmentedDisplayGrid: React.FC<SegmentedDisplayGridProps> = ({ rows = 20, cols = 40 }) => {
  // --- Core State Hook ---
  const {
    activeSegments,
    dSegmentClickState, // Needed for getFillColor logic
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
  }, [effectiveSpacing, effectiveOuterRadius, rows, cols]); // MARGIN is constant

  const svgWidth = MARGIN * 2 + effectiveSpacing * (cols > 1 ? cols - 1 : 0) + effectiveOuterRadius * 2;
  const svgHeight = MARGIN * 2 + effectiveSpacing * (rows > 1 ? rows - 1 : 0) + effectiveOuterRadius * 2;

  // --- Event Handlers / Callbacks for Controls ---
  const toggleLabels = useCallback(() => setShowLabels(prev => !prev), []);
  const toggleColors = useCallback(() => setUseColors(prev => !prev), []);
  const toggleShowOutlines = useCallback(() => setShowOutlines(prev => !prev), []);
  const resetScale = useCallback(() => setScale(1.0), []);

  // --- Color Logic ---
  // Moved here as it needs access to activeSegments, useColors, and potentially dSegmentClickState
  const getFillColor = useCallback((id: string): string => {
    if (!activeSegments.has(id)) {
        // Special handling for inactive 'c' and 'b' segments which should act as masks
        if (id.startsWith('c-') || id.startsWith('b-')) {
            // Fill with white (or background color) to mask underlying quadrants
            return 'white'; // <--- CHANGED FROM 'transparent'
        }
        // Inactive 'a' and quadrants are white
        return "white"; // Default inactive for others like 'a', 'e', 'f', 'g', 'h'
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
  }, [activeSegments, useColors]); // COLORS is constant

  // --- Pass Geometry functions to Renderer ---
  // Memoize these if they are recalculated unnecessarily, but direct pass is fine
  const memoizedCalculateLensPath = useCallback(calculateLensPath, []);
  const memoizedCalculateQuadrantPath = useCallback(calculateQuadrantPath, []);
  const memoizedCalculateDiamondPath = useCallback(calculateDiamondPath, []);
  // Pass effectiveSpacing and effectiveInnerRadius to the connector path function via closure/wrapper
  const memoizedGetHorizontalConnectorPath = useCallback(
      (center: Point) => getHorizontalConnectorPath(center, effectiveSpacing, effectiveInnerRadius),
      [effectiveSpacing, effectiveInnerRadius]
  );


  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{rows}x{cols} Segmented Display</h1>

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

      {/* --- SVG Renderer Component --- */}
      <div className="mt-6 border border-gray-300 rounded p-4 bg-white overflow-auto">
         <SegmentedDisplayRendererSVG
             rows={rows} cols={cols}
             centers={centers}
             activeSegments={activeSegments}
             dSegmentClickState={dSegmentClickState} // Pass if needed by renderer internals (e.g., labels/debug)
             effectiveOuterRadius={effectiveOuterRadius}
             effectiveInnerRadius={effectiveInnerRadius}
             effectiveSpacing={effectiveSpacing} // Pass spacing if needed by renderer
             showOutlines={showOutlines}
             showInactiveDotGrid={showInactiveDotGrid}
             showLabels={showLabels}
             useColors={useColors} // Pass if needed directly by renderer
             svgWidth={svgWidth}
             svgHeight={svgHeight}
             onSegmentClick={toggleSegment} // Pass the main toggle function
             getFillColor={getFillColor} // Pass the color calculation function
             // Pass geometry path functions
             calculateLensPath={memoizedCalculateLensPath}
             calculateQuadrantPath={memoizedCalculateQuadrantPath}
             calculateDiamondPath={memoizedCalculateDiamondPath}
             // Pass the correctly bound connector path function
             getHorizontalConnectorPath={memoizedGetHorizontalConnectorPath}
         />
      </div>

    </div>
  );
};

export default SegmentedDisplayGrid; 