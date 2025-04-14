import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend, MaterialNode } from '@react-three/fiber';
import { BASE_RADIUS_A, BASE_RADIUS_B } from './constants';

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

    // Discard if outside the outer circle
    if (dist > u_radiusA) {
        discard;
    }

    // Check activation state first
    if (v_activated == 1.0) {
        // If activated, only draw the inner circle (black)
        if (dist <= u_radiusB) {
            gl_FragColor = vec4(u_innerColorActive, 1.0); // Solid black inner circle
        } else {
            discard; // Make outer ring transparent when activated
        }
    } else {
        // Not activated - draw both inner and outer circles
        if (dist > u_radiusB) {
            // In the outer ring
            gl_FragColor = vec4(u_outerColor, 1.0);
        } else {
            // In the inner circle - empty/inactive
            gl_FragColor = vec4(u_innerColorEmpty, 1.0);
        }
    }
  }
`;

// Interface for the uniforms
interface CircleMaterialUniforms {
  u_innerColorEmpty: THREE.Color;
  u_innerColorActive: THREE.Color;
  u_outerColor: THREE.Color;
  u_radiusA: number;
  u_radiusB: number;
  // Activation attribute will be removed later and replaced by texture lookup
}

// Create the shader material
const CircleMaterial = shaderMaterial(
  // Uniforms
  {
    u_innerColorEmpty: new THREE.Color(0xffffff),
    u_innerColorActive: new THREE.Color(0x000000),
    u_outerColor: new THREE.Color(0x000000),
    u_radiusA: BASE_RADIUS_A,
    u_radiusB: BASE_RADIUS_B,
  } satisfies CircleMaterialUniforms, // Use satisfies for type checking
  vertexShader,
  fragmentShader,
);

// Extend R3F
extend({ CircleMaterial });

// Define TypeScript type for JSX usage
declare global {
  namespace JSX {
    interface IntrinsicElements {
      circleMaterial: MaterialNode<THREE.ShaderMaterial, CircleMaterialUniforms>;
    }
  }
}

export default CircleMaterial; 