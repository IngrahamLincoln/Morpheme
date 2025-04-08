import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import CircleMaterial from './CircleMaterial';
import ConnectorMaterial from './ConnectorMaterial';
import CmdHorizConnectorMaterial from './CmdHorizConnectorMaterial';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
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

// Create a custom version of CircleMaterial for the viewer that only shows active circles
const viewerVertexShader = /*glsl*/ `
  varying vec2 vUv;
  attribute float a_activated;
  varying float v_activated;
  void main() {
    vUv = uv;
    v_activated = a_activated;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

// Modified fragment shader that only renders active circles (black inner circles)
const viewerFragmentShader = /*glsl*/ `
  uniform float u_radiusA;
  uniform float u_radiusB;
  uniform vec3 u_bgColor;
  uniform vec3 u_outerColor;
  uniform vec3 u_innerColorEmpty;
  uniform vec3 u_innerColorActive;

  varying vec2 vUv;
  varying float v_activated;

  void main() {
    float dist = distance(vUv, vec2(0.5));
    
    // If not activated, discard completely (don't render inactive circles)
    if (v_activated < 0.5) {
      discard;
    }
    
    // Only render activated circles
    if (dist <= u_radiusB) {
      gl_FragColor = vec4(u_innerColorActive, 1.0); // Solid black inner circle
    } else {
      discard; // No outer ring for activated circles in viewer mode
    }
  }
