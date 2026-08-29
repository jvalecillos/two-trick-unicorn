const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const DEBUG = true;
const width = canvas.width;
const height = canvas.height;
const ribbonColors = ["#f45", "#ed4", "#57e"];
const cloud = 0;
const star = 1;
const rift = 2;
const bridge = 3;
const speeds = [220, 280, 340];
const formations = [
  "r..",
  ".r.",
  "c..",
  ".c.",
  "r../..s",
  "c../..s",
  "r.c/s.s",
  "rr./ss.",
  "cc./ss.",
  "rrr",
  "ccc",
  "r../..s/..c/s..",
];
let state = 0;
let lane = 1;
let playerX = 480;
let lastTime = 0;
let distance = 0;
let bonus = 0;
let formationDelay = 0;
let formationRows = [];
let formationCount = 0;
let mirrorFormation = false;
let leapTime = 0;
let blastTime = 0;
let speedTier = 0;
let formationTest = -1;
let entities = [];

function score() {
  return (distance / 10 + bonus) | 0;
}

function lanePosition(targetLane, y) {
  const progress = (y - 100) / 440;
  const roadWidth = 160 + progress * 600;
  return 480 - roadWidth / 2 + ((targetLane + 0.5) * roadWidth) / 3;
}

function jumpLift() {
  return leapTime > 0.25
    ? Math.sin(((leapTime - 0.25) / 0.45) * Math.PI) * 60
    : 0;
}

function blastPosition(y) {
  const start = 382 - jumpLift();
  const currentLane =
    (playerX - lanePosition(0, 440)) /
    (lanePosition(1, 440) - lanePosition(0, 440));
  return playerX + ((lanePosition(currentLane, 260) - playerX) * (start - y)) / (start - 260);
}

function drawRoad() {
  context.fillStyle = "#20152f";
  context.fillRect(0, 0, width, height);

  for (let index = 0; index < 3; index++) {
    const topLeft = 400 + (index * 160) / 3;
    const topRight = 400 + ((index + 1) * 160) / 3;
    const bottomLeft = 100 + (index * 760) / 3;
    const bottomRight = 100 + ((index + 1) * 760) / 3;

    context.fillStyle = ribbonColors[index];
    context.beginPath();
    context.moveTo(topLeft, 100);
    context.lineTo(topRight, 100);
    context.lineTo(bottomRight, height);
    context.lineTo(bottomLeft, height);
    context.fill();
  }

  context.fillStyle = "#fff2";
  for (let index = 0; index < 5; index++) {
    const y = 100 + ((index * 88 + distance) % 440);
    const progress = (y - 100) / 440;
    context.fillRect(400 - progress * 300, y, 160 + progress * 600, 2 + progress * 7);
  }

  context.strokeStyle = "#fff8";
  context.lineWidth = 3;
  for (let index = 1; index < 3; index++) {
    context.beginPath();
    context.moveTo(400 + (index * 160) / 3, 100);
    context.lineTo(100 + (index * 760) / 3, height);
    context.stroke();
  }
}

function drawPlayer() {
  const lift = jumpLift();

  context.fillStyle = "#24163288";
  context.beginPath();
  context.ellipse(playerX, 468, 39 - lift / 3, 11 - lift / 12, 0, 0, 7);
  context.fill();

  context.fillStyle = "#fff5fd";
  context.fillRect(playerX - 25, 412 - lift, 50, 52);
  context.fillStyle = "#ff77cc";
  context.fillRect(playerX - 25, 412 - lift, 12, 52);
  context.fillStyle = "#ffd84d";
  context.beginPath();
  context.moveTo(playerX, 412 - lift);
  context.lineTo(playerX + 9, 382 - lift);
  context.lineTo(playerX + 15, 416 - lift);
  context.fill();
}

function drawBlast() {
  if (blastTime > 0.48) {
    const lift = jumpLift();
    context.strokeStyle = "#fff";
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(playerX + 9, 382 - lift);
    context.lineTo(blastPosition(260), 260);
    context.stroke();
    context.strokeStyle = "#7ff";
    context.lineWidth = 3;
    context.stroke();
  }
}

