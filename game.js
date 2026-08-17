"use strict";

const GRID_SIZE = 28;
const START_INTERVAL = 142;
const MIN_INTERVAL = 68;
const LEVEL_EVERY = 5;
const OBSTACLE_COUNT = 9;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const levelValue = document.getElementById("levelValue");
const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const statusText = document.getElementById("statusText");
const overlay = document.getElementById("gameOverlay");
const overlayKicker = document.getElementById("overlayKicker");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");

const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let boardPixels = 840;
let cellSize = 30;
let mode = "ready";
let snake = [];
let direction = directions.right;
let nextDirection = directions.right;
let food = { x: 18, y: 12 };
let obstacles = [];
let score = 0;
let level = 1;
let eaten = 0;
let best = Number(localStorage.getItem("frostSnakeBest") || 0);
let accumulator = 0;
let lastFrame = 0;
let pulse = 0;
let touchStart = null;

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function cellKey(cell) {
  return `${cell.x}:${cell.y}`;
}

function padScore(value) {
  return String(value).padStart(3, "0");
}

function randomCell() {
  return {
    x: Math.floor(Math.random() * GRID_SIZE),
    y: Math.floor(Math.random() * GRID_SIZE),
  };
}

function isOccupied(cell, includeSnake = true) {
  if (includeSnake && snake.some((part) => sameCell(part, cell))) {
    return true;
  }

  return obstacles.some((block) => sameCell(block, cell));
}

function isNearStart(cell) {
  return cell.x >= 9 && cell.x <= 16 && cell.y >= 11 && cell.y <= 16;
}

function buildObstacles() {
  obstacles = [];
  const used = new Set(snake.map(cellKey));

  while (obstacles.length < OBSTACLE_COUNT) {
    const cell = randomCell();
    const key = cellKey(cell);

    if (used.has(key) || isNearStart(cell)) {
      continue;
    }

    used.add(key);
    obstacles.push(cell);
  }
}

function placeFood() {
  let attempts = 0;

  do {
    food = randomCell();
    attempts += 1;
  } while (isOccupied(food) && attempts < 500);
}

function resetGame() {
  snake = [
    { x: 13, y: 14 },
    { x: 12, y: 14 },
    { x: 11, y: 14 },
  ];
  direction = directions.right;
  nextDirection = directions.right;
  score = 0;
  level = 1;
  eaten = 0;
  accumulator = 0;
  buildObstacles();
  placeFood();
  mode = "ready";
  updateHud();
  showOverlay("Ready", "Guide the frost snake.", "Eat the glowing frost orbs, avoid the wall, blue ice blocks, and your own trail.", "Start game");
}

function showOverlay(kicker, title, text, buttonText) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  overlay.classList.remove("is-hidden");
}

function hideOverlay() {
  overlay.classList.add("is-hidden");
}

function updateHud() {
  levelValue.textContent = String(level);
  scoreValue.textContent = padScore(score);
  bestValue.textContent = padScore(best);

  if (mode === "running") {
    statusText.textContent = "Hunting";
    pauseButton.textContent = "Pause";
  } else if (mode === "paused") {
    statusText.textContent = "Paused";
    pauseButton.textContent = "Resume";
  } else if (mode === "gameover") {
    statusText.textContent = "Frozen";
    pauseButton.textContent = "Pause";
  } else {
    statusText.textContent = "Ready";
    pauseButton.textContent = "Pause";
  }
}

function startGame() {
  if (mode === "gameover") {
    resetGame();
  }

  mode = "running";
  hideOverlay();
  updateHud();
}

function pauseGame() {
  if (mode === "ready") {
    startGame();
    return;
  }

  if (mode === "gameover") {
    return;
  }

  if (mode === "paused") {
    mode = "running";
    hideOverlay();
  } else {
    mode = "paused";
    showOverlay("Paused", "The board is holding still.", "Resume when you are ready.", "Resume");
  }

  updateHud();
}

function hardRestart() {
  resetGame();
  startGame();
}

