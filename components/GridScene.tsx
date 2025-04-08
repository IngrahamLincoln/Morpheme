import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useControls, button, folder } from 'leva';
import { useFrame } from '@react-three/fiber';
import CircleMaterial from './CircleMaterial';
import ConnectorMaterial from './ConnectorMaterial';
import CmdHorizConnectorMaterial from './CmdHorizConnectorMaterial';
// Stats import commented out - not critical for functionality
// import Stats from 'three/addons/libs/stats.module';
import { 
  FIXED_SPACING, 
  BASE_RADIUS_A, 
  BASE_RADIUS_B,
  CONNECTOR_NONE,
  CONNECTOR_DIAG_TL_BR,
  CONNECTOR_DIAG_BL_TR,
  CONNECTOR_HORIZ_T,
  CONNECTOR_HORIZ_B,
  CONNECTOR_HORIZ_CMD
} from './constants';

// === Feature 1: Grid Data & Configuration ===

// Constants for base geometry - REMOVED, now imported
// const BASE_RADIUS_A = 0.5; // Outer radius
// const BASE_RADIUS_B = 0.4; // Inner radius
// const FIXED_SPACING = BASE_RADIUS_A + BASE_RADIUS_B; // 0.9

const BASE_GRID_SPACING = 1.0; // Keep for reference if needed

// Helper Functions
const getIndex = (row: number, col: number, gridWidth: number): number => {
  return row * gridWidth + col;
};

const getCoords = (index: number, gridWidth: number): { row: number; col: number } => {
  const row = Math.floor(index / gridWidth);
  const col = index % gridWidth;
  return { row, col };
};

// Modified to use fixed spacing
const getCenterOffset = (gridWidth: number, gridHeight: number, spacing: number): THREE.Vector2 => {
  const totalWidth = (gridWidth - 1) * spacing;
  const totalHeight = (gridHeight - 1) * spacing;
  return new THREE.Vector2(-totalWidth / 2, -totalHeight / 2);
};

// Modified to use fixed spacing
const getWorldPosition = (
  row: number,
  col: number,
  gridWidth: number, // Keep grid dimensions for offset calculation if needed
  gridHeight: number,
  spacing: number, // This will be FIXED_SPACING
  centerOffset: THREE.Vector2
): { x: number; y: number } => {
  const x = col * spacing + centerOffset.x;
  const y = row * spacing + centerOffset.y;
  return { x, y };
};

// === GridScene Component ===

// Dummy object for matrix calculations
const dummy = new THREE.Object3D();
const tempMatrix = new THREE.Matrix4();
const tempVec = new THREE.Vector3();

// New: Helper for horizontal cmd-click connector key generation
const getHorizCmdConnectorKey = (x: number, y: number) => `hcmd:${x},${y}`;

// Helper to get the key for a 2x2 cell group
const getCellGroupKey = (cellX: number, cellY: number) => `${cellX},${cellY}`;

// --- Adjacency List Structure Definition ---
interface GridNode {
  x: number;
  y: number;
}

interface GridEdge {
  type: 'diag_tl_br' | 'diag_bl_tr' | 'horiz_t' | 'horiz_b' | 'cmd_horiz';
  x: number; // x-coord of the origin cell/circle for the connector
  y: number; // y-coord of the origin cell/circle for the connector
}

interface AdjacencyListData {
  gridWidth: number;
  gridHeight: number;
  nodes: GridNode[];
  edges: GridEdge[];
}
// --- End Adjacency List Structure ---

