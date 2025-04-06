import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useControls, folder, button } from 'leva'; // Import leva with button instead of monitor
import { ConnectorMaterial } from './ConnectorMaterial'; // We'll create this shader material
import { GridConnectorMaterial } from './GridConnectorMaterial'; // Import our new connector material
import { SimpleConnectorMaterial } from './SimpleConnectorMaterial'; // Import simple connector for debugging
import { Html } from '@react-three/drei';

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
  
  // State for active connector - 0: none, 1: red (AB), 2: blue (CD), 3: orange top row, 4: orange bottom row
  const [activeConnector, setActiveConnector] = useState(0);
  
  // Display current values in a separate control panel
  useControls(
    'Current Values',
    {
      innerRadius: { value: scaledRadiusB, label: 'Inner Radius (B)', disabled: true },
      outerRadius: { value: scaledRadiusA, label: 'Outer Radius (A)', disabled: true },
      boxSize: { value: scaledBoxSize, label: 'BBox Size', disabled: true },
      activeConnector: { 
        value: activeConnector.toString(), 
        label: 'Active Connector', 
        disabled: true,
        onChange: () => {}, // Dummy function to prevent errors
      },
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
      gridConnectorMaterialRef.current.uniforms.u_activeConnector = { value: activeConnector };
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
      simpleConnectorMaterialRef.current.uniforms.u_activeConnector = { value: activeConnector };
    }
  }, [gridState, gridStateTexture, gridSpacing, debug, showSimple, activeConnector]);

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
    
    // Calculate scale factor based on ratio to base grid spacing
    const scaleFactor = gridSpacing / BASE_VALUES.baseSpacing;
    
    // Scale the radius values for hit detection
    const scaledRadiusB = BASE_VALUES.radiusB * scaleFactor;
    const scaledRadiusA = BASE_VALUES.radiusA * scaleFactor;
    
    // Grid positions for detecting connector areas
    const centerA = new THREE.Vector2(-gridSpacing * 0.5, gridSpacing * 0.5);   // Top-left (A)
    const centerB = new THREE.Vector2(gridSpacing * 0.5, -gridSpacing * 0.5);   // Bottom-right (B)
    const centerC = new THREE.Vector2(-gridSpacing * 0.5, -gridSpacing * 0.5);  // Bottom-left (C)
    const centerD = new THREE.Vector2(gridSpacing * 0.5, gridSpacing * 0.5);    // Top-right (D)
    
    // Create a 2D point from the click event for easier calculations
    const clickPoint = new THREE.Vector2(event.point.x, event.point.y);
    
    console.log("Click position:", clickPoint);
    console.log("Grid centers:", { A: centerA, B: centerB, C: centerC, D: centerD });
    
    // First check if we clicked in any of the horizontal connector areas
    const isInTopRowConnectorArea = isPointInHorizontalConnectorArea(clickPoint, centerA, centerD, scaledRadiusB);
    const isInBottomRowConnectorArea = isPointInHorizontalConnectorArea(clickPoint, centerC, centerB, scaledRadiusB);
    
    // Then check if we clicked in any diagonal connector area
    const isInAnyDiagonalArea = 
      isPointInConnectorArea(clickPoint, centerA, centerB, scaledRadiusB, scaledRadiusA) || 
      isPointInConnectorArea(clickPoint, centerC, centerD, scaledRadiusB, scaledRadiusA);
    
    console.log("Connector area detection:", {
      "Top row": isInTopRowConnectorArea,
      "Bottom row": isInBottomRowConnectorArea,
      "Diagonal": isInAnyDiagonalArea
    });
    
    // Handle clicks on connector areas
    if (isInTopRowConnectorArea || isInBottomRowConnectorArea) {
      console.log("Handling horizontal connector click");
      
      if (isInTopRowConnectorArea) {
        console.log("Clicked top row connector");
        handleHorizontalConnectorClick(0, 0, 0, 1); // Top row: (0,0) to (0,1)
        return;
      }
      
      if (isInBottomRowConnectorArea) {
        console.log("Clicked bottom row connector");
        handleHorizontalConnectorClick(1, 0, 1, 1); // Bottom row: (1,0) to (1,1)
        return;
      }
    }
    // Check for diagonal area clicks
    else if (isInAnyDiagonalArea) {
      console.log("Handling diagonal connector click");
      handleDiagonalConnectorCycle();
      return;
    }
    
    // If no connector area was hit, check for circle clicks
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
    
    let newInner = currentState.showInner;
    let newOuter = currentState.showOuter;

    if (distFromCenter <= scaledRadiusB) {
      // Clicked inner circle
      newInner = !currentState.showInner;
      console.log(`Toggling inner circle: ${currentState.showInner} -> ${newInner}`);
      
      // Check if toggling off an inner circle that was part of an active connector
      if (!newInner) {
        // Top-left circle is part of red connector or top horizontal connector
        if (row === 0 && col === 0 && (activeConnector === 1 || activeConnector === 3)) {
          setActiveConnector(0);
        }
        // Bottom-right circle is part of red connector or bottom horizontal connector
        else if (row === 1 && col === 1 && (activeConnector === 1 || activeConnector === 4)) {
          setActiveConnector(0);
        }
        // Bottom-left circle is part of blue connector or bottom horizontal connector
        else if (row === 1 && col === 0 && (activeConnector === 2 || activeConnector === 4)) {
          setActiveConnector(0);
        }
        // Top-right circle is part of blue connector or top horizontal connector
        else if (row === 0 && col === 1 && (activeConnector === 2 || activeConnector === 3)) {
          setActiveConnector(0);
        }
      } 
      // If toggling ON an inner circle, check if it completes a pair
      else if (newInner) {
        // Only activate connector if no connector is currently active,
        // or if a connector is active in a different row
        const currentRow = row;
        const isConnectorInOtherRow = 
          (activeConnector === 3 && currentRow === 1) || // Top row connector active but we're in bottom row 
          (activeConnector === 4 && currentRow === 0);   // Bottom row connector active but we're in top row
          
        if (activeConnector === 0 || isConnectorInOtherRow) {
          // Check for diagonal pairs - only if no connectors are active
          if (activeConnector === 0) {
            // Red connector (top-left to bottom-right)
            if ((row === 0 && col === 0 && gridState[1][1].showInner) || 
                (row === 1 && col === 1 && gridState[0][0].showInner)) {
              setActiveConnector(1); // Activate red connector
              return;
            }
            // Blue connector (bottom-left to top-right)
            else if ((row === 1 && col === 0 && gridState[0][1].showInner) || 
                    (row === 0 && col === 1 && gridState[1][0].showInner)) {
              setActiveConnector(2); // Activate blue connector
              return;
            }
          }
          
          // Check for horizontal pairs in the current row
          if (currentRow === 0) {
            // Top row connector - only activate if no bottom connector exists
            if (activeConnector !== 4 && 
                ((row === 0 && col === 0 && gridState[0][1].showInner) || 
                (row === 0 && col === 1 && gridState[0][0].showInner))) {
              setActiveConnector(3); // Activate top row horizontal connector
            }
          } else if (currentRow === 1) {
            // Bottom row connector - only activate if no top connector exists
            if (activeConnector !== 3 && 
                ((row === 1 && col === 0 && gridState[1][1].showInner) || 
                (row === 1 && col === 1 && gridState[1][0].showInner))) {
              setActiveConnector(4); // Activate bottom row horizontal connector
            }
          }
        }
      }
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
  
  // Helper function to determine if a point is in a diagonal connector area
  const isPointInConnectorArea = (point, center1, center2, innerRadius, outerRadius) => {
    // Check that point is not inside either inner circle
    const distToCenter1 = point.distanceTo(center1);
    const distToCenter2 = point.distanceTo(center2);
    
    if (distToCenter1 < innerRadius || distToCenter2 < innerRadius) {
      return false; // Inside an inner circle
    }
    
    // Project point onto the line connecting the centers
    const direction = new THREE.Vector2().subVectors(center2, center1).normalize();
    const center1ToPoint = new THREE.Vector2().subVectors(point, center1);
    const projectionLength = center1ToPoint.dot(direction);
    
    // Check if projection falls between the two centers (with some buffer)
    const distanceBetweenCenters = center1.distanceTo(center2);
    
    // Define the active area along the diagonal line
    if (projectionLength < innerRadius || projectionLength > distanceBetweenCenters - innerRadius) {
      return false; // Outside the region between circles
    }
    
    // Calculate perpendicular distance from point to line
    const projectedPoint = new THREE.Vector2().copy(center1).addScaledVector(direction, projectionLength);
    const perpDistance = point.distanceTo(projectedPoint);
    
    // Define a narrow corridor along the diagonal line
    const connectorWidth = innerRadius * 0.8;
    
    return perpDistance < connectorWidth;
  };

  // Helper function to determine if a point is in a horizontal connector area (Area A)
  const isPointInHorizontalConnectorArea = (point, center1, center2, radius) => {
    // Check that point is not inside either inner circle
    const distToCenter1 = point.distanceTo(center1);
    const distToCenter2 = point.distanceTo(center2);
    
    if (distToCenter1 < radius || distToCenter2 < radius) {
      return false; // Inside an inner circle
    }
    
    // Calculate the rectangle bounds for the horizontal connector (Area A)
    // Ensure it's wider and shorter than the diagonal area
    const midY = (center1.y + center2.y) / 2;
    const left = Math.min(center1.x, center2.x) + radius;
    const right = Math.max(center1.x, center2.x) - radius;
    const halfHeight = radius * 0.6; // Narrower height to distinguish from diagonal
    
    // Check if point is within the horizontal connector rectangle
    return (
      point.x >= left && 
      point.x <= right && 
      point.y >= midY - halfHeight && 
      point.y <= midY + halfHeight
    );
  };
  
  // Helper function to handle horizontal connector clicks (toggle on/off)
  const handleHorizontalConnectorClick = (row1, col1, row2, col2) => {
    // Check if the circles in this row are already part of diagonal connectors
    const hasCircle1InDiagonalConnector = 
      (activeConnector === 1 && ((row1 === 0 && col1 === 0) || (row1 === 1 && col1 === 1))) || 
      (activeConnector === 2 && ((row1 === 1 && col1 === 0) || (row1 === 0 && col1 === 1)));
      
    const hasCircle2InDiagonalConnector = 
      (activeConnector === 1 && ((row2 === 0 && col2 === 0) || (row2 === 1 && col2 === 1))) || 
      (activeConnector === 2 && ((row2 === 1 && col2 === 0) || (row2 === 0 && col2 === 1)));
      
    // Don't toggle if any circle is part of a diagonal connector
    if (hasCircle1InDiagonalConnector || hasCircle2InDiagonalConnector) {
      console.log("Can't toggle horizontal connector: circles already part of diagonal connector");
      return;
    }
    
    // Check if both circles are active
    if (!gridState[row1][col1].showInner || !gridState[row2][col2].showInner) {
      console.log("Can't toggle horizontal connector: one or both circles are inactive");
      return;
    }
    
    // Determine the horizontal connector's state (3 for top row, 4 for bottom row)
    const horizontalConnectorState = row1 === 0 ? 3 : 4;
    
    // Toggle the connector - always toggle regardless of current state
    setActiveConnector(prevState => {
      // If this connector is already active, turn it off
      if (prevState === horizontalConnectorState) {
        return 0;
      }
      // If another connector in this row is active, leave it alone
      else if ((prevState === 3 && row1 === 0) || (prevState === 4 && row1 === 1)) {
        return 0; // Turn off existing connector in same row
      }
      // If no connector or a connector in different row, activate this one
      else {
        return horizontalConnectorState;
      }
    });
  };
  
  // Helper function to handle diagonal connector clicks (cycle through none/red/blue)
  const handleDiagonalConnectorCycle = () => {
    // Check if any of these circles are part of horizontal connectors
    const hasCircleInHorizontalConnector = 
      activeConnector === 3 || activeConnector === 4;
      
    if (hasCircleInHorizontalConnector) {
      console.log("Can't toggle diagonal connector: circles already part of horizontal connector");
      return;
    }
    
    // Check if all four circles are active
    if (!gridState[0][0].showInner || !gridState[0][1].showInner || 
        !gridState[1][0].showInner || !gridState[1][1].showInner) {
      console.log("Can't toggle diagonal connector: one or more circles are inactive");
      return;
    }
    
    // Cycle through diagonal states: None (0) -> Red (1) -> Blue (2) -> None (0)
    setActiveConnector(prevState => {
      if (prevState === 0) return 1;      // None -> Red
      else if (prevState === 1) return 2; // Red -> Blue
      else return 0;                      // Blue -> None
    });
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

      {/* Debug connector areas if debug mode is on - invisible but still useful for debugging */}
      {debug && (
        <>
          {/* These meshes are now invisible but kept for collision detection reference */}
          <mesh position={[0, gridSpacing * 0.5, 0.05]} visible={false}>
            <planeGeometry args={[
              gridSpacing - 2 * scaledRadiusB, 
              scaledRadiusB * 0.6 * 2
            ]} />
            <meshBasicMaterial opacity={0} transparent />
          </mesh>
          
          <mesh position={[0, -gridSpacing * 0.5, 0.05]} visible={false}>
            <planeGeometry args={[
              gridSpacing - 2 * scaledRadiusB, 
              scaledRadiusB * 0.6 * 2
            ]} />
            <meshBasicMaterial opacity={0} transparent />
          </mesh>
          
          <mesh position={[0, 0, 0.05]} rotation={[0, 0, -Math.PI / 4]} visible={false}>
            <planeGeometry args={[
              Math.sqrt(2) * gridSpacing - 2 * scaledRadiusB, 
              scaledRadiusB * 0.8 * 2
            ]} />
            <meshBasicMaterial opacity={0} transparent />
          </mesh>
          
          <mesh position={[0, 0, 0.05]} rotation={[0, 0, Math.PI / 4]} visible={false}>
            <planeGeometry args={[
              Math.sqrt(2) * gridSpacing - 2 * scaledRadiusB, 
              scaledRadiusB * 0.8 * 2
            ]} />
            <meshBasicMaterial opacity={0} transparent />
          </mesh>
        </>
      )}

      {/* Simple connector for debugging (higher z-index so it's visible) */}
      <mesh 
        ref={simpleConnectorMeshRef} 
        position={[0, 0, 0.1]} 
        visible={showSimple}
        onClick={handleClick}
      >
        <planeGeometry args={[connectorPlaneSize, connectorPlaneSize]} />
        <simpleConnectorMaterial
          ref={simpleConnectorMaterialRef}
          key={SimpleConnectorMaterial.key}
          transparent={true}
          depthTest={false}
        />
      </mesh>

      {/* Add original connector mesh for the shapes between circles */}
      <mesh 
        ref={connectorMeshRef} 
        position={[0, 0, -0.1]} 
        visible={!showSimple}
        onClick={handleClick}
      >
        <planeGeometry args={[connectorPlaneSize, connectorPlaneSize]} />
        <gridConnectorMaterial
          ref={gridConnectorMaterialRef}
          key={GridConnectorMaterial.key}
          transparent={true}
          depthTest={false}
        />
      </mesh>

      {/* Transparent background plane to catch all clicks */}
      <mesh 
        position={[0, 0, -0.15]} 
        onClick={handleClick}
      >
        <planeGeometry args={[connectorPlaneSize, connectorPlaneSize]} />
        <meshBasicMaterial color="white" opacity={0.01} transparent />
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