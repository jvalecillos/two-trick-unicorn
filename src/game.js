const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
// The release build flips this constant so Terser removes test controls and UI.
const DEBUG = true;
const width = canvas.width;
const height = canvas.height;
const ribbonColors = ["#f45", "#ed4", "#57e"];
const cloud = 0;
const star = 1;
const rift = 2;
const bridge = 3;
const speeds = [220, 280, 340];
// Formation rows use c=cloud, s=star, r=rift, .=empty; / advances one row.
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
let runTime = 0;
let actFlash = 0;
let restored = false;
let formationTest = -1;
let testSpeed = -1;
let worldColor = 70;
let protection = 0;
let combo = 0;
let burstTime = 0;
let learned = 0;
let entities = [];
let best = 0;

try {
  best = +localStorage.TTU26 || 0;
} catch {}

function score() {
  return (distance / 10 + bonus) | 0;
}

function saveBest() {
  if (score() > best) {
    best = score();
    try {
      localStorage.TTU26 = best;
    } catch {}
  }
}

function reward(points, colorGain) {
  bonus += points * (burstTime ? 2 : 1);
  worldColor = Math.min(100, worldColor + colorGain);
  if (++combo === 8) burstTime = 4;
}

function lanePosition(targetLane, y) {
  const progress = (y - 100) / 440;
  const roadWidth = 160 + progress * 600;
  return 480 - roadWidth / 2 + ((targetLane + 0.5) * roadWidth) / 3;
}

function jumpLift() {
  // The 0.7 s timer reserves its final 0.25 s for grounded recovery.
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
  context.globalAlpha = protection && ((protection * 12) | 0) % 2 ? 0.3 : 1;

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
  context.globalAlpha = 1;
}

function drawBurst() {
  if (burstTime) {
    context.globalAlpha = 0.7;
    for (let index = 0; index < 3; index++) {
      context.fillStyle = ribbonColors[index];
      context.fillRect(playerX - 30 + index * 20, 450, 20, 90);
    }
    for (let index = 0; index < 7; index++) {
      context.fillStyle = ribbonColors[index % 3];
      context.beginPath();
      context.arc(
        playerX + Math.sin(distance / 30 + index) * 65,
        425 - jumpLift() + Math.cos(distance / 30 + index) * 55,
        5,
        0,
        7,
      );
      context.fill();
    }
    if (burstTime > 3.8) {
      context.fillStyle = "#fff8";
      context.fillRect(0, 0, width, height);
    }
    context.globalAlpha = 1;
  }
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
    // Later acts drop the simplest formations while retaining proven patterns.
    const formationStart = speedTier === 2 ? 6 : 4;
    const formation =
      testing
        ? formations[formationTest >> 1]
        : formationCount < 4
        ? formations[formationCount]
        : formations[
            formationStart +
              ((Math.random() * (speedTier ? 12 - formationStart : 3)) | 0)
          ];
    formationRows = formation.split("/");
    mirrorFormation = testing ? formationTest++ % 2 : Math.random() > 0.5;
    formationCount++;
  }
  spawnRow(formationRows.shift());
  const endlessGap = Math.max(0, runTime - 180);
  formationDelay = formationRows.length
    ? 0.55 - speedTier * 0.06 - Math.min(0.08, endlessGap / 1500)
    : 0.95 - speedTier * 0.1 - Math.min(0.05, endlessGap / 2400);
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
  context.filter = `saturate(${worldColor}%)`;
  drawRoad();
  drawEntities();
  drawBlast();
  drawBurst();
  drawPlayer();
  context.filter = "none";
  if (state === 1 || state > 2) {
    context.fillStyle = "white";
    context.textAlign = "left";
    context.font = "bold 24px sans-serif";
    context.fillText(`SCORE ${score()}`, 24, 38);
    context.font = "bold 16px sans-serif";
    context.fillText("COLOR", 24, 65);
    context.fillStyle = "#33283d";
    context.fillRect(85, 52, 150, 16);
    context.fillStyle = ribbonColors[0];
    context.fillRect(85, 52, worldColor * 1.5, 16);
    context.fillStyle = "white";
    context.fillText(burstTime ? "SPECTRAL BURST" : `COMBO ${combo}/8`, 24, 92);
    context.textAlign = "right";
    context.font = "bold 24px sans-serif";
    context.fillText(runTime >= 180 ? "ENDLESS" : ["DAWN", "STORM", "BLOOM"][speedTier], 936, 38);
    if (DEBUG) {
      context.font = "bold 16px sans-serif";
      context.fillText(
        formationTest >= 0
          ? `BLOOM ${formationTest}/24`
          : `TEST ${testSpeed < 0 ? "AUTO" : ["DAWN", "STORM", "BLOOM"][testSpeed]} · ${
              (speeds[speedTier] + Math.min(60, Math.max(0, runTime - 180) / 2)) | 0
            } PX/S · V/T`,
        936,
        65,
      );
    }
    const lesson =
      !(learned & 1) && entities.some((entity) => entity.type === rift)
        ? "PRESS SPACE TO LEAP RIFTS"
        : !(learned & 2) && entities.some((entity) => entity.type === cloud)
          ? "PRESS X TO BLAST CLOUDS"
          : "";
    if (lesson) {
      context.textAlign = "center";
      context.fillText(lesson, width / 2, 70);
    }
    if (actFlash) {
      context.textAlign = "center";
      context.font = "bold 42px sans-serif";
      context.fillText(["DAWN", "STORM", "BLOOM"][speedTier], width / 2, 150);
    }
  }
  if (state === 0) {
    drawMessage("TWO-TRICK UNICORN", "ENTER/CLICK · ← → MOVE · SPACE LEAP · X BLAST");
    context.fillText(`BEST ${best}`, width / 2, 340);
  } else if (state === 2) {
    drawMessage("THE GLOOM WON", `SCORE ${score()} · BEST ${best} · ENTER/CLICK TO TRY AGAIN`);
  } else if (state === 3) {
    drawMessage("RAINBOW RESTORED!", `SCORE ${score()} · ENTER OR CLICK FOR ENDLESS`);
  } else if (state === 4) {
    drawMessage("PAUSED", "ESC/ENTER/CLICK RESUME · Q TITLE");
  }
}

