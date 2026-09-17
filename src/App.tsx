import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const VIEW_HEIGHT = 720;
const WORLD_WIDTH = 3040;
const FIXED_STEP = 1 / 60;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 38;

type GameMode = "ready" | "playing" | "dead" | "won";

type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Spike = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type PopTrap = Spike & {
  triggerX: number;
  delay: number;
};

type FallingTrap = {
  x: number;
  y: number;
  w: number;
  h: number;
  triggerX: number;
  delay: number;
  stopY: number;
};

type Saw = {
  x: number;
  baseY: number;
  r: number;
  range: number;
  speed: number;
  phase: number;
};

type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  coyote: number;
  jumpBuffer: number;
  facing: number;
  squash: number;
};

type PopState = {
  triggered: boolean;
  timer: number;
  rise: number;
};

type FallingState = {
  triggered: boolean;
  timer: number;
  y: number;
  vy: number;
  settled: boolean;
};

type GameState = {
  mode: GameMode;
  player: Player;
  cameraX: number;
  viewportWidth: number;
  checkpoint: 0 | 1;
  deaths: number;
  elapsed: number;
  hudClock: number;
  deathTimer: number;
  flash: number;
  deathPoint: { x: number; y: number } | null;
  popStates: PopState[];
  fallingStates: FallingState[];
};

type InputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpJustPressed: boolean;
};

type HudState = {
  mode: GameMode;
  deaths: number;
  checkpoint: 0 | 1;
  elapsed: number;
};

const PLATFORMS: Platform[] = [
  { x: -120, y: 620, w: 610, h: 180 },
  { x: 620, y: 620, w: 390, h: 180 },
  { x: 1100, y: 530, w: 280, h: 270 },
  { x: 1480, y: 620, w: 280, h: 180 },
  { x: 1870, y: 540, w: 310, h: 260 },
  { x: 2280, y: 620, w: 320, h: 180 },
  { x: 2700, y: 500, w: 340, h: 300 },
];

const STATIC_SPIKES: Spike[] = [
  { x: 360, y: 584, w: 34, h: 36 },
  { x: 720, y: 584, w: 34, h: 36 },
  { x: 772, y: 584, w: 34, h: 36 },
  { x: 1165, y: 494, w: 34, h: 36 },
  { x: 1220, y: 494, w: 34, h: 36 },
  { x: 1542, y: 584, w: 34, h: 36 },
  { x: 1992, y: 504, w: 34, h: 36 },
  { x: 2050, y: 504, w: 34, h: 36 },
  { x: 2350, y: 584, w: 34, h: 36 },
  { x: 2406, y: 584, w: 34, h: 36 },
  { x: 2782, y: 464, w: 34, h: 36 },
  { x: 2838, y: 464, w: 34, h: 36 },
];

const POP_TRAPS: PopTrap[] = [
  { x: 894, y: 584, w: 34, h: 36, triggerX: 820, delay: 15 },
  { x: 1272, y: 494, w: 34, h: 36, triggerX: 1194, delay: 11 },
  { x: 1702, y: 584, w: 34, h: 36, triggerX: 1618, delay: 14 },
  { x: 2112, y: 504, w: 34, h: 36, triggerX: 2036, delay: 12 },
  { x: 2512, y: 584, w: 34, h: 36, triggerX: 2436, delay: 13 },
  { x: 2906, y: 464, w: 34, h: 36, triggerX: 2844, delay: 10 },
];

const FALLING_TRAPS: FallingTrap[] = [
  { x: 1310, y: 176, w: 60, h: 24, triggerX: 1142, delay: 20, stopY: 506 },
  { x: 1662, y: 150, w: 64, h: 24, triggerX: 1544, delay: 18, stopY: 596 },
  { x: 2570, y: 172, w: 58, h: 24, triggerX: 2380, delay: 24, stopY: 596 },
];

const SAWS: Saw[] = [
  { x: 1665, baseY: 570, r: 25, range: 18, speed: 3.2, phase: 0 },
  { x: 1944, baseY: 490, r: 24, range: 24, speed: 2.5, phase: 1.4 },
  { x: 2470, baseY: 570, r: 25, range: 22, speed: 3.8, phase: 2.1 },
];

