const MAX_LINES = 6;
const FADE_AFTER_MS = 15000;
const REMOVE_AFTER_MS = 45000;

// DOM overlay chat panel: a short fading log plus one input line. Message text
// is only ever written with textContent, never parsed as HTML.
export default class ChatUi {
  constructor({ onSend, onFocus }) {
    this.onSend = onSend;
    this.available = false;

    this.root = document.createElement('div');
    this.root.className = 'ws-chat';
    this.log = document.createElement('div');
    this.log.className = 'ws-chat-log';
    this.input = document.createElement('input');
    this.input.className = 'ws-chat-input';
    this.input.type = 'text';
    this.input.maxLength = 140;
    this.input.autocomplete = 'off';
    this.root.append(this.log, this.input);
    document.body.appendChild(this.root);

    // Keys typed here must never reach the game (WASD/Space/E), and the game's
    // own key capture must not swallow spaces.
    const swallow = (e) => e.stopPropagation();
    this.input.addEventListener('keyup', swallow);
    this.input.addEventListener('keypress', swallow);
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.key === 'Enter') {
        const text = this.input.value.trim();
        this.input.value = '';
        if (text) this.onSend(text);
        this.input.blur();
      } else if (e.key === 'Escape') {
        this.input.value = '';
        this.input.blur();
      }
    });
    this.input.addEventListener('focus', () => onFocus());

    this.setAvailable(false, 0);
  }

  setAvailable(available, count) {
    this.available = available;
    this.input.disabled = !available;
    this.input.placeholder = available
      ? `Enter to chat with ${count} connected spider${count === 1 ? '' : 's'}`
      : 'chat unlocks once you connect webs (E near a spider)';
    if (!available && document.activeElement === this.input) this.input.blur();
  }

  focus() {
    if (this.available) this.input.focus();
  }

  addMessage(name, text, kind = 'normal') {
    const line = document.createElement('div');
    line.className = `ws-chat-line${kind === 'mine' ? ' mine' : ''}${kind === 'system' ? ' system' : ''}`;
    if (kind === 'system') {
      line.textContent = text;
    } else {
      const who = document.createElement('span');
      who.className = 'ws-chat-name';
      who.textContent = `${name}: `;
      line.append(who, document.createTextNode(text));
    }
    this.log.appendChild(line);
    while (this.log.children.length > MAX_LINES) this.log.firstChild.remove();
    setTimeout(() => line.classList.add('old'), FADE_AFTER_MS);
    setTimeout(() => line.remove(), REMOVE_AFTER_MS);
  }

  destroy() {
    this.root.remove();
  }
}
