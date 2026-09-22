const getColors = () => {
  const styles = getComputedStyle(document.documentElement);
  return {
    paper: styles.getPropertyValue('--color-bg').trim(),
    surface: styles.getPropertyValue('--color-bg-subtle').trim(),
    ink: styles.getPropertyValue('--color-fg').trim(),
    muted: styles.getPropertyValue('--color-fg-muted').trim(),
    border: styles.getPropertyValue('--color-border').trim()
  };
};

export default class MiniMap {
  constructor(map) {
    this.map = map;
    this.lastDraw = 0;
    this.root = document.createElement('aside');
    this.root.className = 'iw-map';
    this.root.setAttribute('aria-label', `${map.name} minimap`);
    this.header = document.createElement('header');
    this.title = document.createElement('strong');
    this.title.textContent = 'MAP / 01';
    this.room = document.createElement('span');
    this.room.textContent = map.rooms?.[0]?.label || map.name;
    this.header.append(this.title, this.room);
    this.canvas = document.createElement('canvas');
    this.canvas.width = 440;
    this.canvas.height = 190;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Map showing your position, other spiders, and woven threads');
    this.legend = document.createElement('p');
    this.legend.textContent = '■ you  ·  □ spider  ·  — web';
    this.root.append(this.header, this.canvas, this.legend);
    document.body.appendChild(this.root);
  }

  update(now, state) {
    if (now - this.lastDraw < 100) return;
    this.lastDraw = now;
    this.draw(state);
  }

  draw({ player, remotes, strands, camera }) {
    const ctx = this.canvas.getContext('2d');
    const colors = getColors();
    const sx = this.canvas.width / this.map.width;
    const sy = this.canvas.height / this.map.height;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 1;
    this.map.solids.forEach((solid) => {
      ctx.fillRect(solid.x * sx, solid.y * sy, Math.max(1, solid.w * sx), Math.max(1, solid.h * sy));
      ctx.strokeRect(solid.x * sx, solid.y * sy, Math.max(1, solid.w * sx), Math.max(1, solid.h * sy));
    });

    ctx.strokeStyle = colors.muted;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1.5;
    strands.forEach((strand) => {
      ctx.beginPath();
      ctx.moveTo(strand.x1 * sx, strand.y1 * sy);
      ctx.lineTo(strand.x2 * sx, strand.y2 * sy);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = colors.border;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(camera.scrollX * sx, camera.scrollY * sy, camera.width * sx, camera.height * sy);
    ctx.setLineDash([]);

    remotes.forEach((remote) => {
      if (!remote.target) return;
      ctx.strokeStyle = colors.ink;
      ctx.strokeRect(remote.sprite.x * sx - 2, remote.sprite.y * sy - 2, 4, 4);
    });
    ctx.fillStyle = colors.ink;
    ctx.fillRect(player.x * sx - 2.5, player.y * sy - 2.5, 5, 5);

    const current = this.map.rooms?.find((room) => player.x >= room.x && player.x < room.x + room.w);
    this.room.textContent = current?.label || this.map.name;
  }

  destroy() {
    this.root.remove();
  }
}