function setDirection(name) {
  const candidate = directions[name];

  if (!candidate || mode === "gameover") {
    return;
  }

  const reversing = candidate.x + direction.x === 0 && candidate.y + direction.y === 0;

  if (!reversing) {
    nextDirection = candidate;
  }

  if (mode === "ready") {
    startGame();
  }
}

function currentInterval() {
  return Math.max(MIN_INTERVAL, START_INTERVAL - (level - 1) * 12);
}

function stepGame() {
  if (mode !== "running") {
    return;
  }

  direction = nextDirection;

  const head = snake[0];
  const nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  const hitWall = nextHead.x < 0 || nextHead.x >= GRID_SIZE || nextHead.y < 0 || nextHead.y >= GRID_SIZE;
  const hitSelf = snake.some((part) => sameCell(part, nextHead));
  const hitObstacle = obstacles.some((block) => sameCell(block, nextHead));

  if (hitWall || hitSelf || hitObstacle) {
    endGame();
    return;
  }

  snake.unshift(nextHead);

  if (sameCell(nextHead, food)) {
    eaten += 1;
    score += 10 + (level - 1) * 3;

    if (eaten % LEVEL_EVERY === 0) {
      level += 1;
    }

    if (score > best) {
      best = score;
      localStorage.setItem("frostSnakeBest", String(best));
    }

    placeFood();
  } else {
    snake.pop();
  }

  updateHud();
}

function endGame() {
  mode = "gameover";
  showOverlay("Frozen", "The frost trail cracked.", `Final score: ${padScore(score)}. Try again with a cleaner path.`, "Play again");
  updateHud();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const size = Math.max(280, Math.floor(Math.min(rect.width, rect.height)));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(size * dpr);
  canvas.height = Math.floor(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  boardPixels = size;
  cellSize = boardPixels / GRID_SIZE;
}

function roundedRect(x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function drawBackground() {
  const gradient = ctx.createRadialGradient(boardPixels * 0.58, boardPixels * 0.35, boardPixels * 0.08, boardPixels / 2, boardPixels / 2, boardPixels * 0.72);
  gradient.addColorStop(0, "#08244b");
  gradient.addColorStop(0.46, "#041329");
  gradient.addColorStop(1, "#020712");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, boardPixels, boardPixels);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#1bcaff";
  ctx.lineWidth = 1;

  for (let i = 0; i <= GRID_SIZE; i += 1) {
    const line = i * cellSize;
    ctx.globalAlpha = i % 4 === 0 ? 0.22 : 0.1;
    ctx.beginPath();
    ctx.moveTo(line, 0);
    ctx.lineTo(line, boardPixels);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, line);
    ctx.lineTo(boardPixels, line);
    ctx.stroke();
  }

  ctx.restore();
}

function drawObstacle(block) {
  const inset = cellSize * 0.22;
  const x = block.x * cellSize + inset;
  const y = block.y * cellSize + inset;
  const size = cellSize - inset * 2;

  ctx.save();
  ctx.shadowBlur = 16;
  ctx.shadowColor = "rgba(0, 153, 255, 0.7)";
  ctx.fillStyle = "rgba(0, 116, 255, 0.76)";
  roundedRect(x, y, size, size, 3);
  ctx.fill();
  ctx.restore();
}

