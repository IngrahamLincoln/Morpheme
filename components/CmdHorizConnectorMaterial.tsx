import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend, MaterialNode } from '@react-three/fiber'; // Import MaterialNode
import { BASE_RADIUS_A, BASE_RADIUS_B, FIXED_SPACING } from './constants'; // Import geometry constants

// Vertex shader: Pass UVs (same as ConnectorMaterial)
const vertexShader = /*glsl*/ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader: Only for Cmd-Click Horizontal Connectors
const fragmentShader = /*glsl*/ `
  uniform sampler2D u_stateTexture;             // Need state to confirm circles are active
  uniform sampler2D u_cmdHorizConnectorTexture; // Texture for cmd-click horizontal connectors
  uniform vec2 u_gridDimensions;            // Grid size (width, height) in cells
  uniform vec2 u_textureResolution;         // State Texture size (width, height) in pixels
  uniform float u_radiusA;                  // Outer radius (base value)
  uniform float u_radiusB;                  // Inner radius (base value)
  uniform float u_gridSpacing;              // Visual scale factor (from Leva)
  uniform float u_fixedSpacing;             // Base spacing between circle centers (e.g., 0.9)
  // World space uniforms
  uniform vec2 u_centerOffset;              // World offset for centering grid
  uniform vec2 u_planeSize;                 // World size of connector plane

  varying vec2 vUv;

  // --- SDF Helper Functions ---
  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }

  // SDF function for rectangle with sharp corners
  float sdBox2D(vec2 p, vec2 halfSize) {
    vec2 d = abs(p) - halfSize;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  // --- State Sampling Helper ---
  float getState(ivec2 cellCoord) {
    // Use u_textureResolution (size of stateTexture) for clamping
    ivec2 clampedCoord = clamp(cellCoord, ivec2(0), ivec2(u_textureResolution) - ivec2(1));
    if (cellCoord != clampedCoord) return 0.0;
    return texelFetch(u_stateTexture, clampedCoord, 0).r;
  }

  // --- Cmd-Click Horizontal Connector Sampling ---
  float getCmdHorizConnector(ivec2 cellCoord) {
    // The cmd-horiz texture is (gridWidth-1) x gridHeight
    ivec2 horizTextureSize = ivec2(u_gridDimensions.x - 1.0, u_gridDimensions.y);
     // Check bounds against the actual size of the cmdHorizConnectorTexture
    if (cellCoord.x < 0 || cellCoord.x >= horizTextureSize.x ||
        cellCoord.y < 0 || cellCoord.y >= horizTextureSize.y) {
      return 0.0;
    }
    // Fetch from the dedicated texture
    return texelFetch(u_cmdHorizConnectorTexture, cellCoord, 0).r;
  }

  // --- Get Cell Center in World Space ---
  vec2 getCellWorldCenter(ivec2 cell) {
    // Calculate scaled spacing
    float scaledSpacing = u_fixedSpacing * u_gridSpacing;
    float worldX = float(cell.x) * scaledSpacing + u_centerOffset.x;
    float worldY = float(cell.y) * scaledSpacing + u_centerOffset.y;
    return vec2(worldX, worldY);
  }

  // --- Function to calculate SDF for a given row ---
  float calculateConnectorSDF(ivec2 baseCell, vec2 fragPos, float worldRadA, float worldRadB, float scaledSpacing) {
    float sdf = 1e6; // Default to outside

    float cmdConn = getCmdHorizConnector(baseCell);
    if (cmdConn > 0.0) {
        ivec2 rightCell = baseCell + ivec2(1, 0);
        float stateL = getState(baseCell);
        float stateR = getState(rightCell);

        if (stateL == 1.0 && stateR == 1.0) {
            vec2 centerL = getCellWorldCenter(baseCell); // Uses scaled spacing internally now
            vec2 centerR = getCellWorldCenter(rightCell); // Uses scaled spacing internally now

            vec2 connCenter = (centerL + centerR) * 0.5;

            // Use scaled spacing for width calculation too
            float connWidth = scaledSpacing; // Width is simply the distance between centers
            // Use inner radius (RadiusB) for thinner connector matching circle thickness
            // Add a small epsilon to ensure overlap between rows
            float connHeight = worldRadB * 2.0 + 0.01 * u_gridSpacing; // Added small overlap based on scale

            vec2 p = fragPos - connCenter;

            sdf = sdBox2D(p, vec2(connWidth * 0.5, connHeight * 0.5));
        }
    }
    return sdf;
  }


  void main() {
    // Calculate fragment's world position
    vec2 planeOrigin = -u_planeSize * 0.5;
    vec2 fragWorldPos = planeOrigin + vUv * u_planeSize;

    // Calculate scaled spacing consistently
    float scaledSpacing = u_fixedSpacing * u_gridSpacing;

    // Determine the potential bottom-left cell based on floor, using scaled spacing
    // Add a small offset (0.5) before flooring to handle positions exactly on the boundary better? Maybe not needed yet.
    vec2 gridCoord = (fragWorldPos - u_centerOffset) / scaledSpacing;
    ivec2 cell_bl_current = ivec2(floor(gridCoord)); // Cell for the current row floor

    // Define the cell for the row above
    ivec2 cell_bl_above = cell_bl_current + ivec2(0, 1);

    // Calculate world-space radii (these are already scaled by u_gridSpacing in GridScene and passed)
    // Wait, radiusA/B are BASE values. Scale them here.
    float worldRadiusA = u_radiusA * u_gridSpacing;
    float worldRadiusB = u_radiusB * u_gridSpacing;

    // Calculate SDF for the connector potentially in the current row
    float sdf_current = calculateConnectorSDF(cell_bl_current, fragWorldPos, worldRadiusA, worldRadiusB, scaledSpacing);

    // Calculate SDF for the connector potentially in the row above
    float sdf_above = calculateConnectorSDF(cell_bl_above, fragWorldPos, worldRadiusA, worldRadiusB, scaledSpacing);

    // The final SDF is the minimum of the two (closest connector wins)
    float finalSdf = min(sdf_current, sdf_above);

    // Final Output: Draw if inside the combined SDF
    if (finalSdf < 0.0) {
      float smoothFactor = fwidth(finalSdf) * 0.8; // Anti-aliasing
      float alpha = smoothstep(smoothFactor, -smoothFactor, finalSdf);

      if (alpha > 0.01) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); // Black connector
      } else {
        discard; // Discard transparent fragments
      }
    } else {
      discard; // Discard fragments outside the shape
    }
  }
`;

