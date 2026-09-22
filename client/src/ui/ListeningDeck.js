const TRACKS = [
  { title: 'limn', src: '/music/limn-snip.mp3' },
  { title: 'paces', src: '/music/paces.mp3' },
  { title: 'tether', src: '/music/tether-snip.mp3' },
  { title: 'dear april', src: '/music/dear-april-master-snip.mp3' },
  { title: 'rachel', src: '/music/rachel-snip.mp3' },
  { title: 'carmen', src: '/music/carmen-snip.mp3' },
  { title: 'undercover', src: '/music/undercover-snip-verse.mp3' }
];

const el = (tag, className, text = '') => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

export default class ListeningDeck {
  constructor({ onChange }) {
    this.onChange = onChange;
    this.active = false;
    this.online = false;
    this.track = 0;
    this.seconds = 0;
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.volume = 0.7;
    this.audio.setAttribute('playsinline', '');
    this.clockTimer = null;
    this.build();
    this.loadTrack();
    this.audio.addEventListener('ended', () => this.nextTrack({ autoplay: true }));
    this.audio.addEventListener('error', () => {
      this.status.textContent = 'the tape snagged · try the next track';
    });
  }

  build() {
    this.root = el('aside', 'iw-listen');
    this.root.setAttribute('aria-label', 'Listening and Thread');
    this.toggle = el('button', 'iw-listen__button', '▶ listen');
    this.toggle.type = 'button';
    this.toggle.setAttribute('aria-pressed', 'false');
    this.copy = el('div', 'iw-listen__copy');
    this.title = el('strong', '', `${TRACKS[0].title} · isobel`);
    this.status = el('span', '', 'radio ready · Thread 0/100');
    this.copy.append(this.title, this.status);
    this.next = el('button', 'iw-listen__next', '↻');
    this.next.type = 'button';
    this.next.setAttribute('aria-label', 'Next track');
    this.meter = el('progress', 'iw-listen__meter');
    this.meter.max = 100;
    this.meter.value = 0;
    this.meter.setAttribute('aria-label', 'Available Thread');
    this.root.append(this.toggle, this.copy, this.next, this.meter);
    document.body.appendChild(this.root);
    this.toggle.addEventListener('click', () => this.toggleListening());
    this.next.addEventListener('click', () => this.nextTrack());
  }

  async toggleListening() {
    this.setBusy(true);
    try {
      if (!this.active) {
        if (!(await this.startAudio())) return;
        this.active = true;
      } else {
        this.audio.pause();
        this.active = false;
      }
      this.syncClock();
      const result = await this.onChange(this.active);
      this.online = !!result?.ok;
      this.render();
    } finally {
      this.setBusy(false);
    }
  }

  loadTrack() {
    const track = TRACKS[this.track];
    this.title.textContent = `${track.title} · isobel`;
    this.audio.src = track.src;
    this.audio.load();
  }

  async startAudio() {
    try {
      await this.audio.play();
      return true;
    } catch {
      this.status.textContent = 'tap listen again to start the tape';
      return false;
    }
  }

  syncClock() {
    clearInterval(this.clockTimer);
    if (this.active) {
      this.clockTimer = setInterval(() => { this.seconds += 1; this.render(); }, 1000);
    }
    this.render();
  }

  async nextTrack({ autoplay = this.active } = {}) {
    this.track = (this.track + 1) % TRACKS.length;
    this.loadTrack();
    if (autoplay) await this.startAudio();
    this.render();
  }

  setThread(thread) {
    this.thread = thread;
    this.meter.max = thread.max;
    this.meter.value = thread.balance;
    this.render();
  }

  setOnline(online) {
    this.online = online;
    this.render();
  }

  setBusy(busy) {
    this.toggle.disabled = busy;
    this.toggle.setAttribute('aria-busy', String(busy));
  }

  render() {
    this.toggle.textContent = this.active ? '■ pause' : '▶ listen';
    this.toggle.setAttribute('aria-pressed', String(this.active));
    const time = `${String(Math.floor(this.seconds / 60)).padStart(2, '0')}:${String(this.seconds % 60).padStart(2, '0')}`;
    const thread = this.thread ? `Thread ${this.thread.balance}/${this.thread.max}` : 'Thread --/--';
    const mode = this.online ? this.active ? `${time} listened` : 'radio ready' : 'solo preview';
    this.status.textContent = `${mode} · ${thread}`;
  }

  destroy() {
    clearInterval(this.clockTimer);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.root.remove();
  }
}
