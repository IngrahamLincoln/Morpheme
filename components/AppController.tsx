import React, { useState, useEffect, Suspense } from 'react';
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

  // Load initial pattern on mount
  useEffect(() => {
    setActivePattern(samplePattern1);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Control Panel */}
      <div style={{ padding: '10px', background: '#eee', borderBottom: '1px solid #ccc' }}>
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
            
            <label>
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
          </>
        )}
      </div>

      {/* Canvas Area */}
      <div style={{ flexGrow: 1, background: '#f8f8f8' }}>
        <Canvas
          orthographic
          camera={{ zoom: 50, position: [0, 0, 10] }}
          key={showEditor ? 'editor-canvas' : 'viewer-canvas'}
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
              <GridViewer data={activePattern} visualScale={visualScale} />
            </Suspense>
          )}

          {/* Camera controls for navigation */}
          <OrbitControls enableRotate={false} enablePan={true} enableZoom={true} />
        </Canvas>
      </div>
    </div>
  );
};

export default AppController; 