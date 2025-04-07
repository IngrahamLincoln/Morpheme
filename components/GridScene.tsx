import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useControls } from 'leva';
import { useFrame } from '@react-three/fiber';
import CircleMaterial from './CircleMaterial';
import ConnectorMaterial from './ConnectorMaterial';
import CmdHorizConnectorMaterial from './CmdHorizConnectorMaterial';
import Stats from 'three/examples/jsm/libs/stats.module';
import { FIXED_SPACING, BASE_RADIUS_A, BASE_RADIUS_B } from './constants'; // Assuming constants are moved

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

// Define connector types as constants
const CONNECTOR_NONE = 0;
const CONNECTOR_DIAG_TL_BR = 1; // Diagonal \
const CONNECTOR_DIAG_BL_TR = 2; // Diagonal /
const CONNECTOR_HORIZ_T = 3;    // Horizontal Top
const CONNECTOR_HORIZ_B = 4;    // Horizontal Bottom
const CONNECTOR_HORIZ_CMD = 5;  // New: Cmd-click horizontal connector

// === GridScene Component ===

// Dummy object for matrix calculations
const dummy = new THREE.Object3D();
const tempMatrix = new THREE.Matrix4();
const tempVec = new THREE.Vector3();

// New: Helper for horizontal cmd-click connector key generation
const getHorizCmdConnectorKey = (x: number, y: number) => `hcmd:${x},${y}`;

