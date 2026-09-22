import Phaser from 'phaser';
import Spider from '../entities/Spider.js';
import RemoteSpider from '../entities/RemoteSpider.js';
import NestField from '../entities/NestField.js';
import WorldResidents from '../entities/WorldResidents.js';
import ChatBubble from '../entities/ChatBubble.js';
import ChatUi from '../ui/ChatUi.js';
import EmoteBar from '../ui/EmoteBar.js';
import ColorPicker from '../ui/ColorPicker.js';
import ListeningDeck from '../ui/ListeningDeck.js';
import MiniMap from '../ui/MiniMap.js';
import MapSwitcher from '../ui/MapSwitcher.js';
import ComboMeter from '../ui/ComboMeter.js';
import MobileControls from '../ui/MobileControls.js';
import { EMOTES, emoteIndexForKeyCode } from '../ui/emotes.js';
import StrandField from '../entities/StrandField.js';
import SpinTool from '../systems/SpinTool.js';
import Crawl from '../systems/Crawl.js';
import Targeting from '../systems/Targeting.js';
import Traversal from '../systems/Traversal.js';
import TrickSystem from '../systems/TrickSystem.js';
import { MAP } from '../map.js';
import { circleContacts } from '../../../shared/geometry.js';
import Network from '../net/Network.js';
import PaperWorldView from '../world/PaperWorldView.js';
import RegionBackdrop from '../world/RegionBackdrop.js';
import { WORLD_COLOR, WORLD_CSS, WORLD_TYPE } from '../world/worldTheme.js';
import { THREAD_COLORS, THREAD_COLOR_KEYS, DEFAULT_THREAD_COLOR, isThreadColor, threadHex } from '../../../shared/colors.js';
import { buildNest, buildStockStrands } from '../../../shared/worldWebs.js';

