import { TOUCH_TRICKS, nextTouchTrick, stickState } from './touchModel.js';

const HOLD_KEYS = new Set(['Enter', ' ']);

function makeButton(label, className, ariaLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  return button;
}

export default class MobileControls {
  constructor({ onJumpDown, onWebDown, onWebUp }) {
    this.onJumpDown = onJumpDown || (() => {});
    this.onWebDown = onWebDown || (() => {});
    this.onWebUp = onWebUp || (() => {});
    this.state = { left: false, right: false, up: false, down: false, jump: false, trick: null };
    this.trickIndex = 0;
    this.root = document.createElement('section');
    this.root.className = 'iw-touch';
    this.root.setAttribute('aria-label', 'Mobile game controls');
    this.buildStick();
    this.buildActions();
    document.body.appendChild(this.root);
    document.body.classList.add('iw-touch-active');
  }

  buildStick() {
    this.stick = makeButton('', 'iw-touch__stick', 'Movement joystick; drag or use arrow keys');
    this.stick.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight');
    this.thumb = document.createElement('span');
    this.thumb.className = 'iw-touch__thumb';
    this.thumb.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'iw-touch__stick-label';
    label.textContent = 'MOVE';
    this.stick.append(this.thumb, label);
    this.root.appendChild(this.stick);

    this.stick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.stick.setPointerCapture(event.pointerId);
      this.moveStick(event);
    });
    this.stick.addEventListener('pointermove', (event) => {
      if (this.stick.hasPointerCapture(event.pointerId)) this.moveStick(event);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
      this.stick.addEventListener(type, () => this.resetStick());
    });
    this.stick.addEventListener('keydown', (event) => {
      if (this.setArrow(event.key, true)) event.preventDefault();
    });
    this.stick.addEventListener('keyup', (event) => {
      if (this.setArrow(event.key, false)) event.preventDefault();
    });
    this.stick.addEventListener('blur', () => this.resetStick());
  }

  buildActions() {
    const actions = document.createElement('div');
    actions.className = 'iw-touch__actions';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Spider actions');
    this.trickButton = makeButton('CURL', 'iw-touch__button iw-touch__button--trick', 'Perform curl trick');
    const jump = makeButton('JUMP', 'iw-touch__button', 'Jump');
    const web = makeButton('WEB', 'iw-touch__button', 'Fire or release web');
    actions.append(this.trickButton, jump, web);
    this.root.appendChild(actions);

    this.bindHold(jump, () => {
      this.state.jump = true;
      this.onJumpDown();
    }, () => { this.state.jump = false; });
    this.bindHold(web, () => this.onWebDown(), () => this.onWebUp());
    this.bindHold(this.trickButton, () => {
      this.state.trick = TOUCH_TRICKS[this.trickIndex];
    }, () => {
      this.state.trick = null;
      this.trickIndex = nextTouchTrick(this.trickIndex);
      const next = TOUCH_TRICKS[this.trickIndex].toUpperCase();
      this.trickButton.textContent = next;
      this.trickButton.setAttribute('aria-label', `Perform ${next.toLowerCase()} trick`);
    });
  }

  bindHold(button, press, release) {
    let held = false;
    const begin = (event) => {
      event.preventDefault();
      if (held) return;
      held = true;
      button.classList.add('is-pressed');
      press();
    };
    const end = () => {
      if (!held) return;
      held = false;
      button.classList.remove('is-pressed');
      release();
    };
    button.addEventListener('pointerdown', begin);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => button.addEventListener(type, end));
    button.addEventListener('keydown', (event) => { if (HOLD_KEYS.has(event.key)) begin(event); });
    button.addEventListener('keyup', (event) => { if (HOLD_KEYS.has(event.key)) end(); });
    button.addEventListener('blur', end);
  }

  moveStick(event) {
    const rect = this.stick.getBoundingClientRect();
    const limit = Math.max(1, (rect.width - 44) / 2);
    const next = stickState(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2, limit);
    Object.assign(this.state, { left: next.left, right: next.right, up: next.up, down: next.down });
    this.thumb.style.transform = `translate(calc(-50% + ${next.x}px), calc(-50% + ${next.y}px))`;
  }

  setArrow(key, active) {
    const field = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[key];
    if (field) this.state[field] = active;
    return !!field;
  }

  resetStick() {
    Object.assign(this.state, { left: false, right: false, up: false, down: false });
    this.thumb.style.transform = 'translate(-50%, -50%)';
  }

  destroy() {
    this.onWebUp();
    this.root.remove();
    document.body.classList.remove('iw-touch-active');
  }
}
