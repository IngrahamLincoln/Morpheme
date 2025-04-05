import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useControls, folder, button } from 'leva'; // Import leva with button instead of monitor
import { ConnectorMaterial } from './ConnectorMaterial'; // We'll create this shader material
import { GridConnectorMaterial } from './GridConnectorMaterial'; // Import our new connector material
import { SimpleConnectorMaterial } from './SimpleConnectorMaterial'; // Import simple connector for debugging

// Extend THREE namespace with our custom shader materials
extend({ ConnectorMaterial, GridConnectorMaterial, SimpleConnectorMaterial });

const GRID_SIZE = 2;
const TOTAL_INSTANCES = GRID_SIZE * GRID_SIZE;

// Helper to convert grid coords to instance ID
const getInstanceId = (row, col) => row * GRID_SIZE + col;
// Helper to convert instance ID to grid coords
const getGridCoords = (id) => ({ row: Math.floor(id / GRID_SIZE), col: id % GRID_SIZE });

// Create a reusable dummy object for matrix calculation
const dummy = new THREE.Object3D();

// Fixed base values
const BASE_VALUES = {
  radiusB: 0.4,  // Inner radius
  radiusA: 0.5,  // Outer radius
  boxSize: 0.5,  // Bounding box size
  baseSpacing: 0.89 // Reference spacing for scaling
};