const SEND_INTERVAL_MS = 50;
const HANDSHAKE_RANGE = 90;
const EMOTE_COOLDOWN_MS = 800;
const SPIDER_RADIUS = 14;
const BIG_RELEASE_SPEED = 9;

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  init(data) {
    this.playerName = data.name || 'Guest';
    this.touchMode = !!data.touchMode;
  }

  create() {
    this.matter.world.setBounds(0, 0, MAP.width, MAP.height, 32, true, true, false, false);

    this.cameras.main.setBackgroundColor(WORLD_CSS.paper);
    this.cameras.main.setBounds(0, 0, MAP.width, MAP.height);

    this.anchors = [];
    this.buildLevel();
    this.residents = new WorldResidents(this, MAP);

    this.spider = new Spider(this, MAP.spawn.x, MAP.spawn.y);
    this.cameras.main.startFollow(this.spider.sprite, true, 0.12, 0.12);

    this.wasTouching = true;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE');
    this.trickKeys = this.input.keyboard.addKeys('Q,X,Z');
    this.traversal = new Traversal(this);
    this.comboMeter = new ComboMeter({ touchMode: this.touchMode });
    this.tricks = new TrickSystem({
      onEvent: ({ label, points, durationMs, bailed }) => {
        if (bailed) {
          this.popupScore(label);
          return;
        }
        const held = durationMs ? ` ${(durationMs / 1000).toFixed(1)}s` : '';
        this.popupScore(`${label}${held} +${points}`);
      }
    });

    // Launch by aim: click anywhere, the spider fires toward the cursor.
    this.input.on('pointerdown', (p) => {
      if (this.spinTool && this.spinTool.handleClick()) {
        this.spinClickActive = true;
        return;
      }
      this.fireAt(this.cameras.main.getWorldPoint(p.x, p.y));
    });
    this.input.on('pointerup', () => {
      if (this.spinClickActive) {
        this.spinClickActive = false;
        return;
      }
      this.handleRelease();
    });

    // Launch by button: SPACE auto-aims using the direction you're facing, no
    // precise aim needed. On the ground SPACE still jumps (handled in update());
    // in the air it launches instead, so the two never fight over the same press.
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.crawl.active) {
        this.traversal.consumeJumpInput();
        // On a thread Space jumps (like a floor); on a wall it kicks off and launches a web.
        if (this.crawl.kind === 'strand') return this.crawl.jump(this.readInput());
        const target = this.targeting.auto(this.spider.body.position, this.spider.facing);
        if (this.spider.tryFireWebFacing(target ? [target] : [])) this.onWebFired();
        this.crawl.kickOff();
        return;
      }
      if (!this.spider.grounded) this.fireAuto();
    });
    this.input.keyboard.on('keyup-SPACE', () => {
      if (this.spider.webConstraint) this.traversal.preserveReleaseMomentum();
      this.handleRelease();
    });

    this.hudText = this.add.text(12, 244, '', {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '12px',
      color: WORLD_CSS.ink
    }).setScrollFactor(0);

    this.nameTag = this.add.text(0, 0, this.playerName, {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '11px',
      color: WORLD_CSS.ink
    }).setOrigin(0.5, 1);

    this.spider.sprite.setDepth(2);
    this.nameTag.setDepth(3);
    this.setupNetwork();
    this.miniMap = new MiniMap(MAP);
    if (MAP.waypoints?.length) this.mapSwitcher = new MapSwitcher(MAP, (waypoint) => this.travelTo(waypoint));
    if (this.touchMode) {
      this.mobileControls = new MobileControls({
        onJumpDown: () => this.handleTouchJump(),
        onWebDown: () => this.fireAuto(),
        onWebUp: () => {
          if (this.spider.webConstraint) this.traversal.preserveReleaseMomentum();
          this.handleRelease();
        }
      });
    }
  }

  setupNetwork() {
    this.remotes = new Map();
    this.lastSend = 0;
    this.online = false;

    // Web connections: socket ids of connected players who are online right
    // now, how many connections we have in total, and pending handshake offers.
    this.linkedOnline = new Set();
    this.linkTotal = 0;
    this.offersIn = new Map();
    this.offersOut = new Map();
    this.handshakeTarget = null;

    // Thread balance (server-authoritative) and the lasting strands in the world.
    this.thread = null;
    this.strands = new StrandField(this);
    this.strands.setPermanent(buildStockStrands(MAP), 'world');
    this.nests = new NestField(this, MAP, this.strands);
    this.crawl = new Crawl(this, MAP, this.strands);
    this.targeting = new Targeting({ map: MAP, strands: this.strands, maxLen: this.spider.maxWebLength });
    this.aimMarker = this.add.graphics().setDepth(4);

    // Thread color: applies to your swing web and any strand you spin.
    this.threadColor = DEFAULT_THREAD_COLOR;
    this.lastColorChange = 0;
    this.colorPicker = new ColorPicker({ current: this.threadColor, onPick: (key) => this.chooseThreadColor(key) });

    this.localBubble = null;
    this.chatUi = new ChatUi({
      onFocus: () => this.input.keyboard.resetKeys(),
      onSend: (text) => this.sendChat(text)
    });
    this.lastEmote = 0;
    this.emoteBar = new EmoteBar({ emotes: EMOTES, onPick: (id) => this.sendEmote(id) });

    this.threadGraphic = this.add.graphics().setDepth(1);
    this.handshakePrompt = this.add.text(0, 0, '', {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '12px',
      color: WORLD_CSS.paper,
      backgroundColor: WORLD_CSS.ink,
      padding: { x: 5, y: 3 }
    }).setOrigin(0.5, 1).setDepth(4).setVisible(false);

    const clearRemotes = () => {
      this.remotes.forEach((r) => r.destroy());
      this.remotes.clear();
      this.offersIn.clear();
      this.offersOut.clear();
    };
    const addRemote = (p) => {
      const remote = new RemoteSpider(this, p);
      remote.setLinked(this.linkedOnline.has(p.id));
      this.remotes.set(p.id, remote);
    };

    this.network = new Network({
      name: this.playerName,
      palette: this.spider.palette,
      onStatus: (connected) => {
        this.online = connected;
        this.listeningDeck?.setOnline(connected);
        if (!connected) {
          clearRemotes();
          this.linkedOnline.clear();
          this.linkTotal = 0;
          this.chatUi.setAvailable(false, 0);
          this.thread = null;
          this.strands.clear();
        }
      },
      onInit: (data) => {
        clearRemotes();
        data.players.forEach(addRemote);
        this.nests.setAll(data.nests || []);
        this.strands.setAll(data.strands || []);
        this.applyThreadColor(data.color);
        this.spawnAtHome(data.home);
        if (this.listeningDeck?.active) this.network.setListening(true);
      },
      onJoined: (p) => {
        if (!this.remotes.has(p.id)) addRemote(p);
      },
      onState: (s) => {
        const remote = this.remotes.get(s.id);
        if (remote) remote.applyState(s);
      },
      onLeft: (id) => {
        const remote = this.remotes.get(id);
        if (remote) remote.destroy();
        this.remotes.delete(id);
        this.offersIn.delete(id);
        this.offersOut.delete(id);
      },
      onConnections: ({ online, total }) => {
        this.linkedOnline = new Set(online);
        this.linkTotal = total;
        this.remotes.forEach((r, id) => r.setLinked(this.linkedOnline.has(id)));
        this.chatUi.setAvailable(this.linkedOnline.size > 0, this.linkedOnline.size);
      },
      onChat: ({ from, name, text }) => {
        this.chatUi.addMessage(name, text);
        const remote = this.remotes.get(from);
        if (remote) remote.showBubble(text);
      },
      onEmote: ({ from, id }) => {
        const remote = this.remotes.get(from);
        const emote = EMOTES[id];
        if (remote && emote) remote.showBubble(emote.emoji, { emote: true });
      },
      onThread: (t) => {
        this.thread = t;
        this.listeningDeck?.setThread(t);
      },
      onStrandAdded: (strand) => this.strands.add(strand),
      onStrandReinforced: ({ id, ttl }) => this.strands.reinforce(id, ttl),
      onStrandRemoved: ({ id }) => this.strands.remove(id),
      onPlayerColor: ({ id, color }) => {
        if (id === this.network.selfId) this.applyThreadColor(color);
        else if (this.remotes.has(id)) this.remotes.get(id).setThreadColor(color);
      },
      onNestUpsert: (nest) => {
        this.nests.upsert(nest);
        if (this.home?.slot === nest.slot) this.home = nest;
      },
      onOffered: ({ from, ttl }) => {
        this.offersIn.set(from, this.time.now + ttl);
      },
      onConnected: ({ id }) => {
        this.offersIn.delete(id);
        this.offersOut.delete(id);
        this.waveUntil = this.time.now + 1200;
        const remote = this.remotes.get(id);
        this.popupScore(remote ? `Web connected with ${remote.name}!` : 'Web connected!', WORLD_COLOR.ink);
      }
    });

    this.listeningDeck = new ListeningDeck({ onChange: (active) => this.network.setListening(active) });
    this.listeningDeck.setOnline(this.online);

    this.spinTool = new SpinTool(this, { strands: this.strands, network: this.network, getThread: () => this.thread,
      getColor: () => threadHex(this.threadColor)
    });

    this.input.keyboard.on('keydown-E', () => this.tryHandshake());
    this.input.keyboard.on('keydown-ENTER', () => this.chatUi.focus());
    this.input.keyboard.on('keydown-C', () => this.cycleThreadColor());
    this.input.keyboard.on('keydown', (e) => {
      const index = emoteIndexForKeyCode(e.code);
      if (index >= 0) this.sendEmote(index);
    });
    this.events.once('shutdown', () => {
      this.network.destroy();
      this.chatUi.destroy();
      this.emoteBar.destroy();
      this.colorPicker.destroy();
      this.listeningDeck.destroy();
      this.miniMap?.destroy();
      this.mapSwitcher?.destroy();
      this.comboMeter?.destroy();
      this.mobileControls?.destroy();
      this.nests?.destroy();
      this.residents?.destroy();
      this.atmosphere?.destroy();
    });
  }

  travelTo(waypoint) {
    if (!waypoint) return;
    this.spider.releaseWeb();
    this.crawl.end();
    this.matter.body.setPosition(this.spider.body, { x: waypoint.x, y: waypoint.y });
    this.matter.body.setVelocity(this.spider.body, { x: 0, y: 0 });
    this.cameras.main.centerOn(waypoint.x, waypoint.y);
    this.tricks.reset(this.time.now);
    this.popupScore(`MAP / ${waypoint.label.replace(/^\d+ \/ /, '')}`);
  }

  spawnAtHome(home) {
    if (!home || this.homeSpawned) return;
    const nest = buildNest(MAP, home);
    if (!nest) return;
    this.home = home;
    this.homeSpawned = true;
    this.spider.releaseWeb();
    this.crawl.end();
    this.matter.body.setPosition(this.spider.body, nest.spawn);
    this.matter.body.setVelocity(this.spider.body, { x: 0, y: 0 });
    this.popupScore('HOME WEB / ready', threadHex(home.color));
  }

  applyThreadColor(key) {
    if (!isThreadColor(key)) return;
    this.threadColor = key;
    this.spider.webColor = threadHex(key);
    this.colorPicker.setCurrent(key);
  }

  // Applies at once, then asks the server to remember it (and tell everyone
  // else). If the server refuses, fall back to what we had.
  chooseThreadColor(key) {
    const now = this.time.now;
    if (!isThreadColor(key) || key === this.threadColor || now - this.lastColorChange < 350) return;
    this.lastColorChange = now;

    const previous = this.threadColor;
    this.applyThreadColor(key);
    this.popupScore(`Thread color: ${THREAD_COLORS[key].name}`, threadHex(key));
    this.network.setThreadColor(key).then((res) => {
      if (!res.ok && res.error !== 'offline') this.applyThreadColor(previous);
    });
  }

  cycleThreadColor() {
    const i = THREAD_COLOR_KEYS.indexOf(this.threadColor);
    this.chooseThreadColor(THREAD_COLOR_KEYS[(i + 1) % THREAD_COLOR_KEYS.length]);
  }

  sendEmote(id) {
    const emote = EMOTES[id];
    const now = this.time.now;
    if (!emote || now - this.lastEmote < EMOTE_COOLDOWN_MS) return;
    this.lastEmote = now;

    if (this.localBubble) this.localBubble.destroy();
    this.localBubble = new ChatBubble(this, emote.emoji, { emote: true });
    if (emote.pose === 'wave') this.waveUntil = now + 1200;
    this.network.sendEmote(id);
  }

  sendChat(text) {
    this.network.sendChat(text).then((res) => {
      if (res.ok) {
        this.chatUi.addMessage('You', text, 'mine');
        if (this.localBubble) this.localBubble.destroy();
        this.localBubble = new ChatBubble(this, text);
        return;
      }
      const reasons = {
        'no-web': 'no connected spider is online to hear that',
        'slow-down': 'slow down a little',
        offline: 'you are offline',
        timeout: 'message timed out'
      };
      this.chatUi.addMessage('', reasons[res.error] || 'message not sent', 'system');
    });
  }

  // Nearest visible remote spider within handshake range, or null.
  findHandshakeTarget() {
    if (!this.online) return null;
    const pos = this.spider.body.position;
    let best = null;
    let bestDist = HANDSHAKE_RANGE;
    this.remotes.forEach((r) => {
      if (!r.target) return;
      const d = Phaser.Math.Distance.Between(pos.x, pos.y, r.sprite.x, r.sprite.y);
      if (d <= bestDist) {
        bestDist = d;
        best = r;
      }
    });
    return best;
  }

  handshakeStatus(remote) {
    const now = this.time.now;
    if (this.linkedOnline.has(remote.id)) return 'linked';
    if ((this.offersOut.get(remote.id) || 0) > now) return 'waiting';
    if ((this.offersIn.get(remote.id) || 0) > now) return 'incoming';
    return 'idle';
  }

  tryHandshake() {
    const target = this.handshakeTarget;
    if (!target) return;
    const status = this.handshakeStatus(target);
    if (status === 'linked' || status === 'waiting') return;

    this.network.sendHandshake(target.id).then((res) => {
      if (res.status === 'offered') this.offersOut.set(target.id, this.time.now + res.ttl);
    });
  }

  updateHandshakeUi() {
    this.handshakeTarget = this.findHandshakeTarget();
    const target = this.handshakeTarget;
    if (!target) {
      this.handshakePrompt.setVisible(false);
    } else {
      const status = this.handshakeStatus(target);
      const text = {
        idle: `E: shake hands with ${target.name}`,
        incoming: `E: accept web from ${target.name}`,
        waiting: `waiting for ${target.name}...`,
        linked: ''
      }[status];
      this.handshakePrompt.setText(text).setVisible(text !== '');
      this.handshakePrompt.setPosition(target.sprite.x, target.sprite.y - 52);
    }

    // Silk thread between web-connected spiders.
    const g = this.threadGraphic;
    g.clear();
    const a = this.spider.sprite;
    this.remotes.forEach((r) => {
      if (!r.linked || !r.target) return;
      const dist = Phaser.Math.Distance.Between(a.x, a.y, r.sprite.x, r.sprite.y);
      const sag = Math.min(70, dist * 0.18);
      const midX = (a.x + r.sprite.x) / 2;
      const midY = (a.y + r.sprite.y) / 2 + sag;
      g.lineStyle(2, WORLD_COLOR.inkSoft, Phaser.Math.Clamp(1 - dist / 1600, 0.3, 0.9));
      g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * midX + t * t * r.sprite.x;
        const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * midY + t * t * r.sprite.y;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    });
  }

  broadcastState(now) {
    if (now - this.lastSend < SEND_INTERVAL_MS) return;
    this.lastSend = now;

    const pos = this.spider.body.position;
    const anchor = this.spider.currentAnchor;
    this.network.sendState({
      x: Math.round(pos.x * 10) / 10,
      y: Math.round(pos.y * 10) / 10,
      facing: this.spider.facing,
      pose: this.spider.pose,
      rot: Math.round(this.spider.sprite.rotation * 100) / 100,
      anchor: anchor ? { x: anchor.x, y: anchor.y } : null
    });
  }

  buildLevel() {
    this.atmosphere = new RegionBackdrop(this, MAP);
    this.atmosphere.build();
    this.worldView = new PaperWorldView(this, MAP, this.anchors);
    this.worldView.build();
  }

  readInput() {
    const touch = this.mobileControls?.state || {};
    return {
      left: this.cursors.left.isDown || this.keys.A.isDown || touch.left,
      right: this.cursors.right.isDown || this.keys.D.isDown || touch.right,
      up: this.cursors.up.isDown || this.keys.W.isDown || touch.up,
      down: this.cursors.down.isDown || this.keys.S.isDown || touch.down,
      jump: this.keys.SPACE.isDown || this.cursors.up.isDown || touch.jump
    };
  }

  handleTouchJump() {
    if (!this.crawl.active) return;
    this.traversal.consumeJumpInput();
    if (this.crawl.kind === 'strand') this.crawl.jump(this.readInput());
    else this.crawl.kickOff();
  }

  // Web shots. Solid outlines, strands and anchors are all valid attach points;
  // Targeting decides which one a given aim lands on.
  fireAt(world) {
    const target = this.targeting.aim(this.spider.body.position, world);
    if (this.spider.tryFireWeb(target ? [target] : [], world)) this.launched();
  }

  fireAuto() {
    const target = this.targeting.auto(this.spider.body.position, this.spider.facing);
    const list = target ? [target] : [];
    if (this.spider.tryFireWebFacing(list)) this.launched();
  }

  launched() {
    if (this.crawl.active) this.crawl.end();
    this.onWebFired();
  }

  onWebFired() {
    const speed = Math.hypot(this.spider.body.velocity.x, this.spider.body.velocity.y);
    this.tricks.reward('web-snap', 'WEB SNAP', 8 + speed * 2.2, 4 + speed * 0.18, this.time.now);
  }

  handleRelease() {
    if (!this.spider.webConstraint) return;
    const v = this.spider.body.velocity;
    const speed = Math.hypot(v.x, v.y);
    this.spider.releaseWeb();
    const big = speed > BIG_RELEASE_SPEED;
    this.tricks.reward(
      big ? 'big-release' : 'release',
      big ? 'BIG RELEASE' : 'CLEAN RELEASE',
      (big ? 20 : 8) + speed * (big ? 3.2 : 1.8),
      (big ? 10 : 4) + speed * 0.25,
      this.time.now
    );
  }

  popupScore(text, color = WORLD_COLOR.ink) {
    const t = this.add.text(this.spider.sprite.x, this.spider.sprite.y - 30, text, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: t.y - 34,
      alpha: 0,
      duration: 750,
      onComplete: () => t.destroy()
    });
  }

  update(time, delta) {
    const body = this.spider.body;
    const input = this.readInput();

    // Ground / wall / ceiling contact comes from the map geometry (not from
    // physics collision events, which can't tell a floor from a wall).
    const contacts = circleContacts(body.position.x, body.position.y, SPIDER_RADIUS, MAP.solids, 3);
    const movement = this.traversal.update(time, delta, input, contacts);
    const { onGround, swinging } = movement;

    const touching = this.spider.grounded || this.crawl.active;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    this.tricks.update(time, delta, {
      airborne: !touching,
      speed,
      input: {
        curl: this.trickKeys.Q.isDown || this.mobileControls?.state.trick === 'curl',
        star: this.trickKeys.X.isDown || this.mobileControls?.state.trick === 'star',
        twist: this.trickKeys.Z.isDown || this.mobileControls?.state.trick === 'twist'
      }
    });
    if (touching && !this.wasTouching) this.tricks.land(time, speed);
    this.wasTouching = touching;

    if (this.tricks.active) {
      this.spider.setPose(this.tricks.active.def.pose);
    } else if (this.waveUntil && this.time.now < this.waveUntil) {
      this.spider.setPose('wave');
    } else if (this.crawl.active) {
      // A crude two-frame walk cycle while moving along a surface.
      this.spider.setPose(this.crawl.moving && Math.floor(time / 140) % 2 === 0 ? 'leap' : 'idle');
    } else if (swinging) {
      this.spider.setPose('swing');
    } else if (onGround) {
      this.spider.setPose('idle');
    } else {
      this.spider.setPose('leap');
    }

    this.spider.update();
    const stuntAnimation = this.tricks.animation(time, this.spider.facing);
    const targetRot = this.crawl.active ? this.crawl.targetRot : stuntAnimation.rotation;
    const spriteRot = this.spider.sprite.rotation;
    this.spider.sprite.rotation = spriteRot + Phaser.Math.Angle.Wrap(targetRot - spriteRot) * Math.min(1, delta / 60);
    this.spider.sprite.setScale(stuntAnimation.scale);
    this.nameTag.setPosition(this.spider.sprite.x, this.spider.sprite.y - 34);
    if (this.localBubble) this.localBubble.setPosition(this.spider.sprite.x, this.spider.sprite.y - 50);

    if (this.spider.sprite.y > MAP.height) {
      this.spider.releaseWeb();
      this.crawl.end();
      const home = this.home ? buildNest(MAP, this.home)?.spawn : null;
      this.matter.body.setPosition(body, home || { x: MAP.spawn.x, y: MAP.spawn.y });
      this.matter.body.setVelocity(body, { x: 0, y: 0 });
      this.tricks.bail(time);
    }

    const grabbed = this.spider.currentAnchor;
    if (grabbed && grabbed.strandId && !this.strands.has(grabbed.strandId)) this.spider.releaseWeb();
    this.strands.draw();
    this.spinTool.update();
    this.updateAimMarker();

    this.remotes.forEach((r) => r.update(delta));
    this.residents?.update(time);
    this.atmosphere?.update(time, {
      x: body.position.x,
      y: body.position.y + 14,
      vx: body.velocity.x,
      grounded: onGround || this.crawl.active
    });
    this.updateHandshakeUi();
    this.broadcastState(time);
    this.miniMap?.update(time, {
      player: body.position,
      remotes: this.remotes,
      strands: this.strands.list(),
      camera: this.cameras.main
    });
    this.mapSwitcher?.update(time, body.position);
    this.comboMeter?.update(this.tricks.snapshot(time));

    this.hudText.setText(
      `${movement.state.toUpperCase()} / SPEED ${speed.toFixed(1)}\n` +
      `${this.online ? `${this.remotes.size + 1} SPIDERS / ${this.linkedOnline.size} CONNECTED` : 'SOLO / RECONNECTING'}`
    );
  }

  // A faint ring where your web would land if you clicked now.
  updateAimMarker() {
    const g = this.aimMarker;
    g.clear();
    if (this.spider.webConstraint || this.spinTool.shift.isDown) return;
    const pointer = this.input.activePointer;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const target = this.targeting.aim(this.spider.body.position, world);
    if (!target) return;
    g.lineStyle(2, WORLD_COLOR.ink, 0.55).strokeCircle(target.x, target.y, 7);
    g.fillStyle(WORLD_COLOR.ink, 0.5).fillCircle(target.x, target.y, 2.5);
  }
}
