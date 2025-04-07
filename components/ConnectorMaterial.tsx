import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

// Define constants matching GridScene for defaults
// Moved to top to fix linter errors
const BASE_GRID_SPACING = 1.0;
const BASE_RADIUS_A = 0.5; // Outer radius relative to spacing=1
const BASE_RADIUS_B = 0.4; // Inner radius relative to spacing=1
// Fixed spacing is BASE_RADIUS_A + BASE_RADIUS_B = 0.9
const FIXED_SPACING = BASE_RADIUS_A + BASE_RADIUS_B;

// Define connector types as constants - must match GridScene.tsx
const CONNECTOR_NONE = 0;
const CONNECTOR_DIAG_TL_BR = 1; // Diagonal \
const CONNECTOR_DIAG_BL_TR = 2; // Diagonal /
const CONNECTOR_HORIZ_T = 3;    // Horizontal Top
const CONNECTOR_HORIZ_B = 4;    // Horizontal Bottom

// Vertex shader: Pass UVs
const vertexShader = /*glsl*/ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader: Updated to use world space coordinates
const fragmentShader = /*glsl*/ `
  uniform sampler2D u_stateTexture;
  uniform sampler2D u_intendedConnectorTexture;
  uniform vec2 u_gridDimensions;    // Grid size (width, height) in cells
  uniform vec2 u_textureResolution; // Texture size (width, height) in pixels
  uniform float u_radiusA;          // Outer radius (base value)
  uniform float u_radiusB;          // Inner radius (base value)
  uniform float u_gridSpacing;      // Visual scale factor
  // World space uniforms
  uniform vec2 u_centerOffset;      // World offset for centering grid
  uniform vec2 u_planeSize;         // World size of connector plane

  varying vec2 vUv;

  // --- SDF Helper Functions ---
  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }

  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    return sdSegment(p, a, b) - r;
  }

  float opUnion(float d1, float d2) { return min(d1, d2); }
  float opIntersection(float d1, float d2) { return max(d1, d2); }
  float opSubtraction(float d1, float d2) { return max(d1, -d2); }

  // --- State Sampling Helper ---
  float getState(ivec2 cellCoord) {
    ivec2 clampedCoord = clamp(cellCoord, ivec2(0), ivec2(u_textureResolution) - ivec2(1));
    if (cellCoord != clampedCoord) return 0.0;
    return texelFetch(u_stateTexture, clampedCoord, 0).r;
  }

  // --- Intended Connector Sampling ---
  float getIntendedConnector(ivec2 cellCoord) {
    // The connector texture is (gridSize-1)×(gridSize-1)
    ivec2 connTextureSize = ivec2(u_textureResolution) - ivec2(1);
    ivec2 clampedCoord = clamp(cellCoord, ivec2(0), connTextureSize - ivec2(1));
    if (cellCoord != clampedCoord) return 0.0;
    return texelFetch(u_intendedConnectorTexture, clampedCoord, 0).r;
  }

  // --- Get Cell Center in World Space ---
  vec2 getCellWorldCenter(ivec2 cell) {
    float worldX = float(cell.x) * ${FIXED_SPACING} + u_centerOffset.x;
    float worldY = float(cell.y) * ${FIXED_SPACING} + u_centerOffset.y;
    return vec2(worldX, worldY);
  }

  void main() {
    // Calculate fragment's world position
    vec2 planeOrigin = -u_planeSize * 0.5; // Assuming plane is centered at (0,0)
    vec2 fragWorldPos = planeOrigin + vUv * u_planeSize;
    
    // Determine which cell this fragment is in (find nearest cell)
    vec2 gridCoord = (fragWorldPos - u_centerOffset) / ${FIXED_SPACING};
    ivec2 cell_bl = ivec2(floor(gridCoord));
    
    // Define neighbor cells
    ivec2 cell_br = cell_bl + ivec2(1, 0);
    ivec2 cell_tl = cell_bl + ivec2(0, 1);
    ivec2 cell_tr = cell_bl + ivec2(1, 1);

    // Check if this is a valid 2x2 cell group
    bool isValidGroup = 
      cell_bl.x >= 0 && cell_bl.x < int(u_gridDimensions.x) - 1 &&
      cell_bl.y >= 0 && cell_bl.y < int(u_gridDimensions.y) - 1;
    
    if (!isValidGroup) {
      discard;
      return;
    }

    // Get states for all 4 cells around this fragment
    float state_bl = getState(cell_bl);
    float state_br = getState(cell_br);
    float state_tl = getState(cell_tl);
    float state_tr = getState(cell_tr);

    // Get intended connector for this cell group
    float intendedConnector = getIntendedConnector(cell_bl);

    // Get cell centers in world space
    vec2 center_bl = getCellWorldCenter(cell_bl);
    vec2 center_br = getCellWorldCenter(cell_br);
    vec2 center_tl = getCellWorldCenter(cell_tl);
    vec2 center_tr = getCellWorldCenter(cell_tr);

    // Calculate bounding box in world space
    vec2 bboxCenter = (center_bl + center_br + center_tl + center_tr) * 0.25;
    vec2 bboxHalfSize = vec2(${FIXED_SPACING} * 0.5);

    // Calculate world-space radii
    float worldRadiusA = u_radiusA * u_gridSpacing;
    float worldRadiusB = u_radiusB * u_gridSpacing;

    float finalSdf = 1e6;

    // --- Diagonal \\ (TL to BR) Connector ---
    if (state_tl == 1.0 && state_br == 1.0 && (intendedConnector == 1.0 || intendedConnector == 0.0)) {
      // Create connector path
      float sdf_capsule_tl_br = sdCapsule(fragWorldPos, center_tl, center_br, worldRadiusB);
      
      // Must be outside the outer circles of TR and BL
      float sdf_outside_tr_outer = sdCircle(fragWorldPos - center_tr, worldRadiusA);
      float sdf_outside_bl_outer = sdCircle(fragWorldPos - center_bl, worldRadiusA);
      
      // Must be inside the bounding box
      float sdf_inside_bbox = sdBox(fragWorldPos - bboxCenter, bboxHalfSize);
      
      // Combine all constraints
      float sdf_diag1 = sdf_capsule_tl_br;
      sdf_diag1 = max(sdf_diag1, -sdf_outside_tr_outer); // Intersection with "outside TR outer"
      sdf_diag1 = max(sdf_diag1, -sdf_outside_bl_outer); // Intersection with "outside BL outer"
      sdf_diag1 = max(sdf_diag1, sdf_inside_bbox);       // Intersection with "inside bbox"

      // Only show the connector if it's explicitly selected
      if (intendedConnector == 1.0) {
        finalSdf = min(finalSdf, sdf_diag1);
      }
    }

    // --- Diagonal / (BL to TR) Connector ---
    if (state_bl == 1.0 && state_tr == 1.0 && (intendedConnector == 2.0 || intendedConnector == 0.0)) {
      // Create connector path
      float sdf_capsule_bl_tr = sdCapsule(fragWorldPos, center_bl, center_tr, worldRadiusB);
      
      // Must be outside the outer circles of TL and BR
      float sdf_outside_tl_outer = sdCircle(fragWorldPos - center_tl, worldRadiusA);
      float sdf_outside_br_outer = sdCircle(fragWorldPos - center_br, worldRadiusA);
      
      // Must be inside the bounding box
      float sdf_inside_bbox = sdBox(fragWorldPos - bboxCenter, bboxHalfSize);
      
      // Combine all constraints
      float sdf_diag2 = sdf_capsule_bl_tr;
      sdf_diag2 = max(sdf_diag2, -sdf_outside_tl_outer);
      sdf_diag2 = max(sdf_diag2, -sdf_outside_br_outer);
      sdf_diag2 = max(sdf_diag2, sdf_inside_bbox);

      // Only show the connector if it's explicitly selected
      if (intendedConnector == 2.0) {
        finalSdf = min(finalSdf, sdf_diag2);
      }
    }

    // --- Horizontal (BL to BR) Connector ---
    if (state_bl == 1.0 && state_br == 1.0 && (intendedConnector == 4.0 || intendedConnector == 0.0)) {
      float sdf_h_bottom = sdCapsule(fragWorldPos, center_bl, center_br, worldRadiusB);
      
      // Only show the connector if it's explicitly selected
      if (intendedConnector == 4.0) {
        finalSdf = min(finalSdf, sdf_h_bottom);
      }
    }

    // --- Horizontal (TL to TR) Connector ---
    if (state_tl == 1.0 && state_tr == 1.0 && (intendedConnector == 3.0 || intendedConnector == 0.0)) {
      float sdf_h_top = sdCapsule(fragWorldPos, center_tl, center_tr, worldRadiusB);
      
      // Only show the connector if it's explicitly selected
      if (intendedConnector == 3.0) {
        finalSdf = min(finalSdf, sdf_h_top);
      }
    }

    // --- Final Output with Anti-aliasing ---
    if (finalSdf < 0.0) {
      float smoothFactor = fwidth(finalSdf) * 0.8;
      float alpha = smoothstep(smoothFactor, -smoothFactor, finalSdf);
      
      if (alpha > 0.01) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
      } else {
        discard;
      }
    } else {
      discard;
    }
  }
`;

// Create the shader material
const ConnectorMaterial = shaderMaterial(
  {
    u_stateTexture: null, 
    u_intendedConnectorTexture: null,
    u_gridDimensions: new THREE.Vector2(10, 10),
    u_textureResolution: new THREE.Vector2(10, 10),
    u_radiusA: BASE_RADIUS_A,
    u_radiusB: BASE_RADIUS_B,
    u_gridSpacing: BASE_GRID_SPACING,
    // New uniforms for world space calculations
    u_centerOffset: new THREE.Vector2(0, 0),
    u_planeSize: new THREE.Vector2(10, 10),
  },
  vertexShader,
  fragmentShader
);

// Extend R3F
extend({ ConnectorMaterial });

// Define TypeScript type for JSX usage
declare global {
  namespace JSX {
    interface IntrinsicElements {
      connectorMaterial: any; 
    }
  }
}

export default ConnectorMaterial;
// Define constants matching GridScene for defaults (optional, but helps IDE)
// Moved to top - Removing these commented out versions
// const BASE_GRID_SPACING = 1.0;
// const BASE_RADIUS_A = 0.5;
// const BASE_RADIUS_B = 0.4; 
