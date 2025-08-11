// For this example, we'll use a simple approach with script tags
// In a real application, you would use a module bundler

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  
  // Import diagram-js (assuming it's loaded via script tag)
  const Diagram = window.Diagram || DiagramJS;

// Create diagram with focus module
const diagram = new Diagram({
  canvas: {
    container: document.getElementById('canvas')
  },
  modules: [
    FocusModule
  ]
});

// Get services
const canvas = diagram.get('canvas');
const elementFactory = diagram.get('elementFactory');
const focus = diagram.get('focus');

// Create some example shapes
const shapes = [
  { id: 'shape1', x: 100, y: 100, width: 100, height: 80, label: 'Start' },
  { id: 'shape2', x: 300, y: 100, width: 100, height: 80, label: 'Process' },
  { id: 'shape3', x: 500, y: 100, width: 100, height: 80, label: 'Decision' },
  { id: 'shape4', x: 300, y: 250, width: 100, height: 80, label: 'Action' },
  { id: 'shape5', x: 500, y: 250, width: 100, height: 80, label: 'End' }
];

// Add shapes to canvas
shapes.forEach(shapeData => {
  const shape = elementFactory.createShape({
    id: shapeData.id,
    x: shapeData.x,
    y: shapeData.y,
    width: shapeData.width,
    height: shapeData.height,
    businessObject: { name: shapeData.label }
  });

  canvas.addShape(shape);
});

// Create connections
const connections = [
  { id: 'conn1', source: 'shape1', target: 'shape2' },
  { id: 'conn2', source: 'shape2', target: 'shape3' },
  { id: 'conn3', source: 'shape3', target: 'shape4' },
  { id: 'conn4', source: 'shape3', target: 'shape5' },
  { id: 'conn5', source: 'shape4', target: 'shape5' }
];

// Add connections to canvas
connections.forEach(connData => {
  const source = diagram.get('elementRegistry').get(connData.source);
  const target = diagram.get('elementRegistry').get(connData.target);
  
  const connection = elementFactory.createConnection({
    id: connData.id,
    source: source,
    target: target,
    waypoints: [
      { x: source.x + source.width, y: source.y + source.height / 2 },
      { x: target.x, y: target.y + target.height / 2 }
    ]
  });

  canvas.addConnection(connection);
});

// Fit diagram to viewport
canvas.zoom('fit-viewport');

// Button controls
document.getElementById('focusFirstBtn').addEventListener('click', () => {
  const firstShape = diagram.get('elementRegistry').get('shape1');
  focus.focus(firstShape);
});

document.getElementById('fitAllBtn').addEventListener('click', () => {
  focus.fitAll();
});

// Custom renderer for shapes
diagram.get('eventBus').on('render.shape', (event) => {
  const { gfx, element } = event;
  
  // Create rectangle
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', 0);
  rect.setAttribute('y', 0);
  rect.setAttribute('width', element.width);
  rect.setAttribute('height', element.height);
  rect.setAttribute('rx', 5);
  rect.setAttribute('fill', '#fff');
  rect.setAttribute('stroke', '#333');
  rect.setAttribute('stroke-width', 2);
  
  gfx.appendChild(rect);
  
  // Add label
  if (element.businessObject && element.businessObject.name) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', element.width / 2);
    text.setAttribute('y', element.height / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.setAttribute('font-size', '14');
    text.textContent = element.businessObject.name;
    
    gfx.appendChild(text);
  }
});

// Custom renderer for connections
diagram.get('eventBus').on('render.connection', (event) => {
  const { gfx, element } = event;
  
  // Create path
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  
  // Build path data from waypoints
  let pathData = 'M ' + element.waypoints[0].x + ' ' + element.waypoints[0].y;
  for (let i = 1; i < element.waypoints.length; i++) {
    pathData += ' L ' + element.waypoints[i].x + ' ' + element.waypoints[i].y;
  }
  
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#333');
  path.setAttribute('stroke-width', 2);
  path.setAttribute('marker-end', 'url(#arrow)');
  
  gfx.appendChild(path);
});

// Create arrow marker for connections
const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
marker.setAttribute('id', 'arrow');
marker.setAttribute('markerWidth', '10');
marker.setAttribute('markerHeight', '10');
marker.setAttribute('refX', '9');
marker.setAttribute('refY', '3');
marker.setAttribute('orient', 'auto');
marker.setAttribute('markerUnits', 'strokeWidth');

const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
arrowPath.setAttribute('d', 'M0,0 L0,6 L9,3 z');
arrowPath.setAttribute('fill', '#333');

marker.appendChild(arrowPath);
defs.appendChild(marker);
canvas._svg.appendChild(defs);

console.log('Focus feature example loaded. Click on shapes to focus!');