function Scene() {
  // Controls for radius, spacing, and debugging
  const { gridSpacing, zoom, debug, showSimple } = useControls({
    gridSpacing: { value: 0.89, min: 0.5, max: 2.0, step: 0.01, label: 'Grid Spacing' },
    zoom: { value: 1.0, min: 0.5, max: 3.0, step: 0.1, label: 'Camera Zoom' },
    debug: { value: true, label: 'Debug Mode' },
    showSimple: { value: true, label: 'Use Simple Connector' },
  });
  
  // Calculate scaled values for display
  const scaleFactor = gridSpacing / BASE_VALUES.baseSpacing;
  const scaledRadiusB = (BASE_VALUES.radiusB * scaleFactor).toFixed(3);
  const scaledRadiusA = (BASE_VALUES.radiusA * scaleFactor).toFixed(3);
  const scaledBoxSize = (BASE_VALUES.boxSize * scaleFactor).toFixed(3);
  
  // Display current values in a separate control panel
  useControls(
    'Current Values',
    {
      innerRadius: { value: scaledRadiusB, label: 'Inner Radius (B)', disabled: true },
      outerRadius: { value: scaledRadiusA, label: 'Outer Radius (A)', disabled: true },
      boxSize: { value: scaledBoxSize, label: 'BBox Size', disabled: true },
    }
  );

  // State for the 2x2 grid visibility
  const [gridState, setGridState] = useState([
    // Initial state - all circles visible
    [{ showInner: true, showOuter: true }, { showInner: true, showOuter: true }],
    [{ showInner: true, showOuter: true }, { showInner: true, showOuter: true }]
  ]);

  const materialRef = useRef();
  const instancedMeshRef = useRef();
  const gridHelperRef = useRef();
  const cameraRef = useRef();

  // Reference for connector material
  const gridConnectorMaterialRef = useRef();
  const connectorMeshRef = useRef();
  const debugMeshRef = useRef();

  // Reference for simple connector material (for debugging)
  const simpleConnectorMaterialRef = useRef();
  const simpleConnectorMeshRef = useRef();

  // Attributes for instance visibility data
  const instanceShowInner = useMemo(() => new Float32Array(TOTAL_INSTANCES), []);
  const instanceShowOuter = useMemo(() => new Float32Array(TOTAL_INSTANCES), []);

  // Store positions for click detection
  const instancePositions = useRef(Array(TOTAL_INSTANCES).fill().map(() => new THREE.Vector3()));

  // Access three.js helpers
  const { camera, raycaster, mouse } = useThree();

  // Log the grid state for debugging
  useEffect(() => {
    console.log('Grid State:', gridState);
  }, [gridState]);

  // Create a data texture to store grid state for the connector shader
  const gridStateTexture = useMemo(() => {
    const data = new Float32Array(4 * 4); // RGBA for each of the 4 cells
    const texture = new THREE.DataTexture(
      data,
      2, // width for 2x2 grid
      2, // height
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Update the grid state texture and uniforms when controls change
  useEffect(() => {
    const data = gridStateTexture.image.data;
    
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const idx = (row * GRID_SIZE + col) * 4;
        data[idx] = gridState[row][col].showInner ? 1.0 : 0.0;     // R - Inner circle
        data[idx + 1] = gridState[row][col].showOuter ? 1.0 : 0.0; // G - Outer circle
        data[idx + 2] = 0.0; // B - unused
        data[idx + 3] = 1.0; // A - opacity
      }
    }
    
    gridStateTexture.needsUpdate = true;
    console.log('Updated grid state texture', data);
    
    // Calculate scale factor based on ratio to base grid spacing
    const scaleFactor = gridSpacing / BASE_VALUES.baseSpacing;
    
    // Update connector material uniforms (original grid one)
    if (gridConnectorMaterialRef.current) {
      gridConnectorMaterialRef.current.uniforms.u_radiusB.value = BASE_VALUES.radiusB * scaleFactor;
      gridConnectorMaterialRef.current.uniforms.u_radiusA.value = BASE_VALUES.radiusA * scaleFactor;
      gridConnectorMaterialRef.current.uniforms.u_spacing.value = gridSpacing;
      gridConnectorMaterialRef.current.uniforms.u_gridState.value = gridStateTexture;
      // Pass the connector thickness to the shader (if it exists - might remove later)
      if (gridConnectorMaterialRef.current.uniforms.u_thickness) {
        // gridConnectorMaterialRef.current.uniforms.u_thickness.value = connectorThickness; // Keep commented out for now
      }
      // Pass the curvature parameter (if it exists - might remove later)
      if (gridConnectorMaterialRef.current.uniforms.u_curvature) {
        // gridConnectorMaterialRef.current.uniforms.u_curvature.value = connectorCurvature; // Keep commented out for now
      }
    }
    
    // Update simple connector material uniforms
    if (simpleConnectorMaterialRef.current) {
      // Scale the radius and box size values proportionally
      simpleConnectorMaterialRef.current.uniforms.u_radiusB.value = BASE_VALUES.radiusB * scaleFactor;
      simpleConnectorMaterialRef.current.uniforms.u_radiusA.value = BASE_VALUES.radiusA * scaleFactor;
      simpleConnectorMaterialRef.current.uniforms.u_boxSize.value = BASE_VALUES.boxSize * scaleFactor;
      simpleConnectorMaterialRef.current.uniforms.u_spacing.value = gridSpacing;
      simpleConnectorMaterialRef.current.uniforms.u_gridState.value = gridStateTexture;
    }
  }, [gridState, gridStateTexture, gridSpacing, debug, showSimple]);

  // Update camera zoom based on control
  useEffect(() => {
    if (camera) {
      camera.zoom = 100 * (1/zoom); // Adjust as needed for scale
      camera.updateProjectionMatrix();
    }
  }, [camera, zoom]);

  // Update instance matrices and visibility attributes based on state
  useEffect(() => {
    if (!instancedMeshRef.current) return;

    let instanceId = 0;
    
    // Calculate grid starting position
    const startOffset = (GRID_SIZE - 1) * 0.5 * gridSpacing;
    
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        // Position at grid intersections
        const x = col * gridSpacing - startOffset;
        const y = -(row * gridSpacing - startOffset); // Y is inverted for screen coordinates
        
        // Update the dummy object's position
        dummy.position.set(x, y, 0);
        dummy.updateMatrix();
        
        // Set the instance matrix
        instancedMeshRef.current.setMatrixAt(instanceId, dummy.matrix);
        
        // Store position for click detection
        instancePositions.current[instanceId].set(x, y, 0);
        
        // Update visibility attributes
        instanceShowInner[instanceId] = gridState[row][col].showInner ? 1.0 : 0.0;
        instanceShowOuter[instanceId] = gridState[row][col].showOuter ? 1.0 : 0.0;
        
        instanceId++;
      }
    }

    // Mark attributes and matrix for update
    instancedMeshRef.current.geometry.attributes.a_instanceShowInner.needsUpdate = true;
    instancedMeshRef.current.geometry.attributes.a_instanceShowOuter.needsUpdate = true;
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;

    // Update global uniforms with the radius values
    if (materialRef.current) {
      // Calculate scale factor based on ratio to base grid spacing
      const scaleFactor = gridSpacing / BASE_VALUES.baseSpacing;
      
      materialRef.current.uniforms.u_radiusB.value = BASE_VALUES.radiusB * scaleFactor;
      materialRef.current.uniforms.u_radiusA.value = BASE_VALUES.radiusA * scaleFactor;
      materialRef.current.uniforms.u_spacing.value = gridSpacing;
    }

    // Update grid helper to match spacing
    if (gridHelperRef.current) {
      gridHelperRef.current.scale.set(gridSpacing, gridSpacing, 1);
    }

  }, [gridState, gridSpacing, instanceShowInner, instanceShowOuter]);

  // Handle click on the canvas
  const handleClick = (event) => {
    if (!instancedMeshRef.current) return;
    
    // If no instance was hit, return
    if (event.instanceId === undefined) return;
    
    const instanceId = event.instanceId;
    const { row, col } = getGridCoords(instanceId);
    console.log(`Clicked instance: row=${row}, col=${col}`);
    
    const currentState = gridState[row][col];
    
    // Get instance position from our stored reference
    const instancePosition = instancePositions.current[instanceId];
    
    // Create a copy of the click point
    const pointCopy = event.point.clone();
    
    // Calculate distance from click to instance center
    const distFromCenter = pointCopy.distanceTo(instancePosition);
    
    // Calculate scale factor based on ratio to base grid spacing
    const scaleFactor = gridSpacing / BASE_VALUES.baseSpacing;
    
    // Scale the radius values for hit detection
    const scaledRadiusB = BASE_VALUES.radiusB * scaleFactor;
    const scaledRadiusA = BASE_VALUES.radiusA * scaleFactor;
    
    let newInner = currentState.showInner;
    let newOuter = currentState.showOuter;

    if (distFromCenter <= scaledRadiusB) {
      // Clicked inner circle
      newInner = !currentState.showInner;
      console.log(`Toggling inner circle: ${currentState.showInner} -> ${newInner}`);
    } else if (distFromCenter <= scaledRadiusA) {
      // Clicked outer circle
      newOuter = !currentState.showOuter;
      console.log(`Toggling outer circle: ${currentState.showOuter} -> ${newOuter}`);
    }
    
    if (newInner !== currentState.showInner || newOuter !== currentState.showOuter) {
      setGridState(prevState => {
        const newState = JSON.parse(JSON.stringify(prevState)); // Deep copy
        newState[row][col] = { showInner: newInner, showOuter: newOuter };
        return newState;
      });
    }
  };

  // Calculate plane size based on the grid size and spacing
  const connectorPlaneSize = useMemo(() => 
    GRID_SIZE * gridSpacing + Math.max(BASE_VALUES.radiusA, BASE_VALUES.radiusB) * 2,
    [gridSpacing, BASE_VALUES.radiusA, BASE_VALUES.radiusB]
  );

  return (
    <>
      {/* Debug colored plane to verify rendering */}
      {debug && (
        <mesh ref={debugMeshRef} position={[0, 0, -0.2]}>
          <planeGeometry args={[connectorPlaneSize, connectorPlaneSize]} />
          <meshBasicMaterial color="blue" opacity={0.1} transparent />
        </mesh>
      )}

      {/* Simple connector for debugging (higher z-index so it's visible) */}
      <mesh ref={simpleConnectorMeshRef} position={[0, 0, 0.1]} visible={showSimple}>
        <planeGeometry args={[connectorPlaneSize, connectorPlaneSize]} />
        <simpleConnectorMaterial
          ref={simpleConnectorMaterialRef}
          key={SimpleConnectorMaterial.key}
          transparent={true}
          depthTest={false}
        />
      </mesh>

      {/* Add original connector mesh for the shapes between circles */}
      <mesh ref={connectorMeshRef} position={[0, 0, -0.1]} visible={!showSimple}>
        <planeGeometry args={[connectorPlaneSize, connectorPlaneSize]} />
        <gridConnectorMaterial
          ref={gridConnectorMaterialRef}
          key={GridConnectorMaterial.key}
          transparent={true}
          depthTest={false}
        />
      </mesh>

      {/* Circles */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[null, null, TOTAL_INSTANCES]}
        onClick={handleClick}
        position={[0, 0, 0]}
      >
        <planeGeometry args={[connectorPlaneSize, connectorPlaneSize]}>
          <instancedBufferAttribute 
            attach="attributes-a_instanceShowInner" 
            args={[instanceShowInner, 1]} 
          />
          <instancedBufferAttribute 
            attach="attributes-a_instanceShowOuter" 
            args={[instanceShowOuter, 1]} 
          />
        </planeGeometry>
        <connectorMaterial
          ref={materialRef}
          key={ConnectorMaterial.key}
          transparent={true}
        />
      </instancedMesh>

      {/* Grid lines that match the grid spacing */}
      <group ref={gridHelperRef} position={[0, 0, -0.2]}>
        <gridHelper 
          args={[10, 10]} 
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>
    </>
  );
}

export default function WebGLCanvas() {
  return (
    // Set up the R3F Canvas
    <Canvas style={{ background: '#f0f0f0' }}>
      {/* Orthographic camera for true 2D view */}
      <OrthographicCamera 
        makeDefault 
        zoom={100} 
        position={[0, 0, 5]} 
        rotation={[0, 0, 0]}
      />
      <ambientLight intensity={0.8} />
      <Scene />
    </Canvas>
  );
} 