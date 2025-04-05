import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

// A very simple connector material for debugging
const SimpleConnectorMaterial = shaderMaterial(
  // Uniforms
  {
    u_radiusB: 0.4, // Radius for target circles B1, B2 (inner)
    u_radiusA: 0.5, // Radius for defining circles A1, A2 (outer)
    u_boxSize: 0.5, // Default half-size for the bounding box 
    u_spacing: 0.89, // Grid spacing between centers
    u_activeConnector: 0, // 0 = none, 1 = red (AB), 2 = blue (CD)
    u_gridState: new THREE.DataTexture( // Add grid state texture
      new Float32Array(4), // RGBA values per cell
      2, // width (for 2x2 grid)
      2, // height (for 2x2 grid)
      THREE.RGBAFormat,
      THREE.FloatType
    )
    // u_thickness, u_curvature, u_resolution are removed as they are not needed for this SDF logic
  },
  // Vertex Shader
  /*glsl*/`
    varying vec2 vUv;
    varying vec2 vWorldPos;

    void main() {
      vUv = uv;

      // World position of the vertex
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xy;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  /*glsl*/`
    varying vec2 vUv;
    varying vec2 vWorldPos; // Pixel position in world space

    uniform float u_radiusB; // Radius for target circles B1, B2
    uniform float u_radiusA; // Radius for defining circles A1, A2
    uniform float u_boxSize; // Receive box size from JS
    uniform float u_spacing; // Grid spacing between centers
    uniform float u_activeConnector; // 0 = none, 1 = red (AB), 2 = blue (CD)
    uniform sampler2D u_gridState; // Grid state texture

    // Helper function to get circle state from the grid state texture
    vec4 getGridState(int row, int col) {
      return texture2D(u_gridState, vec2(float(col) + 0.5, float(row) + 0.5) / 2.0);
    }

    // SDF for a 2D circle
    float sdCircle( vec2 p, vec2 c, float r ) {
        return length(p-c) - r;
    }

    // SDF for a 2D Box
    // p: point, c: center, b: half-size
    float sdBox( vec2 p, vec2 c, vec2 b ) {
        vec2 q = abs(p - c) - b;
        return length(max(q,0.0)) + min(max(q.x,q.y),0.0);
    }

    // Smooth minimum function (use log/exp, base-e is fine)
    float smin( float a, float b, float k ) {
        float h = clamp( 0.5 + 0.5*(b-a)/k, 0.0, 1.0 );
        return mix( b, a, h ) - k*h*(1.0-h);
        // Alternative formulation using exp:
        // k = max(k, 0.0001); // Ensure k is positive
        // return -log(exp(-k*a) + exp(-k*b))/k;
    }

    void main() {
      // If no connector is active, discard immediately
      if (u_activeConnector < 0.5) {
        discard;
        return;
      }
      
      // Check if relevant circles are active
      vec4 stateA = getGridState(0, 0); // Top-left
      vec4 stateB = getGridState(1, 1); // Bottom-right
      vec4 stateC = getGridState(1, 0); // Bottom-left  
      vec4 stateD = getGridState(0, 1); // Top-right
      
      // Check if inner circles are active (red channel = inner circle)
      bool circleB1Active = stateA.r > 0.5; // Top-left inner circle
      bool circleB2Active = stateB.r > 0.5; // Bottom-right inner circle
      bool circleA1Active = stateC.r > 0.5; // Bottom-left inner circle
      bool circleA2Active = stateD.r > 0.5; // Top-right inner circle
      
      // Determine which connector to draw based on active connector state
      bool drawRedConnector = u_activeConnector == 1.0;
      bool drawBlueConnector = u_activeConnector == 2.0;
      
      // Verify the required circles are active for the selected connector
      if (drawRedConnector && (!circleB1Active || !circleB2Active)) {
        discard;
        return;
      }
      
      if (drawBlueConnector && (!circleA1Active || !circleA2Active)) {
        discard;
        return;
      }
    
      // Calculate offset based on half the grid spacing
      float offset = u_spacing * 0.5;
      
      // Define circle centers dynamically based on grid spacing
      vec2 centerB1 = vec2(-offset, offset);    // Top-left
      vec2 centerB2 = vec2(offset, -offset);    // Bottom-right
      vec2 centerA1 = vec2(-offset, -offset);   // Bottom-left
      vec2 centerA2 = vec2(offset, offset);     // Top-right

      // Calculate SDFs for each circle - both inner and outer radii
      // Inner circles (B radius)
      float sdB1Inner = sdCircle(vWorldPos, centerB1, u_radiusB);
      float sdB2Inner = sdCircle(vWorldPos, centerB2, u_radiusB);
      float sdA1Inner = sdCircle(vWorldPos, centerA1, u_radiusB);
      float sdA2Inner = sdCircle(vWorldPos, centerA2, u_radiusB);
      
      // Outer circles (A radius)
      float sdB1Outer = sdCircle(vWorldPos, centerB1, u_radiusA);
      float sdB2Outer = sdCircle(vWorldPos, centerB2, u_radiusA);
      float sdA1Outer = sdCircle(vWorldPos, centerA1, u_radiusA);
      float sdA2Outer = sdCircle(vWorldPos, centerA2, u_radiusA);
      
      // Calculate SDF for a bounding box using the uniform size
      vec2 boxCenter = vec2(0.0);
      vec2 boxHalfSize = vec2(u_boxSize);
      float sdfBoundingBox = sdBox(vWorldPos, boxCenter, boxHalfSize);
      
      // Calculate connector shapes based on the new specifications
      
      // Red connector (B1-B2 diagonal):
      // - Must be outside inner B circles (B1 and B2)
      // - Must be outside outer A circles (A1 and A2)
      float sdRedConnector = 1.0;
      if (drawRedConnector) {
        bool outsideInnerB = (sdB1Inner > 0.0) && (sdB2Inner > 0.0);
        bool outsideOuterA = (sdA1Outer > 0.0) && (sdA2Outer > 0.0);
        
        if (outsideInnerB && outsideOuterA && sdfBoundingBox < 0.0) {
          sdRedConnector = -1.0; // Inside the connector
        }
      }
      
      // Blue connector (A1-A2 diagonal):
      // - Must be outside inner A circles (A1 and A2)
      // - Must be outside outer B circles (B1 and B2)
      float sdBlueConnector = 1.0;
      if (drawBlueConnector) {
        bool outsideInnerA = (sdA1Inner > 0.0) && (sdA2Inner > 0.0);
        bool outsideOuterB = (sdB1Outer > 0.0) && (sdB2Outer > 0.0);
        
        if (outsideInnerA && outsideOuterB && sdfBoundingBox < 0.0) {
          sdBlueConnector = -1.0; // Inside the connector
        }
      }
      
      // Determine if we're inside either connector
      if (sdRedConnector < 0.0 || sdBlueConnector < 0.0) {
        // Choose color based on which connector we're inside
        if (sdRedConnector < 0.0) {
          // Red connector
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red
        } else {
          // Blue connector
          gl_FragColor = vec4(0.0, 0.5, 1.0, 1.0); // Blue
        }
      } else {
        discard; // Outside both connectors
      }
    }
  `
);

// Add a unique key for HMR purposes with R3F
SimpleConnectorMaterial.key = THREE.MathUtils.generateUUID();

export { SimpleConnectorMaterial }; 