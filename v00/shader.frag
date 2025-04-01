// Fragment Shader: Distance Field Offset with Diagonal Detection
#ifdef GL_ES
precision mediump float;
#endif

varying vec2 vTexCoord;

uniform vec2 u_resolution;
uniform int u_num_balls;
uniform vec4 u_balls[50]; // x, y, radius, isActive 

uniform float u_offset_radius;

uniform vec3 u_active_color; 
uniform vec3 u_inactive_color;
uniform vec3 u_bg_color;
uniform vec3 u_offset_line_color;

void main() {
    vec2 uv = vTexCoord;
    vec2 pixel_coord = uv * u_resolution;

    float is_inside_inactive_core = 0.0;
    float is_inside_active_core = 0.0; 
    float lines = 0.0; 
    float line_width = 1.0;
    
    // Process each ball and do basic visualization
    for (int i = 0; i < 50; i++) { 
        if (i >= u_num_balls) break; 
        
        vec4 ball_data = u_balls[i];
        vec2 ball_pos_webgl = ball_data.xy;
        float ball_radius = ball_data.z;
        float isActive = ball_data.w;

        if (ball_radius <= 0.0) continue; 

        vec2 ball_pos_pixels = ball_pos_webgl + u_resolution * 0.5;
        float dist_to_center = distance(pixel_coord, ball_pos_pixels);
        float dist_to_edge = dist_to_center - ball_radius;

        // Draw visualization lines
        float core_line = smoothstep(line_width/2.0, -line_width/2.0, abs(dist_to_edge));
        float offset_line = smoothstep(line_width/2.0, -line_width/2.0, abs(dist_to_edge - u_offset_radius));
        lines = max(lines, max(core_line, offset_line));

        // Check if inside core
        if (dist_to_edge <= 0.0) {
            if (isActive > 0.5) {
                is_inside_active_core = 1.0;
            } else {
                is_inside_inactive_core = 1.0;
            }
        }
    }
    
    // Simple approach: Fill diagonals, avoid horizontal/vertical
    float diag_connection = 0.0;
    
    // Only attempt connection if not in any core
    if (is_inside_active_core < 0.5 && is_inside_inactive_core < 0.5) {
        // Use the spacing value to determine the grid size
        float spacing = 62.5; // From sketch.js
        
        // Grid coordinates, quantize the pixel position
        vec2 grid_pos = floor((pixel_coord + spacing * 0.5) / spacing);
        
        // Calculate modular position within a grid cell
        vec2 cell_pos = mod(pixel_coord, spacing) / spacing;
        
        // For a true diagonal connection, it should be in a corner region
        // This creates the a, b, c segments while avoiding the d segments
        float diagonal_mask = 0.0;
        
        // Top-left to bottom-right diagonal
        if ((cell_pos.x < 0.5 && cell_pos.y < 0.5) || (cell_pos.x > 0.5 && cell_pos.y > 0.5)) {
            diagonal_mask = 1.0;
        }
        
        // Check if we're in an area where offset regions would overlap
        // This simplification assumes the grid layout and uses it to our advantage
        float dist_to_grid_center = distance(pixel_coord, grid_pos * spacing);
        if (dist_to_grid_center < 2.0 * u_offset_radius && diagonal_mask > 0.5) {
            diag_connection = 1.0;
        }
    }

    // Color layering
    vec3 final_color = u_bg_color; 

    // Layer 1: Diagonal connection fill
    if (diag_connection > 0.5) {
        final_color = u_active_color;
    }

    // Layer 2: Visualization Lines 
    final_color = mix(final_color, u_offset_line_color, lines);

    // Layer 3: Inactive core fill
    if (is_inside_inactive_core > 0.5) {
        final_color = u_inactive_color;
    } 

    // Layer 4: Active core fill
    if (is_inside_active_core > 0.5) {
        final_color = u_active_color;
    }

    gl_FragColor = vec4(final_color, 1.0);
} 