// Base geometry values
export const BASE_RADIUS_A = 0.5; // Outer radius
export const BASE_RADIUS_B = 0.4; // Inner radius

// Calculated fixed spacing based on desired overlap
export const FIXED_SPACING = BASE_RADIUS_A + BASE_RADIUS_B; // 0.5 + 0.4 = 0.9 

// Define connector types as constants
export const CONNECTOR_NONE = 0;
export const CONNECTOR_DIAG_TL_BR = 1; // Diagonal \
export const CONNECTOR_DIAG_BL_TR = 2; // Diagonal /
export const CONNECTOR_HORIZ_T = 3;    // Horizontal Top
export const CONNECTOR_HORIZ_B = 4;    // Horizontal Bottom
export const CONNECTOR_HORIZ_CMD = 5;  // Cmd-click horizontal connector 