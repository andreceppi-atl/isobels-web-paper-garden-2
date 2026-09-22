import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import WorldScene from './scenes/WorldScene.js';
import './ui/tokens.css';
import './ui/listening.css';
import './ui/map-switcher.css';
import './ui/minimap.css';
import './ui/combo.css';
import './ui/touch.css';
import './ui/social.css';
import { WORLD_CSS } from './world/worldTheme.js';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 960,
  height: 540,
  pixelArt: true,
  backgroundColor: WORLD_CSS.paper,
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1.2 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, WorldScene]
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) window.__game = game;
