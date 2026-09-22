const COLOR_TOKENS = {
  ink: '--color-fg',
  paper: '--color-bg',
  petal: '--thread-rose',
  link: '--thread-sky'
};

export default class EditorArtSurface {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;
  }

  prepare(strokes) {
    const grid = this.map.artPlate || this.map.editorGrid;
    if (!grid) return;
    const key = `editor-${grid.texture}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.texture = this.scene.textures.createCanvas(key, grid.nativeWidth, grid.nativeHeight);
    this.canvas = this.texture.getSourceImage();
    this.context = this.texture.context;
    grid.runtimeTexture = key;
    this.redraw(strokes);
  }

  drawStroke(stroke, fromIndex = 0) {
    if (!this.context) return;
    const ctx = this.context;
    const points = stroke.points;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = this.resolveColor(stroke.color);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    const start = points[Math.max(0, fromIndex)];
    if (points.length === 1) {
      ctx.fillRect(start[0] - stroke.size / 2, start[1] - stroke.size / 2, stroke.size, stroke.size);
    } else {
      const end = points.at(-1);
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
    }
    ctx.restore();
    this.texture.refresh();
  }

  redraw(strokes) {
    if (!this.context) return;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.imageSmoothingEnabled = false;
    if (this.map.artPlate) {
      const source = this.scene.textures.get(this.map.artPlate.texture).getSourceImage();
      this.context.drawImage(source, 0, 0);
    }
    strokes.forEach((stroke) => this.drawStroke(stroke));
    this.texture.refresh();
  }

  resolveColor(key) {
    const styles = getComputedStyle(document.documentElement);
    return styles.getPropertyValue(COLOR_TOKENS[key] || COLOR_TOKENS.ink).trim();
  }
}
