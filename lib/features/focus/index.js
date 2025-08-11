import Focus from './Focus';
import FocusBehavior from './FocusBehavior';

/**
 * @type { import('didi').ModuleDeclaration }
 */
export default {
  __init__: [ 'focus', 'focusBehavior' ],
  focus: [ 'type', Focus ],
  focusBehavior: [ 'type', FocusBehavior ]
};