// Interface for the uniforms
interface CmdHorizConnectorMaterialUniforms {
  u_stateTexture: THREE.Texture | null;
  u_cmdHorizConnectorTexture: THREE.Texture | null;
  u_gridDimensions: THREE.Vector2;
  u_textureResolution: THREE.Vector2; // Should match stateTexture size
  u_radiusA: number;
  u_radiusB: number;
  u_gridSpacing: number; // Visual scale multiplier
  u_fixedSpacing: number; // Base fixed spacing
  u_centerOffset: THREE.Vector2;
  u_planeSize: THREE.Vector2;
}

// Create the shader material
const CmdHorizConnectorMaterial = shaderMaterial(
  // Uniforms definition with initial values
  {
    u_stateTexture: null,             // Will be passed from GridScene
    u_cmdHorizConnectorTexture: null, // Will be passed from GridScene
    u_gridDimensions: new THREE.Vector2(10, 10),
    u_textureResolution: new THREE.Vector2(10, 10),
    u_radiusA: BASE_RADIUS_A,
    u_radiusB: BASE_RADIUS_B,
    u_gridSpacing: 1.0, // Default scale
    u_fixedSpacing: FIXED_SPACING, // Pass the base fixed spacing
    u_centerOffset: new THREE.Vector2(0, 0),
    u_planeSize: new THREE.Vector2(10, 10),
  } satisfies CmdHorizConnectorMaterialUniforms, // Use satisfies for type checking
  vertexShader,
  fragmentShader
);

// Extend R3F
extend({ CmdHorizConnectorMaterial });

// Define TypeScript type for JSX usage
declare global {
  namespace JSX {
    interface IntrinsicElements {
      cmdHorizConnectorMaterial: MaterialNode<THREE.ShaderMaterial, CmdHorizConnectorMaterialUniforms>;
    }
  }
}

export default CmdHorizConnectorMaterial; 