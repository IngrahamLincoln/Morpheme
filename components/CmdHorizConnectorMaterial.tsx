import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

// Constants from GridScene/ConnectorMaterial needed for calculations
const BASE_RADIUS_A = 0.5; // Outer radius relative to spacing=1
const BASE_RADIUS_B = 0.4; // Inner radius relative to spacing=1
const FIXED_SPACING = BASE_RADIUS_A + BASE_RADIUS_B; // 0.9

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
    // Using the fixed spacing value directly. Ensure this matches TS definition.
    float fixedSpacingValue = 0.9; // Direct value of BASE_RADIUS_A + BASE_RADIUS_B
    float worldX = float(cell.x) * fixedSpacingValue + u_centerOffset.x;
    float worldY = float(cell.y) * fixedSpacingValue + u_centerOffset.y;
    return vec2(worldX, worldY);
  }

  // --- Function to calculate SDF for a given row ---
  float calculateConnectorSDF(ivec2 baseCell, vec2 fragPos, float worldRadA, float worldRadB) {
    float sdf = 1e6; // Default to outside

    float cmdConn = getCmdHorizConnector(baseCell);
    if (cmdConn > 0.0) {
        ivec2 rightCell = baseCell + ivec2(1, 0);
        float stateL = getState(baseCell);
        float stateR = getState(rightCell);

        if (stateL == 1.0 && stateR == 1.0) {
            vec2 centerL = getCellWorldCenter(baseCell);
            vec2 centerR = getCellWorldCenter(rightCell);

            vec2 connCenter = (centerL + centerR) * 0.5;
            // REMOVED vertical shift: connCenter.y -= worldRadB * 0.15;

            float connWidth = distance(centerL, centerR);
            // Use inner radius (RadiusB) for thinner connector matching circle thickness
            float connHeight = worldRadB * 2.0; // Changed from worldRadA to worldRadB

            vec2 p = fragPos - connCenter;
            // No rotation needed for axis-aligned horizontal box
            // float angle = atan(centerR.y - centerL.y, centerR.x - centerL.x);
            // float c = cos(-angle);
            // float s = sin(-angle);
            // p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);

            sdf = sdBox2D(p, vec2(connWidth * 0.5, connHeight * 0.5));
        }
    }
    return sdf;
  }


  void main() {
    // Calculate fragment's world position
    vec2 planeOrigin = -u_planeSize * 0.5;
    vec2 fragWorldPos = planeOrigin + vUv * u_planeSize;

    // Determine the potential bottom-left cell based on floor
    float fixedSpacingValue = 0.9;
    vec2 gridCoord = (fragWorldPos - u_centerOffset) / fixedSpacingValue;
    ivec2 cell_bl_current = ivec2(floor(gridCoord)); // Cell for the current row floor

    // Define the cell for the row above
    ivec2 cell_bl_above = cell_bl_current + ivec2(0, 1);

    // Calculate world-space radii
    float worldRadiusA = u_radiusA * u_gridSpacing;
    float worldRadiusB = u_radiusB * u_gridSpacing;

    // Calculate SDF for the connector potentially in the current row
    float sdf_current = calculateConnectorSDF(cell_bl_current, fragWorldPos, worldRadiusA, worldRadiusB);

    // Calculate SDF for the connector potentially in the row above
    float sdf_above = calculateConnectorSDF(cell_bl_above, fragWorldPos, worldRadiusA, worldRadiusB);

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

// Create the shader material
const CmdHorizConnectorMaterial = shaderMaterial(
  {
    u_stateTexture: null,             // Will be passed from GridScene
    u_cmdHorizConnectorTexture: null, // Will be passed from GridScene
    u_gridDimensions: new THREE.Vector2(10, 10),
    u_textureResolution: new THREE.Vector2(10, 10), // Should match stateTexture size
    u_radiusA: BASE_RADIUS_A,
    u_radiusB: BASE_RADIUS_B,
    u_gridSpacing: 1.0, // Default scale
    u_centerOffset: new THREE.Vector2(0, 0),
    u_planeSize: new THREE.Vector2(10, 10),
  },
  vertexShader,
  fragmentShader
);

// Extend R3F
extend({ CmdHorizConnectorMaterial });

// Define TypeScript type for JSX usage
declare global {
  namespace JSX {
    interface IntrinsicElements {
      cmdHorizConnectorMaterial: any; // Use 'any' or define specific types
    }
  }
}

export default CmdHorizConnectorMaterial; 