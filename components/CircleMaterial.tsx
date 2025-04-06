import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

// Simple vertex shader
const vertexShader = /*glsl*/ `
  varying vec2 vUv;
  attribute float a_activated; // Will be used in Feature 4
  varying float v_activated;   // Will be used in Feature 4
  void main() {
    vUv = uv;
    v_activated = a_activated; // Pass activation state
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader to draw two concentric circles
const fragmentShader = /*glsl*/ `
  uniform float u_radiusA;      // Outer radius (scaled relative to instance size)
  uniform float u_radiusB;      // Inner radius (scaled relative to instance size)
  uniform vec3 u_bgColor;       // Background color (or transparent)
  uniform vec3 u_outerColor;    // Color of the outer ring
  uniform vec3 u_innerColorEmpty; // Color of the inner circle when inactive
  uniform vec3 u_innerColorActive;// Color of the inner circle when active

  varying vec2 vUv;
  varying float v_activated; // Read from vertex shader (comes from a_activated attribute)

  void main() {
    float dist = distance(vUv, vec2(0.5));

    if (dist > u_radiusA) {
        discard; // Outside outer circle
    }

    if (dist > u_radiusB) {
        // In the outer ring
        gl_FragColor = vec4(u_outerColor, 1.0);
    } else {
        // In the inner circle - Use activation state
        if (v_activated == 1.0) {
            gl_FragColor = vec4(u_innerColorActive, 1.0);
        } else {
            gl_FragColor = vec4(u_innerColorEmpty, 1.0);
        }
    }

    // Optional: Make inner empty circle transparent if its color matches background
    // if (v_activated == 0.0 && u_innerColorEmpty == u_bgColor) {
    //     if (dist <= u_radiusB) discard;
    // }
  }
`;

// Create the shader material using drei/shaderMaterial
const CircleMaterial = shaderMaterial(
  {
    u_radiusA: 0.5, // Default value, will be updated
    u_radiusB: 0.4, // Default value, will be updated
    u_bgColor: new THREE.Color('#ffffff'), // Default bg
    u_outerColor: new THREE.Color('#cccccc'), // Light grey outer ring
    u_innerColorEmpty: new THREE.Color('#ffffff'), // White/transparent inner empty
    u_innerColorActive: new THREE.Color('#000000'), // Black inner active
  },
  vertexShader,
  fragmentShader
);

// Extend R3F to recognize the material
extend({ CircleMaterial });

// Define TypeScript type for JSX usage
declare global {
  namespace JSX {
    interface IntrinsicElements {
      circleMaterial: any; // Use \'any\' or define more specific types
    }
  }
}

export default CircleMaterial; 