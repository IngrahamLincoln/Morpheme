import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import GridViewer, { AdjacencyListData } from './GridViewer';
import GridScene from './GridScene';

// Placeholder sample grid data
const samplePattern1: AdjacencyListData = {
  gridWidth: 10,
  gridHeight: 10,
  nodes: [
    {x: 1, y: 1}, {x: 2, y: 2}, {x: 3, y: 3}, {x: 4, y: 4}, {x: 5, y: 5},
    {x: 1, y: 5}, {x: 2, y: 4}, {x: 3, y: 3}, {x: 4, y: 2}, {x: 5, y: 1}
  ],
  edges: [
    {type: 'diag_tl_br', x: 1, y: 1},
    {type: 'diag_bl_tr', x: 1, y: 4},
    {type: 'cmd_horiz', x: 1, y: 3}
  ]
};

const samplePattern2: AdjacencyListData = {
  gridWidth: 6,
  gridHeight: 6,
  nodes: [
    {x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 1},
    {x: 4, y: 4}, {x: 5, y: 4}, {x: 4, y: 5}, {x: 5, y: 5}
  ],
  edges: [
    {type: 'cmd_horiz', x: 0, y: 0},
    {type: 'cmd_horiz', x: 4, y: 4}
  ]
};

const AppController: React.FC = () => {
  const [activePattern, setActivePattern] = useState<AdjacencyListData | null>(null);
  const [visualScale, setVisualScale] = useState<number>(1.0);
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [showInactiveCircles, setShowInactiveCircles] = useState<boolean>(false);
  const [controlsEnabled, setControlsEnabled] = useState<boolean>(true);
  const controlPanelRef = useRef<HTMLDivElement>(null);

  // Load initial pattern on mount
  useEffect(() => {
    setActivePattern(samplePattern1);
  }, []);

  // Disable OrbitControls when hovering over control panel
  useEffect(() => {
    const controlPanel = controlPanelRef.current;
    if (!controlPanel) return;
    
    const handleMouseEnter = () => {
      setControlsEnabled(false);
    };
    
    const handleMouseLeave = () => {
      setControlsEnabled(true);
    };
    
    controlPanel.addEventListener('mouseenter', handleMouseEnter);
    controlPanel.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      controlPanel.removeEventListener('mouseenter', handleMouseEnter);
      controlPanel.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Handler for loading pattern from file
  const loadPatternFromFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const jsonContent = e.target?.result as string;
            const parsedData: AdjacencyListData = JSON.parse(jsonContent);
            // Basic validation
            if (parsedData && typeof parsedData.gridWidth === 'number' && Array.isArray(parsedData.nodes)) {
              setActivePattern(parsedData);
            } else {
              alert('Invalid grid data file.');
            }
          } catch (err) {
            console.error("Error parsing JSON:", err);
            alert('Failed to read or parse the file.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      {/* Control Panel */}
      <div 
        ref={controlPanelRef}
        className="control-panel" 
        style={{ 
          padding: '10px', 
          background: '#eee', 
          borderBottom: '1px solid #ccc',
          position: 'relative',
          zIndex: 10
        }}
      >
        <button 
          onClick={() => setShowEditor(!showEditor)} 
          style={{ marginRight: '20px' }}
        >
          {showEditor ? 'Show Viewer' : 'Show Editor'}
        </button>

        {/* Viewer Controls (only show if viewer is active) */}
        {!showEditor && (
          <>
            <button 
              onClick={() => setActivePattern(samplePattern1)}
              style={{ marginRight: '10px' }}
            >
              Load Pattern 1
            </button>
            
            <button 
              onClick={() => setActivePattern(samplePattern2)}
              style={{ marginRight: '10px' }}
            >
              Load Pattern 2
            </button>
            
            <button 
              onClick={loadPatternFromFile}
              style={{ marginRight: '10px' }}
            >
              Load From File...
            </button>
            
            <button 
              onClick={() => setActivePattern(null)}
              style={{ marginRight: '20px' }}
            >
              Clear Viewer
            </button>
            
            <label style={{ marginRight: '20px' }}>
              Visual Scale:
              <input
                type="range"
                min="0.2" max="3" step="0.1"
                value={visualScale}
                onChange={(e) => setVisualScale(parseFloat(e.target.value))}
                style={{ marginLeft: '5px', verticalAlign: 'middle' }}
              />
              ({visualScale.toFixed(1)})
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={showInactiveCircles}
                onChange={() => setShowInactiveCircles(!showInactiveCircles)}
                style={{ marginRight: '5px' }}
              />
              Show Inactive Circles
            </label>
          </>
        )}
      </div>

      {/* Canvas Area */}
      <div className="canvas-container" style={{ 
        flexGrow: 1, 
        background: '#f8f8f8',
        position: 'relative',
        zIndex: 1
      }}>
        <Canvas
          className="react-three-fiber"
          orthographic
          camera={{ zoom: 50, position: [0, 0, 10] }}
          key={showEditor ? 'editor-canvas' : 'viewer-canvas'}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.7} />
          <pointLight position={[0, 0, 5]} intensity={0.5} />

          {/* Conditional Rendering based on mode */}
          {showEditor ? (
            <Suspense fallback={null}>
              <GridScene />
            </Suspense>
          ) : (
            <Suspense fallback={null}>
              <GridViewer 
                data={activePattern} 
                visualScale={visualScale} 
                showInactiveCircles={showInactiveCircles}
              />
            </Suspense>
          )}

          {/* Camera controls with dynamic enabling/disabling */}
          <OrbitControls 
            enableRotate={false} 
            enablePan={controlsEnabled} 
            enableZoom={controlsEnabled}
          />
        </Canvas>
      </div>
    </div>
  );
};

export default AppController; 