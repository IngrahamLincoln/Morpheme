import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useControls } from 'leva'; // Import leva
import { ConnectorMaterial } from './ConnectorMaterial'; // We'll create this shader material

// Extend THREE namespace with our custom shader material
extend({ ConnectorMaterial });

function Scene() {
  // State for circle visibility
  const [showInnerCircle, setShowInnerCircle] = useState(true);
  const [showOuterCircle, setShowOuterCircle] = useState(true);
  
  // Controls for both inner and outer radius
  const { radiusB, radiusA } = useControls({
    radiusB: { value: 0.4, min: 0.1, max: 1.0, step: 0.01, label: 'Inner Radius' },
    radiusA: { value: 0.5, min: 0.1, max: 1.5, step: 0.01, label: 'Outer Radius' },
  });

  const materialRef = useRef();
  const meshRef = useRef();

  // Access three.js camera and raycaster
  const { camera, raycaster, mouse } = useThree();
  
  // Handle click on the canvas
  const handleClick = (event) => {
    // Cast a ray from camera through mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Check if we hit the mesh
    const intersects = raycaster.intersectObject(meshRef.current);
    
    if (intersects.length > 0) {
      // We hit the mesh, now determine which circle was clicked
      // Get the world position at the intersection point
      const point = intersects[0].point;
      
      // Calculate distance from center (mesh is at 0,0,0)
      const distFromCenter = Math.sqrt(point.x * point.x + point.y * point.y);
      
      // Check if we're in inner circle
      if (distFromCenter <= radiusB) {
        // Toggle inner circle
        setShowInnerCircle(!showInnerCircle);
      } 
      // Check if we're in outer ring
      else if (distFromCenter <= radiusA) {
        // Toggle outer circle
        setShowOuterCircle(!showOuterCircle);
      }
    }
  };

  // Update the material when radius or visibility changes
  useEffect(() => {
    if (materialRef.current) {
      // Update radius values
      materialRef.current.uniforms.u_radiusB.value = radiusB;
      materialRef.current.uniforms.u_radiusA.value = radiusA;
      
      // Update visibility flags
      materialRef.current.uniforms.u_showInnerCircle.value = showInnerCircle;
      materialRef.current.uniforms.u_showOuterCircle.value = showOuterCircle;
    }
  }, [radiusB, radiusA, showInnerCircle, showOuterCircle]);

  // Calculate plane size based on the larger radius
  const planeSize = useMemo(() => Math.max(2, Math.max(radiusA, radiusB) * 4), [radiusA, radiusB]);

  return (
    <>
      {/* Simple plane with our shader material */}
      <mesh 
        ref={meshRef}
        rotation={[0, 0, 0]} 
        onClick={handleClick}
      >
        <planeGeometry args={[planeSize, planeSize]} />
        <connectorMaterial
          ref={materialRef}
          key={ConnectorMaterial.key} // Needed for R3F hot-reloading shaders
          transparent={true}
        />
      </mesh>

      {/* Debug grid - flat on XY plane */}
      <gridHelper args={[10, 10]} rotation={[Math.PI/2, 0, 0]} />
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