function drawFood(now) {
  const cx = (food.x + 0.5) * cellSize;
  const cy = (food.y + 0.5) * cellSize;
  const glow = 0.5 + Math.sin(now / 220) * 0.14;

  ctx.save();
  ctx.shadowBlur = 28;
  ctx.shadowColor = "rgba(221, 252, 255, 0.95)";
  ctx.fillStyle = `rgba(232, 253, 255, ${0.85 + glow * 0.12})`;
  ctx.beginPath();
  ctx.arc(cx, cy, cellSize * (0.28 + glow * 0.04), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHeadMarker(x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const arrow = size * 0.34;

  ctx.save();
  ctx.fillStyle = "#f7fdff";
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
  ctx.beginPath();

  if (direction === directions.up) {
    ctx.moveTo(cx, cy - arrow);
    ctx.lineTo(cx - arrow * 0.72, cy + arrow * 0.55);
    ctx.lineTo(cx + arrow * 0.72, cy + arrow * 0.55);
  } else if (direction === directions.down) {
    ctx.moveTo(cx, cy + arrow);
    ctx.lineTo(cx - arrow * 0.72, cy - arrow * 0.55);
    ctx.lineTo(cx + arrow * 0.72, cy - arrow * 0.55);
  } else if (direction === directions.left) {
    ctx.moveTo(cx - arrow, cy);
    ctx.lineTo(cx + arrow * 0.55, cy - arrow * 0.72);
    ctx.lineTo(cx + arrow * 0.55, cy + arrow * 0.72);
  } else {
    ctx.moveTo(cx + arrow, cy);
    ctx.lineTo(cx - arrow * 0.55, cy - arrow * 0.72);
    ctx.lineTo(cx - arrow * 0.55, cy + arrow * 0.72);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSnake() {
  snake.forEach((part, index) => {
    const inset = index === 0 ? cellSize * 0.12 : cellSize * 0.16;
    const x = part.x * cellSize + inset;
    const y = part.y * cellSize + inset;
    const size = cellSize - inset * 2;

    ctx.save();
    ctx.shadowBlur = index === 0 ? 24 : 14;
    ctx.shadowColor = "rgba(0, 153, 255, 0.86)";
    ctx.fillStyle = index === 0 ? "#25cfff" : "#0099ff";
    roundedRect(x, y, size, size, 4);
    ctx.fill();

    if (index === 0) {
      drawHeadMarker(x, y, size);
    }

    ctx.restore();
  });
}

function drawVignette() {
  ctx.save();
  const edge = ctx.createRadialGradient(boardPixels / 2, boardPixels / 2, boardPixels * 0.32, boardPixels / 2, boardPixels / 2, boardPixels * 0.72);
  edge.addColorStop(0, "rgba(0, 0, 0, 0)");
  edge.addColorStop(1, "rgba(0, 0, 0, 0.44)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, boardPixels, boardPixels);
  ctx.restore();
}

function draw(now) {
  pulse = now;
  ctx.clearRect(0, 0, boardPixels, boardPixels);
  drawBackground();
  obstacles.forEach(drawObstacle);
  drawFood(pulse);
  drawSnake();
  drawVignette();
}

function loop(now) {
  if (!lastFrame) {
    lastFrame = now;
  }

  const delta = Math.min(now - lastFrame, 90);
  lastFrame = now;
  accumulator += delta;

  while (accumulator >= currentInterval()) {
    stepGame();
    accumulator -= currentInterval();
  }

  draw(now);
  requestAnimationFrame(loop);
}

function handleKey(event) {
  const keyMap = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };

  if (keyMap[event.key]) {
    event.preventDefault();
    setDirection(keyMap[event.key]);
  } else if (event.key === " ") {
    event.preventDefault();
    pauseGame();
  }
}

function handleTouchStart(event) {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}

function handleTouchEnd(event) {
  if (!touchStart) {
    return;
  }

  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const threshold = 24;

  if (Math.max(absX, absY) >= threshold) {
    if (absX > absY) {
      setDirection(dx > 0 ? "right" : "left");
    } else {
      setDirection(dy > 0 ? "down" : "up");
    }
  }

  touchStart = null;
}

document.addEventListener("keydown", handleKey);
window.addEventListener("resize", () => {
  resizeCanvas();
  draw(performance.now());
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode === "running") {
    pauseGame();
  }
});

canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
canvas.addEventListener("touchend", handleTouchEnd, { passive: true });

document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => setDirection(button.dataset.dir));
});

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
restartButton.addEventListener("click", hardRestart);

resizeCanvas();
resetGame();
requestAnimationFrame(loop);
