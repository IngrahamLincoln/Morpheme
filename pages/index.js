import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { Leva, useControls } from 'leva';
import GridScene from '../components/GridScene'; // Adjust path if necessary
import styles from '../styles/Home.module.css'; // Assuming you have this for styling

const App = () => {
  // Leva controls for camera zoom
  const { cameraZoom } = useControls({
    cameraZoom: { value: 50, min: 10, max: 200, step: 1 },
  });

  return (
    <div className={styles.container}>
      <Leva collapsed /> {/* Leva panel for controls */}
      <Canvas
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        {/* Use OrthographicCamera for 2D view */}
        <OrthographicCamera
          makeDefault // Sets this camera as the default
          zoom={cameraZoom}
          position={[0, 0, 100]} // Positioned to look along -Z axis
          near={0.1}
          far={1000}
        />
        <ambientLight intensity={1.0} /> {/* Basic lighting */}
        
        {/* Render the main scene component */}
        <GridScene /> 
        
        {/* Optional: Add OrbitControls if needed for debugging/navigation */}
        {/* <OrbitControls enableRotate={false} /> */}
      </Canvas>
    </div>
  );
};

export default App; 