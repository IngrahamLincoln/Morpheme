// SegmentedDisplayControls.tsx
import React from 'react';
import type { SegmentedDisplayControlsProps } from './segmentedDisplayTypes';

const SegmentedDisplayControls: React.FC<SegmentedDisplayControlsProps> = ({
  rows,
  cols,
  showLabels, toggleLabels,
  useColors, toggleColors,
  showOutlines, toggleShowOutlines,
  isAddOnlyMode, toggleAddOnlyMode,
  showInactiveDotGrid, toggleInactiveDotGrid,
  scale, setScale, resetScale,
  adjacencyListOutput, adjacencyListInput, setAdjacencyListInput,
  handleSave, handleLoad,
  clearAllSegments, activateAllSegments,
  effectiveOuterRadius, effectiveInnerRadius, effectiveSpacing
}) => {
  return (
    <div>
      {/* Display Settings */}
      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <h2 className="text-lg font-semibold mr-4">Display Options:</h2>
        <div className="flex items-center gap-2">
          <label className="font-medium">Labels:</label>
          <button className={`px-3 py-1 rounded text-sm ${showLabels ? 'bg-blue-500 text-white' : 'bg-gray-200'}`} onClick={toggleLabels}>
            {showLabels ? 'On' : 'Off'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="font-medium">Colors:</label>
          <button className={`px-3 py-1 rounded text-sm ${useColors ? 'bg-blue-500 text-white' : 'bg-gray-200'}`} onClick={toggleColors}>
            {useColors ? 'On' : 'Off'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="font-medium">Outlines:</label>
          <button className={`px-3 py-1 rounded text-sm ${showOutlines ? 'bg-blue-500 text-white' : 'bg-gray-200'}`} onClick={toggleShowOutlines}>
            {showOutlines ? 'On' : 'Off'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="font-medium">Dot Grid:</label>
          <button className={`px-3 py-1 rounded text-sm ${showInactiveDotGrid ? 'bg-purple-500 text-white' : 'bg-gray-200'}`} onClick={toggleInactiveDotGrid}>
            {showInactiveDotGrid ? 'On' : 'Off'}
          </button>
        </div>
         <div className="flex items-center gap-2">
          <label className="font-medium">Add Only:</label>
          <button className={`px-3 py-1 rounded text-sm ${isAddOnlyMode ? 'bg-green-500 text-white' : 'bg-gray-200'}`} onClick={toggleAddOnlyMode}>
            {isAddOnlyMode ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Save/Load UI */}
      <div className="my-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Save Area */}
        <div>
          <button className="mb-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm" onClick={handleSave}>
            Save Current State
          </button>
          <textarea readOnly value={adjacencyListOutput} placeholder="Click 'Save' to generate JSON..."
            className="w-full h-40 p-2 border rounded bg-gray-100 font-mono text-xs" />
        </div>
        {/* Load Area */}
        <div>
          <button className="mb-2 px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50 text-sm" onClick={handleLoad} disabled={!adjacencyListInput.trim()}>
            Load State from Input
          </button>
          <textarea value={adjacencyListInput} onChange={(e) => setAdjacencyListInput(e.target.value)} placeholder="Paste JSON here and click 'Load'..."
            className="w-full h-40 p-2 border rounded font-mono text-xs" />
        </div>
      </div>

       {/* Action Buttons */}
      <div className="mt-4 mb-4 flex gap-2">
        <button className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm" onClick={clearAllSegments}>
          Clear All
        </button>
        <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm" onClick={activateAllSegments}>
          Activate All (Visual)
        </button>
      </div>

      {/* Parameter Controls */}
      <div className="mt-6 p-4 border rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">Adjust Parameters</h2>
        <div className="grid gap-4">
          {/* Scale Slider */}
          <div>
            <label className="block mb-1 font-medium">Scale: {scale.toFixed(2)}x</label>
            <div className="flex items-center gap-2">
              <input type="range" min="0.2" max="2.0" step="0.05" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-full" />
              <input type="number" min="0.2" max="2.0" step="0.05" value={scale} onChange={(e) => { const v = parseFloat(e.target.value)||0.2; setScale(Math.min(2.0, Math.max(0.2, v))); }} className="w-20 p-1 border rounded text-sm" />
              <button className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400 text-sm" onClick={resetScale}> Reset </button>
            </div>
          </div>
          {/* Effective Dimensions Display */}
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
            <span>Outer Radius: <strong className="font-mono">{effectiveOuterRadius.toFixed(1)}px</strong></span>
            <span>Inner Radius: <strong className="font-mono">{effectiveInnerRadius.toFixed(1)}px</strong></span>
            <span>Spacing: <strong className="font-mono">{effectiveSpacing.toFixed(1)}px</strong></span>
            <span>Thickness: <strong className="font-mono">{(effectiveOuterRadius - effectiveInnerRadius).toFixed(1)}px</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SegmentedDisplayControls; 