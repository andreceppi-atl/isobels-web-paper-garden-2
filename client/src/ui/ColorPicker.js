import { THREAD_COLORS, THREAD_COLOR_KEYS } from '../../../shared/colors.js';

// Thread color picker: a small button showing your color, opening a grid of
// presets. Buttons never take keyboard focus (Space/Enter must keep meaning
// "jump"/"chat" in the game).
export default class ColorPicker {
  constructor({ current, onPick }) {
    this.onPick = onPick;

    this.root = document.createElement('div');
    this.root.className = 'ws-color';

    this.panel = document.createElement('div');
    this.panel.className = 'ws-color-panel';
    this.swatches = new Map();
    for (const key of THREAD_COLOR_KEYS) {
      const btn = this.button('ws-color-swatch', `${THREAD_COLORS[key].name}`);
      btn.dataset.thread = key;
      btn.addEventListener('click', () => {
        this.onPick(key);
        this.root.classList.remove('open');
      });
      this.swatches.set(key, btn);
      this.panel.appendChild(btn);
    }

    this.toggle = this.button('ws-color-toggle', 'thread color (C cycles)');
    this.dot = document.createElement('span');
    this.dot.className = 'ws-color-dot';
    this.toggle.append(this.dot, document.createTextNode('thread'));
    this.toggle.addEventListener('click', () => this.root.classList.toggle('open'));

    this.root.append(this.panel, this.toggle);
    document.body.appendChild(this.root);
    this.setCurrent(current);
  }

  button(className, title) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.title = title;
    btn.tabIndex = -1;
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => btn.blur());
    return btn;
  }

  setCurrent(key) {
    this.dot.dataset.thread = key;
    this.swatches.forEach((btn, k) => btn.classList.toggle('selected', k === key));
  }

  destroy() {
    this.root.remove();
  }
}