const START_POSITION = { x: 108, y: 582 };
const CHECKPOINT_POSITION = { x: 1504, y: 582 };
const CHECKPOINT_X = 1500;
const GOAL = { x: 2950, y: 430, w: 48, h: 70 };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function makePlayer(x: number, y: number): Player {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
    onGround: true,
    coyote: 7,
    jumpBuffer: 0,
    facing: 1,
    squash: 0,
  };
}

function createGame(): GameState {
  return {
    mode: "ready",
    player: makePlayer(START_POSITION.x, START_POSITION.y),
    cameraX: 0,
    viewportWidth: 1180,
    checkpoint: 0,
    deaths: 0,
    elapsed: 0,
    hudClock: 0,
    deathTimer: 0,
    flash: 0,
    deathPoint: null,
    popStates: POP_TRAPS.map(() => ({ triggered: false, timer: 0, rise: 0 })),
    fallingStates: FALLING_TRAPS.map((trap) => ({
      triggered: false,
      timer: 0,
      y: trap.y,
      vy: 0,
      settled: false,
    })),
  };
}

function resetTraps(game: GameState) {
  game.popStates = POP_TRAPS.map(() => ({ triggered: false, timer: 0, rise: 0 }));
  game.fallingStates = FALLING_TRAPS.map((trap) => ({
    triggered: false,
    timer: 0,
    y: trap.y,
    vy: 0,
    settled: false,
  }));
}

function resetGame(game: GameState) {
  Object.assign(game, createGame());
}

function respawn(game: GameState) {
  const spawn = game.checkpoint === 1 ? CHECKPOINT_POSITION : START_POSITION;
  game.player = makePlayer(spawn.x, spawn.y);
  game.mode = "playing";
  game.deathTimer = 0;
  game.flash = 0;
  game.deathPoint = null;
  game.cameraX = clamp(spawn.x - game.viewportWidth * 0.35, 0, WORLD_WIDTH - game.viewportWidth);
  resetTraps(game);
}

function triggerDeath(game: GameState) {
  if (game.mode !== "playing") return;

  game.mode = "dead";
  game.deathTimer = 36;
  game.deaths += 1;
  game.flash = 16;
  game.deathPoint = {
    x: game.player.x + game.player.w / 2,
    y: game.player.y + game.player.h / 2,
  };
  game.player.vx = 0;
  game.player.vy = 0;
}

function tryJump(player: Player) {
  if (player.jumpBuffer <= 0 || player.coyote <= 0) return false;

  player.vy = -14.6;
  player.onGround = false;
  player.coyote = 0;
  player.jumpBuffer = 0;
  player.squash = 1;
  return true;
}

function collidesWithSpike(player: Player, spike: Spike) {
  if (
    player.x + player.w <= spike.x ||
    player.x >= spike.x + spike.w ||
    player.y >= spike.y + spike.h ||
    player.y + player.h <= spike.y
  ) {
    return false;
  }

  const sampleXs = [player.x + 4, player.x + player.w / 2, player.x + player.w - 4];
  const playerBottom = player.y + player.h;

  return sampleXs.some((sampleX) => {
    if (sampleX < spike.x || sampleX > spike.x + spike.w) return false;
    const distanceFromTip = Math.abs(sampleX - (spike.x + spike.w / 2)) / (spike.w / 2);
    const spikeSurface = spike.y + spike.h * distanceFromTip;
    return playerBottom >= spikeSurface && player.y < spike.y + spike.h;
  });
}

function collidesWithSaw(player: Player, saw: Saw, elapsed: number) {
  const sawY = saw.baseY + Math.sin(elapsed * saw.speed + saw.phase) * saw.range;
  const nearestX = clamp(saw.x, player.x, player.x + player.w);
  const nearestY = clamp(sawY, player.y, player.y + player.h);
  const dx = saw.x - nearestX;
  const dy = sawY - nearestY;
  return dx * dx + dy * dy < saw.r * saw.r;
}

function updateTraps(game: GameState) {
  const playerCenter = game.player.x + game.player.w / 2;

  POP_TRAPS.forEach((trap, index) => {
    const state = game.popStates[index];
    if (!state.triggered && playerCenter > trap.triggerX) state.triggered = true;
    if (!state.triggered) return;

    state.timer += 1;
    if (state.timer > trap.delay) state.rise = clamp(state.rise + 0.2, 0, 1);
  });

  FALLING_TRAPS.forEach((trap, index) => {
    const state = game.fallingStates[index];
    if (!state.triggered && playerCenter > trap.triggerX) state.triggered = true;
    if (!state.triggered || state.settled) return;

    state.timer += 1;
    if (state.timer <= trap.delay) return;

    state.vy = Math.min(state.vy + 0.72, 17);
    state.y += state.vy;
    if (state.y + trap.h >= trap.stopY + trap.h) {
      state.y = trap.stopY;
      state.settled = true;
    }
  });
}

