import {
  assign,
  forEach,
  isNumber
} from 'min-dash';

import {
  domify,
  assignStyle,
  attr as domAttr,
  remove as domRemove
} from 'min-dom';

import {
  getBBox
} from '../../util/Elements';

/**
 * @typedef {import('../../core/Canvas').default} Canvas
 * @typedef {import('../../core/ElementRegistry').default} ElementRegistry
 * @typedef {import('../../core/EventBus').default} EventBus
 * @typedef {import('../../model/Types').Element} Element
 */

// Focus configuration constants
var ANIMATION_DURATION = 700;
var PADDING = 60;
var SPOTLIGHT_RADIUS_SCALE = 0.65;
var SPOTLIGHT_MIN_RADIUS = 160;
var SPOTLIGHT_EXTRA = 80;
var SPOTLIGHT_INNER_RATIO = 0.05;

// Easing functions
var Easings = {
  linear: function(t) { return t; },
  easeInOutCubic: function(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
};

/**
 * A service that provides focus/spotlight functionality for diagram elements.
 *
 * @param {Canvas} canvas
 * @param {ElementRegistry} elementRegistry
 * @param {EventBus} eventBus
 */
export default function Focus(canvas, elementRegistry, eventBus) {
  this._canvas = canvas;
  this._elementRegistry = elementRegistry;
  this._eventBus = eventBus;

  this._focusedElement = null;
  this._spotlightOverlay = null;
  this._animationFrame = null;

  this._init();
}

Focus.$inject = [
  'canvas',
  'elementRegistry',
  'eventBus'
];

/**
 * Initialize the focus module
 */
Focus.prototype._init = function() {
  var self = this;

  // Create spotlight overlay container
  this._createSpotlightOverlay();

  // Listen for canvas viewport changes to update spotlight
  this._eventBus.on('canvas.viewbox.changed', function() {
    if (self._focusedElement) {
      self._updateSpotlight();
    }
  });

  // Clean up on diagram destroy
  this._eventBus.on('diagram.destroy', function() {
    self._cleanup();
  });

  // Handle element removal
  this._eventBus.on(['shape.removed', 'connection.removed'], function(event) {
    if (event.element === self._focusedElement) {
      self.blur();
    }
  });
};

/**
 * Focus on a specific element with animation
 *
 * @param {Element|string} element - The element or element ID to focus on
 * @param {Object} [options] - Focus options
 * @param {number} [options.duration] - Animation duration in ms
 * @param {number} [options.padding] - Padding around the element
 * @param {boolean} [options.showSpotlight] - Whether to show spotlight effect
 */
Focus.prototype.focus = function(element, options) {
  if (typeof element === 'string') {
    element = this._elementRegistry.get(element);
  }

  if (!element) {
    throw new Error('element not found');
  }

  options = assign({
    duration: ANIMATION_DURATION,
    padding: PADDING,
    showSpotlight: true
  }, options || {});

  // Cancel any ongoing animation
  if (this._animationFrame) {
    cancelAnimationFrame(this._animationFrame);
  }

  this._focusedElement = element;

  // Calculate target viewport
  var targetViewport = this._calculateTargetViewport(element, options.padding);

  // Animate to target
  this._animateViewport(targetViewport, options.duration);

  // Show spotlight if requested
  if (options.showSpotlight) {
    this._showSpotlight(element);
  }

  // Fire focus event
  this._eventBus.fire('focus.changed', {
    element: element,
    focused: true
  });
};

/**
 * Remove focus and hide spotlight
 */
Focus.prototype.blur = function() {
  if (!this._focusedElement) {
    return;
  }

  var previousElement = this._focusedElement;
  this._focusedElement = null;

  // Hide spotlight
  this._hideSpotlight();

  // Fire blur event
  this._eventBus.fire('focus.changed', {
    element: previousElement,
    focused: false
  });
};

/**
 * Get the currently focused element
 *
 * @return {Element|null}
 */
Focus.prototype.getFocused = function() {
  return this._focusedElement;
};

/**
 * Check if an element is currently focused
 *
 * @param {Element|string} element
 * @return {boolean}
 */
Focus.prototype.isFocused = function(element) {
  if (typeof element === 'string') {
    element = this._elementRegistry.get(element);
  }

  return this._focusedElement === element;
};

/**
 * Fit all elements in viewport (overview mode)
 *
 * @param {Object} [options]
 * @param {number} [options.duration] - Animation duration
 */
Focus.prototype.fitAll = function(options) {
  options = assign({
    duration: ANIMATION_DURATION
  }, options || {});

  // Clear focus
  this.blur();

  // Animate to fit viewport
  var canvas = this._canvas;
  var currentViewbox = canvas.viewbox();
  
  // Calculate target scale to fit all elements
  var innerBox = currentViewbox.inner;
  var outerBox = currentViewbox.outer;
  
  var targetScale = Math.min(
    outerBox.width / (innerBox.width + 2 * PADDING),
    outerBox.height / (innerBox.height + 2 * PADDING)
  );

  var targetViewport = {
    x: innerBox.x - PADDING,
    y: innerBox.y - PADDING,
    width: outerBox.width / targetScale,
    height: outerBox.height / targetScale,
    scale: targetScale
  };

  this._animateViewport(targetViewport, options.duration);
};

/**
 * Calculate target viewport for focusing on an element
 *
 * @param {Element} element
 * @param {number} padding
 * @return {Object}
 */
Focus.prototype._calculateTargetViewport = function(element, padding) {
  var canvas = this._canvas;
  var currentViewbox = canvas.viewbox();
  var elementBounds = getBBox(element);

  // Calculate scale to fit element with padding
  var targetScale = Math.min(
    (currentViewbox.outer.width - 2 * padding) / elementBounds.width,
    (currentViewbox.outer.height - 2 * padding) / elementBounds.height
  );

  // Don't zoom in too much
  targetScale = Math.min(targetScale, 2);

  // Calculate position to center element
  var centerX = elementBounds.x + elementBounds.width / 2;
  var centerY = elementBounds.y + elementBounds.height / 2;

  return {
    x: centerX - (currentViewbox.outer.width / targetScale) / 2,
    y: centerY - (currentViewbox.outer.height / targetScale) / 2,
    width: currentViewbox.outer.width / targetScale,
    height: currentViewbox.outer.height / targetScale,
    scale: targetScale
  };
};

/**
 * Animate viewport to target position/scale
 *
 * @param {Object} targetViewport
 * @param {number} duration
 */
Focus.prototype._animateViewport = function(targetViewport, duration) {
  var self = this;
  var canvas = this._canvas;
  var startViewbox = canvas.viewbox();
  var startTime = Date.now();

  function animate() {
    var elapsed = Date.now() - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var eased = Easings.easeInOutCubic(progress);

    // Interpolate viewport properties
    var currentViewport = {
      x: startViewbox.x + (targetViewport.x - startViewbox.x) * eased,
      y: startViewbox.y + (targetViewport.y - startViewbox.y) * eased,
      width: startViewbox.width + (targetViewport.width - startViewbox.width) * eased,
      height: startViewbox.height + (targetViewport.height - startViewbox.height) * eased
    };

    // Apply viewport
    canvas.viewbox(currentViewport);

    if (progress < 1) {
      self._animationFrame = requestAnimationFrame(animate);
    } else {
      self._animationFrame = null;
    }
  }

  animate();
};

/**
 * Create spotlight overlay element
 */
Focus.prototype._createSpotlightOverlay = function() {
  var container = this._canvas.getContainer();
  
  // Create overlay container
  this._spotlightOverlay = domify(
    '<div class="djs-focus-spotlight" style="' +
    'position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
    'pointer-events: none; display: none;">' +
    '<svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">' +
    '<defs>' +
    '<mask id="djs-spotlight-mask">' +
    '<rect width="100%" height="100%" fill="white" />' +
    '<circle id="djs-spotlight-circle" cx="0" cy="0" r="0" fill="black" />' +
    '</mask>' +
    '</defs>' +
    '<rect width="100%" height="100%" fill="rgba(2,6,23,0.55)" mask="url(#djs-spotlight-mask)" />' +
    '</svg>' +
    '</div>'
  );

  container.appendChild(this._spotlightOverlay);
};

/**
 * Show spotlight effect for element
 *
 * @param {Element} element
 */
Focus.prototype._showSpotlight = function(element) {
  if (!this._spotlightOverlay) {
    return;
  }

  assignStyle(this._spotlightOverlay, { display: 'block' });
  this._updateSpotlight();
};

/**
 * Hide spotlight effect
 */
Focus.prototype._hideSpotlight = function() {
  if (this._spotlightOverlay) {
    assignStyle(this._spotlightOverlay, { display: 'none' });
  }
};

/**
 * Update spotlight position and size based on current viewport and focused element
 */
Focus.prototype._updateSpotlight = function() {
  if (!this._spotlightOverlay || !this._focusedElement) {
    return;
  }

  var canvas = this._canvas;
  var viewbox = canvas.viewbox();
  var elementBounds = getBBox(this._focusedElement);
  
  // Calculate element center in screen coordinates
  var centerX = (elementBounds.x + elementBounds.width / 2 - viewbox.x) * viewbox.scale;
  var centerY = (elementBounds.y + elementBounds.height / 2 - viewbox.y) * viewbox.scale;
  
  // Calculate spotlight radius based on element size
  var elementWidth = elementBounds.width * viewbox.scale;
  var elementHeight = elementBounds.height * viewbox.scale;
  var spotlightRadius = Math.max(
    SPOTLIGHT_MIN_RADIUS,
    Math.hypot(elementWidth, elementHeight) * SPOTLIGHT_RADIUS_SCALE + SPOTLIGHT_EXTRA
  );

  // Update spotlight circle
  var circle = this._spotlightOverlay.querySelector('#djs-spotlight-circle');
  if (circle) {
    domAttr(circle, {
      cx: centerX,
      cy: centerY,
      r: spotlightRadius
    });
  }
};

/**
 * Clean up resources
 */
Focus.prototype._cleanup = function() {
  if (this._animationFrame) {
    cancelAnimationFrame(this._animationFrame);
  }

  if (this._spotlightOverlay) {
    domRemove(this._spotlightOverlay);
    this._spotlightOverlay = null;
  }
};