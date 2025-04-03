import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

// Define uniforms and shader code
// With inner and outer circle visibility toggle and outlines

const ConnectorMaterial = shaderMaterial(
  // Uniforms (inputs to the shader)
  {
    u_radiusB: 0.4, // Inner circle radius
    u_radiusA: 0.5, // Outer circle radius
    u_spacing: 1.5,
    u_center1: new THREE.Vector2(0, 0),
    u_center2: new THREE.Vector2(0, 0),
    u_resolution: new THREE.Vector2(1, 1),
    u_showInnerCircle: { value: true }, // Toggle flag for inner circle
    u_showOuterCircle: { value: true }, // Toggle flag for outer circle
  },
  // Vertex Shader (usually simple for 2D planes)
  /*glsl*/`
    varying vec2 vUv;
    varying vec2 vWorldPos; // Pass world position

    void main() {
      vUv = uv;
      // Calculate world position (assuming plane is at z=0)
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader - with inner and outer circles
  /*glsl*/`
    varying vec2 vUv;
    varying vec2 vWorldPos;

    uniform float u_radiusB; // Inner circle radius
    uniform float u_radiusA; // Outer circle radius
    uniform float u_spacing;
    uniform vec2 u_center1;
    uniform vec2 u_center2;
    uniform vec2 u_resolution;
    uniform bool u_showInnerCircle; // Toggle flag for inner circle
    uniform bool u_showOuterCircle; // Toggle flag for outer circle

    void main() {
      // Get the pixel's world position
      vec2 p = vWorldPos;

      // Calculate distance to center
      float dist = length(p);
      
      // Signed distance field for inner circle (radiusB)
      float innerCircleSDF = dist - u_radiusB;
      
      // Signed distance field for outer circle (radiusA)
      float outerCircleSDF = dist - u_radiusA;
      
      // Edge width for anti-aliasing
      float edgeWidth = 0.01;
      
      // Line width for outlines
      float lineWidth = 0.01;
      
      // Inner circle
      float innerAlpha = 0.0;
      if (u_showInnerCircle) {
        // Full circle
        innerAlpha = 1.0 - smoothstep(-edgeWidth, edgeWidth, innerCircleSDF);
      } else {
        // Just an outline
        innerAlpha = (1.0 - smoothstep(-lineWidth/2.0, lineWidth/2.0, abs(innerCircleSDF) - lineWidth/2.0)) * 0.8;
      }
      
      // Outer circle
      float ringAlpha = 0.0;
      if (u_showOuterCircle) {
        // Full outer ring
        float insideOuter = 1.0 - smoothstep(-edgeWidth, edgeWidth, outerCircleSDF);
        float innerMask = u_showInnerCircle ? innerAlpha : 0.0;
        ringAlpha = insideOuter - innerMask;
      } else {
        // Just an outline for the outer circle
        ringAlpha = (1.0 - smoothstep(-lineWidth/2.0, lineWidth/2.0, abs(outerCircleSDF) - lineWidth/2.0)) * 0.8;
      }
      
      // Combine both shapes
      float finalAlpha = max(innerAlpha, ringAlpha * 0.7); 
      
      // If nearly transparent, discard the pixel
      if (finalAlpha < 0.01) discard;
      
      // Create different colors
      vec3 innerColor = u_showInnerCircle ? vec3(0.0) : vec3(0.3); // Black when on, gray when outline
      vec3 ringColor = u_showOuterCircle ? vec3(0.3) : vec3(0.5);  // Dark gray when on, lighter gray when outline
      
      // Mix colors based on where we are
      vec3 color;
      if (abs(innerCircleSDF) < lineWidth && !u_showInnerCircle) {
        // Inner circle outline
        color = innerColor;
      } else if (abs(outerCircleSDF) < lineWidth && !u_showOuterCircle) {
        // Outer circle outline
        color = ringColor;
      } else if (innerCircleSDF < 0.0 && u_showInnerCircle) {
        // Inner circle fill
        color = innerColor;
      } else if (outerCircleSDF < 0.0 && innerCircleSDF > 0.0 && u_showOuterCircle) {
        // Outer ring fill
        color = ringColor;
      } else {
        // Default (shouldn't reach here often)
        color = mix(ringColor, innerColor, step(0.01, innerAlpha));
      }
      
      // Output with calculated alpha
      gl_FragColor = vec4(color, finalAlpha);
    }
  `
);

// Add a unique key for HMR purposes with R3F
ConnectorMaterial.key = THREE.MathUtils.generateUUID();

export { ConnectorMaterial }; 