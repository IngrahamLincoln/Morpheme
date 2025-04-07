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
        position={[0, 0, 0.1]} 
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
        position={[0, 0, -0.1]} // Position behind circles
        key={`connector-plane-${GRID_WIDTH}-${GRID_HEIGHT}-${visualScale}`}
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
          u_radiusA={BASE_RADIUS_A} // Pass base outer radius (shader works relative to spacing=1)
          u_radiusB={BASE_RADIUS_B} // Pass base inner radius (shader works relative to spacing=1)
          u_gridSpacing={visualScale} // Pass current spacing (world units per cell)
          u_centerOffset={[centerOffset.x, centerOffset.y]} // Pass the center offset for world space calculation
          u_planeSize={[planeWidth, planeHeight]} // Pass plane dimensions for world space calculation
        />
      </mesh>

    </group>
  );
};

export default GridScene; 