function placeEntity(entity) {
  const progress = (entity.y - 100) / 440;
  entity.x = lanePosition(entity.lane, entity.y);
  entity.size = 10 + progress * 28;
}

function spawnRow(row) {
  for (let targetLane = 0; targetLane < 3; targetLane++) {
    const symbol = row[mirrorFormation ? 2 - targetLane : targetLane];
    const type = "csr".indexOf(symbol);
    if (type >= 0 && (type !== star || Math.random() > 0.2)) {
      entities.push({ lane: targetLane, type, y: 100 });
    }
  }
}

function scheduleFormation() {
  if (!formationRows.length) {
    if (DEBUG && formationTest === 24) formationTest = -1;
    const testing = DEBUG && formationTest >= 0;
    const formation =
      testing
        ? formations[formationTest >> 1]
        : formationCount < 4
        ? formations[formationCount]
        : formations[4 + ((Math.random() * 8) | 0)];
    formationRows = formation.split("/");
    mirrorFormation = testing ? formationTest++ % 2 : Math.random() > 0.5;
    formationCount++;
  }
  spawnRow(formationRows.shift());
  formationDelay = formationRows.length
    ? 0.55 - speedTier * 0.06
    : 0.95 - speedTier * 0.1;
}

function drawEntities() {
  for (const entity of entities) {
    if (entity.type === star) {
      context.fillStyle = "#fff6a8";
      context.beginPath();
      context.moveTo(entity.x, entity.y - entity.size);
      context.lineTo(entity.x + entity.size * 0.65, entity.y);
      context.lineTo(entity.x, entity.y + entity.size);
      context.lineTo(entity.x - entity.size * 0.65, entity.y);
      context.fill();
    } else if (entity.type === cloud) {
      context.fillStyle = "#24163266";
      context.beginPath();
      context.ellipse(
        entity.x,
        entity.y + entity.size * 1.2,
        entity.size * 1.5,
        entity.size * 0.3,
        0,
        0,
        7,
      );
      context.fill();
      context.fillStyle = "#292033";
      context.beginPath();
      context.arc(entity.x, entity.y, entity.size, 0, 7);
      context.arc(
        entity.x + entity.size,
        entity.y + entity.size * 0.15,
        entity.size * 0.75,
        0,
        7,
      );
      context.arc(
        entity.x - entity.size,
        entity.y + entity.size * 0.15,
        entity.size * 0.75,
        0,
        7,
      );
      context.fill();
    } else if (entity.type === rift) {
      context.fillStyle = "#160f20";
      context.beginPath();
      context.moveTo(entity.x - entity.size * 1.5, entity.y);
      context.lineTo(entity.x - entity.size * 0.5, entity.y - entity.size * 0.5);
      context.lineTo(entity.x, entity.y + entity.size * 0.2);
      context.lineTo(entity.x + entity.size * 0.6, entity.y - entity.size * 0.4);
      context.lineTo(entity.x + entity.size * 1.5, entity.y);
      context.lineTo(entity.x, entity.y + entity.size * 0.7);
      context.fill();
    } else {
      for (let index = 0; index < 3; index++) {
        context.fillStyle = ribbonColors[index];
        context.fillRect(
          entity.x - entity.size * 1.5,
          entity.y + entity.size * (index / 6 - 0.25),
          entity.size * 3,
          entity.size / 6,
        );
      }
    }
  }
}

function drawMessage(title, subtitle) {
  context.fillStyle = "#120d20cc";
  context.fillRect(190, 170, 580, 190);
  context.fillStyle = "white";
  context.textAlign = "center";
  context.font = "bold 52px sans-serif";
  context.fillText(title, width / 2, 240);
  context.font = "22px sans-serif";
  context.fillText(subtitle, width / 2, 305);
}

