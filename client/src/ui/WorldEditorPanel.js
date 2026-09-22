const makeButton = (label, action, title = label) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.dataset.action = action;
  return button;
};

const makeGroup = (label, controls) => {
  const group = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = label;
  group.append(legend, ...controls);
  return group;
};

export default class WorldEditorPanel {
  constructor(actions) {
    this.actions = actions;
    this.layer = 'graphic';
    this.tool = 'paint';
    this.color = 'ink';
    this.root = document.createElement('aside');
    this.root.className = 'iw-editor';
    this.root.setAttribute('aria-label', 'World builder');
    this.toggle = makeButton('BUILD', 'toggle', 'Open the world builder');
    this.toggle.className = 'iw-editor__toggle';
    this.toggle.setAttribute('aria-expanded', 'false');
    this.panel = document.createElement('section');
    this.panel.className = 'iw-editor__panel';
    this.panel.hidden = true;
    this.buildPanel();
    this.root.append(this.toggle, this.panel);
    document.body.appendChild(this.root);
    this.bind();
  }

  buildPanel() {
    const header = document.createElement('header');
    const title = document.createElement('strong');
    title.textContent = 'WORLD BUILDER';
    this.status = document.createElement('span');
    this.status.textContent = 'LOCAL DRAFT';
    header.append(title, this.status);

    this.layerButtons = [makeButton('GRAPHIC', 'layer-graphic'), makeButton('TANGIBLE', 'layer-tangible')];
    this.toolButtons = [makeButton('PAINT', 'tool-paint'), makeButton('DELETE', 'tool-erase')];
    this.colorButtons = ['ink', 'paper', 'petal', 'link'].map((color) => {
      const button = makeButton(color.toUpperCase(), `color-${color}`);
      button.dataset.paint = color;
      return button;
    });
    this.graphicGroup = makeGroup('INK / GRAPHIC', this.colorButtons);
    this.size = document.createElement('select');
    this.size.setAttribute('aria-label', 'Brush size in source pixels');
    [1, 2, 4, 8].forEach((value) => {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = `${value} PX`;
      if (value === 2) option.selected = true;
      this.size.appendChild(option);
    });
    this.sizeGroup = makeGroup('BRUSH / SOURCE PIXELS', [this.size]);

    const history = document.createElement('div');
    history.className = 'iw-editor__actions';
    this.undo = makeButton('UNDO', 'undo');
    this.redo = makeButton('REDO', 'redo');
    this.export = makeButton('SAVE JSON', 'export');
    this.import = makeButton('LOAD JSON', 'import');
    this.reset = makeButton('RESET', 'reset');
    history.append(this.undo, this.redo, this.export, this.import, this.reset);

    this.file = document.createElement('input');
    this.file.type = 'file';
    this.file.accept = 'application/json,.json';
    this.file.className = 'iw-editor__file';
    this.coords = document.createElement('output');
    this.coords.textContent = 'PX —, — / WORLD —, —';
    const help = document.createElement('p');
    help.textContent = 'DRAG to paint · WASD/ARROWS to pan · WHEEL to zoom';
    this.panel.append(header, makeGroup('LAYER', this.layerButtons), makeGroup('TOOL', this.toolButtons),
      this.graphicGroup, this.sizeGroup, this.coords, help, history, this.file);
    this.syncControls();
  }

  bind() {
    this.root.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'toggle') return this.actions.onToggle();
      if (action.startsWith('layer-')) this.layer = action.replace('layer-', '');
      else if (action.startsWith('tool-')) this.tool = action.replace('tool-', '');
      else if (action.startsWith('color-')) {
        this.color = action.replace('color-', '');
        this.actions.onColor(this.color);
      }
      else if (action === 'import') this.file.click();
      else this.actions[action]?.();
      this.syncControls();
      this.actions.onBrush(this.layer, this.tool, Number(this.size.value));
    });
    this.size.addEventListener('change', () => this.actions.onBrush(this.layer, this.tool, Number(this.size.value)));
    this.file.addEventListener('change', async () => {
      const [file] = this.file.files;
      if (file) await this.actions.onImport(await file.text());
      this.file.value = '';
    });
  }

  syncControls() {
    this.layerButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.action === `layer-${this.layer}`));
    this.toolButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.action === `tool-${this.tool}`));
    this.colorButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.paint === this.color));
    this.graphicGroup.hidden = this.layer !== 'graphic';
  }

  setOpen(open) {
    this.panel.hidden = !open;
    this.toggle.textContent = open ? 'PLAY' : 'BUILD';
    this.toggle.setAttribute('aria-expanded', String(open));
    this.toggle.title = open ? 'Return to play' : 'Open the world builder';
    document.body.classList.toggle('iw-editor-active', open);
  }

  setHistory(canUndo, canRedo) {
    this.undo.disabled = !canUndo;
    this.redo.disabled = !canRedo;
  }

  setStatus(text) {
    this.status.textContent = text;
  }

  setPosition(art, world) {
    this.coords.textContent = `PX ${art.x}, ${art.y} / WORLD ${world.x}, ${world.y}`;
  }

  destroy() {
    document.body.classList.remove('iw-editor-active');
    this.root.remove();
  }
}