const GridScene = () => {
  // Get the set function directly from useControls
  const [controls, setLevaControl] = useControls('Grid', () => ({
    GRID_WIDTH: { value: 10, min: 2, max: 100, step: 1 },
    GRID_HEIGHT: { value: 10, min: 2, max: 100, step: 1 },
    visualScale: {
      value: 1.0,
      min: 0.1,
      max: 5,
      step: 0.1,
      label: 'Visual Scale'
    },
    // Use button functions that don't reference the component functions directly
    'Save/Load': folder({
        saveState: button(() => { 
          console.log("Save button clicked");
          
          // Get the CURRENT state at the moment the button is clicked
          const currentControls = { ...controls }; // Make a fresh copy of the controls object
          console.log(`Current controls dimensions: ${currentControls.GRID_WIDTH}x${currentControls.GRID_HEIGHT}`);
          
          // Get the current activation state directly from the buffer attribute
          let currentActivation: Float32Array;
          if (activationAttributeRef.current && activationAttributeRef.current.array) {
            currentActivation = activationAttributeRef.current.array as Float32Array;
            console.log("- Using activation state from buffer attribute");
          } else {
            currentActivation = activationState;
            console.log("- Using activation state from React state (fallback)");
          }
          
          // Use the ref values which should have the most up-to-date state
          const currentIntendedConnectors = JSON.parse(JSON.stringify(intendedConnectorsRef.current || {}));
          const currentCmdHorizConnectors = JSON.parse(JSON.stringify(cmdHorizConnectorsRef.current || {}));
          
          console.log("Ref values for connectors:", {
            intended: currentIntendedConnectors,
            cmdHoriz: currentCmdHorizConnectors
          });
          
          // Save using direct values with current dimensions
          saveGridStateWithDirectValues(
            currentActivation,
            currentIntendedConnectors,
            currentCmdHorizConnectors,
            currentControls.GRID_WIDTH,
            currentControls.GRID_HEIGHT
          );
        }),
        loadState: button(() => { 
          console.log("Load requested");
          const jsonInput = prompt("Paste Grid State JSON:");
          if (!jsonInput) {
              console.log("Load cancelled.");
              return;
          }
          
          try {
              const data: AdjacencyListData = JSON.parse(jsonInput);
              console.log("Parsed JSON data:", data);
              
              // Instead of calling the loadGridState function, process the data directly
              // Validate basic structure
              if (
                  typeof data.gridWidth !== 'number' ||
                  typeof data.gridHeight !== 'number' ||
                  !Array.isArray(data.nodes) ||
                  !Array.isArray(data.edges)
              ) {
                  throw new Error("Invalid JSON structure.");
              }

              console.log("Grid dimensions to be set:", data.gridWidth, "x", data.gridHeight);
              console.log("Nodes to load:", data.nodes.length);
              console.log("Edges to load:", data.edges.length);

              // --- Use the captured setLevaControl function ---
              setLevaControl({ GRID_WIDTH: data.gridWidth, GRID_HEIGHT: data.gridHeight });

              // --- Process Nodes and Edges ---
              setTimeout(() => {
                  // Use data.gridWidth/Height here as controls might not have updated yet
                  const newTotalCircles = data.gridWidth * data.gridHeight;
                  const newActivationState = new Float32Array(newTotalCircles).fill(0.0);
                  
                  console.log("Setting active nodes...");
                  data.nodes.forEach(node => {
                      if (node.x >= 0 && node.x < data.gridWidth && node.y >= 0 && node.y < data.gridHeight) {
                          const index = getIndex(node.y, node.x, data.gridWidth);
                          newActivationState[index] = 1.0;
                          console.log(`Activating node at (${node.x}, ${node.y}), index: ${index}`);
                      } else {
                          console.warn(`Node out of bounds ignored: (${node.x}, ${node.y})`);
                      }
                  });

                  const newIntendedConnectors: Record<string, number> = {};
                  const newCmdHorizConnectors: Record<string, number> = {};

                  console.log("Processing edges...");
                  data.edges.forEach(edge => {
                       console.log("Processing edge:", edge);
                       let connectorType: number = CONNECTOR_NONE;
                       let isValid = false;

                       switch (edge.type) {
                          case 'diag_tl_br':
                              connectorType = CONNECTOR_DIAG_TL_BR;
                              isValid = edge.x >= 0 && edge.x < data.gridWidth - 1 && edge.y >= 0 && edge.y < data.gridHeight - 1;
                              break;
                          case 'diag_bl_tr':
                              connectorType = CONNECTOR_DIAG_BL_TR;
                              isValid = edge.x >= 0 && edge.x < data.gridWidth - 1 && edge.y >= 0 && edge.y < data.gridHeight - 1;
                              break;
                          case 'horiz_t':
                              connectorType = CONNECTOR_HORIZ_T;
                              isValid = edge.x >= 0 && edge.x < data.gridWidth - 1 && edge.y >= 0 && edge.y < data.gridHeight - 1;
                              break;
                          case 'horiz_b':
                              connectorType = CONNECTOR_HORIZ_B;
                              isValid = edge.x >= 0 && edge.x < data.gridWidth - 1 && edge.y >= 0 && edge.y < data.gridHeight - 1;
                              break;
                          case 'cmd_horiz':
                              // This type updates a different state object
                              isValid = edge.x >= 0 && edge.x < data.gridWidth - 1 && edge.y >= 0 && edge.y < data.gridHeight;
                              if (isValid) {
                                  const key = getHorizCmdConnectorKey(edge.x, edge.y);
                                  newCmdHorizConnectors[key] = 1;
                                  console.log(`Added cmd_horiz connector at (${edge.x}, ${edge.y}) with key ${key}`);
                              }
                              break;
                          default:
                              console.warn(`Unknown edge type ignored: ${edge.type}`);
                       }

                       // Assign to intendedConnectors *after* the switch, if valid and applicable
                       if (isValid && edge.type !== 'cmd_horiz' && connectorType !== CONNECTOR_NONE) {
                            const key = getCellGroupKey(edge.x, edge.y);
                            newIntendedConnectors[key] = connectorType;
                            console.log(`Added ${edge.type} connector at (${edge.x}, ${edge.y}) with key ${key} and type value ${connectorType}`);
                       }

                       if (!isValid) {
                           console.warn(`Edge out of bounds or invalid ignored:`, edge);
                       }
                  });

                  console.log("Setting activation state with", Object.values(newActivationState).filter(v => v === 1.0).length, "active nodes");
                  setActivationState(newActivationState);
                  
                  console.log("Setting intended connectors:", Object.keys(newIntendedConnectors).length, "connectors");
                  setIntendedConnectors(newIntendedConnectors);
                  // Update the ref as well
                  intendedConnectorsRef.current = { ...newIntendedConnectors };
                  
                  console.log("Setting cmd-horiz connectors:", Object.keys(newCmdHorizConnectors).length, "connectors");
                  setCmdHorizConnectors(newCmdHorizConnectors);
                  // Update the ref as well
                  cmdHorizConnectorsRef.current = { ...newCmdHorizConnectors };

                  console.log("Grid state loaded successfully.");
                  
                  // Verify the loaded state after a short delay
                  setTimeout(() => {
                      console.log("Verification of loaded state:");
                      console.log("- Active nodes:", Object.values(activationState).filter(v => v === 1.0).length);
                      console.log("- Intended connectors:", Object.entries(intendedConnectors).filter(([_, v]) => v !== CONNECTOR_NONE).length);
                      console.log("- Cmd-horiz connectors:", Object.entries(cmdHorizConnectors).filter(([_, v]) => v === 1).length);
                  }, 200);
              }, 100);
          } catch (error) {
              console.error("Failed to parse or process JSON:", error);
              alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
          }
        })
    })
  }));

  // Derived values calculation - use 'controls' now
  const { TOTAL_CIRCLES, centerOffset, planeWidth, planeHeight } = useMemo(() => {
      const total = controls.GRID_WIDTH * controls.GRID_HEIGHT;
      const offset = getCenterOffset(controls.GRID_WIDTH, controls.GRID_HEIGHT, FIXED_SPACING);
      const width = (controls.GRID_WIDTH > 1 ? (controls.GRID_WIDTH - 1) * FIXED_SPACING : 0) + (controls.visualScale * BASE_RADIUS_A * 2);
      const height = (controls.GRID_HEIGHT > 1 ? (controls.GRID_HEIGHT - 1) * FIXED_SPACING : 0) + (controls.visualScale * BASE_RADIUS_A * 2);
      return { TOTAL_CIRCLES: total, centerOffset: offset, planeWidth: width, planeHeight: height };
  }, [controls.GRID_WIDTH, controls.GRID_HEIGHT, controls.visualScale]); // Update dependencies

  // Refs for mesh and material
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<any>(null!); // Use 'any' or specific type for CircleMaterial
  const activationAttributeRef = useRef<THREE.InstancedBufferAttribute>(null!);
  const connectorMaterialRef = useRef<any>(null!); // Ref for connector material
  const cmdHorizMaterialRef = useRef<any>(null);
  
  // Refs to track current state
  const intendedConnectorsRef = useRef<Record<string, number>>({});
  const cmdHorizConnectorsRef = useRef<Record<string, number>>({});

  // === Feature 3: Circle Activation State ===
  const [activationState, setActivationState] = useState<Float32Array>(() => 
    new Float32Array(TOTAL_CIRCLES).fill(0.0) // 0.0 inactive, 1.0 active
  );

  // New: Add horizontal cmd-click connector state
  const [cmdHorizConnectors, setCmdHorizConnectors] = useState<Record<string, number>>({});

  // === Feature 8: Connector Interaction State and Helpers (Moved UP) ===
  const [intendedConnectors, setIntendedConnectors] = useState<Record<string, number>>({});

  // Helper to get the intended connector for a 2x2 cell group (Moved UP)
  const getIntendedConnector = useCallback((cellX: number, cellY: number) => {
    if (cellX < 0 || cellX >= controls.GRID_WIDTH - 1 || cellY < 0 || cellY >= controls.GRID_HEIGHT - 1) {
        return CONNECTOR_NONE;
    }
    const key = getCellGroupKey(cellX, cellY);
    return intendedConnectors[key] || CONNECTOR_NONE;
  }, [intendedConnectors, controls.GRID_WIDTH, controls.GRID_HEIGHT]);

  // State needs to be reset if TOTAL_CIRCLES changes
  useEffect(() => {
    console.log('Resetting activation state due to grid size change');
    setActivationState(new Float32Array(TOTAL_CIRCLES).fill(0.0));
    setIntendedConnectors({}); // Also reset intended connectors
    setCmdHorizConnectors({}); // Also reset cmd-horiz connectors
    
    // Also reset the refs
    intendedConnectorsRef.current = {};
    cmdHorizConnectorsRef.current = {};
  }, [TOTAL_CIRCLES]);

  // Update buffer attribute when state changes
  useEffect(() => {
    if (activationAttributeRef.current) {
      activationAttributeRef.current.array = activationState;
      activationAttributeRef.current.needsUpdate = true;
      // console.log('Updated activation buffer attribute.'); // Less noisy log
    }
  }, [activationState]);

  // === Feature 2: Static Circle Rendering ===
  useEffect(() => {
    if (!meshRef.current) return;

    // Calculate and set instance matrices
    for (let index = 0; index < TOTAL_CIRCLES; index++) {
      const { row, col } = getCoords(index, controls.GRID_WIDTH);
      const { x, y } = getWorldPosition(
        row,
        col,
        controls.GRID_WIDTH,
        controls.GRID_HEIGHT,
        FIXED_SPACING,
        centerOffset
      );
      dummy.position.set(x, y, 0); // Z=0 for circles
       // Retrieve existing scale/rotation before setting position to avoid overwriting scale effect
      const currentMatrix = new THREE.Matrix4();
      meshRef.current.getMatrixAt(index, currentMatrix);
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scaleVec = new THREE.Vector3();
      currentMatrix.decompose(position, quaternion, scaleVec);
      // Update only position
      position.set(x, y, 0);
      dummy.matrix.compose(position, quaternion, scaleVec); // Recompose with original scale/rotation
      meshRef.current.setMatrixAt(index, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // console.log(`Updated ${TOTAL_CIRCLES} instance matrices (position).`);

  }, [controls.GRID_WIDTH, controls.GRID_HEIGHT, FIXED_SPACING, TOTAL_CIRCLES, centerOffset]);

  // Update shader uniforms when scaled radii change
  useEffect(() => {
    if (materialRef.current) {
      // Shader expects radii relative to plane size (0.0 to 0.5 range if plane is size 1)
      // Let's use plane size 1 and scale radii to 0.0-0.5 range for shader.
      materialRef.current.uniforms.u_radiusA.value = BASE_RADIUS_A; // Use base radius relative to plane size 1
      materialRef.current.uniforms.u_radiusB.value = BASE_RADIUS_B; // Use base radius relative to plane size 1
      // Scale the whole instance instead to match spacing
       console.log(`Updated material radii uniforms: A=${BASE_RADIUS_A}, B=${BASE_RADIUS_B}`);
    }
  }, []); // Depend on scaled radii, though using base for uniform now

 // Adjust instance scale based on spacing
 useEffect(() => {
  if (!meshRef.current) return;
  const scale = controls.visualScale; // Use the leva control value for scale
  console.log(`Updating instance scales to: ${scale.toFixed(2)}`);
  for (let index = 0; index < TOTAL_CIRCLES; index++) {
      meshRef.current.getMatrixAt(index, tempMatrix);
      const position = tempVec.setFromMatrixPosition(tempMatrix);
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(tempMatrix);
      // Update only scale
      const scaleVec = new THREE.Vector3().set(scale, scale, 1);
      
      tempMatrix.compose(position, quaternion, scaleVec);
      meshRef.current.setMatrixAt(index, tempMatrix);
  }
  meshRef.current.instanceMatrix.needsUpdate = true;
}, [controls.visualScale, TOTAL_CIRCLES]); // Depends on scale control and count

  // === Feature 4: Circle Interaction (Now uses helpers defined above) ===
  const handleCircleClick = useCallback((event: any) => {
    event.stopPropagation();
    if (event.instanceId === undefined || !meshRef.current) return;

    const index = event.instanceId;
    const { row: y, col: x } = getCoords(index, controls.GRID_WIDTH);
    
    console.log('Circle clicked:', {
      index,
      x, y,
      isCmdClick: event.metaKey || event.ctrlKey,
      point: event.point,
      currentState: activationState[index]
    });

    // Get the center of the clicked instance
    meshRef.current.getMatrixAt(index, tempMatrix);
    const instanceCenter = tempVec.setFromMatrixPosition(tempMatrix);

    // Calculate distance from click point to instance center
    const distFromCenter = event.point.distanceTo(instanceCenter);

    // Get the CURRENT world-space inner radius
    const currentInnerRadius = BASE_RADIUS_B * controls.visualScale; 

    console.log('Click details:', {
      distFromCenter,
      currentInnerRadius,
      isInside: distFromCenter <= currentInnerRadius
    });

    // Check if click is inside the inner circle
    if (distFromCenter <= currentInnerRadius) {
      // Check if this is a cmd/ctrl click
      if (event.metaKey || event.ctrlKey) {
        // Check conditions for horizontal connector
        const rightIndex = getIndex(y, x + 1, controls.GRID_WIDTH);
        const canConnectBase = x < controls.GRID_WIDTH - 1 && 
                               activationState[index] === 1.0 && 
                               activationState[rightIndex] === 1.0;

        // --- NEW: Check for blocking diagonal connectors ---
        const connectorBelow = getIntendedConnector(x, y - 1);
        const connectorAdjacent = getIntendedConnector(x, y);
        const isBlockedByDiagonal = 
          (connectorBelow === CONNECTOR_DIAG_TL_BR || connectorBelow === CONNECTOR_DIAG_BL_TR) ||
          (connectorAdjacent === CONNECTOR_DIAG_TL_BR || connectorAdjacent === CONNECTOR_DIAG_BL_TR);
        // --- End NEW check ---

        console.log('Processing cmd-click on circle:', {
          x, y,
          rightIndex,
          leftActive: activationState[index] === 1.0,
          rightActive: x < controls.GRID_WIDTH - 1 ? activationState[rightIndex] === 1.0 : false,
          canConnectBase,
          isBlockedByDiagonal, // Log the blocking status
          connectorBelow,
          connectorAdjacent
        });

        // Only allow toggle if base conditions met AND not blocked by diagonal
        if (canConnectBase && !isBlockedByDiagonal) { 
          const connectorKey = getHorizCmdConnectorKey(x, y);
          console.log('Toggling horizontal connector (allowed):', { key: connectorKey });
          
          setCmdHorizConnectors(prev => {
            const newValue = prev[connectorKey] ? 0 : 1;
            const newState = { ...prev, [connectorKey]: newValue };
            
            // Update the ref to track the latest state
            cmdHorizConnectorsRef.current = newState;
            
            console.log('Updated cmd-horiz connector state:', { 
              key: connectorKey, 
              newValue, 
              allConnectors: newState,
              keys: Object.keys(newState),
              activeConnectors: Object.entries(newState).filter(([_, v]) => v === 1)
            });
            return newState;
          });
          
          return; // Exit after handling cmd-click
        } else {
           console.log('Cmd-click horizontal connector blocked or base conditions not met.');
        }
        // If blocked or can't connect, fall through to regular click? 
        // Or maybe do nothing on cmd-click if blocked? Let's do nothing for now.
        return; // Explicitly do nothing more if cmd-click was blocked or invalid
      }

      // Regular click behavior (toggle activation) - only runs if not a handled cmd-click
      console.log('Toggling circle activation (regular click)');
      setActivationState(current => {
        const newState = new Float32Array(current);
        newState[index] = newState[index] === 1.0 ? 0.0 : 1.0;
        console.log('New activation state for circle:', {
          index,
          oldValue: current[index],
          newValue: newState[index]
        });
        return newState;
      });
    }
  }, [meshRef, setActivationState, controls.GRID_WIDTH, controls.visualScale, setCmdHorizConnectors, cmdHorizConnectors, intendedConnectors, controls.GRID_HEIGHT]); // Dependencies are correct now

  // === Feature 5: State Data Texture ===
  const stateTexture = useMemo(() => {
    console.log(`Creating state texture: ${controls.GRID_WIDTH}x${controls.GRID_HEIGHT}`);
    const texture = new THREE.DataTexture(
      new Float32Array(TOTAL_CIRCLES).fill(0.0), // Initial data buffer
      controls.GRID_WIDTH,
      controls.GRID_HEIGHT,
      THREE.RedFormat, // Store activation (0.0 or 1.0) in Red channel
      THREE.FloatType
    );
    texture.minFilter = THREE.NearestFilter; // Crucial: No interpolation
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true; // Initial update needed
    return texture;
  }, [controls.GRID_WIDTH, controls.GRID_HEIGHT, TOTAL_CIRCLES]); // Recreate texture if grid dimensions change

  // Update texture data when activationState changes
  useEffect(() => {
    if (stateTexture && activationState.length === stateTexture.image.data.length) {
      stateTexture.image.data.set(activationState); // Update texture data directly
      stateTexture.needsUpdate = true; // Mark for GPU upload
      console.log('Updated state texture data.');
    } else {
      console.warn('Skipping texture update: Mismatch between state array and texture size or texture not ready.');
    }
  }, [activationState, stateTexture]); // Depend on activation state and the texture itself

  // === Feature 8: Connector Plane Interaction (Moved DOWN, uses helpers defined above) ===
  const handleConnectorClick = useCallback((event: any) => {
    event.stopPropagation();
    console.log('Connector plane clicked:', {
      point: event.point,
      isCmdClick: event.metaKey || event.ctrlKey
    });
    
    // Get the click point in world space
    const clickPoint = event.point;
    
    // First, check if the click is on a circle
    // Determine which grid cell this point is closest to
    const gridX = Math.round((clickPoint.x - centerOffset.x) / FIXED_SPACING);
    const gridY = Math.round((clickPoint.y - centerOffset.y) / FIXED_SPACING);
    
    // Check if this cell is within grid bounds
    if (gridX >= 0 && gridX < controls.GRID_WIDTH && gridY >= 0 && gridY < controls.GRID_HEIGHT) {
      // Calculate the cell center in world space
      const cellCenter = getWorldPosition(gridY, gridX, controls.GRID_WIDTH, controls.GRID_HEIGHT, FIXED_SPACING, centerOffset);
      
      // Calculate distance from click to cell center
      const distFromCenter = Math.sqrt(
        Math.pow(clickPoint.x - cellCenter.x, 2) + 
        Math.pow(clickPoint.y - cellCenter.y, 2)
      );
      
      // Check if click is inside the inner circle
      const currentInnerRadius = BASE_RADIUS_B * controls.visualScale;
      if (distFromCenter <= currentInnerRadius) {
        // This is a click on a circle - toggle its activation state
        const index = getIndex(gridY, gridX, controls.GRID_WIDTH);

        // If this is a cmd/ctrl click and there's an active circle to the right
        if ((event.metaKey || event.ctrlKey) && gridX < controls.GRID_WIDTH - 1) {
          const rightIndex = getIndex(gridY, gridX + 1, controls.GRID_WIDTH);
          const leftActive = activationState[index] === 1.0;
          const rightActive = activationState[rightIndex] === 1.0;
          const canConnectBase = leftActive && rightActive;

          // --- NEW: Check for blocking diagonal connectors ---
          const connectorBelow = getIntendedConnector(gridX, gridY - 1);
          const connectorAdjacent = getIntendedConnector(gridX, gridY);
          const isBlockedByDiagonal = 
            (connectorBelow === CONNECTOR_DIAG_TL_BR || connectorBelow === CONNECTOR_DIAG_BL_TR) ||
            (connectorAdjacent === CONNECTOR_DIAG_TL_BR || connectorAdjacent === CONNECTOR_DIAG_BL_TR);
          // --- End NEW check ---

          console.log('Processing cmd-click (via plane on circle):', {
            x: gridX, y: gridY,
            leftActive, rightActive,
            canConnectBase, isBlockedByDiagonal,
            connectorBelow, connectorAdjacent
          });

          // Only allow toggle if base conditions met AND not blocked by diagonal
          if (canConnectBase && !isBlockedByDiagonal) {
            const connectorKey = getHorizCmdConnectorKey(gridX, gridY);
            console.log('Toggling cmd-horiz connector (allowed):', { key: connectorKey });
            setCmdHorizConnectors(prev => {
              const newConnectors = { ...prev };
              newConnectors[connectorKey] = prev[connectorKey] ? 0 : 1;
              
              // Update the ref to track the latest state
              cmdHorizConnectorsRef.current = newConnectors;
              
              console.log('Updated cmd-horiz connector state (via plane):', { 
                key: connectorKey, 
                newValue: newConnectors[connectorKey], 
                allConnectors: newConnectors,
                keys: Object.keys(newConnectors),
                activeConnectors: Object.entries(newConnectors).filter(([_, v]) => v === 1)
              });
              return newConnectors;
            });
            return; // Exit after handling cmd-click
          } else {
             console.log('Cmd-click horizontal connector blocked or base conditions not met.');
          }
          // If blocked or can't connect, fall through to regular click? Let's do nothing more.
          return; // Explicitly do nothing more if cmd-click was blocked or invalid
        }

        // Regular click behavior (toggle activation) - only runs if not a handled cmd-click
        console.log('Toggling circle activation (regular click on plane)');
        setActivationState(current => {
          const newState = new Float32Array(current);
          newState[index] = newState[index] === 1.0 ? 0.0 : 1.0;
          return newState;
        });
        console.log(`Toggling circle at (${gridX},${gridY})`);
        return;
      }
    }
    
    // If we get here, the click wasn't on a circle, so treat it as a connector click
    // Determine which grid cell (bottom-left of a 2x2 group) this point is closest to
    const groupX = Math.floor((clickPoint.x - centerOffset.x) / FIXED_SPACING);
    const groupY = Math.floor((clickPoint.y - centerOffset.y) / FIXED_SPACING);
    
    // Get the indices of the four cells in the 2x2 group
    const blIndex = getIndex(groupY, groupX, controls.GRID_WIDTH);
    const brIndex = getIndex(groupY, groupX + 1, controls.GRID_WIDTH);
    const tlIndex = getIndex(groupY + 1, groupX, controls.GRID_WIDTH);
    const trIndex = getIndex(groupY + 1, groupX + 1, controls.GRID_WIDTH);
    
    // Check which cells are within grid bounds
    const isValidGroup = 
      groupX >= 0 && groupX < controls.GRID_WIDTH - 1 && 
      groupY >= 0 && groupY < controls.GRID_HEIGHT - 1;
    
    if (!isValidGroup) return;
    
    // Get activation states for the four cells
    const blActive = activationState[blIndex] === 1.0;
    const brActive = activationState[brIndex] === 1.0;
    const tlActive = activationState[tlIndex] === 1.0;
    const trActive = activationState[trIndex] === 1.0;
    
    // Get the world positions of the cell centers
    const blPos = getWorldPosition(groupY, groupX, controls.GRID_WIDTH, controls.GRID_HEIGHT, FIXED_SPACING, centerOffset);
    const brPos = getWorldPosition(groupY, groupX + 1, controls.GRID_WIDTH, controls.GRID_HEIGHT, FIXED_SPACING, centerOffset);
    const tlPos = getWorldPosition(groupY + 1, groupX, controls.GRID_WIDTH, controls.GRID_HEIGHT, FIXED_SPACING, centerOffset);
    const trPos = getWorldPosition(groupY + 1, groupX + 1, controls.GRID_WIDTH, controls.GRID_HEIGHT, FIXED_SPACING, centerOffset);
    
    // Calculate the center of the 2x2 group
    const centerX = (blPos.x + brPos.x + tlPos.x + trPos.x) / 4;
    const centerY = (blPos.y + brPos.y + tlPos.y + trPos.y) / 4;
    
    // Calculate distance from click to center of 2x2 group
    const distToCenter = Math.sqrt(
      Math.pow(clickPoint.x - centerX, 2) + 
      Math.pow(clickPoint.y - centerY, 2)
    );
    
    // Check if the click is in the center zone (30% of cell spacing)
    const isCenterClick = distToCenter < FIXED_SPACING * 0.3 * controls.visualScale;
    
    // Get the possible diagonal connectors
    const canUseDiagTLBR = tlActive && brActive;
    const canUseDiagBLTR = blActive && trActive;
    const hasDiagonalOptions = canUseDiagTLBR || canUseDiagBLTR;
    
    // Get current intended connector
    const currentConnector = getIntendedConnector(groupX, groupY);
    const groupKey = getCellGroupKey(groupX, groupY);
    
    // --- NEW: Check for blocking horizontal connectors ---
    const hasHorizCmdBelow = cmdHorizConnectors[getHorizCmdConnectorKey(groupX, groupY)] === 1;
    const hasHorizCmdAbove = cmdHorizConnectors[getHorizCmdConnectorKey(groupX, groupY + 1)] === 1;
    const isBlockedByHoriz = hasHorizCmdBelow || hasHorizCmdAbove;
    // --- End NEW Check ---

    let newConnector = CONNECTOR_NONE; // Initialize potential new state
    let potentialConnectorType = CONNECTOR_NONE; // Store the type determined by click logic
    
    // If clicked in the center and diagonal connectors are available, cycle through them
    if (isCenterClick && hasDiagonalOptions) {
      if (canUseDiagTLBR && canUseDiagBLTR) {
        // Both diagonals are available, cycle through the options: NONE -> TL-BR -> BL-TR -> NONE
        if (currentConnector === CONNECTOR_NONE) {
          potentialConnectorType = CONNECTOR_DIAG_TL_BR;
        } else if (currentConnector === CONNECTOR_DIAG_TL_BR) {
          potentialConnectorType = CONNECTOR_DIAG_BL_TR;
        } else { // current was BL_TR
          potentialConnectorType = CONNECTOR_NONE;
        }
      } else if (canUseDiagTLBR) {
        // Only TL-BR diagonal is available, toggle it
        potentialConnectorType = currentConnector === CONNECTOR_DIAG_TL_BR ? CONNECTOR_NONE : CONNECTOR_DIAG_TL_BR;
      } else { // Only canUseDiagBLTR
        // Only BL-TR diagonal is available, toggle it
        potentialConnectorType = currentConnector === CONNECTOR_DIAG_BL_TR ? CONNECTOR_NONE : CONNECTOR_DIAG_BL_TR;
      }
    } else if (!isCenterClick) { // Check non-center clicks only if not a center click
      // For clicks outside the center, determine which diagonal was clicked (if any)
      let clickedType = CONNECTOR_NONE;
      
      // Calculate distances from click to each diagonal
      const distToBLTR = Math.abs((clickPoint.x - blPos.x) * (trPos.y - blPos.y) - (clickPoint.y - blPos.y) * (trPos.x - blPos.x)) / 
                        Math.sqrt(Math.pow(trPos.x - blPos.x, 2) + Math.pow(trPos.y - blPos.y, 2));
      const distToTLBR = Math.abs((clickPoint.x - tlPos.x) * (brPos.y - tlPos.y) - (clickPoint.y - tlPos.y) * (brPos.x - tlPos.x)) / 
                        Math.sqrt(Math.pow(brPos.x - tlPos.x, 2) + Math.pow(brPos.y - tlPos.y, 2));
            
      if (distToBLTR < distToTLBR) {
        // Closer to BL-TR diagonal (/)
        if (canUseDiagBLTR) { // Check if possible
          clickedType = CONNECTOR_DIAG_BL_TR;
        }
      } else {
        // Closer to TL-BR diagonal (\)
        if (canUseDiagTLBR) { // Check if possible
          clickedType = CONNECTOR_DIAG_TL_BR;
        }
      }
      
      // Toggle logic - if the clicked connector is already active, turn it off
      // Otherwise, turn on the clicked one
      if (currentConnector === clickedType) {
        potentialConnectorType = CONNECTOR_NONE; // Toggle off
      } else if (clickedType !== CONNECTOR_NONE) {
        potentialConnectorType = clickedType; // Toggle on new connector
      }
    }

    // --- Apply Blocking Logic ---
    if (isBlockedByHoriz && (potentialConnectorType === CONNECTOR_DIAG_TL_BR || potentialConnectorType === CONNECTOR_DIAG_BL_TR)) {
      newConnector = CONNECTOR_NONE; // Force to NONE if blocked by horizontal
      console.log(`Diagonal connector blocked by existing horizontal connector at group (${groupX},${groupY})`);
    } else {
      newConnector = potentialConnectorType; // Otherwise, use the type determined by click logic
    }
    // --- End Blocking Logic ---
    
    // Update the intended connector state
    setIntendedConnectors(prev => {
      console.log(`Connector update at (${groupX},${groupY}): previous=${prev[groupKey]} -> new=${newConnector}`);
      const updated = {
        ...prev,
        [groupKey]: newConnector
      };
      
      // Update the ref to track the latest state
      intendedConnectorsRef.current = updated;
      
      // Log the change that was made
      if (prev[groupKey] !== newConnector) {
        if (newConnector === CONNECTOR_NONE) {
          console.log(`Removed connector at (${groupX},${groupY})`);
        } else {
          const typeStr = 
            newConnector === CONNECTOR_DIAG_TL_BR ? "DIAG_TL_BR (\\)" :
            newConnector === CONNECTOR_DIAG_BL_TR ? "DIAG_BL_TR (/)" :
            newConnector === CONNECTOR_HORIZ_T ? "HORIZ_T" :
            newConnector === CONNECTOR_HORIZ_B ? "HORIZ_B" :
            `unknown (${newConnector})`;
          console.log(`Added ${typeStr} connector at (${groupX},${groupY})`);
          
          // Log updated connector state to help with debugging
          console.log("New connector state:", updated);
          console.log("Connector keys:", Object.keys(updated));
          console.log("Non-zero connectors:", Object.entries(updated).filter(([_, v]) => v !== CONNECTOR_NONE));
        }
      }
      
      return updated;
    });
    
    console.log(`Clicked cell group (${groupX},${groupY}), setting connector to ${newConnector}`);
    
  }, [controls.GRID_WIDTH, controls.GRID_HEIGHT, FIXED_SPACING, centerOffset, activationState, intendedConnectors, controls.visualScale, setCmdHorizConnectors, cmdHorizConnectors]); // Dependencies are correct now

  // Reset connector intent when a circle is deactivated
  useEffect(() => {
    // Check all cell groups
    const newIntendedConnectors = { ...intendedConnectors };
    const newCmdHorizConnectors = { ...cmdHorizConnectors };
    let hasChanges = false;
    let hasCmdHorizChanges = false;
    
    // First check regular connectors
    for (const key in intendedConnectors) {
      const connector = intendedConnectors[key];
      if (connector === CONNECTOR_NONE) continue;
      
      // Parse x,y from key
      const [x, y] = key.split(',').map(Number);
      
      // Get the indices of the four cells
      const blIndex = getIndex(y, x, controls.GRID_WIDTH);
      const brIndex = getIndex(y, x + 1, controls.GRID_WIDTH);
      const tlIndex = getIndex(y + 1, x, controls.GRID_WIDTH);
      const trIndex = getIndex(y + 1, x + 1, controls.GRID_WIDTH);
      
      // Get activation states
      const blActive = activationState[blIndex] === 1.0;
      const brActive = activationState[brIndex] === 1.0;
      const tlActive = activationState[tlIndex] === 1.0;
      const trActive = activationState[trIndex] === 1.0;
      
      // Check if the connector is still valid
      let isValid = true;
      
      switch (connector) {
        case CONNECTOR_DIAG_TL_BR:
          isValid = tlActive && brActive;
          break;
        case CONNECTOR_DIAG_BL_TR:
          isValid = blActive && trActive;
          break;
        case CONNECTOR_HORIZ_T:
          isValid = tlActive && trActive;
          break;
        case CONNECTOR_HORIZ_B:
          isValid = blActive && brActive;
          break;
      }
      
      if (!isValid) {
        newIntendedConnectors[key] = CONNECTOR_NONE;
        hasChanges = true;
      }
    }

    // Now check cmd-click horizontal connectors
    for (const key in cmdHorizConnectors) {
      if (cmdHorizConnectors[key] === 0) continue;

      // Parse x,y from key (remove 'hcmd:' prefix)
      const [x, y] = key.substring(5).split(',').map(Number);

      // Get indices for left and right circles
      const leftIndex = getIndex(y, x, controls.GRID_WIDTH);
      const rightIndex = getIndex(y, x + 1, controls.GRID_WIDTH);

      // Check if both circles are still active
      const leftActive = activationState[leftIndex] === 1.0;
      const rightActive = activationState[rightIndex] === 1.0;

      if (!leftActive || !rightActive) {
        newCmdHorizConnectors[key] = 0;
        hasCmdHorizChanges = true;
      }
    }
    
    if (hasChanges) {
      setIntendedConnectors(newIntendedConnectors);
    }
    if (hasCmdHorizChanges) {
      setCmdHorizConnectors(newCmdHorizConnectors);
    }
  }, [activationState, controls.GRID_WIDTH, intendedConnectors, cmdHorizConnectors]);

  // Create a data texture for intended connectors
  const intendedConnectorTexture = useMemo(() => {
    console.log(`Creating intended connector texture: ${controls.GRID_WIDTH-1}x${controls.GRID_HEIGHT-1}`);
    
    // Texture has one pixel per 2x2 cell group (grid cells minus 1 in each dimension)
    const width = Math.max(1, controls.GRID_WIDTH - 1);
    const height = Math.max(1, controls.GRID_HEIGHT - 1);
    
    const texture = new THREE.DataTexture(
      new Float32Array(width * height).fill(0.0),
      width,
      height,
      THREE.RedFormat,
      THREE.FloatType
    );
    
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    
    return texture;
  }, [controls.GRID_WIDTH, controls.GRID_HEIGHT]);
  
  // Update the intended connector texture when state changes
  useEffect(() => {
    const width = Math.max(1, controls.GRID_WIDTH - 1);
    const data = new Float32Array(width * Math.max(1, controls.GRID_HEIGHT - 1));
    
    for (let y = 0; y < controls.GRID_HEIGHT - 1; y++) {
      for (let x = 0; x < controls.GRID_WIDTH - 1; x++) {
        const index = y * width + x;
        const connector = getIntendedConnector(x, y);
        data[index] = connector;
      }
    }
    
    if (intendedConnectorTexture && data.length === intendedConnectorTexture.image.data.length) {
      intendedConnectorTexture.image.data.set(data);
      intendedConnectorTexture.needsUpdate = true;
    }
  }, [intendedConnectors, controls.GRID_WIDTH, controls.GRID_HEIGHT, intendedConnectorTexture]);

  // Create horizontal cmd-click connector texture
  const cmdHorizConnectorTexture = useMemo(() => {
    console.log(`Creating cmd-click horizontal connector texture: ${controls.GRID_WIDTH-1}x${controls.GRID_HEIGHT}`);
    
    // Texture has one pixel per horizontal connection possibility
    const width = Math.max(1, controls.GRID_WIDTH - 1);
    const height = controls.GRID_HEIGHT;
    
    const texture = new THREE.DataTexture(
      new Float32Array(width * height).fill(0.0),
      width,
      height,
      THREE.RedFormat,
      THREE.FloatType
    );
    
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    
    return texture;
  }, [controls.GRID_WIDTH, controls.GRID_HEIGHT]);
  
  // Update the cmd-click horizontal connector texture when state changes
  useEffect(() => {
    const width = Math.max(1, controls.GRID_WIDTH - 1);
    const data = new Float32Array(width * controls.GRID_HEIGHT);
    
    console.log('Updating cmd-horiz connector texture:', {
      width,
      height: controls.GRID_HEIGHT,
      connectors: cmdHorizConnectors
    });
    
    for (let y = 0; y < controls.GRID_HEIGHT; y++) {
      for (let x = 0; x < width; x++) {
        const key = getHorizCmdConnectorKey(x, y);
        const value = cmdHorizConnectors[key] || 0;
        data[y * width + x] = value;
        
        if (value > 0) {
          console.log('Found active connector:', { x, y, key, value });
        }
      }
    }
    
    if (cmdHorizConnectorTexture && data.length === cmdHorizConnectorTexture.image.data.length) {
      cmdHorizConnectorTexture.image.data.set(data);
      cmdHorizConnectorTexture.needsUpdate = true;
      console.log('Updated cmd-horiz connector texture data');
    } else {
      console.warn('Skipping cmd-horiz texture update: size mismatch or texture not ready', {
        textureSize: cmdHorizConnectorTexture?.image.data.length,
        dataSize: data.length
      });
    }
  }, [cmdHorizConnectors, controls.GRID_WIDTH, controls.GRID_HEIGHT, cmdHorizConnectorTexture]);

  useEffect(() => {
    if (!meshRef.current) return;
    
    // Enable frustum culling
    meshRef.current.frustumCulled = true;
    
    // Update bounding sphere for better culling
    if (meshRef.current.geometry) {
      meshRef.current.geometry.computeBoundingSphere();
      if (meshRef.current.geometry.boundingSphere) {
        meshRef.current.geometry.boundingSphere.radius *= Math.max(controls.visualScale, 1.0);
      }
    }
  }, [controls.visualScale]);

  // --- Performance Monitoring Setup ---
  const statsRef = useRef<any | null>(null); // Use useRef to hold the instance

  useEffect(() => {
    // Stats is disabled for now due to import issues
    // Initialize Stats.js on component mount
    /*
    statsRef.current = new Stats();
    statsRef.current.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(statsRef.current.dom);
    */

    // Cleanup function to remove Stats.js on unmount
    return () => {
      if (statsRef.current) {
        document.body.removeChild(statsRef.current.dom);
        statsRef.current = null; // Clear the ref
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount/unmount

  // Frame update logic (including stats)
  useFrame((state) => {
    if (statsRef.current) { // Check if statsRef.current exists
      statsRef.current.update(); // Update FPS counter
    }

    // Optional: Log frame time periodically
    // if (state.clock.elapsedTime % 5 < state.clock.getDelta()) { // Check every 5s
    //   console.log('Frame time:', state.clock.getDelta() * 1000, 'ms');
    // }
  });

  // Save with direct values
  const saveGridStateWithDirectValues = useCallback((
    currentActivation: Float32Array,
    directIntendedConnectors: Record<string, number>,
    directCmdHorizConnectors: Record<string, number>,
    gridWidth: number,
    gridHeight: number
  ) => {
    console.log("========== SAVE DIAGNOSTICS START ==========");
    console.log("Starting direct save grid state with data:");
    
    console.log(`Current grid dimensions: ${gridWidth} x ${gridHeight}`);
    
    // Log the state details
    console.log("- Current activation state has length:", currentActivation.length);
    console.log("- Active nodes count:", Array.from(currentActivation).filter(val => val === 1.0).length);
    
    // Log the raw state for debugging
    console.log("RAW intendedConnectors:", directIntendedConnectors);
    console.log("RAW cmdHorizConnectors:", directCmdHorizConnectors);
    
    // Make deep copies to ensure we don't mutate the original objects
    const intendedConnectorsCopy = JSON.parse(JSON.stringify(directIntendedConnectors));
    const cmdHorizConnectorsCopy = JSON.parse(JSON.stringify(directCmdHorizConnectors));
    
    // DEBUG: Log the intended connectors in detail
    console.log("- Intended connectors (direct) keys:", Object.keys(intendedConnectorsCopy));
    console.log("- Intended connectors (direct) count:", Object.keys(intendedConnectorsCopy).length);
    
    // Check if connectors have actual values or are just empty objects
    const nonZeroIntendedConnectors = Object.entries(intendedConnectorsCopy).filter(([key, value]) => value !== CONNECTOR_NONE);
    console.log("- Non-zero intended connectors:", nonZeroIntendedConnectors.length);
    console.log("- Non-zero intended connectors data:", nonZeroIntendedConnectors);
    
    // DEBUG: Log the cmd horiz connectors in detail
    console.log("- Cmd horiz connectors (direct) keys:", Object.keys(cmdHorizConnectorsCopy));
    console.log("- Cmd horiz connectors count:", Object.keys(cmdHorizConnectorsCopy).length);
    
    // Check if cmd horiz connectors have actual values or are just empty objects
    const activeHorizConnectors = Object.entries(cmdHorizConnectorsCopy).filter(([key, value]) => value === 1);
    console.log("- Active horiz connectors:", activeHorizConnectors.length);
    console.log("- Active horiz connectors data:", activeHorizConnectors);
    
    // Find all active nodes
    const nodes: GridNode[] = [];
    // Ensure loop uses the correct length based on actual activation array,
    // but coordinate calculation uses passed dimensions
    const expectedLength = gridWidth * gridHeight;
    if (currentActivation.length !== expectedLength) {
        console.warn(`Activation array length (${currentActivation.length}) doesn't match expected (${expectedLength}) based on passed dimensions! Using array length for loop, but coordinates might be wrong.`);
    }
    
    for (let i = 0; i < currentActivation.length; i++) {
      if (currentActivation[i] === 1.0) {
        // Use passed gridWidth for coordinate calculation
        const row = Math.floor(i / gridWidth); 
        const col = i % gridWidth;
        // Add bounds check just in case activation array length mismatches
        if (col >= 0 && col < gridWidth && row >= 0 && row < gridHeight) {
          nodes.push({ x: col, y: row });
          console.log(`Found active node at (${col}, ${row})`);
        } else {
          console.warn(`Calculated node coords (${col}, ${row}) for index ${i} are out of bounds for passed dimensions ${gridWidth}x${gridHeight}. Skipping.`);
        }
      }
    }
    console.log(`Total active nodes found: ${nodes.length}`);

    // Find all edges - connectors between active nodes
    const edges: GridEdge[] = [];
    
    // Process intended connectors (diagonals, etc.)
    console.log("Processing intended connectors...");
    // Instead of iterating through all positions, directly iterate over the keys in the connectors object
    for (const key of Object.keys(intendedConnectorsCopy)) {
      const type = intendedConnectorsCopy[key];
      if (type === undefined || type === CONNECTOR_NONE) {
        continue;
      }
      
      // Extract x,y from the key (which is in format "x,y")
      const [x, y] = key.split(',').map(Number);
      
      // Check if extracted coordinates are valid for the current grid dimensions
      if (x < 0 || x >= gridWidth - 1 || y < 0 || y >= gridHeight - 1) {
        console.warn(`Connector at (${x},${y}) is out of bounds for current grid size (${gridWidth}x${gridHeight}), skipping.`);
        continue;
      }
      
      console.log(`Found connector at (${x},${y}) with key ${key}, type=${type}`);
      
      // Map the numeric connector type to the string type for the JSON
      let edgeType: GridEdge['type'] | null = null;
      switch (type) {
        case CONNECTOR_DIAG_TL_BR: 
          edgeType = 'diag_tl_br'; 
          console.log(`Converting CONNECTOR_DIAG_TL_BR (${CONNECTOR_DIAG_TL_BR}) to 'diag_tl_br'`);
          break;
        case CONNECTOR_DIAG_BL_TR: 
          edgeType = 'diag_bl_tr'; 
          console.log(`Converting CONNECTOR_DIAG_BL_TR (${CONNECTOR_DIAG_BL_TR}) to 'diag_bl_tr'`);
          break;
        case CONNECTOR_HORIZ_T: 
          edgeType = 'horiz_t'; 
          console.log(`Converting CONNECTOR_HORIZ_T (${CONNECTOR_HORIZ_T}) to 'horiz_t'`);
          break;
        case CONNECTOR_HORIZ_B: 
          edgeType = 'horiz_b'; 
          console.log(`Converting CONNECTOR_HORIZ_B (${CONNECTOR_HORIZ_B}) to 'horiz_b'`);
          break;
        default:
          console.warn(`Unknown connector type ignored: ${type}`);
      }
      
      if (edgeType) {
        edges.push({ type: edgeType, x, y });
        console.log(`Added ${edgeType} connector at (${x}, ${y}) to edges array`);
      }
    }

    // Process cmd-horizontal connectors
    console.log("Processing cmd-horizontal connectors...");
    // Instead of iterating through all positions, directly iterate over the keys in the cmdHorizConnectors object
    for (const key of Object.keys(cmdHorizConnectorsCopy)) {
      const value = cmdHorizConnectorsCopy[key];
      if (value !== 1) {
        continue;
      }
      
      // Extract x,y from the key (format is "hcmd:x,y")
      const [x, y] = key.substring(5).split(',').map(Number);
      
      // Check if extracted coordinates are valid for the current grid dimensions
      if (x < 0 || x >= gridWidth - 1 || y < 0 || y >= gridHeight) {
        console.warn(`CMD-horiz connector at (${x},${y}) is out of bounds for current grid size (${gridWidth}x${gridHeight}), skipping.`);
        continue;
      }
      
      edges.push({ type: 'cmd_horiz', x, y });
      console.log(`Added cmd_horiz connector at (${x}, ${y}) to edges array`);
    }
    
    console.log(`Total edges found: ${edges.length}`);

    // Create the final JSON data structure
    const data: AdjacencyListData = {
      gridWidth,
      gridHeight,
      nodes,
      edges,
    };

    // Create JSON string
    const dataStr = JSON.stringify(data, null, 2);
    console.log('Grid State JSON:', dataStr);
    console.log("========== SAVE DIAGNOSTICS END ==========");

    // Prompt user for filename
    const defaultFilename = `grid_state_${gridWidth}x${gridHeight}`;
    const userFilename = prompt(`Enter filename for saving (without extension):`, defaultFilename);
    
    // If user cancels the prompt, abort the save
    if (userFilename === null) {
      console.log("Save cancelled by user.");
      return;
    }
    
    // Use the provided filename (or default if user entered empty string)
    const finalFilename = (userFilename.trim() === '') ? defaultFilename : userFilename.trim();
    
    // Ensure filename has .json extension
    const downloadFilename = finalFilename.endsWith('.json') ? finalFilename : `${finalFilename}.json`;

    // Trigger download
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // --- Save Grid State Function ---
  const saveGridState = useCallback(() => {
    console.log("Starting save grid state with data:");
    
    // Get the current activation state directly from the buffer attribute
    // which is the most up-to-date source of truth
    let currentActivation: Float32Array;
    if (activationAttributeRef.current && activationAttributeRef.current.array) {
      currentActivation = activationAttributeRef.current.array as Float32Array;
      console.log("- Using activation state from buffer attribute");
    } else {
      currentActivation = activationState;
      console.log("- Using activation state from React state (fallback)");
    }

    // Use the ref values which should be in sync with state
    const currentIntendedConnectors = JSON.parse(JSON.stringify(intendedConnectorsRef.current || {}));
    const currentCmdHorizConnectors = JSON.parse(JSON.stringify(cmdHorizConnectorsRef.current || {}));

    // Debug current state
    console.log("Current intended connectors before save:", currentIntendedConnectors);
    console.log("Keys in intended connectors:", Object.keys(currentIntendedConnectors));
    console.log("Active intended connectors:", Object.entries(currentIntendedConnectors).filter(([_, v]) => v !== CONNECTOR_NONE));
    
    console.log("Current cmd horiz connectors before save:", currentCmdHorizConnectors);
    console.log("Active cmd horiz connectors:", Object.entries(currentCmdHorizConnectors).filter(([_, v]) => v === 1));

    console.log("Using direct save method to ensure up-to-date state capture");
    saveGridStateWithDirectValues(currentActivation, currentIntendedConnectors, currentCmdHorizConnectors, controls.GRID_WIDTH, controls.GRID_HEIGHT);
    
  }, [controls, activationState, activationAttributeRef]);

  // Debug function to create a test pattern similar to what's in the image
  const createTestPattern = useCallback(() => {
    console.log("========== TEST PATTERN CREATION START ==========");
    console.log("Creating test pattern");
    // Create a new activation state array
    const newActivationState = new Float32Array(TOTAL_CIRCLES).fill(0.0);
    
    // Activate nodes in a pattern similar to the image
    // The pattern shows a vertical line with some horizontal connectors and diagonal branches
    const pattern = [
      // Vertical central column (top to bottom)
      { x: 5, y: 2 }, // Top node
      { x: 5, y: 3 }, 
      { x: 5, y: 4 }, 
      { x: 5, y: 5 }, 
      { x: 5, y: 6 }, 
      { x: 5, y: 7 }, // Bottom node
      
      // Horizontal connection in the middle row
      { x: 4, y: 4 }, // Left node on middle row
      { x: 6, y: 4 }, // Right node on middle row
      
      // Diagonal cluster at bottom
      { x: 4, y: 6 }, // Bottom left
      { x: 6, y: 6 }, // Bottom right
      
      // Diagonal node at top
      { x: 6, y: 3 }, // Top right diagonal
    ];
    
    // Set active nodes
    pattern.forEach(({x, y}) => {
      if (x >= 0 && x < controls.GRID_WIDTH && y >= 0 && y < controls.GRID_HEIGHT) {
        const index = getIndex(y, x, controls.GRID_WIDTH);
        newActivationState[index] = 1.0;
        console.log(`Setting active node at (${x}, ${y}), index: ${index}`);
      }
    });
    
    // Create connectors
    const newIntendedConnectors: Record<string, number> = {
      // Diagonal connections - they use bottom-left coordinates of the 2x2 group
      "5,2": CONNECTOR_DIAG_BL_TR, // Diagonal from (5,3) to (6,2) - top
      "4,5": CONNECTOR_DIAG_BL_TR, // Diagonal from (4,5) to (5,6) - bottom left
      "5,5": CONNECTOR_DIAG_TL_BR  // Diagonal from (5,6) to (6,5) - bottom right
    };
    
    // Create cmd-horiz connectors - these connect dots horizontally with cmd-click
    const newCmdHorizConnectors: Record<string, number> = {
      // Middle row horizontal connector
      ["hcmd:4,4"]: 1  // Horizontal connector from (4,4) to (5,4)
    };
    
    // Log details of the test pattern
    console.log("Test pattern details:");
    console.log("- Total active nodes:", pattern.length);
    
    // Log diagonal connector details 
    Object.entries(newIntendedConnectors).forEach(([key, value]) => {
      const type = value === CONNECTOR_DIAG_BL_TR ? "diagonal BL-TR (/)" : 
                   value === CONNECTOR_DIAG_TL_BR ? "diagonal TL-BR (\\)" : 
                   `unknown type ${value}`;
      console.log(`- Diagonal connector at ${key}: ${type} (value: ${value})`);
    });
    
    // Log cmd-horiz connector details
    Object.entries(newCmdHorizConnectors).forEach(([key, value]) => {
      if (value === 1) {
        console.log(`- Cmd-horiz connector at ${key.substring(5)}: active`);
      }
    });
    
    // Set states
    console.log("Setting activation state, intended connectors, and cmd-horiz connectors...");
    setActivationState(newActivationState);
    setIntendedConnectors(newIntendedConnectors);
    setCmdHorizConnectors(newCmdHorizConnectors);
    
    console.log("Test pattern created");
    
    // Add check after small delay to verify state was updated
    setTimeout(() => {
      console.log("Verification of state update:");
      console.log("- intendedConnectors:", intendedConnectors);
      console.log("- nonzero intendedConnectors:", Object.entries(intendedConnectors).filter(([_, v]) => v !== CONNECTOR_NONE));
      console.log("- cmdHorizConnectors:", cmdHorizConnectors);
      console.log("- active cmdHorizConnectors:", Object.entries(cmdHorizConnectors).filter(([_, v]) => v === 1));
      
      // Check if our expectation matches reality
      const allConnectorsMatch = 
        Object.keys(newIntendedConnectors).length === 
          Object.entries(intendedConnectors).filter(([_, v]) => v !== CONNECTOR_NONE).length &&
        Object.keys(newCmdHorizConnectors).filter(k => newCmdHorizConnectors[k] === 1).length ===
          Object.entries(cmdHorizConnectors).filter(([_, v]) => v === 1).length;
      
      console.log("All connectors set correctly:", allConnectorsMatch ? "YES" : "NO");
    }, 100);
    
    // Automatically trigger custom save after a delay
    setTimeout(() => {
      console.log("========== AUTO-SAVE TEST PATTERN START ==========");
      console.log("Auto-saving test pattern with direct reference to new states...");
      
      // Get the CURRENT state at the moment of auto-save
      const currentControls = { ...controls }; // Make a fresh copy of the controls object
      console.log(`Current controls dimensions: ${currentControls.GRID_WIDTH}x${currentControls.GRID_HEIGHT}`);
      
      // Get the current activation state directly from the buffer attribute
      let currentActivation: Float32Array;
      if (activationAttributeRef.current && activationAttributeRef.current.array) {
        currentActivation = activationAttributeRef.current.array as Float32Array;
        console.log("- Using activation state from buffer attribute");
      } else {
        currentActivation = activationState;
        console.log("- Using activation state from React state (fallback)");
      }
      
      // Use the ref values which should have the most up-to-date state
      const currentIntendedConnectors = JSON.parse(JSON.stringify(intendedConnectorsRef.current || {}));
      const currentCmdHorizConnectors = JSON.parse(JSON.stringify(cmdHorizConnectorsRef.current || {}));
      
      console.log("Ref values for connectors:", {
        intended: currentIntendedConnectors,
        cmdHoriz: currentCmdHorizConnectors
      });
      
      // Save using direct values with current dimensions
      saveGridStateWithDirectValues(
        currentActivation,
        currentIntendedConnectors,
        currentCmdHorizConnectors,
        currentControls.GRID_WIDTH,
        currentControls.GRID_HEIGHT
      );
      
      console.log("========== AUTO-SAVE TEST PATTERN END ==========");
    }, 500); // 500ms delay should be sufficient
    
    console.log("========== TEST PATTERN CREATION END ==========");
  }, [TOTAL_CIRCLES, controls, setActivationState, setIntendedConnectors, setCmdHorizConnectors, intendedConnectors, cmdHorizConnectors]);
  
  // Debug function to clear everything
  const clearAll = useCallback(() => {
    console.log("Clearing all state");
    setActivationState(new Float32Array(TOTAL_CIRCLES).fill(0.0));
    setIntendedConnectors({});
    setCmdHorizConnectors({});
    
    // Also clear the refs
    intendedConnectorsRef.current = {};
    cmdHorizConnectorsRef.current = {};
  }, [TOTAL_CIRCLES, setActivationState, setIntendedConnectors, setCmdHorizConnectors]);
  
  // Now that we've defined the debug functions, add the debug controls
  useControls('Debug', () => ({
    createTestPattern: button(() => createTestPattern()),
    clearAll: button(() => clearAll()),
    directSave: button(() => {
      console.log("Direct save triggered manually");
      
      // Get the CURRENT state at the moment the button is clicked
      const currentControls = { ...controls }; // Make a fresh copy of the controls object
      console.log(`Current controls dimensions: ${currentControls.GRID_WIDTH}x${currentControls.GRID_HEIGHT}`);
      
      // Get the current activation state directly from the buffer attribute
      let currentActivation: Float32Array;
      if (activationAttributeRef.current && activationAttributeRef.current.array) {
        currentActivation = activationAttributeRef.current.array as Float32Array;
        console.log("- Using activation state from buffer attribute");
      } else {
        currentActivation = activationState;
        console.log("- Using activation state from React state (fallback)");
      }
      
      // Use the ref values which should have the most up-to-date state
      const currentIntendedConnectors = JSON.parse(JSON.stringify(intendedConnectorsRef.current || {}));
      const currentCmdHorizConnectors = JSON.parse(JSON.stringify(cmdHorizConnectorsRef.current || {}));
      
      console.log("Ref values for connectors:", {
        intended: currentIntendedConnectors,
        cmdHoriz: currentCmdHorizConnectors
      });
      
      // Save using direct values with current dimensions
      saveGridStateWithDirectValues(
        currentActivation,
        currentIntendedConnectors,
        currentCmdHorizConnectors,
        currentControls.GRID_WIDTH,
        currentControls.GRID_HEIGHT
      );
    })
  }));

  return (
    <group>
      <instancedMesh 
        ref={meshRef} 
        args={[undefined, undefined, TOTAL_CIRCLES]}
        key={`circles-${TOTAL_CIRCLES}`}
        onClick={handleCircleClick} // Attach click handler
        position={[0, 0, -0.1]} // Position circles behind connectors
      >
        {/* Pass args directly to fix TypeScript error */}
        <planeGeometry args={[1, 1]}> 
          {/* Attach the instanced buffer attribute for activation state */}
          <instancedBufferAttribute
            ref={activationAttributeRef}
            attach="attributes-a_activated"
            args={[activationState, 1]} // Pass initial state, item size 1
            usage={THREE.DynamicDrawUsage} // Mark as dynamic
          />
        </planeGeometry> 
        <circleMaterial 
            ref={materialRef} 
            transparent={true} 
            key={CircleMaterial.key} // Add key for material hotswapping if needed
        />
      </instancedMesh>

      {/* Main Connector Plane (Existing) */}
      <mesh
        position={[0, 0, 0.1]} // Keep this slightly in front of circles
        key={`connector-plane-${controls.GRID_WIDTH}-${controls.GRID_HEIGHT}-${controls.visualScale}`}
        onClick={handleConnectorClick} 
      >
        <planeGeometry args={[planeWidth, planeHeight]} />
        <connectorMaterial 
          ref={connectorMaterialRef}
          key={ConnectorMaterial.key}
          transparent={true} 
          side={THREE.DoubleSide} 
          // Pass required uniforms (cmdHoriz texture removed)
          u_stateTexture={stateTexture} 
          u_intendedConnectorTexture={intendedConnectorTexture}
          // u_cmdHorizConnectorTexture removed
          u_gridDimensions={[controls.GRID_WIDTH, controls.GRID_HEIGHT]}
          u_textureResolution={[controls.GRID_WIDTH, controls.GRID_HEIGHT]} 
          u_radiusA={BASE_RADIUS_A}
          u_radiusB={BASE_RADIUS_B}
          u_gridSpacing={controls.visualScale}
          u_centerOffset={[centerOffset.x, centerOffset.y]}
          u_planeSize={[planeWidth, planeHeight]}
        />
      </mesh>

      {/* New Cmd-Click Horizontal Connector Plane */}
      <mesh
        position={[0, 0, 0.2]} // Position this slightly in front of the main connectors
        key={`cmd-horiz-connector-plane-${controls.GRID_WIDTH}-${controls.GRID_HEIGHT}-${controls.visualScale}`}
        // No click handler needed here, interaction is via circles
      >
        {/* Use the same plane geometry dimensions */}
        <planeGeometry args={[planeWidth, planeHeight]} /> 
        <cmdHorizConnectorMaterial
          ref={cmdHorizMaterialRef}
          key={CmdHorizConnectorMaterial.key}
          transparent={true}
          side={THREE.DoubleSide}
          // Pass necessary uniforms for this specific material
          u_stateTexture={stateTexture}                 // Need for checking active circles
          u_cmdHorizConnectorTexture={cmdHorizConnectorTexture} // The texture with cmd-horiz state
          u_gridDimensions={[controls.GRID_WIDTH, controls.GRID_HEIGHT]}  // Grid dimensions
          u_textureResolution={[controls.GRID_WIDTH, controls.GRID_HEIGHT]} // State texture resolution
          u_radiusA={BASE_RADIUS_A}                     // Base radii
          u_radiusB={BASE_RADIUS_B}
          u_gridSpacing={controls.visualScale}                   // Current visual scale
          u_fixedSpacing={FIXED_SPACING}                // Pass the base fixed spacing
          u_centerOffset={[centerOffset.x, centerOffset.y]} // Grid offset
          u_planeSize={[planeWidth, planeHeight]}       // Plane dimensions
        />
      </mesh>

    </group>
  );
};

export default GridScene; 