function updateGame(game: GameState, input: InputState) {
  if (game.mode === "dead") {
    game.deathTimer -= 1;
    game.flash = Math.max(0, game.flash - 1);
    if (game.deathTimer <= 0) respawn(game);
    return;
  }

  if (game.mode !== "playing") return;

  const player = game.player;
  game.elapsed += FIXED_STEP;
  game.flash = Math.max(0, game.flash - 1);
  player.squash = Math.max(0, player.squash - 0.12);

  if (input.jumpJustPressed) player.jumpBuffer = 8;
  input.jumpJustPressed = false;
  if (player.jumpBuffer > 0) player.jumpBuffer -= 1;

  if (player.onGround) player.coyote = 7;
  else player.coyote = Math.max(0, player.coyote - 1);

  const direction = Number(input.right) - Number(input.left);
  if (direction !== 0) {
    player.vx = clamp(player.vx + direction * (player.onGround ? 0.9 : 0.55), -6.5, 6.5);
    player.facing = direction;
  } else {
    player.vx *= player.onGround ? 0.72 : 0.95;
    if (Math.abs(player.vx) < 0.04) player.vx = 0;
  }

  tryJump(player);
  if (!input.jump && player.vy < -5) player.vy += 0.75;
  player.vy = Math.min(player.vy + 0.78, 17);

  player.x += player.vx;
  for (const platform of PLATFORMS) {
    if (!rectsOverlap(player.x, player.y, player.w, player.h, platform.x, platform.y, platform.w, platform.h)) {
      continue;
    }
    if (player.vx > 0) player.x = platform.x - player.w;
    else if (player.vx < 0) player.x = platform.x + platform.w;
    player.vx = 0;
  }

  const oldY = player.y;
  player.y += player.vy;
  player.onGround = false;
  for (const platform of PLATFORMS) {
    if (!rectsOverlap(player.x, player.y, player.w, player.h, platform.x, platform.y, platform.w, platform.h)) {
      continue;
    }

    if (player.vy >= 0 && oldY + player.h <= platform.y + 16) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.coyote = 7;
      player.squash = 0.8;
    } else if (player.vy < 0 && oldY >= platform.y + platform.h - 16) {
      player.y = platform.y + platform.h;
      player.vy = 0;
    }
  }

  if (player.onGround) tryJump(player);
  updateTraps(game);

  const hitPopSpike = POP_TRAPS.some((trap, index) => {
    const state = game.popStates[index];
    if (state.rise < 0.62) return false;
    const height = trap.h * state.rise;
    return collidesWithSpike(player, {
      x: trap.x,
      y: trap.y + trap.h - height,
      w: trap.w,
      h: height,
    });
  });

  const hitStaticSpike = STATIC_SPIKES.some((spike) => collidesWithSpike(player, spike));
  const hitSaw = SAWS.some((saw) => collidesWithSaw(player, saw, game.elapsed));
  const hitFallingTrap = FALLING_TRAPS.some((trap, index) => {
    const state = game.fallingStates[index];
    return rectsOverlap(player.x, player.y, player.w, player.h, trap.x, state.y, trap.w, trap.h);
  });

  if (hitPopSpike || hitStaticSpike || hitSaw || hitFallingTrap || player.y > VIEW_HEIGHT + 150) {
    triggerDeath(game);
    return;
  }

  if (game.checkpoint === 0 && player.x > CHECKPOINT_X) game.checkpoint = 1;

  if (rectsOverlap(player.x, player.y, player.w, player.h, GOAL.x, GOAL.y, GOAL.w, GOAL.h)) {
    game.mode = "won";
    input.left = false;
    input.right = false;
    input.jump = false;
    input.jumpJustPressed = false;
  }

  const cameraTarget = clamp(player.x - game.viewportWidth * 0.36, 0, WORLD_WIDTH - game.viewportWidth);
  game.cameraX += (cameraTarget - game.cameraX) * 0.16;
}

