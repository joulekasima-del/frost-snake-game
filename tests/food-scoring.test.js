"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function createElement(id) {
  return {
    id,
    textContent: "",
    dataset: {},
    classList: {
      add() {},
      remove() {},
    },
    addEventListener() {},
    getBoundingClientRect() {
      return { width: 840, height: 840 };
    },
  };
}

function createCanvasContext() {
  const methods = new Set([
    "arc",
    "beginPath",
    "clearRect",
    "closePath",
    "fill",
    "fillRect",
    "lineTo",
    "moveTo",
    "quadraticCurveTo",
    "restore",
    "save",
    "setTransform",
    "stroke",
  ]);

  return new Proxy({}, {
    get(target, prop) {
      if (prop === "createRadialGradient") {
        return () => ({ addColorStop() {} });
      }

      if (methods.has(prop)) {
        return () => {};
      }

      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}

function loadGame() {
  const code = fs.readFileSync("game.js", "utf8");
  const elements = new Map();
  const context = {
    console,
    localStorage: {
      getItem() {
        return "0";
      },
      setItem() {},
    },
    performance: {
      now() {
        return 0;
      },
    },
    requestAnimationFrame() {},
    window: {
      devicePixelRatio: 1,
      addEventListener() {},
    },
  };

  function getElement(id) {
    if (!elements.has(id)) {
      elements.set(id, createElement(id));
    }

    return elements.get(id);
  }

  const canvas = getElement("gameCanvas");
  canvas.getContext = () => createCanvasContext();

  context.document = {
    hidden: false,
    addEventListener() {},
    getElementById(id) {
      return id === "gameCanvas" ? canvas : getElement(id);
    },
    querySelectorAll() {
      return [];
    },
  };

  context.Math = Object.create(Math);
  context.randomValues = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
    [6, 0],
    [7, 0],
    [8, 0],
    [2, 2],
    [20, 20],
  ].flatMap(([x, y]) => [(x + 0.01) / 28, (y + 0.01) / 28]);
  context.Math.random = () => context.randomValues.shift() ?? 0;

  vm.createContext(context);
  vm.runInContext(code, context);

  return context;
}

function readState(context) {
  return vm.runInContext(`({
    mode,
    score,
    scoreText: scoreValue.textContent,
    bestText: bestValue.textContent,
    snake: snake.map((part) => ({ ...part })),
    food: { ...food },
    obstacles: obstacles.map((block) => ({ ...block })),
  })`, context);
}

const context = loadGame();

vm.runInContext(`
  snake = [
    { x: 13, y: 14 },
    { x: 12, y: 14 },
    { x: 11, y: 14 },
  ];
  direction = directions.right;
  nextDirection = directions.right;
  obstacles = [{ x: 1, y: 1 }];
  food = { x: 14, y: 14 };
  score = 0;
  level = 1;
  eaten = 0;
  best = 0;
  mode = "ready";
  updateHud();
`, context);

const before = readState(context);

vm.runInContext(`
  startGame();
  stepGame();
`, context);

const after = readState(context);

assert.strictEqual(before.score, 0);
assert.strictEqual(before.snake.length, 3);
assert.strictEqual(after.mode, "running");
assert.strictEqual(after.score, 10);
assert.strictEqual(after.scoreText, "010");
assert.strictEqual(after.bestText, "010");
assert.strictEqual(after.snake.length, 4);
assert.notDeepStrictEqual(after.food, before.food);
assert.strictEqual(after.food.x, 20);
assert.strictEqual(after.food.y, 20);
assert.strictEqual(after.snake.some((part) => part.x === after.food.x && part.y === after.food.y), false);
assert.strictEqual(after.obstacles.some((block) => block.x === after.food.x && block.y === after.food.y), false);

console.log("food scoring regression passed");
