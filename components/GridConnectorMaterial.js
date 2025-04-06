import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

// This material handles the connector shapes between active points on the grid
const GridConnectorMaterial = shaderMaterial(
  // Uniforms
  {
    u_radiusB: 0.4, // Inner circle radius (black circle)
    u_radiusA: 0.5, // Outer circle radius (for connector shape calculation)
    u_spacing: 1.0, // Grid spacing
    u_thickness: 0.2, // Connector thickness control
    u_curvature: 0.5, // Controls the curvature of the connector
    u_resolution: new THREE.Vector2(1, 1),
    u_activeConnector: 0, // 0 = none, 1 = red (AB), 2 = blue (CD), 3 = orange top row, 4 = orange bottom row
    u_gridState: new THREE.DataTexture( // Will store grid state in a texture
      new Float32Array(4), // RGBA values per cell
      2, // width (for 2x2 grid)
      2, // height (for 2x2 grid)
      THREE.RGBAFormat,
      THREE.FloatType
    ),
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
    varying vec2 vWorldPos;

    uniform float u_radiusB; // Inner circle radius (black circle)
    uniform float u_radiusA; // Outer circle radius (for connector shape)
    uniform float u_spacing;
    uniform float u_thickness; // Controls connector thickness
    uniform float u_curvature; // Controls the curve shape
    uniform vec2 u_resolution;
    uniform float u_activeConnector; // 0 = none, 1 = red (AB), 2 = blue (CD), 3 = orange top row, 4 = orange bottom row
    uniform sampler2D u_gridState;

    // Helper function to get circle state from the grid state texture
    vec4 getGridState(int row, int col) {
      return texture2D(u_gridState, vec2(float(col) + 0.5, float(row) + 0.5) / 2.0);
    }

    // Helper function to calculate distance to a circle
    float distToCircle(vec2 point, vec2 center) {
      return length(point - center);
    }

    // Create a smooth minimum function to blend the connector
    float smin(float a, float b, float k) {
      float h = max(k - abs(a - b), 0.0) / k;
      return min(a, b) - h * h * k * 0.25;
    }

    // Helper function for horizontal connector
    bool isInHorizontalConnector(vec2 point, vec2 center1, vec2 center2, float radius) {
      // Calculate rectangle bounds
      float midY = (center1.y + center2.y) * 0.5;
      float leftX = min(center1.x, center2.x);
      float rightX = max(center1.x, center2.x);
      
      // Check if inside the rectangle
      if (point.x >= leftX && point.x <= rightX && 
          point.y >= midY - radius && point.y <= midY + radius) {
        return true;
      }
      
      return false;
    }

    void main() {
      // If no connector is active, discard immediately
      if (u_activeConnector < 0.5) {
        discard;
        return;
      }
      
      // Calculate grid positions (2x2 grid)
      float gridOffset = u_spacing * 0.5;
      vec2 center_A = vec2(-gridOffset, gridOffset);   // Top-left (A)
      vec2 center_B = vec2(gridOffset, -gridOffset);   // Bottom-right (B)
      vec2 center_C = vec2(-gridOffset, -gridOffset);  // Bottom-left (C)
      vec2 center_D = vec2(gridOffset, gridOffset);    // Top-right (D)

      // Calculate distances from current pixel to each circle center
      float dist_A = distToCircle(vWorldPos, center_A);
      float dist_B = distToCircle(vWorldPos, center_B);
      float dist_C = distToCircle(vWorldPos, center_C);
      float dist_D = distToCircle(vWorldPos, center_D);

      // Get circle states
      vec4 stateA = getGridState(0, 0); // Top-left
      vec4 stateB = getGridState(1, 1); // Bottom-right
      vec4 stateC = getGridState(1, 0); // Bottom-left
      vec4 stateD = getGridState(0, 1); // Top-right

      // Check if relevant circles are active 
      bool circleAInnerActive = stateA.r > 0.5; // Top-left inner circle
      bool circleBInnerActive = stateB.r > 0.5; // Bottom-right inner circle
      bool circleCInnerActive = stateC.r > 0.5; // Bottom-left inner circle
      bool circleDInnerActive = stateD.r > 0.5; // Top-right inner circle
      
      // Determine connector type based on active connector state
      bool drawABConnector = u_activeConnector == 1.0;
      bool drawCDConnector = u_activeConnector == 2.0;
      bool drawTopRowConnector = u_activeConnector == 3.0;
      bool drawBottomRowConnector = u_activeConnector == 4.0;
      
      // Handle the horizontal connectors first (orange)
      if (drawTopRowConnector) {
        // Verify the required circles are active
        if (!circleAInnerActive || !circleDInnerActive) {
          discard;
          return;
        }
        
        // Check if we're outside the inner circles
        if (dist_A <= u_radiusB || dist_D <= u_radiusB) {
          discard;
          return;
        }
        
        // Check if the point is within the horizontal connector area
        if (isInHorizontalConnector(vWorldPos, center_A, center_D, u_radiusB)) {
          // Draw the horizontal connector
          gl_FragColor = vec4(1.0, 0.5, 0.0, 1.0); // Orange for horizontal connector
          return;
        }
        
        discard;
        return;
      }
      
      if (drawBottomRowConnector) {
        // Verify the required circles are active
        if (!circleCInnerActive || !circleBInnerActive) {
          discard;
          return;
        }
        
        // Check if we're outside the inner circles
        if (dist_C <= u_radiusB || dist_B <= u_radiusB) {
          discard;
          return;
        }
        
        // Check if the point is within the horizontal connector area
        if (isInHorizontalConnector(vWorldPos, center_C, center_B, u_radiusB)) {
          // Draw the horizontal connector
          gl_FragColor = vec4(1.0, 0.5, 0.0, 1.0); // Orange for horizontal connector
          return;
        }
        
        discard;
        return;
      }
      
      // Handle diagonal connectors (original functionality)
      // Verify the required circles are active for the selected connector
      if (drawABConnector && (!circleAInnerActive || !circleBInnerActive)) {
        discard;
        return;
      }
      
      if (drawCDConnector && (!circleCInnerActive || !circleDInnerActive)) {
        discard;
        return;
      }
      
      // Distance fields for the inner black circles
      float sdfA = dist_A - u_radiusB;
      float sdfB = dist_B - u_radiusB;
      float sdfC = dist_C - u_radiusB;
      float sdfD = dist_D - u_radiusB;
      
      // We only continue if we're outside the relevant black circles
      bool outsideRelevantCircles = true;
      
      if (drawABConnector) {
        outsideRelevantCircles = (sdfA > 0.0) && (sdfB > 0.0);
      }
      
      if (drawCDConnector) {
        outsideRelevantCircles = (sdfC > 0.0) && (sdfD > 0.0);
      }
      
      if (!outsideRelevantCircles) {
        discard;
        return;
      }
      
      // Check if inside influence areas
      bool insideInfluenceArea = false;
      
      if (drawABConnector) {
        // For Red AB connector:
        // Must be outside inner B circles (we already checked this with outsideRelevantCircles)
        // Must be outside outer A circles (represented by the gray circles)
        // Notice how we're checking if we're outside both outer A circles (C and D)
        insideInfluenceArea = (dist_C > u_radiusA) && (dist_D > u_radiusA);
      }
      
      if (drawCDConnector) {
        // For Blue CD connector:
        // Must be outside inner A circles (we already checked this with outsideRelevantCircles)
        // Must be outside outer B circles (represented by the gray circles)
        // Notice how we're checking if we're outside both outer B circles (A and B)
        insideInfluenceArea = (dist_A > u_radiusA) && (dist_B > u_radiusA);
      }
      
      if (!insideInfluenceArea) {
        discard;
        return;
      }
      
      // Calculate vector between the active circles
      vec2 activeDirection;
      vec2 startCenter;
      vec2 endCenter;
      float distStart;
      float distEnd;
      
      if (drawABConnector) {
        activeDirection = center_B - center_A;
        startCenter = center_A;
        endCenter = center_B;
        distStart = dist_A;
        distEnd = dist_B;
      }
      
      if (drawCDConnector) {
        activeDirection = center_D - center_C;
        startCenter = center_C;
        endCenter = center_D;
        distStart = dist_C;
        distEnd = dist_D;
      }
      
      // Continue with existing connector logic, but use the active centers
      float lengthAB = length(activeDirection);
      vec2 AB_normalized = activeDirection / lengthAB;
      
      // Project current point onto line
      vec2 AP = vWorldPos - startCenter;
      float projection = dot(AP, AB_normalized);
      
      // Create a field that represents the "pathway" between the two circles
      // This creates a curved shape that narrows in the middle
      float pathwayField;
      
      // For the first part of the curvature range, use distance-based shape
      if (u_curvature < 0.5) {
        // Method 1: Path with varying width based on projection along AB
        
        // Only proceed if the pixel is reasonably near the AB line
        if (projection >= -u_radiusA && projection <= lengthAB + u_radiusA) {
          // Calculate perpendicular distance from point to AB line
          vec2 perpendicular = AP - projection * AB_normalized;
          float perpDistance = length(perpendicular);
          
          // Base width based on thickness
          float baseWidth = u_thickness * u_radiusA;
          float midPoint = lengthAB * 0.5;
          float distFromMid = abs(projection - midPoint);
          
          // Make narrower in middle based on curvature
          float t = distFromMid / midPoint; // 0 at center, 1 at endpoints
          float narrowingFactor = mix(0.5, 0.9, u_curvature * 2.0); // More narrow at higher curvature
          float widthCurve = 1.0 - pow(t, 1.5) * narrowingFactor;
          
          // Calculate the adjusted width based on position
          float adjustedWidth;
          
          if (projection < 0.0) {
            // Near endpoint A - blend with circle
            adjustedWidth = mix(u_radiusA * 0.8, baseWidth, 1.0 + projection / u_radiusA);
          } else if (projection > lengthAB) {
            // Near endpoint B - blend with circle
            adjustedWidth = mix(u_radiusA * 0.8, baseWidth, 1.0 - (projection - lengthAB) / u_radiusA);
          } else {
            // Between endpoints - use curved width
            adjustedWidth = baseWidth * widthCurve;
          }
          
          // If within the adjusted width, we're in the connector
          if (perpDistance < adjustedWidth) {
            // Set color based on which connector is being drawn
            if (drawABConnector) {
              gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red for AB connector
            } else {
              gl_FragColor = vec4(0.0, 0.5, 1.0, 1.0); // Blue for CD connector
            }
            return;
          }
        }
      }
      else {
        // Method 2: Use hyperbolic distance field for higher curvature
        // Normalize distances for better control
        float d1 = max(0.0, distStart - u_radiusB) / u_radiusA; 
        float d2 = max(0.0, distEnd - u_radiusB) / u_radiusA;
        
        // Create hyperbolic field (product of distances)
        pathwayField = d1 * d2;
        
        // Adjust field strength based on distance to make shape more compact
        float distanceScale = 3.0 / lengthAB;
        pathwayField *= distanceScale;
        
        // Thickness controls the threshold
        float threshold = u_thickness * 0.2 * mix(1.0, 2.0, u_curvature - 0.5);
        
        // Check if within the field threshold
        if (pathwayField < threshold) {
          // Only show connector between the circles (not extending out the other sides)
          float dotProductA = dot(AP, AB_normalized);
          float dotProductB = dot(vWorldPos - endCenter, -AB_normalized);
          
          if (dotProductA >= -u_radiusB * 0.5 && dotProductB >= -u_radiusB * 0.5) {
            // Set color based on which connector is being drawn
            if (drawABConnector) {
              gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red for AB connector
            } else {
              gl_FragColor = vec4(0.0, 0.5, 1.0, 1.0); // Blue for CD connector
            }
            return;
          }
        }
      }
      
      // If we got here, the pixel is outside the connector shape
      discard;
    }
  `
);

// Add a unique key for HMR purposes with R3F
GridConnectorMaterial.key = THREE.MathUtils.generateUUID();

export { GridConnectorMaterial }; 