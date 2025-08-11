# Comprehensive Guide to diagram-js

## Table of Contents
1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Getting Started](#getting-started)
4. [Core Services](#core-services)
5. [Creating Custom Modules](#creating-custom-modules)
6. [Advanced Features](#advanced-features)
7. [Real-World Examples](#real-world-examples)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Introduction

diagram-js is a powerful and extensible JavaScript library for creating interactive diagrams on the web. It serves as the foundation for several domain-specific modeling tools and provides a robust framework for building custom diagram editors.

### What Makes diagram-js Special?

1. **Modular Architecture**: Build only what you need with a plugin-based system
2. **Event-Driven Design**: Loosely coupled components communicate via events
3. **Professional Features**: Built-in support for undo/redo, keyboard shortcuts, and more
4. **SVG-Based Rendering**: High-quality, scalable graphics
5. **Battle-Tested**: Powers production-ready tools like bpmn-js

### Who Uses diagram-js?

- **bpmn-js**: BPMN 2.0 process modeling
- **cmmn-js**: CMMN case management modeling
- **dmn-js**: DMN decision modeling
- **postit-js**: Collaborative sticky note boards

## Architecture Overview

### Dependency Injection

diagram-js uses the `didi` library for dependency injection, enabling a clean and testable architecture:

```javascript
// Service definition
function MyService(eventBus, canvas) {
  this._eventBus = eventBus;
  this._canvas = canvas;
}

// Declare dependencies
MyService.$inject = ['eventBus', 'canvas'];

// Module definition
export default {
  __init__: ['myService'],  // Services to instantiate on startup
  myService: ['type', MyService]  // Service registration
};
```

### Module System

Modules are the building blocks of diagram-js applications:

```javascript
const diagram = new Diagram({
  canvas: {
    container: document.getElementById('canvas')
  },
  modules: [
    // Core modules
    CoreModule,
    // Feature modules
    SelectionModule,
    MoveModule,
    // Custom modules
    MyCustomModule
  ]
});
```

### Event System

Events enable communication between loosely coupled components:

```javascript
// Listen to events
eventBus.on('shape.added', function(event) {
  console.log('Shape added:', event.element);
});

// Fire events
eventBus.fire('custom.event', {
  element: shape,
  data: additionalData
});

// Priority-based event handling
eventBus.on('shape.move', 1500, function(event) {
  // Higher priority (executed first)
});
```

## Getting Started

### Installation

```bash
npm install diagram-js
```

### Basic Setup

```javascript
import Diagram from 'diagram-js';

// Create a diagram instance
const diagram = new Diagram({
  canvas: {
    container: document.getElementById('container'),
    width: 800,
    height: 600
  }
});

// Get core services
const canvas = diagram.get('canvas');
const elementFactory = diagram.get('elementFactory');
const elementRegistry = diagram.get('elementRegistry');
const eventBus = diagram.get('eventBus');
```

### Creating Your First Diagram

```javascript
// Create a shape
const shape = elementFactory.createShape({
  id: 'shape1',
  x: 100,
  y: 100,
  width: 100,
  height: 80
});

// Add to canvas
canvas.addShape(shape);

// Create a connection
const connection = elementFactory.createConnection({
  id: 'connection1',
  source: shape1,
  target: shape2,
  waypoints: [
    { x: 150, y: 140 },
    { x: 250, y: 140 }
  ]
});

canvas.addConnection(connection);
```

## Core Services

### Canvas

The canvas manages the drawing surface and viewport:

```javascript
// Zoom operations
canvas.zoom(1.5);  // Zoom to 150%
canvas.zoom('fit-viewport');  // Fit all elements

// Scrolling
canvas.scroll({ dx: 100, dy: 50 });

// Get viewport information
const viewbox = canvas.viewbox();
// Returns: { x, y, width, height, scale, inner, outer }

// Focus on element
canvas.scrollToElement(element, {
  top: 50,
  right: 50,
  bottom: 50,
  left: 50
});
```

### ElementRegistry

Manages all diagram elements:

```javascript
// Get element by ID
const element = elementRegistry.get('elementId');

// Get all elements
const allElements = elementRegistry.getAll();

// Filter elements
const shapes = elementRegistry.filter(function(element) {
  return element.type === 'shape';
});

// Get graphics for element
const gfx = elementRegistry.getGraphics(element);
```

### ElementFactory

Creates diagram elements:

```javascript
// Create different element types
const shape = elementFactory.createShape({
  id: 'unique-id',
  type: 'custom-type',
  x: 100,
  y: 100,
  width: 100,
  height: 80,
  businessObject: customData
});

const connection = elementFactory.createConnection({
  source: sourceElement,
  target: targetElement,
  type: 'custom-connection'
});

const label = elementFactory.createLabel({
  labelTarget: shape,
  x: 150,
  y: 150
});
```

### CommandStack

Provides undo/redo functionality:

```javascript
// Execute commands
commandStack.execute('shape.create', {
  shape: newShape,
  position: { x: 100, y: 100 },
  parent: canvas.getRootElement()
});

// Undo/Redo
commandStack.undo();
commandStack.redo();

// Check if operations are available
const canUndo = commandStack.canUndo();
const canRedo = commandStack.canRedo();

// Listen to command events
eventBus.on('commandStack.changed', function() {
  updateUndoRedoButtons();
});
```

### EventBus

Central communication hub:

```javascript
// Event handling with context
eventBus.on('element.hover', function(event) {
  const element = event.element;
  const gfx = event.gfx;
  
  // Add hover effect
  gfx.classList.add('hover');
});

// One-time event listener
eventBus.once('diagram.init', function() {
  console.log('Diagram initialized');
});

// Remove event listener
const listener = function(event) { /* ... */ };
eventBus.on('shape.added', listener);
eventBus.off('shape.added', listener);

// Event priorities
eventBus.on('shape.move', 2000, function(event) {
  // High priority - runs first
});

eventBus.on('shape.move', 500, function(event) {
  // Low priority - runs last
});
```

## Creating Custom Modules

### Basic Module Structure

```javascript
// features/my-feature/MyService.js
export default function MyService(eventBus, canvas, elementRegistry) {
  this._eventBus = eventBus;
  this._canvas = canvas;
  this._elementRegistry = elementRegistry;
  
  // Initialization
  eventBus.on('diagram.init', this._init, this);
}

MyService.$inject = ['eventBus', 'canvas', 'elementRegistry'];

MyService.prototype._init = function() {
  console.log('MyService initialized');
};

MyService.prototype.doSomething = function(element) {
  // Service functionality
};

// features/my-feature/index.js
import MyService from './MyService';

export default {
  __init__: ['myService'],
  myService: ['type', MyService]
};
```

### Custom Renderer

```javascript
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { append as svgAppend, create as svgCreate } from 'tiny-svg';

export default function CustomRenderer(eventBus, styles) {
  BaseRenderer.call(this, eventBus, 2000);
  this._styles = styles;
}

inherits(CustomRenderer, BaseRenderer);

CustomRenderer.$inject = ['eventBus', 'styles'];

CustomRenderer.prototype.canRender = function(element) {
  return element.type === 'custom:shape';
};

CustomRenderer.prototype.drawShape = function(parentNode, element) {
  const rect = svgCreate('rect');
  
  svgAttr(rect, {
    x: 0,
    y: 0,
    width: element.width,
    height: element.height,
    rx: 5,
    fill: this._styles.fillColor || '#fff',
    stroke: this._styles.strokeColor || '#000',
    strokeWidth: 2
  });
  
  svgAppend(parentNode, rect);
  
  return rect;
};

CustomRenderer.prototype.getShapePath = function(shape) {
  const { x, y, width, height } = shape;
  return [
    ['M', x, y],
    ['l', width, 0],
    ['l', 0, height],
    ['l', -width, 0],
    ['z']
  ];
};
```

### Custom Tool

```javascript
export default function DrawTool(eventBus, canvas, create, elementFactory) {
  this._eventBus = eventBus;
  this._canvas = canvas;
  this._create = create;
  this._elementFactory = elementFactory;
}

DrawTool.$inject = ['eventBus', 'canvas', 'create', 'elementFactory'];

DrawTool.prototype.activate = function() {
  const shape = this._elementFactory.createShape({
    type: 'custom:shape',
    width: 100,
    height: 80
  });
  
  this._create.start(event, shape);
};
```

### Custom Rules

```javascript
import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';

export default function CustomRules(eventBus) {
  RuleProvider.call(this, eventBus);
}

inherits(CustomRules, RuleProvider);

CustomRules.$inject = ['eventBus'];

CustomRules.prototype.init = function() {
  this.addRule('shape.create', function(context) {
    const target = context.target;
    const shape = context.shape;
    
    // Allow shapes only on valid targets
    return target.type === 'container';
  });
  
  this.addRule('connection.create', function(context) {
    const source = context.source;
    const target = context.target;
    
    // Define connection rules
    return source.type === 'start' && target.type === 'end';
  });
};
```

## Advanced Features

### Context Pad Integration

```javascript
function CustomContextPadProvider(contextPad, modeling, elementFactory) {
  contextPad.registerProvider(this);
  this._modeling = modeling;
  this._elementFactory = elementFactory;
}

CustomContextPadProvider.$inject = ['contextPad', 'modeling', 'elementFactory'];

CustomContextPadProvider.prototype.getContextPadEntries = function(element) {
  const modeling = this._modeling;
  const elementFactory = this._elementFactory;
  
  return {
    'append.task': {
      group: 'model',
      className: 'bpmn-icon-task',
      title: 'Append Task',
      action: {
        click: function(event, element) {
          const shape = elementFactory.createShape({ type: 'task' });
          modeling.appendShape(element, shape);
        }
      }
    },
    'delete': {
      group: 'edit',
      className: 'bpmn-icon-trash',
      title: 'Remove',
      action: {
        click: function(event, element) {
          modeling.removeElements([element]);
        }
      }
    }
  };
};
```

### Palette Integration

```javascript
function CustomPaletteProvider(palette, create, elementFactory) {
  palette.registerProvider(this);
  this._create = create;
  this._elementFactory = elementFactory;
}

CustomPaletteProvider.$inject = ['palette', 'create', 'elementFactory'];

CustomPaletteProvider.prototype.getPaletteEntries = function() {
  const create = this._create;
  const elementFactory = this._elementFactory;
  
  return {
    'create.start-event': {
      group: 'event',
      className: 'bpmn-icon-start-event-none',
      title: 'Create Start Event',
      action: {
        dragstart: function(event) {
          const shape = elementFactory.createShape({ type: 'startEvent' });
          create.start(event, shape);
        }
      }
    }
  };
};
```

### Keyboard Bindings

```javascript
function CustomKeyboardBindings(keyboard, modeling, selection) {
  keyboard.addListener(function(context) {
    const event = context.keyEvent;
    
    if (keyboard.isCmd(event) && keyboard.isKey(['c'], event)) {
      // Ctrl+C: Copy
      const selected = selection.get();
      if (selected.length) {
        modeling.copy(selected);
        return true;
      }
    }
    
    if (keyboard.isKey(['Delete', 'Del'], event)) {
      // Delete selected elements
      const selected = selection.get();
      if (selected.length) {
        modeling.removeElements(selected);
        return true;
      }
    }
  });
}

CustomKeyboardBindings.$inject = ['keyboard', 'modeling', 'selection'];
```

## Real-World Examples

### Simple Flowchart Editor

```javascript
import Diagram from 'diagram-js';
import ModelingModule from 'diagram-js/lib/features/modeling';
import MoveModule from 'diagram-js/lib/features/move';
import ConnectModule from 'diagram-js/lib/features/connect';
import ContextPadModule from 'diagram-js/lib/features/context-pad';
import PaletteModule from 'diagram-js/lib/features/palette';

// Custom modules
import CustomRendererModule from './renderer';
import CustomRulesModule from './rules';
import CustomPaletteModule from './palette';

class FlowchartEditor {
  constructor(container) {
    this._diagram = new Diagram({
      canvas: {
        container: container
      },
      modules: [
        // Core features
        ModelingModule,
        MoveModule,
        ConnectModule,
        ContextPadModule,
        PaletteModule,
        // Custom features
        CustomRendererModule,
        CustomRulesModule,
        CustomPaletteModule
      ]
    });
    
    this._init();
  }
  
  _init() {
    const canvas = this._diagram.get('canvas');
    const elementFactory = this._diagram.get('elementFactory');
    const modeling = this._diagram.get('modeling');
    
    // Create initial elements
    const startEvent = elementFactory.createShape({
      id: 'start',
      type: 'flowchart:start',
      x: 100,
      y: 100,
      width: 50,
      height: 50
    });
    
    modeling.createShape(startEvent, { x: 100, y: 100 }, canvas.getRootElement());
    
    // Fit viewport
    canvas.zoom('fit-viewport');
  }
  
  exportSVG() {
    const canvas = this._diagram.get('canvas');
    const svg = canvas._svg;
    return svg.outerHTML;
  }
  
  exportJSON() {
    const elementRegistry = this._diagram.get('elementRegistry');
    const elements = elementRegistry.getAll();
    
    return {
      elements: elements.map(element => ({
        id: element.id,
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        connections: element.incoming.concat(element.outgoing).map(c => c.id)
      }))
    };
  }
}

// Usage
const editor = new FlowchartEditor(document.getElementById('canvas'));
```

### Collaborative Diagram Editor

```javascript
class CollaborativeDiagramEditor {
  constructor(container, websocketUrl) {
    this._diagram = new Diagram({
      canvas: { container },
      modules: [/* ... */]
    });
    
    this._websocket = new WebSocket(websocketUrl);
    this._initCollaboration();
  }
  
  _initCollaboration() {
    const eventBus = this._diagram.get('eventBus');
    const commandStack = this._diagram.get('commandStack');
    
    // Send local changes to server
    eventBus.on('commandStack.changed', (event) => {
      if (event.trigger === 'remote') return;
      
      this._websocket.send(JSON.stringify({
        type: 'command',
        command: event.command,
        context: event.context
      }));
    });
    
    // Receive remote changes
    this._websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'command') {
        commandStack.execute(data.command, {
          ...data.context,
          trigger: 'remote'
        });
      }
    };
  }
}
```

## Best Practices

### 1. Module Organization

```
my-diagram-editor/
├── features/
│   ├── my-feature/
│   │   ├── index.js
│   │   ├── MyService.js
│   │   └── MyService.spec.js
│   └── another-feature/
├── rules/
│   └── CustomRules.js
├── renderer/
│   └── CustomRenderer.js
└── index.js
```

### 2. Performance Optimization

```javascript
// Batch updates
eventBus.fire('elements.changed', {
  elements: changedElements
});

// Debounce expensive operations
import { debounce } from 'min-dash';

const debouncedSave = debounce(function() {
  saveToBackend();
}, 500);

eventBus.on('commandStack.changed', debouncedSave);

// Virtual rendering for large diagrams
if (!isInViewport(element, canvas.viewbox())) {
  return; // Skip rendering
}
```

### 3. Error Handling

```javascript
class SafeCommandHandler {
  execute(context) {
    try {
      // Perform operation
      this._doExecute(context);
    } catch (error) {
      // Log error
      console.error('Command failed:', error);
      
      // Revert changes
      this._revert(context);
      
      // Notify user
      eventBus.fire('notification', {
        type: 'error',
        message: 'Operation failed: ' + error.message
      });
      
      throw error;
    }
  }
}
```

### 4. Testing

```javascript
import {
  bootstrapDiagram,
  inject,
  getDiagramJS
} from 'diagram-js/test/helper';

describe('Custom Feature', function() {
  beforeEach(bootstrapDiagram({
    modules: [
      CustomFeatureModule
    ]
  }));
  
  describe('should work', function() {
    it('should create shape', inject(function(canvas, modeling) {
      // given
      const rootElement = canvas.getRootElement();
      
      // when
      const shape = modeling.createShape({
        type: 'custom:shape'
      }, { x: 100, y: 100 }, rootElement);
      
      // then
      expect(shape).to.exist;
      expect(shape.x).to.equal(100);
    }));
  });
});
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Elements Not Rendering

```javascript
// Check if renderer is registered
const renderers = diagram.get('rendererRegistry');
console.log('Registered renderers:', renderers._renderers);

// Ensure renderer priority
function CustomRenderer(eventBus) {
  BaseRenderer.call(this, eventBus, 2000); // High priority
}
```

#### 2. Events Not Firing

```javascript
// Check event listeners
const eventBus = diagram.get('eventBus');
console.log('Event listeners:', eventBus._listeners);

// Use correct event names
eventBus.on('shape.added', handler);    // Correct
eventBus.on('shapeAdded', handler);     // Wrong
```

#### 3. Dependency Injection Issues

```javascript
// Always declare dependencies
MyService.$inject = ['eventBus', 'canvas'];

// Check for circular dependencies
// Module A depends on B, B depends on A - will fail
```

#### 4. Performance Issues

```javascript
// Profile rendering
console.time('render');
canvas.addShape(shape);
console.timeEnd('render');

// Use Chrome DevTools Performance tab
// Look for:
// - Long rendering times
// - Excessive reflows
// - Memory leaks
```

## Conclusion

diagram-js provides a solid foundation for building sophisticated diagram editors. Its modular architecture, comprehensive event system, and extensive feature set make it suitable for both simple and complex diagramming needs. By following the patterns and practices outlined in this guide, you can create powerful, maintainable diagram editors tailored to your specific domain.

### Additional Resources

- [Official GitHub Repository](https://github.com/bpmn-io/diagram-js)
- [bpmn-js Documentation](https://github.com/bpmn-io/bpmn-js) - Example implementation
- [Forum](https://forum.bpmn.io/) - Community support
- [Examples](https://github.com/bpmn-io/diagram-js/tree/master/example) - Code examples