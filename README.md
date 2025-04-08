# WebGL Meta Project

A WebGL-based grid visualization and editing tool using React Three Fiber.

## Features

### Grid Scene Editor
- Interactive grid of circles with dynamic connectors
- Click to toggle circle states (active/inactive)
- Create different connector types between active circles
- Save and load grid states as JSON

### Grid Viewer
- Non-interactive visualization of saved grid states
- Load different patterns through UI controls
- Import grid configurations from JSON files
- Adjust visual scale for better viewing

## Components

### GridScene
The main editor component that allows for interactive creation and editing of grid patterns.

### GridViewer
A display-only component that visualizes pre-defined grid patterns without editing capabilities.

### AppController
A control panel component that allows switching between the editor and viewer modes, and manages different grid patterns in viewer mode.

## Usage

Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Editor Mode
- Click on circles to toggle their state
- Click between circles to create connectors
- Use Cmd/Ctrl click on adjacent active circles to create horizontal connectors
- Save your designs as JSON files

### Viewer Mode
- Switch to viewer mode using the toggle button
- Load example patterns or import from JSON files
- Adjust the visual scale to zoom in/out
- No editing capabilities in viewer mode

## Data Structure

The application uses the following data structure for grid patterns:

```typescript
interface AdjacencyListData {
  gridWidth: number;
  gridHeight: number;
  nodes: GridNode[];  // Active circles
  edges: GridEdge[];  // Connectors between circles
}
```

## Technologies

- React
- Next.js
- Three.js
- React Three Fiber
- Shader Materials
- WebGL 