export default class BootModeButton {
  constructor({ label, onStart }) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'iw-mobile-start';
    this.button.textContent = label;
    this.button.setAttribute('aria-label', 'Start with on-screen mobile controls');
    this.button.addEventListener('click', onStart);
    document.body.appendChild(this.button);
  }

  destroy() {
    this.button.remove();
  }
}