function drawSpike(ctx: CanvasRenderingContext2D, spike: Spike, progress = 1, muted = false) {
  const height = spike.h * progress;
  if (height <= 0) return;
  const top = spike.y + spike.h - height;
  const base = spike.y + spike.h;

  ctx.beginPath();
  ctx.moveTo(spike.x, base);
  ctx.lineTo(spike.x + spike.w / 2, top);
  ctx.lineTo(spike.x + spike.w, base);
  ctx.closePath();
  ctx.fillStyle = muted ? "#5d233a" : "#f14f69";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(spike.x + spike.w / 2, top + 3);
  ctx.lineTo(spike.x + spike.w - 5, base - 3);
  ctx.lineTo(spike.x + spike.w / 2 + 2, base - 3);
  ctx.closePath();
  ctx.fillStyle = muted ? "#8a304d" : "#ffabb8";
  ctx.fill();
}

function drawPlatform(ctx: CanvasRenderingContext2D, platform: Platform) {
  ctx.fillStyle = "#1d2639";
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  ctx.fillStyle = "#85e5d7";
  ctx.fillRect(platform.x, platform.y, platform.w, 4);
  ctx.fillStyle = "#314057";
  ctx.fillRect(platform.x, platform.y + 4, platform.w, 5);

  ctx.strokeStyle = "rgba(124, 153, 183, 0.2)";
  ctx.lineWidth = 2;
  for (let x = platform.x + 24; x < platform.x + platform.w; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, platform.y + 22);
    ctx.lineTo(x - 20, platform.y + 42);
    ctx.stroke();
  }
}

