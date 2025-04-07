import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useControls } from 'leva';
import { useFrame } from '@react-three/fiber';
import CircleMaterial from './CircleMaterial';
import ConnectorMaterial from './ConnectorMaterial';

// === Feature 1: Grid Data & Configuration ===

// Constants for base geometry
const BASE_GRID_SPACING = 1.0; // Keep for reference if needed, but spacing is now fixed
const BASE_RADIUS_A = 0.5; // Outer radius
const BASE_RADIUS_B = 0.4; // Inner radius

// Calculate the fixed spacing based on desired overlap
const FIXED_SPACING = BASE_RADIUS_A + BASE_RADIUS_B; // 0.5 + 0.4 = 0.9

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

// === GridScene Component ===

// Dummy object for matrix calculations
const dummy = new THREE.Object3D();
const tempMatrix = new THREE.Matrix4();
const tempVec = new THREE.Vector3();

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

  // State needs to be reset if TOTAL_CIRCLES changes
  useEffect(() => {
    console.log('Resetting activation state due to grid size change');
    setActivationState(new Float32Array(TOTAL_CIRCLES).fill(0.0));
  }, [TOTAL_CIRCLES]);

  // Update buffer attribute when state changes
  useEffect(() => {
    if (activationAttributeRef.current) {
      activationAttributeRef.current.array = activationState;
      activationAttributeRef.current.needsUpdate = true;
      console.log('Updated activation buffer attribute.');
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

  // === Feature 4: Circle Interaction ===
  const handleCircleClick = useCallback((event: any) => {
    event.stopPropagation();
    if (event.instanceId === undefined || !meshRef.current) return;

    const index = event.instanceId;
    const clickPoint = event.point; // Click point in world space

    // Get the center of the clicked instance
    meshRef.current.getMatrixAt(index, tempMatrix);
    const instanceCenter = tempVec.setFromMatrixPosition(tempMatrix);

    // Calculate distance from click point to instance center
    const distFromCenter = clickPoint.distanceTo(instanceCenter);

    // Get the CURRENT world-space inner radius (Base radius * current instance scale)
    // Note: scaledRadiusB is calculated based on spacing, which matches instance scale
    const currentInnerRadius = BASE_RADIUS_B * visualScale; 

    // console.log(`Clicked instance ${index}, dist: ${distFromCenter.toFixed(2)}, innerRadius: ${currentInnerRadius.toFixed(2)}`);

    // Check if click is inside the inner circle
    if (distFromCenter <= currentInnerRadius) {
      console.log(`Toggling instance ${index}`);
      setActivationState(current => {
        const newState = new Float32Array(current); // Important: Copy!
        newState[index] = newState[index] === 1.0 ? 0.0 : 1.0; // Toggle
        return newState;
      });

      // TODO: Feature 8 - Reset connector intent if circle is deactivated
      // if (newState[index] === 0.0) {
      //   // Check if intendedConnector relies on this index and reset if needed
      // }
    }

  }, [meshRef, setActivationState, visualScale]); // Dependencies for the click handler

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

  // === Feature 8: Connector Interaction ===
  // Connector intent state - track which connector types are intended for 2x2 cell groups
  const [intendedConnectors, setIntendedConnectors] = useState<Record<string, number>>({});

  // Helper to get the key for a 2x2 cell group
  const getCellGroupKey = (cellX: number, cellY: number) => `${cellX},${cellY}`;

  // Helper to get the intended connector for a 2x2 cell group
  const getIntendedConnector = (cellX: number, cellY: number) => {
    const key = getCellGroupKey(cellX, cellY);
    return intendedConnectors[key] || CONNECTOR_NONE;
  };

  // Handle clicks on the connector plane
  const handleConnectorClick = useCallback((event: any) => {
    event.stopPropagation();
    
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
        setActivationState(current => {
          const newState = new Float32Array(current);
          newState[index] = newState[index] === 1.0 ? 0.0 : 1.0; // Toggle
          return newState;
        });
        console.log(`Toggling circle at (${gridX},${gridY})`);
        return; // Exit early - we've handled this as a circle click
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
    
    // Calculate distances from click to each diagonal
    const distToBLTR = Math.abs((clickPoint.x - blPos.x) * (trPos.y - blPos.y) - (clickPoint.y - blPos.y) * (trPos.x - blPos.x)) / 
                      Math.sqrt(Math.pow(trPos.x - blPos.x, 2) + Math.pow(trPos.y - blPos.y, 2));
    
    const distToTLBR = Math.abs((clickPoint.x - tlPos.x) * (brPos.y - tlPos.y) - (clickPoint.y - tlPos.y) * (brPos.x - tlPos.x)) / 
                      Math.sqrt(Math.pow(brPos.x - tlPos.x, 2) + Math.pow(brPos.y - tlPos.y, 2));
    
    // Determine if click is closer to horizontal or vertical
    const clickOffsetX = clickPoint.x - centerX;
    const clickOffsetY = clickPoint.y - centerY;
    const isHorizontalClick = Math.abs(clickOffsetY) < Math.abs(clickOffsetX);
    const isTopHalf = clickOffsetY > 0;
    
    // Get current intended connector
    const currentConnector = getIntendedConnector(groupX, groupY);
    const groupKey = getCellGroupKey(groupX, groupY);
    
    let newConnector = CONNECTOR_NONE;
    
    // Determine which connector was clicked
    let clickedType = CONNECTOR_NONE;
    
    if (distToBLTR < distToTLBR) {
      // Closer to BL-TR diagonal (/)
      if (blActive && trActive) {
        clickedType = CONNECTOR_DIAG_BL_TR;
      }
    } else {
      // Closer to TL-BR diagonal (\)
      if (tlActive && brActive) {
        clickedType = CONNECTOR_DIAG_TL_BR;
      }
    }
    
    // Horizontal connector logic
    if (isHorizontalClick) {
      if (isTopHalf) {
        // Top horizontal
        if (tlActive && trActive) {
          clickedType = CONNECTOR_HORIZ_T;
        }
      } else {
        // Bottom horizontal
        if (blActive && brActive) {
          clickedType = CONNECTOR_HORIZ_B;
        }
      }
    }
    
    // Toggle logic - if the clicked connector is already active, turn it off
    // Otherwise, turn off any current connector and turn on the clicked one
    if (currentConnector === clickedType) {
      newConnector = CONNECTOR_NONE; // Toggle off
    } else if (clickedType !== CONNECTOR_NONE) {
      newConnector = clickedType; // Toggle on new connector
    }
    
    // Update the intended connector
    setIntendedConnectors(prev => ({
      ...prev,
      [groupKey]: newConnector
    }));
    
    console.log(`Clicked cell group (${groupX},${groupY}), setting connector to ${newConnector}`);
    
  }, [GRID_WIDTH, GRID_HEIGHT, FIXED_SPACING, centerOffset, activationState, intendedConnectors, visualScale]);

  // Reset connector intent when a circle is deactivated
  useEffect(() => {
    // Check all cell groups
    const newIntendedConnectors = { ...intendedConnectors };
    let hasChanges = false;
    
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
    
    if (hasChanges) {
      setIntendedConnectors(newIntendedConnectors);
    }
  }, [activationState, GRID_WIDTH, intendedConnectors]);

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

  // Memoize the geometry props to avoid unnecessary re-creations
  // const instanceGeometryArgs = useMemo(() => [1, 1], []); // Removed memoization causing TS error

  // Geometry for connector plane (memoized) - Removed, caused TS error
  // const connectorPlaneArgs = useMemo(() => [planeWidth, planeHeight], [planeWidth, planeHeight]);

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

      {/* Connector Plane (Feature 6 & 7) */}
      <mesh
        position={[0, 0, 0.1]} // Position connectors in front of circles
        key={`connector-plane-${GRID_WIDTH}-${GRID_HEIGHT}-${visualScale}`}
        onClick={handleConnectorClick} // Add click handler for connector interaction
      >
        <planeGeometry args={[planeWidth, planeHeight]} />
        <connectorMaterial 
          ref={connectorMaterialRef}
          key={ConnectorMaterial.key}
          transparent={true} 
          side={THREE.DoubleSide} 
          // Pass required uniforms (updated for Feature 7)
          u_stateTexture={stateTexture} 
          u_gridDimensions={[GRID_WIDTH, GRID_HEIGHT]}
          u_textureResolution={[GRID_WIDTH, GRID_HEIGHT]} 
          u_radiusA={BASE_RADIUS_A}
          u_radiusB={BASE_RADIUS_B}
          u_gridSpacing={visualScale}
          u_centerOffset={[centerOffset.x, centerOffset.y]}
          u_planeSize={[planeWidth, planeHeight]}
          // New uniform for connector intent
          u_intendedConnectorTexture={intendedConnectorTexture}
        />
      </mesh>

    </group>
  );
};

export default GridScene; 