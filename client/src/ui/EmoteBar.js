import { emoteKeyLabel } from './emotes.js';

// Row of emote buttons. Buttons never take keyboard focus, otherwise pressing
// Space (jump) or Enter afterwards would "click" the last-used emote.
export default class EmoteBar {
  constructor({ emotes, onPick }) {
    this.root = document.createElement('div');
    this.root.className = 'ws-emotes';
    emotes.forEach((emote, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ws-emote-btn';
      btn.tabIndex = -1;
      btn.title = `${emote.label} (${emoteKeyLabel(index)})`;
      const key = document.createElement('span');
      key.className = 'ws-emote-key';
      key.textContent = emoteKeyLabel(index);
      btn.append(key, document.createTextNode(emote.emoji));
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        onPick(index);
        btn.blur();
      });
      this.root.appendChild(btn);
    });
    document.body.appendChild(this.root);
  }

  destroy() {
    this.root.remove();
  }
}