function draw() {
  drawRoad();
  drawEntities();
  drawBlast();
  drawPlayer();
  if (state === 1) {
    context.fillStyle = "white";
    context.textAlign = "left";
    context.font = "bold 24px sans-serif";
    context.fillText(`SCORE ${score()}`, 24, 38);
    if (DEBUG) {
      context.textAlign = "right";
      context.fillText(
        formationTest >= 0
          ? `BLOOM ${formationTest}/24`
          : `TEST ${["DAWN", "STORM", "BLOOM"][speedTier]} · V`,
        936,
        38,
      );
    }
    if (formationCount < 5) {
      context.textAlign = "center";
      context.fillText(
        formationCount < 3 ? "SPACE · LEAP RIFTS" : "X · BLAST CLOUDS",
        width / 2,
        70,
      );
    }
  }
  if (state === 0) {
    drawMessage("TWO-TRICK UNICORN", "ENTER/CLICK · ← → MOVE · SPACE LEAP · X BLAST");
  } else if (state === 2) {
    drawMessage("THE GLOOM WON", `SCORE ${score()} · ENTER OR CLICK TO TRY AGAIN`);
  }
}

function start() {
  if (state !== 1) {
    state = 1;
    lane = 1;
    playerX = 480;
    distance = 0;
    bonus = 0;
    formationDelay = 0.8;
    formationRows = [];
    formationCount = 0;
    leapTime = 0;
    blastTime = 0;
    speedTier = 0;
    if (DEBUG) formationTest = -1;
    entities = [];
    draw();
  }
}

addEventListener("keydown", (event) => {
  if (event.key === "Enter") start();
  if (state === 1 && ["ArrowLeft", "a", "A"].includes(event.key)) {
    lane = Math.max(0, lane - 1);
    event.preventDefault();
  }
  if (state === 1 && ["ArrowRight", "d", "D"].includes(event.key)) {
    lane = Math.min(2, lane + 1);
    event.preventDefault();
  }
  if (state === 1 && event.code === "Space") {
    if (leapTime <= 0 && !event.repeat) leapTime = 0.7;
    event.preventDefault();
  }
  if (state === 1 && event.key.toLowerCase() === "x") {
    if (blastTime <= 0 && !event.repeat) blastTime = 0.6;
    event.preventDefault();
  }
  if (DEBUG && state === 1 && event.key.toLowerCase() === "v" && !event.repeat) {
    speedTier = (speedTier + 1) % 3;
  }
  if (DEBUG && state === 1 && event.key.toLowerCase() === "b" && !event.repeat) {
    speedTier = 2;
    formationTest = 0;
    formationCount = 5;
    formationRows = [];
    formationDelay = 0.5;
    leapTime = blastTime = 0;
    lane = 1;
    playerX = 480;
    entities = [];
  }
});
canvas.addEventListener("pointerdown", start);
document.addEventListener("visibilitychange", () => {
  lastTime = performance.now();
});

function update(time) {
  const delta = Math.min((time - lastTime) / 1000 || 0, 0.05);
  lastTime = time;

  if (state === 1) {
    const speed = speeds[speedTier];
    distance += delta * speed;
    leapTime = Math.max(0, leapTime - delta);
    blastTime = Math.max(0, blastTime - delta);
    playerX += (lanePosition(lane, 440) - playerX) * Math.min(1, delta * 12);
    formationDelay -= delta;

    if (formationDelay <= 0) scheduleFormation();

    entities = entities.filter((entity) => {
      entity.y += delta * speed;
      placeEntity(entity);
      if (
        entity.type === cloud &&
        blastTime > 0.48 &&
        entity.y > 260 &&
        entity.y < 390 - jumpLift() &&
        Math.abs(entity.x - blastPosition(entity.y)) < entity.size + 15
      ) {
        entity.type = star;
        bonus += 50;
      }
      if (
        Math.abs(entity.x - playerX) < entity.size + 25 &&
        entity.y > 405 &&
        entity.y < 465
      ) {
        if (entity.type === star) bonus += 100;
        else if (entity.type === rift && leapTime > 0.25) {
          entity.type = bridge;
          bonus += 50;
          return true;
        } else if (entity.type !== bridge) state = 2;
        return entity.type === bridge;
      }
      return entity.y < 580;
    });
  }

  draw();
  requestAnimationFrame(update);
}

requestAnimationFrame(update);
