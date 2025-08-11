import {
  forEach
} from 'min-dash';

/**
 * @typedef {import('../../core/ElementRegistry').default} ElementRegistry
 * @typedef {import('../../core/EventBus').default} EventBus
 * @typedef {import('./Focus').default} Focus
 */

var PRIORITY = 500;

/**
 * Focus behavior - handles user interactions for focusing elements
 *
 * @param {ElementRegistry} elementRegistry
 * @param {EventBus} eventBus
 * @param {Focus} focus
 */
export default function FocusBehavior(elementRegistry, eventBus, focus) {
  this._elementRegistry = elementRegistry;
  this._eventBus = eventBus;
  this._focus = focus;

  var self = this;

  // Click to focus behavior
  eventBus.on('element.click', PRIORITY, function(event) {
    var element = event.element;

    // Don't focus on root elements
    if (element.isFrame || element.type === 'label') {
      return;
    }

    // Toggle focus
    if (focus.isFocused(element)) {
      focus.blur();
    } else {
      focus.focus(element);
    }

    // Prevent other click handlers
    return false;
  });

  // Double-click to fit all
  eventBus.on('canvas.dblclick', function(event) {
    focus.fitAll();
  });

  // Keyboard navigation
  eventBus.on('keyboard.keydown', function(event) {
    var keyEvent = event.keyEvent;

    // ESC to blur
    if (keyEvent.key === 'Escape' && focus.getFocused()) {
      focus.blur();
      return true;
    }

    // F to fit all
    if (keyEvent.key === 'f' && !keyEvent.ctrlKey && !keyEvent.metaKey) {
      focus.fitAll();
      return true;
    }

    // Arrow keys for navigation between elements
    if (focus.getFocused() && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(keyEvent.key)) {
      var currentElement = focus.getFocused();
      var nextElement = self._findNextElement(currentElement, keyEvent.key);
      
      if (nextElement) {
        focus.focus(nextElement);
        return true;
      }
    }
  });
}

FocusBehavior.$inject = [
  'elementRegistry',
  'eventBus',
  'focus'
];

/**
 * Find the next element to focus based on arrow key direction
 *
 * @param {Element} currentElement
 * @param {string} direction - Arrow key pressed
 * @return {Element|null}
 */
FocusBehavior.prototype._findNextElement = function(currentElement, direction) {
  var elementRegistry = this._elementRegistry;
  var elements = elementRegistry.filter(function(element) {
    // Filter out non-focusable elements
    return !element.isFrame && 
           element.type !== 'label' && 
           element !== currentElement &&
           element.type === currentElement.type; // Only navigate between same types
  });

  if (!elements.length) {
    return null;
  }

  var currentBounds = this._getElementCenter(currentElement);
  var bestElement = null;
  var bestScore = Infinity;

  forEach(elements, function(element) {
    var elementBounds = this._getElementCenter(element);
    var score = this._calculateDirectionScore(
      currentBounds,
      elementBounds,
      direction
    );

    if (score < bestScore) {
      bestScore = score;
      bestElement = element;
    }
  }, this);

  return bestElement;
};

/**
 * Get element center coordinates
 *
 * @param {Element} element
 * @return {Object}
 */
FocusBehavior.prototype._getElementCenter = function(element) {
  if (element.waypoints) {
    // For connections, use the middle waypoint
    var middleIndex = Math.floor(element.waypoints.length / 2);
    return element.waypoints[middleIndex];
  }

  return {
    x: element.x + (element.width || 0) / 2,
    y: element.y + (element.height || 0) / 2
  };
};

/**
 * Calculate direction score for finding next element
 * Lower score is better
 *
 * @param {Object} from - Current element center
 * @param {Object} to - Target element center  
 * @param {string} direction - Arrow key direction
 * @return {number}
 */
FocusBehavior.prototype._calculateDirectionScore = function(from, to, direction) {
  var dx = to.x - from.x;
  var dy = to.y - from.y;
  var distance = Math.sqrt(dx * dx + dy * dy);

  // Penalize elements in wrong direction
  switch (direction) {
    case 'ArrowLeft':
      if (dx >= 0) return Infinity;
      return distance - dx; // Prefer more to the left
    
    case 'ArrowRight':
      if (dx <= 0) return Infinity;
      return distance + dx; // Prefer more to the right
    
    case 'ArrowUp':
      if (dy >= 0) return Infinity;
      return distance - dy; // Prefer more upward
    
    case 'ArrowDown':
      if (dy <= 0) return Infinity;
      return distance + dy; // Prefer more downward
    
    default:
      return distance;
  }
};