function start() {
  if (state === 3 || state === 4) {
    state = 1;
    lastTime = performance.now();
    return;
  }
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
    runTime = 0;
    actFlash = 2;
    restored = false;
    if (DEBUG) formationTest = testSpeed = -1;
    worldColor = 70;
    protection = 0;
    combo = burstTime = 0;
    entities = [];
    draw();
  }
}

addEventListener("keydown", (event) => {
  if (event.key === "Enter") start();
  if (event.key === "Escape" && state) {
    state = state === 1 ? 4 : state === 4 ? 1 : 0;
    lastTime = performance.now();
    event.preventDefault();
  }
  if (state === 4 && event.key.toLowerCase() === "q") {
    saveBest();
    state = 0;
  }
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
    testSpeed = (testSpeed + 2) % 4 - 1;
  }
  if (DEBUG && state === 1 && event.key.toLowerCase() === "t" && !event.repeat) {
    testSpeed = -1;
    runTime = runTime < 50 ? 50 : runTime < 110 ? 110 : runTime < 180 ? 180 : runTime + 60;
  }
  if (DEBUG && state === 1 && event.key.toLowerCase() === "b" && !event.repeat) {
    speedTier = 2;
    testSpeed = 2;
    formationTest = 0;
    formationCount = 5;
    formationRows = [];
    formationDelay = 0.5;
    leapTime = blastTime = 0;
    worldColor = 70;
    protection = 0;
    combo = burstTime = 0;
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
    runTime += delta;
    // Debug tiers override the authored 50 s and 110 s act boundaries locally.
    const nextTier =
      DEBUG && testSpeed >= 0 ? testSpeed : runTime < 50 ? 0 : runTime < 110 ? 1 : 2;
    if (nextTier !== speedTier) {
      speedTier = nextTier;
      actFlash = 2;
    }
    const speed = speeds[speedTier] + Math.min(60, Math.max(0, runTime - 180) / 2);
    distance += delta * speed;
    if (burstTime) bonus += (delta * speed) / 10;
    protection = Math.max(0, protection - delta);
    actFlash = Math.max(0, actFlash - delta);
    if (burstTime && !(burstTime = Math.max(0, burstTime - delta))) combo = 0;
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
        learned |= 2;
        reward(50, 1);
      }
      if (
        Math.abs(entity.x - playerX) < entity.size + 25 &&
        entity.y > 405 &&
        entity.y < 465
      ) {
        if (entity.type === star) {
          reward(100, 5);
        }
        else if (entity.type === rift && leapTime > 0.25) {
          entity.type = bridge;
          learned |= 1;
          reward(50, 1);
          return true;
        } else if (entity.type !== bridge && !protection && !burstTime) {
          worldColor -= 25;
          protection = 1;
          combo = 0;
          if (worldColor <= 0) {
            state = 2;
            saveBest();
          }
        }
        return entity.type === bridge;
      }
      return entity.y < 580;
    });
    if (!restored && runTime >= 180) {
      restored = true;
      state = 3;
      saveBest();
      entities = [];
      formationRows = [];
      formationDelay = 0.8;
    }
  }

  draw();
  requestAnimationFrame(update);
}

requestAnimationFrame(update);