function drawSaw(ctx: CanvasRenderingContext2D, saw: Saw, elapsed: number) {
  const y = saw.baseY + Math.sin(elapsed * saw.speed + saw.phase) * saw.range;
  ctx.save();
  ctx.translate(saw.x, y);
  ctx.rotate(elapsed * 7 + saw.phase);

  for (let index = 0; index < 10; index += 1) {
    ctx.rotate((Math.PI * 2) / 10);
    ctx.beginPath();
    ctx.moveTo(saw.r - 3, 0);
    ctx.lineTo(saw.r + 10, 5);
    ctx.lineTo(saw.r + 1, 11);
    ctx.closePath();
    ctx.fillStyle = "#d8e4ff";
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(0, 0, saw.r - 4, 0, Math.PI * 2);
  ctx.fillStyle = "#33445d";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#f14f69";
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player) {
  const squashX = 1 + player.squash * 0.12;
  const squashY = 1 - player.squash * 0.1;
  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h);
  ctx.scale(squashX, squashY);
  ctx.translate(-player.w / 2, -player.h);

  ctx.fillStyle = "#f3f8ff";
  ctx.fillRect(0, 0, player.w, player.h);
  ctx.fillStyle = "#101625";
  ctx.fillRect(player.facing > 0 ? 18 : 5, 11, 7, 8);
  ctx.fillStyle = "#79e7d9";
  ctx.fillRect(4, 5, 5, 4);
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, game: GameState, viewWidth: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  gradient.addColorStop(0, "#111a30");
  gradient.addColorStop(0.55, "#171e31");
  gradient.addColorStop(1, "#0c101c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewWidth, VIEW_HEIGHT);

  ctx.fillStyle = "rgba(126, 229, 215, 0.09)";
  ctx.beginPath();
  ctx.arc(viewWidth * 0.76, 145, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111a30";
  ctx.beginPath();
  ctx.arc(viewWidth * 0.76 + 25, 130, 92, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(221, 240, 255, 0.45)";
  for (let index = 0; index < 40; index += 1) {
    const x = (index * 149 + 31 - game.cameraX * 0.08) % (viewWidth + 90);
    const y = 70 + ((index * 83) % 290);
    ctx.fillRect(x < 0 ? x + viewWidth + 90 : x, y, index % 3 === 0 ? 2 : 1, 1);
  }

  ctx.save();
  ctx.translate(-game.cameraX * 0.18, 0);
  for (let index = -1; index < 31; index += 1) {
    const x = index * 130;
    const height = 80 + ((index * 47 + 91) % 150);
    ctx.fillStyle = "#121a2b";
    ctx.fillRect(x, 550 - height, 92, height + 190);
    ctx.fillStyle = "rgba(118, 226, 211, 0.1)";
    for (let row = 0; row < 4; row += 1) {
      ctx.fillRect(x + 16, 550 - height + 20 + row * 28, 22, 3);
    }
  }
  ctx.restore();

  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  for (let y = 0; y < VIEW_HEIGHT; y += 4) ctx.fillRect(0, y, viewWidth, 1);
}

function drawWorld(ctx: CanvasRenderingContext2D, game: GameState) {
  const visibleLeft = game.cameraX - 60;
  const visibleRight = game.cameraX + game.viewportWidth + 60;

  ctx.fillStyle = "rgba(66, 105, 140, 0.16)";
  ctx.fillRect(0, 618, WORLD_WIDTH, 2);

  PLATFORMS.forEach((platform) => {
    if (platform.x < visibleRight && platform.x + platform.w > visibleLeft) drawPlatform(ctx, platform);
  });

  ctx.fillStyle = "rgba(241, 79, 105, 0.25)";
  ctx.fillRect(473, 677, 131, 5);
  ctx.fillRect(994, 677, 93, 5);
  ctx.fillRect(1362, 677, 109, 5);
  ctx.fillRect(1744, 677, 111, 5);
  ctx.fillRect(2164, 677, 100, 5);
  ctx.fillRect(2584, 677, 100, 5);

  STATIC_SPIKES.forEach((spike) => drawSpike(ctx, spike));
  POP_TRAPS.forEach((trap, index) => {
    const state = game.popStates[index];
    if (state.rise > 0) drawSpike(ctx, trap, state.rise, state.rise < 0.62);
    else {
      ctx.fillStyle = "rgba(241, 79, 105, 0.65)";
      ctx.fillRect(trap.x + 5, trap.y + trap.h - 3, trap.w - 10, 2);
    }
  });

  FALLING_TRAPS.forEach((trap, index) => {
    const state = game.fallingStates[index];
    ctx.fillStyle = "#f14f69";
    ctx.fillRect(trap.x, state.y, trap.w, trap.h);
    ctx.fillStyle = "#ffbac4";
    ctx.fillRect(trap.x + 4, state.y + 4, trap.w - 8, 3);
    if (!state.triggered) {
      ctx.strokeStyle = "rgba(180, 203, 232, 0.36)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(trap.x + trap.w / 2, 0);
      ctx.lineTo(trap.x + trap.w / 2, state.y);
      ctx.stroke();
    }
  });

  SAWS.forEach((saw) => drawSaw(ctx, saw, game.elapsed));

  ctx.fillStyle = "#85e5d7";
  ctx.fillRect(CHECKPOINT_X, 480, 3, 140);
  ctx.beginPath();
  ctx.moveTo(CHECKPOINT_X + 3, 485);
  ctx.lineTo(CHECKPOINT_X + 47, 498);
  ctx.lineTo(CHECKPOINT_X + 3, 513);
  ctx.closePath();
  ctx.fillStyle = game.checkpoint === 1 ? "#85e5d7" : "#3a5862";
  ctx.fill();

  ctx.fillStyle = "rgba(133, 229, 215, 0.14)";
  ctx.fillRect(GOAL.x - 8, GOAL.y - 8, GOAL.w + 16, GOAL.h + 8);
  ctx.strokeStyle = "#85e5d7";
  ctx.lineWidth = 4;
  ctx.strokeRect(GOAL.x, GOAL.y, GOAL.w, GOAL.h);
  ctx.fillStyle = "#f3f8ff";
  ctx.fillRect(GOAL.x + 11, GOAL.y + 13, GOAL.w - 22, 6);
  ctx.fillStyle = "#85e5d7";
  ctx.fillRect(GOAL.x + 11, GOAL.y + 29, GOAL.w - 22, 24);

  if (game.mode === "dead" && game.deathPoint) {
    const { x, y } = game.deathPoint;
    const radius = 18 + (36 - game.deathTimer) * 1.7;
    ctx.strokeStyle = `rgba(241, 79, 105, ${Math.max(0, game.deathTimer / 48)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (game.mode !== "dead") drawPlayer(ctx, game.player);
}

function drawOverlay(ctx: CanvasRenderingContext2D, game: GameState, viewWidth: number) {
  const progress = clamp((game.player.x / (GOAL.x + GOAL.w)) * 100, 0, 100);
  ctx.fillStyle = "rgba(4, 7, 13, 0.62)";
  ctx.fillRect(28, 28, 212, 35);
  ctx.fillStyle = "#9bacbf";
  ctx.font = "12px 'Courier New', monospace";
  ctx.fillText("ESCAPE ROUTE", 40, 49);
  ctx.fillStyle = "#2d4158";
  ctx.fillRect(40, 56, 180, 2);
  ctx.fillStyle = "#85e5d7";
  ctx.fillRect(40, 56, 180 * (progress / 100), 2);

  ctx.textAlign = "right";
  ctx.fillStyle = "#d6e4f7";
  ctx.fillText(`DEATHS ${String(game.deaths).padStart(2, "0")}`, viewWidth - 34, 48);
  ctx.textAlign = "left";

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(241, 79, 105, ${game.flash / 48})`;
    ctx.fillRect(0, 0, viewWidth, VIEW_HEIGHT);
  }

  if (game.mode === "ready" || game.mode === "won") {
    ctx.fillStyle = "rgba(6, 9, 16, 0.42)";
    ctx.fillRect(0, 0, viewWidth, VIEW_HEIGHT);
    ctx.textAlign = "center";
    ctx.fillStyle = game.mode === "won" ? "#85e5d7" : "#f3f8ff";
    ctx.font = "700 42px 'Courier New', monospace";
    ctx.fillText(game.mode === "won" ? "ROUTE BREACHED" : "TRAP ADVENTURE 2", viewWidth / 2, 292);
    ctx.fillStyle = "#f14f69";
    ctx.font = "700 16px 'Courier New', monospace";
    ctx.fillText(game.mode === "won" ? "YOU MADE THE FLOOR LOSE" : "THE FLOOR IS LYING TO YOU", viewWidth / 2, 324);
    ctx.fillStyle = "#b8c9df";
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(
      game.mode === "won" ? "PRESS REBOOT TO GO AGAIN" : "PRESS A / D OR TAP THE CONTROLS TO BEGIN",
      viewWidth / 2,
      360,
    );
    ctx.textAlign = "left";
  }
}

function renderGame(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const scale = cssHeight / VIEW_HEIGHT;
  const viewWidth = cssWidth / scale;
  game.viewportWidth = viewWidth;
  game.cameraX = clamp(game.cameraX, 0, Math.max(0, WORLD_WIDTH - viewWidth));

  ctx.save();
  ctx.scale(scale, scale);
  drawBackground(ctx, game, viewWidth);
  ctx.save();
  ctx.translate(-game.cameraX, 0);
  drawWorld(ctx, game);
  ctx.restore();
  drawOverlay(ctx, game, viewWidth);
  ctx.restore();
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(1).padStart(4, "0")}`;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameState>(createGame());
  const inputRef = useRef<InputState>({ left: false, right: false, jump: false, jumpJustPressed: false });
  const [hud, setHud] = useState<HudState>({ mode: "ready", deaths: 0, checkpoint: 0, elapsed: 0 });
  const [canvasFailed, setCanvasFailed] = useState(false);
  const hudRef = useRef<HudState>({ mode: "ready", deaths: 0, checkpoint: 0, elapsed: 0 });

  const syncHud = useCallback((game: GameState) => {
    const nextHud = {
      mode: game.mode,
      deaths: game.deaths,
      checkpoint: game.checkpoint,
      elapsed: game.elapsed,
    };
    hudRef.current = nextHud;
    setHud(nextHud);
  }, []);

  const startRun = useCallback(() => {
    const game = gameRef.current;
    if (game.mode === "won") resetGame(game);
    if (game.mode === "ready") game.mode = "playing";
    syncHud(game);
  }, [syncHud]);

  const rebootRun = useCallback(() => {
    resetGame(gameRef.current);
    gameRef.current.mode = "playing";
    inputRef.current = { left: false, right: false, jump: false, jumpJustPressed: false };
    syncHud(gameRef.current);
  }, [syncHud]);

  const setTouchControl = useCallback(
    (control: "left" | "right" | "jump", active: boolean) => {
      const input = inputRef.current;
      if (active) startRun();
      if (control === "jump" && active && !input.jump) input.jumpJustPressed = true;
      input[control] = active;
    },
    [startRun],
  );

  const handlePadPointer = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, control: "left" | "right" | "jump", active: boolean) => {
      event.preventDefault();
      if (active) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Some browsers throw for mouse/touch edge cases (e.g. the pointer
          // is already gone). The controls work fine without capture.
        }
      }
      setTouchControl(control, active);
    },
    [setTouchControl],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      // Canvas 2D unavailable (very old browser / disabled). Show a message
      // through React state instead of a silently blank canvas.
      setCanvasFailed(true);
      return;
    }

    let animationFrame = 0;
    let previousTime = performance.now();
    let accumulator = 0;
    let cssWidth = 1;
    let cssHeight = 1;
    let dpr = 1;

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      cssWidth = Math.max(1, bounds.width);
      cssHeight = Math.max(1, bounds.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      context.imageSmoothingEnabled = false;
    };

    // ResizeObserver exists in all modern browsers, but fall back to the
    // window resize event on older ones instead of throwing (white screen).
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resizeCanvas) : null;
    if (resizeObserver) resizeObserver.observe(canvas);
    else window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const clearInput = () => {
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jump = false;
      inputRef.current.jumpJustPressed = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const input = inputRef.current;
      const isLeft = event.code === "ArrowLeft" || event.code === "KeyA";
      const isRight = event.code === "ArrowRight" || event.code === "KeyD";
      const isJump = event.code === "ArrowUp" || event.code === "KeyW" || event.code === "Space";

      if (event.code === "KeyR") {
        event.preventDefault();
        rebootRun();
        return;
      }

      if (!isLeft && !isRight && !isJump) return;
      event.preventDefault();
      startRun();
      if (isLeft) input.left = true;
      if (isRight) input.right = true;
      if (isJump && !input.jump && !event.repeat) input.jumpJustPressed = true;
      if (isJump) input.jump = true;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const input = inputRef.current;
      if (event.code === "ArrowLeft" || event.code === "KeyA") input.left = false;
      if (event.code === "ArrowRight" || event.code === "KeyD") input.right = false;
      if (event.code === "ArrowUp" || event.code === "KeyW" || event.code === "Space") input.jump = false;
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearInput);

    const frame = (now: number) => {
      const delta = Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;
      accumulator += delta;

      // Fixed updates keep physics and input response consistent at 60 Hz.
      let updateCount = 0;
      while (accumulator >= FIXED_STEP && updateCount < 5) {
        updateGame(gameRef.current, inputRef.current);
        accumulator -= FIXED_STEP;
        updateCount += 1;
      }
      if (updateCount === 5) accumulator = 0;

      const game = gameRef.current;
      const currentHud = hudRef.current;
      if (game.mode === "playing" && game.elapsed - game.hudClock >= 0.1) {
        game.hudClock = game.elapsed;
        syncHud(game);
      } else if (
        game.mode !== currentHud.mode ||
        game.deaths !== currentHud.deaths ||
        game.checkpoint !== currentHud.checkpoint
      ) {
        syncHud(game);
      }

      renderGame(context, game, cssWidth, cssHeight, dpr);
      animationFrame = requestAnimationFrame(frame);
    };

    animationFrame = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationFrame);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearInput);
    };
  }, [rebootRun, startRun, syncHud]);

  const stageLabel =
    hud.mode === "won" ? "ROUTE BREACHED" : hud.checkpoint === 1 ? "CHECKPOINT // 02" : "SECTOR // 01";

  return (
    <main className="relative flex h-[100dvh] flex-col overflow-hidden bg-[#0b0e16] font-mono text-[#edf4ff]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(91,144,187,0.13),transparent_30%),radial-gradient(circle_at_85%_100%,rgba(52,189,169,0.08),transparent_28%)]" />

      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-[#243247] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="signal-dot h-2 w-2 rounded-full bg-[#85e5d7]" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-bold tracking-[0.25em] text-[#85e5d7]">TRAP ADVENTURE 2</p>
            <h1 className="text-sm font-bold tracking-[0.08em] text-[#eef6ff] sm:text-base">BROWSER PROTOTYPE</h1>
          </div>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div className="hidden sm:block">
            <p className="text-[10px] tracking-[0.14em] text-[#7e93ad]">SIMULATION</p>
            <p className="text-xs font-bold text-[#85e5d7]">60 HZ LOCK</p>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.14em] text-[#7e93ad]">TIME</p>
            <p className="text-xs font-bold tabular-nums">{formatTime(hud.elapsed)}</p>
          </div>
          <button
            type="button"
            onClick={rebootRun}
            className="border border-[#465976] px-3 py-2 text-[10px] font-bold tracking-[0.12em] text-[#dce9fa] transition hover:border-[#85e5d7] hover:bg-[#162235] hover:text-[#85e5d7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85e5d7]"
          >
            REBOOT <span className="hidden sm:inline">[R]</span>
          </button>
        </div>
      </header>

      <section className="relative z-10 min-h-0 flex-1 px-3 py-3 sm:px-5 sm:py-5" aria-label="Trap platform game">
        <div className="relative h-full min-h-[180px] overflow-hidden border border-[#31415a] bg-[#101728] shadow-[0_0_0_1px_rgba(133,229,215,0.05),0_24px_60px_rgba(0,0,0,0.36)] md:min-h-[300px]">
          <canvas
            ref={canvasRef}
            onPointerDown={startRun}
            className="block h-full w-full touch-none"
            aria-label="Trap Adventure 2 game canvas. Use A and D or arrow keys to move, Space to jump, and R to reboot."
            role="img"
          />
          {canvasFailed && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#101728] p-6 text-center">
              <p className="font-mono text-xs font-bold tracking-[0.2em] text-[#f14f69]">
                CANVAS 2D IS NOT AVAILABLE IN THIS BROWSER
              </p>
            </div>
          )}
          <div className="scan-sweep pointer-events-none absolute inset-x-0 top-0 h-px bg-[#85e5d7]/40" />
          <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-2 text-[10px] font-bold tracking-[0.13em] text-[#9db0c8] sm:bottom-4 sm:left-5">
            <span className="h-1.5 w-1.5 bg-[#f14f69]" aria-hidden="true" />
            {stageLabel}
          </div>
          <div className="pointer-events-none absolute bottom-3 right-4 text-[10px] font-bold tracking-[0.13em] text-[#dce9fa] sm:bottom-4 sm:right-5">
            DEATHS {String(hud.deaths).padStart(2, "0")}
          </div>
        </div>
      </section>

      <section className="relative z-10 shrink-0 px-3 pb-3 sm:px-5 sm:pb-5 md:hidden" aria-label="Touch controls">
        <div className="flex items-stretch justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Move left"
              onPointerDown={(event) => handlePadPointer(event, "left", true)}
              onPointerUp={(event) => handlePadPointer(event, "left", false)}
              onPointerCancel={(event) => handlePadPointer(event, "left", false)}
              onLostPointerCapture={() => setTouchControl("left", false)}
              className="trap-control flex h-16 w-16 items-center justify-center border border-[#46617a] bg-[#142035] text-2xl text-[#eef6ff] active:border-[#85e5d7] active:bg-[#1b3044]"
            >
              <span aria-hidden="true">&lt;</span>
            </button>
            <button
              type="button"
              aria-label="Move right"
              onPointerDown={(event) => handlePadPointer(event, "right", true)}
              onPointerUp={(event) => handlePadPointer(event, "right", false)}
              onPointerCancel={(event) => handlePadPointer(event, "right", false)}
              onLostPointerCapture={() => setTouchControl("right", false)}
              className="trap-control flex h-16 w-16 items-center justify-center border border-[#46617a] bg-[#142035] text-2xl text-[#eef6ff] active:border-[#85e5d7] active:bg-[#1b3044]"
            >
              <span aria-hidden="true">&gt;</span>
            </button>
          </div>
          <button
            type="button"
            aria-label="Jump"
            onPointerDown={(event) => handlePadPointer(event, "jump", true)}
            onPointerUp={(event) => handlePadPointer(event, "jump", false)}
            onPointerCancel={(event) => handlePadPointer(event, "jump", false)}
            onLostPointerCapture={() => setTouchControl("jump", false)}
            className="trap-control flex h-16 min-w-32 items-center justify-center border border-[#f14f69] bg-[#402031] px-5 text-xs font-bold tracking-[0.2em] text-[#fff1f4] active:bg-[#62283b]"
          >
            JUMP
          </button>
        </div>
      </section>

      <footer className="relative z-10 hidden shrink-0 border-t border-[#243247] px-6 py-3 text-[10px] font-bold tracking-[0.13em] text-[#8499b1] md:flex md:items-center md:justify-between">
        <p>A / D OR ARROWS TO MOVE. SPACE / W / UP TO JUMP. R TO REBOOT.</p>
        <p className="text-[#85e5d7]">JUMP BUFFER + COYOTE TIME ENABLED</p>
      </footer>
    </main>
  );
}