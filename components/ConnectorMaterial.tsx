import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

// Define constants matching GridScene for defaults
// Moved to top to fix linter errors
const BASE_GRID_SPACING = 1.0;
const BASE_RADIUS_A = 0.5; // Outer radius relative to spacing=1
const BASE_RADIUS_B = 0.4; // Inner radius relative to spacing=1

// Vertex shader: Pass UVs
const vertexShader = /*glsl*/ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader: Draw connectors based on state texture and SDFs
const fragmentShader = /*glsl*/ `
  uniform sampler2D u_stateTexture;
  uniform vec2 u_gridDimensions;    // Grid size (width, height) in cells
  uniform vec2 u_textureResolution; // Texture size (width, height) in pixels
  uniform float u_radiusA;          // Outer radius (relative to cell spacing = 1.0)
  uniform float u_radiusB;          // Inner radius (relative to cell spacing = 1.0)
  uniform float u_gridSpacing;      // World space size of one grid cell

  varying vec2 vUv;

  // --- SDF Helper Functions ---
  float sdCircle(vec2 p, float r) {
      return length(p) - r;
  }

  // SDF for an axis-aligned box centered at origin
  float sdBox(vec2 p, vec2 b) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  // SDF for a line segment (used for horizontal connector)
  // Note: Simpler to use a box for thick horizontal line
  float sdSegment(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      return length(pa - ba * h);
  }

  // SDF for a capsule (segment with thickness)
  float sdCapsule( vec2 p, vec2 a, vec2 b, float r ){
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
  }

  float opUnion( float d1, float d2 ) { return min(d1, d2); }
  float opIntersection( float d1, float d2 ) { return max(d1, d2); }
  float opSubtraction( float d1, float d2 ) { return max(d1, -d2); }

  // --- State Sampling Helper ---
  float getState(ivec2 cellCoord) {
      // Clamp coordinates to valid texture range
      ivec2 clampedCoord = clamp(cellCoord, ivec2(0), ivec2(u_textureResolution) - ivec2(1));
      if (cellCoord != clampedCoord) return 0.0; // Return inactive if out of bounds
      return texelFetch(u_stateTexture, clampedCoord, 0).r;
  }

  // --- Coordinate Helpers ---
  // Get grid-space center of a cell (cell units, e.g., (0.5, 0.5), (1.5, 0.5), ...)
  vec2 getCellCenter(ivec2 cell) {
      return vec2(cell) + vec2(0.5); 
  }

  void main() {
    // Fragment position in continuous grid coordinates (origin BL, e.g., 0.0 to GRID_WIDTH)
    // Note: Plane origin is center, UVs are [0,1]. Need to map UV to grid coords.
    // Plane size is planeWidth = GRID_WIDTH * spacing, planeHeight = GRID_HEIGHT * spacing
    // World pos x = (uv.x - 0.5) * planeWidth
    // World pos y = (uv.y - 0.5) * planeHeight
    // Grid coord x = world_x / spacing - centerOffset.x / spacing + 0.5 ?? No, simpler:
    // Let's map UV directly to grid space [0, GRID_WIDTH] x [0, GRID_HEIGHT]
    vec2 gridCoord = vUv * u_gridDimensions;
    
    // Integer coordinates of the bottom-left cell this fragment might influence
    ivec2 cell_bl = ivec2(floor(gridCoord - vec2(0.5))); // Offset by 0.5 to center influence

    // Define the 4 cells involved in potential connectors around this point
    ivec2 cell_br = cell_bl + ivec2(1, 0);
    ivec2 cell_tl = cell_bl + ivec2(0, 1);
    ivec2 cell_tr = cell_bl + ivec2(1, 1);

    // Get activation states for the 4 cells
    float state_bl = getState(cell_bl);
    float state_br = getState(cell_br);
    float state_tl = getState(cell_tl);
    float state_tr = getState(cell_tr);

    // If no cells nearby are active, discard early (optimization)
    if (state_bl + state_br + state_tl + state_tr < 1.0) {
        discard;
    }

    // Get grid-space centers of the 4 cells
    vec2 center_bl = getCellCenter(cell_bl);
    vec2 center_br = getCellCenter(cell_br);
    vec2 center_tl = getCellCenter(cell_tl);
    vec2 center_tr = getCellCenter(cell_tr);

    // Fragment position relative to the center of the 4-cell BBox
    vec2 bboxCenter = (center_bl + center_tr) * 0.5;
    vec2 p = gridCoord - bboxCenter; // Position relative to bbox center

    float finalSdf = 1e6; // Initialize with a large positive value (outside)

    // --- Calculate potential connector SDFs (all in grid space) ---

    // 1. Horizontal (BL -> BR)
    if (state_bl == 1.0 && state_br == 1.0) {
        // Use a capsule (thick line) centered vertically within the cell row
        float sdf_h1 = sdCapsule(gridCoord, center_bl, center_br, u_radiusB); 
        // We only want the horizontal part, clip ends
        // Better: define a box centered between cells
        vec2 h_box_center = (center_bl + center_br) * 0.5;
        vec2 h_box_halfsize = vec2(0.5, u_radiusB); // Width is 1 cell, height is inner diameter
        float sdf_h_bl_br = sdBox(gridCoord - h_box_center, h_box_halfsize);
        finalSdf = opUnion(finalSdf, sdf_h_bl_br);
    }
    
    // 2. Horizontal (TL -> TR) - Similar logic
    if (state_tl == 1.0 && state_tr == 1.0) {
        vec2 h_box_center = (center_tl + center_tr) * 0.5;
        vec2 h_box_halfsize = vec2(0.5, u_radiusB);
        float sdf_h_tl_tr = sdBox(gridCoord - h_box_center, h_box_halfsize);
        finalSdf = opUnion(finalSdf, sdf_h_tl_tr);    
    }

    // 3. Diagonal \ (TL -> BR)
    if (state_tl == 1.0 && state_br == 1.0) {
        // Constraint a: Outside inner circles of connected TL & BR
        float sdf_outside_inner_conn = opIntersection(
            sdCircle(gridCoord - center_tl, u_radiusB), 
            sdCircle(gridCoord - center_br, u_radiusB)
        ); // Positive distance means outside both
        
        // Constraint b: Outside outer circles of non-connected BL & TR
        float sdf_outside_outer_non_conn = opIntersection(
            sdCircle(gridCoord - center_bl, u_radiusA), 
            sdCircle(gridCoord - center_tr, u_radiusA)
        );

        // Constraint c: Inside bounding box (size 1x1 cell units, centered)
        float sdf_inside_bbox = sdBox(p, vec2(0.5)); // p is already relative to bbox center
                                                     // Negative distance means inside

        // Combine constraints: Must satisfy a, b, and c
        // Valid area = NOT (outside_inner OR outside_outer OR outside_bbox)
        // SDF: intersection( outside_inner, outside_outer, -sdf_inside_bbox )
        // We want > 0 for outside inner/outer, and > 0 for inside bbox (-sdf_inside_bbox)
        float sdf_diag1_constraints = opIntersection(
            opIntersection(sdf_outside_inner_conn, sdf_outside_outer_non_conn),
            -sdf_inside_bbox // Negate to make inside positive
        );
        
        // If sdf_diag1_constraints > 0, we are in the valid zone. 
        // The actual connector shape is implicitly defined by this zone.
        // We want to fill where this is positive, so use -sdf as the distance field.
        finalSdf = opUnion(finalSdf, -sdf_diag1_constraints);
    }

    // 4. Diagonal / (BL -> TR)
    if (state_bl == 1.0 && state_tr == 1.0) {
        // Constraint a: Outside inner circles of connected BL & TR
        float sdf_outside_inner_conn = opIntersection(
            sdCircle(gridCoord - center_bl, u_radiusB), 
            sdCircle(gridCoord - center_tr, u_radiusB)
        );
        
        // Constraint b: Outside outer circles of non-connected TL & BR
        float sdf_outside_outer_non_conn = opIntersection(
            sdCircle(gridCoord - center_tl, u_radiusA), 
            sdCircle(gridCoord - center_br, u_radiusA)
        );

        // Constraint c: Inside bounding box (same as above)
        float sdf_inside_bbox = sdBox(p, vec2(0.5));

        // Combine constraints
        float sdf_diag2_constraints = opIntersection(
            opIntersection(sdf_outside_inner_conn, sdf_outside_outer_non_conn),
            -sdf_inside_bbox
        );
        
        // Union with final SDF
        finalSdf = opUnion(finalSdf, -sdf_diag2_constraints);
    }

    // --- Final Output ---
    // If finalSdf < 0, the fragment is inside a valid connector region
    if (finalSdf < 0.0) {
        // Antialiasing using screen-space derivatives
        float smoothFactor = fwidth(finalSdf) * 0.8; // Adjust multiplier for desired softness
        float alpha = smoothstep(smoothFactor, -smoothFactor, finalSdf);
        
        if (alpha > 0.0) { // Check alpha after smoothing
            gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); // Black connector, alpha based on smoothing
        } else {
             discard;
        }
    } else {
        discard; // Outside all connector regions
    }
  }
`;

// Create the shader material
const ConnectorMaterial = shaderMaterial(
  {
    u_stateTexture: null, 
    u_gridDimensions: new THREE.Vector2(10, 10),
    u_textureResolution: new THREE.Vector2(10, 10),
    u_radiusA: BASE_RADIUS_A, // Pass base radius relative to spacing=1
    u_radiusB: BASE_RADIUS_B, // Pass base radius relative to spacing=1
    u_gridSpacing: BASE_GRID_SPACING, // Pass base spacing
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