const GridScene = () => {
  // Leva controls for grid parameters
  const { GRID_WIDTH, GRID_HEIGHT, visualScale } = useControls('Grid', {
    GRID_WIDTH: { value: 10, min: 2, max: 100, step: 1 },
    GRID_HEIGHT: { value: 10, min: 2, max: 100, step: 1 },
    visualScale: { // Renamed from currentGridSpacing
      value: 1.0, // Default scale is 1.0
      min: 0.1,
      max: 5,
      step: 0.1,
      label: 'Visual Scale' // Updated label
    },
  });

  // Add dynamic instance management
  const instanceCount = useMemo(() => {
    // Only create as many instances as visible in viewport
    const visibleWidth = Math.min(GRID_WIDTH, Math.ceil(window.innerWidth / (FIXED_SPACING * visualScale)) + 2);
    const visibleHeight = Math.min(GRID_HEIGHT, Math.ceil(window.innerHeight / (FIXED_SPACING * visualScale)) + 2);
    return visibleWidth * visibleHeight;
  }, [GRID_WIDTH, GRID_HEIGHT, visualScale]);

  // Derived values calculation using useMemo for optimization
  const { 
    TOTAL_CIRCLES, 
    centerOffset, // Based on FIXED_SPACING
    planeWidth,   // Based on FIXED_SPACING
    planeHeight   // Based on FIXED_SPACING
  } = useMemo(() => {
    const total = GRID_WIDTH * GRID_HEIGHT;
    // Offset and plane dimensions depend on the fixed spacing between centers
    const offset = getCenterOffset(GRID_WIDTH, GRID_HEIGHT, FIXED_SPACING);
    // Calculate actual grid extent based on fixed spacing
    const width = (GRID_WIDTH > 1 ? (GRID_WIDTH - 1) * FIXED_SPACING : 0) + (visualScale * BASE_RADIUS_A * 2); // Add diameter margin
    const height = (GRID_HEIGHT > 1 ? (GRID_HEIGHT - 1) * FIXED_SPACING : 0) + (visualScale * BASE_RADIUS_A * 2); // Add diameter margin
    
    console.log(`Layout Spacing: ${FIXED_SPACING.toFixed(2)}`);
    console.log(`Calculated Center Offset: x=${offset.x.toFixed(2)}, y=${offset.y.toFixed(2)}`);
    console.log(`Calculated Plane Size: w=${width.toFixed(2)}, h=${height.toFixed(2)}`);

    return {
      TOTAL_CIRCLES: total,
      centerOffset: offset,
      planeWidth: width,
      planeHeight: height,
    };
  }, [GRID_WIDTH, GRID_HEIGHT, visualScale]); // Depend on grid size and visual scale for plane margin

  // Refs for mesh and material
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<any>(null!); // Use 'any' or specific type for CircleMaterial
  const activationAttributeRef = useRef<THREE.InstancedBufferAttribute>(null!);
  const connectorMaterialRef = useRef<any>(null!); // Ref for connector material

  // === Feature 3: Circle Activation State ===
  const [activationState, setActivationState] = useState<Float32Array>(() => 
    new Float32Array(TOTAL_CIRCLES).fill(0.0) // 0.0 inactive, 1.0 active
  );

  // New: Add horizontal cmd-click connector state
  const [cmdHorizConnectors, setCmdHorizConnectors] = useState<Record<string, number>>({});

  // === Feature 8: Connector Interaction State and Helpers (Moved UP) ===
  const [intendedConnectors, setIntendedConnectors] = useState<Record<string, number>>({});

  // Helper to get the key for a 2x2 cell group (Moved UP)
  const getCellGroupKey = (cellX: number, cellY: number) => `${cellX},${cellY}`;

  // Helper to get the intended connector for a 2x2 cell group (Moved UP)
  const getIntendedConnector = (cellX: number, cellY: number) => {
    // Check bounds first
    if (cellX < 0 || cellX >= GRID_WIDTH - 1 || cellY < 0 || cellY >= GRID_HEIGHT - 1) {
      return CONNECTOR_NONE;
    }
    const key = getCellGroupKey(cellX, cellY);
    return intendedConnectors[key] || CONNECTOR_NONE;
  };

  // State needs to be reset if TOTAL_CIRCLES changes
  useEffect(() => {
    console.log('Resetting activation state due to grid size change');
    setActivationState(new Float32Array(TOTAL_CIRCLES).fill(0.0));
    setIntendedConnectors({}); // Also reset intended connectors
    setCmdHorizConnectors({}); // Also reset cmd-horiz connectors
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
      const { row, col } = getCoords(index, GRID_WIDTH);
      const { x, y } = getWorldPosition(
        row,
        col,
        GRID_WIDTH,
        GRID_HEIGHT,
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

  }, [GRID_WIDTH, GRID_HEIGHT, FIXED_SPACING, TOTAL_CIRCLES, centerOffset]);

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
  const scale = visualScale; // Use the leva control value for scale
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
}, [visualScale, TOTAL_CIRCLES]); // Depends on scale control and count

  // === Feature 4: Circle Interaction (Now uses helpers defined above) ===
  const handleCircleClick = useCallback((event: any) => {
    event.stopPropagation();
    if (event.instanceId === undefined || !meshRef.current) return;

    const index = event.instanceId;
    const { row: y, col: x } = getCoords(index, GRID_WIDTH);
    
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
    const currentInnerRadius = BASE_RADIUS_B * visualScale; 

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
        const rightIndex = getIndex(y, x + 1, GRID_WIDTH);
        const canConnectBase = x < GRID_WIDTH - 1 && 
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
          rightActive: x < GRID_WIDTH - 1 ? activationState[rightIndex] === 1.0 : false,
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
            // console.log('Updated connector state:', { key: connectorKey, newValue, allConnectors: newState }); // Optional detailed log
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
  }, [meshRef, setActivationState, GRID_WIDTH, visualScale, setCmdHorizConnectors, cmdHorizConnectors, intendedConnectors, GRID_HEIGHT]); // Dependencies are correct now

  // === Feature 5: State Data Texture ===
  const stateTexture = useMemo(() => {
    console.log(`Creating state texture: ${GRID_WIDTH}x${GRID_HEIGHT}`);
    const texture = new THREE.DataTexture(
      new Float32Array(TOTAL_CIRCLES).fill(0.0), // Initial data buffer
      GRID_WIDTH,
      GRID_HEIGHT,
      THREE.RedFormat, // Store activation (0.0 or 1.0) in Red channel
      THREE.FloatType
    );
    texture.minFilter = THREE.NearestFilter; // Crucial: No interpolation
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true; // Initial update needed
    return texture;
  }, [GRID_WIDTH, GRID_HEIGHT, TOTAL_CIRCLES]); // Recreate texture if grid dimensions change

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
    if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT) {
      // Calculate the cell center in world space
      const cellCenter = getWorldPosition(gridY, gridX, GRID_WIDTH, GRID_HEIGHT, FIXED_SPACING, centerOffset);
      
      // Calculate distance from click to cell center
      const distFromCenter = Math.sqrt(
        Math.pow(clickPoint.x - cellCenter.x, 2) + 
        Math.pow(clickPoint.y - cellCenter.y, 2)
      );
      
      // Check if click is inside the inner circle
      const currentInnerRadius = BASE_RADIUS_B * visualScale;
      if (distFromCenter <= currentInnerRadius) {
        // This is a click on a circle - toggle its activation state
        const index = getIndex(gridY, gridX, GRID_WIDTH);

        // If this is a cmd/ctrl click and there's an active circle to the right
        if ((event.metaKey || event.ctrlKey) && gridX < GRID_WIDTH - 1) {
          const rightIndex = getIndex(gridY, gridX + 1, GRID_WIDTH);
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
              // console.log('Toggling cmd-horiz connector:', { key: connectorKey, newValue: newConnectors[connectorKey] }); // Optional detailed log
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
    const blIndex = getIndex(groupY, groupX, GRID_WIDTH);
    const brIndex = getIndex(groupY, groupX + 1, GRID_WIDTH);
    const tlIndex = getIndex(groupY + 1, groupX, GRID_WIDTH);
    const trIndex = getIndex(groupY + 1, groupX + 1, GRID_WIDTH);
    
    // Check which cells are within grid bounds
    const isValidGroup = 
      groupX >= 0 && groupX < GRID_WIDTH - 1 && 
      groupY >= 0 && groupY < GRID_HEIGHT - 1;
    
    if (!isValidGroup) return;
    
    // Get activation states for the four cells
    const blActive = activationState[blIndex] === 1.0;
    const brActive = activationState[brIndex] === 1.0;
    const tlActive = activationState[tlIndex] === 1.0;
    const trActive = activationState[trIndex] === 1.0;
    
    // Get the world positions of the cell centers
    const blPos = getWorldPosition(groupY, groupX, GRID_WIDTH, GRID_HEIGHT, FIXED_SPACING, centerOffset);
    const brPos = getWorldPosition(groupY, groupX + 1, GRID_WIDTH, GRID_HEIGHT, FIXED_SPACING, centerOffset);
    const tlPos = getWorldPosition(groupY + 1, groupX, GRID_WIDTH, GRID_HEIGHT, FIXED_SPACING, centerOffset);
    const trPos = getWorldPosition(groupY + 1, groupX + 1, GRID_WIDTH, GRID_HEIGHT, FIXED_SPACING, centerOffset);
    
    // Calculate the center of the 2x2 group
    const centerX = (blPos.x + brPos.x + tlPos.x + trPos.x) / 4;
    const centerY = (blPos.y + brPos.y + tlPos.y + trPos.y) / 4;
    
    // Calculate distance from click to center of 2x2 group
    const distToCenter = Math.sqrt(
      Math.pow(clickPoint.x - centerX, 2) + 
      Math.pow(clickPoint.y - centerY, 2)
    );
    
    // Check if the click is in the center zone (30% of cell spacing)
    const isCenterClick = distToCenter < FIXED_SPACING * 0.3 * visualScale;
    
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
    setIntendedConnectors(prev => ({
      ...prev,
      [groupKey]: newConnector
    }));
    
    console.log(`Clicked cell group (${groupX},${groupY}), setting connector to ${newConnector}`);
    
  }, [GRID_WIDTH, GRID_HEIGHT, FIXED_SPACING, centerOffset, activationState, intendedConnectors, visualScale, setCmdHorizConnectors, cmdHorizConnectors]); // Dependencies are correct now

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
      const blIndex = getIndex(y, x, GRID_WIDTH);
      const brIndex = getIndex(y, x + 1, GRID_WIDTH);
      const tlIndex = getIndex(y + 1, x, GRID_WIDTH);
      const trIndex = getIndex(y + 1, x + 1, GRID_WIDTH);
      
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
      const leftIndex = getIndex(y, x, GRID_WIDTH);
      const rightIndex = getIndex(y, x + 1, GRID_WIDTH);

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
  }, [activationState, GRID_WIDTH, intendedConnectors, cmdHorizConnectors]);

  // Create a data texture for intended connectors
  const intendedConnectorTexture = useMemo(() => {
    console.log(`Creating intended connector texture: ${GRID_WIDTH-1}x${GRID_HEIGHT-1}`);
    
    // Texture has one pixel per 2x2 cell group (grid cells minus 1 in each dimension)
    const width = Math.max(1, GRID_WIDTH - 1);
    const height = Math.max(1, GRID_HEIGHT - 1);
    
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
  }, [GRID_WIDTH, GRID_HEIGHT]);
  
  // Update the intended connector texture when state changes
  useEffect(() => {
    const width = Math.max(1, GRID_WIDTH - 1);
    const data = new Float32Array(width * Math.max(1, GRID_HEIGHT - 1));
    
    for (let y = 0; y < GRID_HEIGHT - 1; y++) {
      for (let x = 0; x < GRID_WIDTH - 1; x++) {
        const index = y * width + x;
        const connector = getIntendedConnector(x, y);
        data[index] = connector;
      }
    }
    
    if (intendedConnectorTexture && data.length === intendedConnectorTexture.image.data.length) {
      intendedConnectorTexture.image.data.set(data);
      intendedConnectorTexture.needsUpdate = true;
    }
  }, [intendedConnectors, GRID_WIDTH, GRID_HEIGHT, intendedConnectorTexture]);

  // Create horizontal cmd-click connector texture
  const cmdHorizConnectorTexture = useMemo(() => {
    console.log(`Creating cmd-click horizontal connector texture: ${GRID_WIDTH-1}x${GRID_HEIGHT}`);
    
    // Texture has one pixel per horizontal connection possibility
    const width = Math.max(1, GRID_WIDTH - 1);
    const height = GRID_HEIGHT;
    
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
  }, [GRID_WIDTH, GRID_HEIGHT]);
  
  // Update the cmd-click horizontal connector texture when state changes
  useEffect(() => {
    const width = Math.max(1, GRID_WIDTH - 1);
    const data = new Float32Array(width * GRID_HEIGHT);
    
    console.log('Updating cmd-horiz connector texture:', {
      width,
      height: GRID_HEIGHT,
      connectors: cmdHorizConnectors
    });
    
    for (let y = 0; y < GRID_HEIGHT; y++) {
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
  }, [cmdHorizConnectors, GRID_WIDTH, GRID_HEIGHT, cmdHorizConnectorTexture]);

  // Ref for the new material
  const cmdHorizMaterialRef = useRef<any>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    
    // Enable frustum culling
    meshRef.current.frustumCulled = true;
    
    // Update bounding sphere for better culling
    if (meshRef.current.geometry) {
      meshRef.current.geometry.computeBoundingSphere();
      if (meshRef.current.geometry.boundingSphere) {
        meshRef.current.geometry.boundingSphere.radius *= Math.max(visualScale, 1.0);
      }
    }
  }, [visualScale]);

  // --- Performance Monitoring Setup ---
  const statsRef = useRef<Stats | null>(null); // Use useRef to hold the instance

  useEffect(() => {
    // Initialize Stats.js on component mount
    statsRef.current = new Stats();
    statsRef.current.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(statsRef.current.dom);

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
        key={`connector-plane-${GRID_WIDTH}-${GRID_HEIGHT}-${visualScale}`}
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
          u_gridDimensions={[GRID_WIDTH, GRID_HEIGHT]}
          u_textureResolution={[GRID_WIDTH, GRID_HEIGHT]} 
          u_radiusA={BASE_RADIUS_A}
          u_radiusB={BASE_RADIUS_B}
          u_gridSpacing={visualScale}
          u_centerOffset={[centerOffset.x, centerOffset.y]}
          u_planeSize={[planeWidth, planeHeight]}
        />
      </mesh>

      {/* New Cmd-Click Horizontal Connector Plane */}
      <mesh
        position={[0, 0, 0.2]} // Position this slightly in front of the main connectors
        key={`cmd-horiz-connector-plane-${GRID_WIDTH}-${GRID_HEIGHT}-${visualScale}`}
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
          u_gridDimensions={[GRID_WIDTH, GRID_HEIGHT]}  // Grid dimensions
          u_textureResolution={[GRID_WIDTH, GRID_HEIGHT]} // State texture resolution
          u_radiusA={BASE_RADIUS_A}                     // Base radii
          u_radiusB={BASE_RADIUS_B}
          u_gridSpacing={visualScale}                   // Current visual scale
          u_fixedSpacing={FIXED_SPACING}                // Pass the base fixed spacing
          u_centerOffset={[centerOffset.x, centerOffset.y]} // Grid offset
          u_planeSize={[planeWidth, planeHeight]}       // Plane dimensions
        />
      </mesh>

    </group>
  );
};

export default GridScene; 