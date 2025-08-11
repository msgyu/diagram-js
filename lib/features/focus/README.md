# Focus Feature for diagram-js

The focus feature provides spotlight/focus functionality for diagram elements, similar to presentation or tutorial modes. It allows users to focus on specific elements with smooth animations and visual highlighting.

## Features

- **Smooth Animation**: Animated panning and zooming to focused elements
- **Spotlight Effect**: Visual overlay that darkens the canvas except for the focused element
- **User Interactions**: Click to focus, keyboard navigation, and more
- **Programmatic API**: Control focus behavior from your application code

## Usage

### Basic Setup

```javascript
import Diagram from 'diagram-js';
import FocusModule from 'diagram-js/lib/features/focus';

const diagram = new Diagram({
  modules: [
    FocusModule
  ]
});

const focus = diagram.get('focus');
```

### API Methods

#### `focus.focus(element, options)`
Focus on a specific element with animation.

```javascript
// Focus on element by ID
focus.focus('element-id');

// Focus on element object
focus.focus(element, {
  duration: 700,        // Animation duration in ms
  padding: 60,          // Padding around element
  showSpotlight: true   // Show spotlight effect
});
```

#### `focus.blur()`
Remove focus and hide spotlight.

```javascript
focus.blur();
```

#### `focus.fitAll(options)`
Fit all elements in viewport (overview mode).

```javascript
focus.fitAll({
  duration: 700  // Animation duration
});
```

#### `focus.getFocused()`
Get the currently focused element.

```javascript
const focusedElement = focus.getFocused();
```

#### `focus.isFocused(element)`
Check if an element is currently focused.

```javascript
if (focus.isFocused(element)) {
  console.log('Element is focused');
}
```

### User Interactions

The focus behavior module provides these built-in interactions:

- **Click** on any shape to focus/unfocus
- **Double-click** on canvas to fit all elements
- **ESC** key to blur current focus
- **F** key to fit all elements
- **Arrow keys** to navigate between elements when focused

### Events

The focus module fires these events:

```javascript
eventBus.on('focus.changed', function(event) {
  console.log('Focus changed:', event.element, event.focused);
});
```

### Styling

You can customize the spotlight appearance with CSS:

```css
/* Customize spotlight overlay */
.djs-focus-spotlight rect {
  fill: rgba(0, 0, 0, 0.7);  /* Darker overlay */
}

/* Add glow to focused elements */
.djs-element.djs-focused {
  filter: drop-shadow(0 0 10px #0078d4);
}
```

## Example

See the [examples/focus](../../../examples/focus) directory for a complete working example.

## Configuration

The focus feature uses these default values that can be overridden:

- `ANIMATION_DURATION`: 700ms - Default animation duration
- `PADDING`: 60px - Default padding around focused elements
- `SPOTLIGHT_MIN_RADIUS`: 160px - Minimum spotlight radius
- `SPOTLIGHT_RADIUS_SCALE`: 0.65 - Scale factor for spotlight size

## Browser Support

The focus feature works in all modern browsers that support:
- SVG masks
- CSS transforms
- RequestAnimationFrame