`;

// Create the viewer-specific shader material
const ViewerCircleMaterial = shaderMaterial(
  {
    u_radiusA: 0.5,
    u_radiusB: 0.4,
    u_bgColor: new THREE.Color('#ffffff'),
    u_outerColor: new THREE.Color('#cccccc'),
    u_innerColorEmpty: new THREE.Color('#ffffff'),
    u_innerColorActive: new THREE.Color('#000000'),
  },
  viewerVertexShader,
  viewerFragmentShader
);

// Extend R3F to recognize the material
extend({ ViewerCircleMaterial });

// Add to global JSX namespace
declare global {
  namespace JSX {
    interface IntrinsicElements {
      viewerCircleMaterial: any;
    }
  }
}

// Helper functions from GridScene
const getIndex = (row: number, col: number, gridWidth: number): number => {
  return row * gridWidth + col;
};

const getCoords = (index: number, gridWidth: number): { row: number; col: number } => {
  const row = Math.floor(index / gridWidth);
  const col = index % gridWidth;
  return { row, col };
};

const getCenterOffset = (gridWidth: number, gridHeight: number, spacing: number): THREE.Vector2 => {
  const totalWidth = (gridWidth - 1) * spacing;
  const totalHeight = (gridHeight - 1) * spacing;
  return new THREE.Vector2(-totalWidth / 2, -totalHeight / 2);
};

const getWorldPosition = (
  row: number,
  col: number,
  gridWidth: number,
  gridHeight: number,
  spacing: number,
  centerOffset: THREE.Vector2
): { x: number; y: number } => {
  const x = col * spacing + centerOffset.x;
  const y = row * spacing + centerOffset.y;
  return { x, y };
};

const getHorizCmdConnectorKey = (x: number, y: number) => `hcmd:${x},${y}`;
const getCellGroupKey = (cellX: number, cellY: number) => `${cellX},${cellY}`;

// Dummy objects for matrix calculations
const dummy = new THREE.Object3D();
const tempMatrix = new THREE.Matrix4();
const tempVec = new THREE.Vector3();

// Types for AdjacencyListData
export interface GridNode {
  x: number;
  y: number;
}

export interface GridEdge {
  type: 'diag_tl_br' | 'diag_bl_tr' | 'horiz_t' | 'horiz_b' | 'cmd_horiz';
  x: number;
  y: number;
}

export interface AdjacencyListData {
  gridWidth: number;
  gridHeight: number;
  nodes: GridNode[];
  edges: GridEdge[];
}

// Props for GridViewer
interface GridViewerProps {
  data: AdjacencyListData | null;
  visualScale?: number;
  showInactiveCircles?: boolean;
}

const GridViewer: React.FC<GridViewerProps> = ({ 
  data, 
  visualScale = 1.0,
  showInactiveCircles = false
}) => {
  // Internal state to hold grid dimensions derived from data
  const [gridDims, setGridDims] = useState({ width: 0, height: 0 });

  // States for rendering
  const [activationState, setActivationState] = useState<Float32Array>(new Float32Array(0));
  const [intendedConnectors, setIntendedConnectors] = useState<Record<string, number>>({});
  const [cmdHorizConnectors, setCmdHorizConnectors] = useState<Record<string, number>>({});

  // Recalculate derived values when gridDims or visualScale changes
  const { TOTAL_CIRCLES, centerOffset, planeWidth, planeHeight } = useMemo(() => {
    const { width, height } = gridDims;
    if (width <= 0 || height <= 0) {
      return { TOTAL_CIRCLES: 0, centerOffset: new THREE.Vector2(), planeWidth: 0, planeHeight: 0 };
    }
    
    const total = width * height;
    const currentSpacing = FIXED_SPACING * visualScale;
    const offset = getCenterOffset(width, height, currentSpacing);
    
    // Calculate plane dimensions considering the scaled size of circles
    const scaledRadiusA = BASE_RADIUS_A * visualScale;
    const pWidth = (width > 1 ? (width - 1) * currentSpacing : 0) + (scaledRadiusA * 2);
    const pHeight = (height > 1 ? (height - 1) * currentSpacing : 0) + (scaledRadiusA * 2);
    
    return { TOTAL_CIRCLES: total, centerOffset: offset, planeWidth: pWidth, planeHeight: pHeight };
  }, [gridDims, visualScale]);

  // Refs for meshes and materials
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<any>(null!);
  const activationAttributeRef = useRef<THREE.InstancedBufferAttribute>(null!);
  const connectorMaterialRef = useRef<any>(null!);
  const cmdHorizMaterialRef = useRef<any>(null);

  // Effect to process input data
  useEffect(() => {
    if (!data || data.gridWidth <= 0 || data.gridHeight <= 0) {
      setGridDims({ width: 0, height: 0 });
      setActivationState(new Float32Array(0));
      setIntendedConnectors({});
      setCmdHorizConnectors({});
      return;
    }

    // Data is valid, process it
    const { gridWidth, gridHeight, nodes, edges } = data;
    setGridDims({ width: gridWidth, height: gridHeight });

    const newTotalCircles = gridWidth * gridHeight;
    const newActivationState = new Float32Array(newTotalCircles).fill(0.0);
    const newIntendedConnectors: Record<string, number> = {};
    const newCmdHorizConnectors: Record<string, number> = {};

    // Process Nodes (activate circles)
    nodes.forEach(node => {
      if (node.x >= 0 && node.x < gridWidth && node.y >= 0 && node.y < gridHeight) {
        const index = getIndex(node.y, node.x, gridWidth);
        newActivationState[index] = 1.0;
      }
    });

    // Process Edges (set connectors)
    edges.forEach(edge => {
      let connectorType: number = CONNECTOR_NONE;
      let isValid = false;

      switch (edge.type) {
        case 'diag_tl_br':
          connectorType = CONNECTOR_DIAG_TL_BR;
          isValid = edge.x >= 0 && edge.x < gridWidth - 1 && edge.y >= 0 && edge.y < gridHeight - 1;
          break;
        case 'diag_bl_tr':
          connectorType = CONNECTOR_DIAG_BL_TR;
          isValid = edge.x >= 0 && edge.x < gridWidth - 1 && edge.y >= 0 && edge.y < gridHeight - 1;
          break;
        case 'horiz_t':
          connectorType = CONNECTOR_HORIZ_T;
          isValid = edge.x >= 0 && edge.x < gridWidth - 1 && edge.y >= 0 && edge.y < gridHeight - 1;
          break;
        case 'horiz_b':
          connectorType = CONNECTOR_HORIZ_B;
          isValid = edge.x >= 0 && edge.x < gridWidth - 1 && edge.y >= 0 && edge.y < gridHeight - 1;
          break;
        case 'cmd_horiz':
          isValid = edge.x >= 0 && edge.x < gridWidth - 1 && edge.y >= 0 && edge.y < gridHeight;
          if (isValid) {
            const key = getHorizCmdConnectorKey(edge.x, edge.y);
            newCmdHorizConnectors[key] = 1;
          }
          break;
      }

      if (isValid && edge.type !== 'cmd_horiz' && connectorType !== CONNECTOR_NONE) {
        const key = getCellGroupKey(edge.x, edge.y);
        newIntendedConnectors[key] = connectorType;
      }
    });

    setActivationState(newActivationState);
    setIntendedConnectors(newIntendedConnectors);
    setCmdHorizConnectors(newCmdHorizConnectors);
  }, [data]);

  // Update buffer attribute when activationState changes
  useEffect(() => {
    if (activationAttributeRef.current && activationState.length > 0) {
      if (activationAttributeRef.current.array.length !== activationState.length) {
        activationAttributeRef.current.array = activationState;
      } else {
        (activationAttributeRef.current.array as Float32Array).set(activationState);
      }
      activationAttributeRef.current.needsUpdate = true;
    }
  }, [activationState]);

  // Update instance matrices when dimensions change
  useEffect(() => {
    if (!meshRef.current || TOTAL_CIRCLES === 0) return;

    if (meshRef.current.count !== TOTAL_CIRCLES) {
      meshRef.current.count = TOTAL_CIRCLES;
    }

    const currentSpacing = FIXED_SPACING * visualScale;

    for (let index = 0; index < TOTAL_CIRCLES; index++) {
      const { row, col } = getCoords(index, gridDims.width);
      const { x, y } = getWorldPosition(
        row, col, gridDims.width, gridDims.height, currentSpacing, centerOffset
      );

      dummy.position.set(x, y, 0);
      dummy.scale.set(visualScale, visualScale, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(index, dummy.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [gridDims.width, gridDims.height, TOTAL_CIRCLES, centerOffset, visualScale]);

  // Data textures for shaders
  const stateTexture = useMemo(() => {
    const { width, height } = gridDims;
    if (width <= 0 || height <= 0) {
      return new THREE.DataTexture(
        new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType
      );
    }
    
    const texture = new THREE.DataTexture(
      new Float32Array(width * height).fill(0.0),
      width, height, THREE.RedFormat, THREE.FloatType
    );
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, [gridDims]);

  // Update state texture when activationState changes
  useEffect(() => {
    if (stateTexture && activationState.length === stateTexture.image.data.length && activationState.length > 0) {
      stateTexture.image.data.set(activationState);
      stateTexture.needsUpdate = true;
    }
  }, [activationState, stateTexture]);

  // Intended connector texture
  const intendedConnectorTexture = useMemo(() => {
    const width = Math.max(1, gridDims.width - 1);
    const height = Math.max(1, gridDims.height - 1);
    if (gridDims.width <= 1 || gridDims.height <= 1) {
      return new THREE.DataTexture(
        new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType
      );
    }
    
    const texture = new THREE.DataTexture(
      new Float32Array(width * height).fill(CONNECTOR_NONE),
      width, height, THREE.RedFormat, THREE.FloatType
    );
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, [gridDims]);

  // Update intended connector texture
  useEffect(() => {
    const texWidth = Math.max(1, gridDims.width - 1);
    const texHeight = Math.max(1, gridDims.height - 1);
    if (gridDims.width <= 1 || gridDims.height <= 1) return;

    const dataArray = new Float32Array(texWidth * texHeight);
    for (let y = 0; y < texHeight; y++) {
      for (let x = 0; x < texWidth; x++) {
        const key = getCellGroupKey(x, y);
        dataArray[y * texWidth + x] = intendedConnectors[key] || CONNECTOR_NONE;
      }
    }

    if (intendedConnectorTexture && dataArray.length === intendedConnectorTexture.image.data.length) {
      intendedConnectorTexture.image.data.set(dataArray);
      intendedConnectorTexture.needsUpdate = true;
    }
  }, [intendedConnectors, gridDims, intendedConnectorTexture]);

  // Cmd horizontal connector texture
  const cmdHorizConnectorTexture = useMemo(() => {
    const width = Math.max(1, gridDims.width - 1);
    const height = gridDims.height;
    if (gridDims.width <= 1 || gridDims.height <= 0) {
      return new THREE.DataTexture(
        new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType
      );
    }
    
    const texture = new THREE.DataTexture(
      new Float32Array(width * height).fill(0.0),
      width, height, THREE.RedFormat, THREE.FloatType
    );
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, [gridDims]);

  // Update cmd horiz connector texture
  useEffect(() => {
    const texWidth = Math.max(1, gridDims.width - 1);
    const texHeight = gridDims.height;
    if (gridDims.width <= 1 || gridDims.height <= 0) return;

    const dataArray = new Float32Array(texWidth * texHeight);
    for (let y = 0; y < texHeight; y++) {
      for (let x = 0; x < texWidth; x++) {
        const key = getHorizCmdConnectorKey(x, y);
        dataArray[y * texWidth + x] = cmdHorizConnectors[key] || 0;
      }
    }

    if (cmdHorizConnectorTexture && dataArray.length === cmdHorizConnectorTexture.image.data.length) {
      cmdHorizConnectorTexture.image.data.set(dataArray);
      cmdHorizConnectorTexture.needsUpdate = true;
    }
  }, [cmdHorizConnectors, gridDims, cmdHorizConnectorTexture]);

  // Set up frustum culling
  useEffect(() => {
    if (meshRef.current?.geometry) {
      meshRef.current.frustumCulled = true;
      meshRef.current.geometry.computeBoundingSphere();
    }
  }, [visualScale, meshRef.current?.geometry]);

  // If no data or invalid data, render nothing
  if (TOTAL_CIRCLES === 0) {
    return null;
  }

  // Unique keys for mesh recreation when dimensions change
  const meshKey = `viewer-${gridDims.width}-${gridDims.height}-${TOTAL_CIRCLES}-${showInactiveCircles ? 'with-inactive' : 'active-only'}`;
  const planeKey = `viewer-plane-${gridDims.width}-${gridDims.height}-${visualScale.toFixed(2)}`;

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, TOTAL_CIRCLES]}
        key={meshKey}
        position={[0, 0, -0.1]}
        frustumCulled={true}
      >
        <planeGeometry args={[1, 1]}>
          <instancedBufferAttribute
            ref={activationAttributeRef}
            attach="attributes-a_activated"
            args={[activationState, 1]}
            usage={THREE.DynamicDrawUsage}
          />
        </planeGeometry>
        {showInactiveCircles ? (
          // Use original circle material if showing inactive circles
          <circleMaterial
            ref={materialRef}
            transparent={true}
            key={CircleMaterial.key}
          />
        ) : (
          // Use our custom viewer material that only shows active circles
          <viewerCircleMaterial
            ref={materialRef}
            transparent={true}
            key={ViewerCircleMaterial.key}
          />
        )}
      </instancedMesh>

      {/* Main Connector Plane */}
      <mesh
        position={[0, 0, 0.1]}
        key={`${planeKey}-main`}
      >
        <planeGeometry args={[planeWidth, planeHeight]} />
        <connectorMaterial
          ref={connectorMaterialRef}
          key={ConnectorMaterial.key}
          transparent={true}
          side={THREE.DoubleSide}
          u_stateTexture={stateTexture}
          u_intendedConnectorTexture={intendedConnectorTexture}
          u_gridDimensions={[gridDims.width, gridDims.height]}
          u_textureResolution={[gridDims.width, gridDims.height]}
          u_radiusA={BASE_RADIUS_A}
          u_radiusB={BASE_RADIUS_B}
          u_gridSpacing={visualScale}
          u_centerOffset={[centerOffset.x, centerOffset.y]}
          u_planeSize={[planeWidth, planeHeight]}
        />
      </mesh>

      {/* Cmd-Click Horizontal Connector Plane */}
      <mesh
        position={[0, 0, 0.2]}
        key={`${planeKey}-cmd`}
      >
        <planeGeometry args={[planeWidth, planeHeight]} />
        <cmdHorizConnectorMaterial
          ref={cmdHorizMaterialRef}
          key={CmdHorizConnectorMaterial.key}
          transparent={true}
          side={THREE.DoubleSide}
          u_stateTexture={stateTexture}
          u_cmdHorizConnectorTexture={cmdHorizConnectorTexture}
          u_gridDimensions={[gridDims.width, gridDims.height]}
          u_textureResolution={[gridDims.width, gridDims.height]}
          u_radiusA={BASE_RADIUS_A}
          u_radiusB={BASE_RADIUS_B}
          u_gridSpacing={visualScale}
          u_fixedSpacing={FIXED_SPACING}
          u_centerOffset={[centerOffset.x, centerOffset.y]}
          u_planeSize={[planeWidth, planeHeight]}
        />
      </mesh>
    </group>
  );
};

export default GridViewer; 