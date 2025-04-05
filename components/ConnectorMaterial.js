import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

// Define uniforms and shader code
// Adapted for InstancedMesh with matrix-based positioning

const ConnectorMaterial = shaderMaterial(
  // Uniforms (global settings)
  {
    u_radiusB: 0.4, // Inner circle radius
    u_radiusA: 0.5, // Outer circle radius
    u_spacing: 1.5,
    u_resolution: new THREE.Vector2(1, 1),
  },
  // Vertex Shader - Pass instance visibility and world center
  /*glsl*/`
    // Instance attributes
    attribute float a_instanceShowInner;
    attribute float a_instanceShowOuter;

    // Varyings to pass data to fragment shader
    varying vec2 vUv;
    varying vec2 vWorldPos;
    varying vec2 vInstanceCenterWorld; // Pass instance center in world space
    varying float v_showInner;
    varying float v_showOuter;

    void main() {
      vUv = uv;
      v_showInner = a_instanceShowInner;
      v_showOuter = a_instanceShowOuter;

      // World position of the vertex
      vec4 worldPos = instanceMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xy;
      
      // World position of the instance center (origin of the instance's local space)
      vec4 instanceCenterWorld = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vInstanceCenterWorld = instanceCenterWorld.xy;
      
      gl_Position = projectionMatrix * modelViewMatrix * worldPos;
    }
  `,
  // Fragment Shader - Use instance visibility and world center
  /*glsl*/`
    varying vec2 vUv;
    varying vec2 vWorldPos;
    varying vec2 vInstanceCenterWorld;
    varying float v_showInner;
    varying float v_showOuter;

    uniform float u_radiusB; // Inner circle radius
    uniform float u_radiusA; // Outer circle radius
    uniform float u_spacing;
    uniform vec2 u_resolution;

    void main() {
      // Calculate distance from pixel's world position to the instance's world center
      float dist = length(vWorldPos - vInstanceCenterWorld);
      
      // Signed distance field for inner circle (radiusB)
      float innerCircleSDF = dist - u_radiusB;
      
      // Signed distance field for outer circle (radiusA)
      float outerCircleSDF = dist - u_radiusA;
      
      // Edge width for anti-aliasing
      float edgeWidth = 0.01;
      
      // Line width for outlines
      float lineWidth = 0.01;
      
      // Inner circle - use v_showInner (attribute)
      float innerAlpha = 0.0;
      bool isInnerVisible = v_showInner > 0.5;
      if (isInnerVisible) {
        // Full circle
        innerAlpha = 1.0 - smoothstep(-edgeWidth, edgeWidth, innerCircleSDF);
      } else {
        // Just an outline
        innerAlpha = (1.0 - smoothstep(-lineWidth/2.0, lineWidth/2.0, abs(innerCircleSDF) - lineWidth/2.0)) * 0.8;
      }
      
      // Outer circle - use v_showOuter (attribute)
      float ringAlpha = 0.0;
      bool isOuterVisible = v_showOuter > 0.5;
      // Always render outer circle as outline only, never filled
      ringAlpha = (1.0 - smoothstep(-lineWidth/2.0, lineWidth/2.0, abs(outerCircleSDF) - lineWidth/2.0)) * 0.8;
      
      // Combine both shapes
      float finalAlpha = max(innerAlpha, ringAlpha * 0.7);
      
      // If nearly transparent, discard the pixel
      if (finalAlpha < 0.01) discard;
      
      // Create different colors based on instance visibility
      vec3 innerColor = isInnerVisible ? vec3(0.0) : vec3(0.3); // Black when on, gray when outline
      vec3 ringColor = vec3(0.5);  // Always light gray for outer circle outline
      
      // Determine final color
      vec3 color = vec3(1.0); // Default white (shouldn't be visible)
      if(abs(innerCircleSDF) < lineWidth / 2.0 + edgeWidth && !isInnerVisible) {
        color = innerColor; // Inner outline
      } else if (abs(outerCircleSDF) < lineWidth / 2.0 + edgeWidth) {
         color = ringColor; // Outer outline - always render as outline
      } else if (innerCircleSDF < 0.0 && isInnerVisible) {
        color = innerColor; // Inner fill
      } 
      // Removed the else if for outer circle fill since we never want it filled

      // Output with calculated alpha
      gl_FragColor = vec4(color, finalAlpha);
    }
  `
);

// Add a unique key for HMR purposes with R3F
ConnectorMaterial.key = THREE.MathUtils.generateUUID();

export { ConnectorMaterial }; 