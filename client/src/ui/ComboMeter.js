export default class ComboMeter {
  constructor({ touchMode = false } = {}) {
    this.root = document.createElement('aside');
    this.root.className = 'iw-combo';
    this.root.setAttribute('aria-label', 'Stunt style meter');

    this.kicker = document.createElement('span');
    this.kicker.className = 'iw-combo__kicker';
    this.kicker.textContent = 'SILK STYLE';
    this.rank = document.createElement('strong');
    this.rank.className = 'iw-combo__rank';
    this.label = document.createElement('span');
    this.label.className = 'iw-combo__label';
    this.meta = document.createElement('span');
    this.meta.className = 'iw-combo__meta';
    this.meter = document.createElement('progress');
    this.meter.className = 'iw-combo__meter';
    this.meter.max = 100;
    this.meter.setAttribute('aria-label', 'Current style level');
    this.action = document.createElement('span');
    this.action.className = 'iw-combo__action';
    this.hint = document.createElement('span');
    this.hint.className = 'iw-combo__hint';
    this.hint.textContent = touchMode
      ? 'AIR / HOLD CURL · THEN STAR · TWIST'
      : 'AIR / Q CURL · X STAR · Z TWIST';

    const copy = document.createElement('div');
    copy.className = 'iw-combo__copy';
    copy.append(this.kicker, this.label, this.meta);
    this.root.append(this.rank, copy, this.meter, this.action, this.hint);
    document.body.appendChild(this.root);
    this.lastRank = null;
    this.update({
      totalScore: 0,
      comboScore: 0,
      style: 0,
      chain: 0,
      tier: { rank: 'D', label: 'DANGLING', multiplier: 1 },
      multiplier: 1,
      stuntTier: null,
      active: null,
      activeDuration: '0.0s',
      status: ''
    });
  }

  update(state) {
    const rankChanged = this.lastRank && this.lastRank !== state.tier.rank;
    this.lastRank = state.tier.rank;
    this.rank.textContent = state.tier.rank;
    this.label.textContent = state.tier.label;
    this.meta.textContent = `x${state.multiplier.toFixed(2)} · ${state.totalScore.toLocaleString()} PTS`;
    this.meter.value = state.style;
    this.meter.setAttribute('aria-valuetext', `${state.tier.label}, ${Math.round(state.style)} percent`);
    this.action.textContent = state.active
      ? `${state.stuntTier.label} ${state.active} / ${state.activeDuration}`
      : (state.status || `${state.chain} STUNT${state.chain === 1 ? '' : 'S'} · ${state.comboScore} COMBO`);
    this.root.classList.toggle('is-live', state.style > 0);
    if (rankChanged) this.pulse();
  }

  pulse() {
    clearTimeout(this.pulseTimer);
    this.root.classList.remove('is-hit');
    requestAnimationFrame(() => this.root.classList.add('is-hit'));
    this.pulseTimer = setTimeout(() => this.root.classList.remove('is-hit'), 180);
  }

  destroy() {
    clearTimeout(this.pulseTimer);
    this.root.remove();
  }
}
