# Circle Grid Visualization

An interactive visualization of a grid of circles with dynamic diagonal connections. The visualization features:

- Outer circles (labeled 'A') that act as visual containers
- Inner circles (labeled 'B') that connect diagonally
- Smooth diagonal connections between inner circles
- Dynamic masking where outer circles hide connection intersections

## Setup

1. Clone this repository
2. Open `index.html` in a web browser
3. Click on circles to interact with the visualization

## Implementation Details

The visualization is built using p5.js and features:
- Custom drawing order for proper layering
- Bezier curves for smooth diagonal connections
- Dynamic masking using outer circles
- Interactive circle selection 