export default class MapSwitcher {
  constructor(map, onTravel) {
    this.map = map;
    this.onTravel = onTravel;
    this.lastUpdate = 0;

    this.root = document.createElement('nav');
    this.root.className = 'iw-map-switcher';
    this.root.setAttribute('aria-label', 'Overworld landmark switcher');

    this.label = document.createElement('label');
    this.label.htmlFor = 'iw-map-destination';
    this.label.textContent = 'MAP / GO TO';

    this.select = document.createElement('select');
    this.select.id = 'iw-map-destination';
    this.select.setAttribute('aria-label', 'Jump to an Overworld landmark');
    (map.waypoints || []).forEach((waypoint) => {
      const option = document.createElement('option');
      option.value = waypoint.id;
      option.textContent = waypoint.label;
      this.select.appendChild(option);
    });
    this.select.addEventListener('change', () => {
      const waypoint = map.waypoints.find(({ id }) => id === this.select.value);
      if (waypoint) this.onTravel(waypoint);
    });

    this.root.append(this.label, this.select);
    document.body.appendChild(this.root);
  }

  update(now, position) {
    if (!this.map.waypoints?.length || now - this.lastUpdate < 500) return;
    this.lastUpdate = now;
    const nearest = this.map.waypoints.reduce((best, waypoint) => (
      Math.abs(position.x - waypoint.x) < Math.abs(position.x - best.x) ? waypoint : best
    ));
    if (document.activeElement !== this.select) this.select.value = nearest.id;
  }

  destroy() {
    this.root.remove();
  }
}
