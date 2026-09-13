const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
// The release build flips this constant so Terser removes test controls and UI.
const DEBUG = true;
const width = canvas.width;
const height = canvas.height;
const ribbonColors = ["#f45", "#ed4", "#57e"];
const roadColors = ["#f60", "#7e2", "#a5f"];
const cloud = 0;
const star = 1;
const rift = 2;
const bridge = 3;
const speeds = [220, 280, 340];
// Formation rows use c=cloud, s=star, r=rift, and .=empty. A slash advances one row.
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
  ".r./s.s",
  ".c./s.s",
];
// States: 0 title, 1 run, 2 loss, 3 victory, 4 pause, 5 controls, 6 about.
let state = 0;
let menuChoice = 0;
let panelReturn = 0;
let aboutTime = 0;
let lane = 1;
let playerX = 480;
let lastTime = 0;
let distance = 0;
let bonus = 0;
let formationDelay = 0;
let formationRows = [];
let formationCount = 0;
let mirrorFormation = false;
let dawnOffset = 0;
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
// Tutorial bits record Leap as 1 and Blast as 2.
let learned = 0;
let entities = [];
let best = 0;
let audio;
let musicTimer;
let musicStep = 0;
let effectTime = 0;
let effectX = 0;
let effectY = 0;
let effectHit = false;
let shakeTime = 0;
let freezeTime = 0;

try {
  best = +localStorage.TTU26 || 0;
} catch {}

function score() {
  return (distance / 10 + bonus) | 0;
}

function sound(
  frequency,
  duration = 0.1,
  endFrequency = frequency,
  type = "sine",
  delay = 0,
  volume = 0.1,
) {
  try {
    audio ||= new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + delay;
    audio.resume();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency * (0.98 + Math.random() * 0.04), start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  } catch {}
}

function tune(notes) {
  notes.forEach((note, index) => sound(note, 0.16, note, "square", index * 0.08, 0.075));
}

function musicStart() {
  if (musicTimer || !audio) return;
  const notes = [
    [262, 330, 392, 523, 392, 330, 294, 330],
    [294, 370, 440, 587, 440, 370, 330, 370],
    [330, 415, 494, 659, 494, 415, 370, 415],
  ];
  const play = () => {
    // Keep the clock alive across menus, but make no notes outside active play.
    if (state === 1) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "triangle";
      // Act roots rise, while Burst briefly doubles tempo and register.
      const note = notes[speedTier][musicStep++ & 7] * (burstTime ? 1.5 : 1);
      oscillator.frequency.value = note;
      gain.gain.setValueAtTime(0.065, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.2);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.2);
    }
    musicTimer = setTimeout(play, burstTime ? 140 : 240 - speedTier * 20);
  };
  play();
}

function particles(x, y, hit) {
  // One reusable burst keeps the effect state bounded in endless play.
  effectX = x;
  effectY = y;
  effectHit = hit;
  effectTime = 0.35;
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
  if (++combo === 8) {
    burstTime = 4;
    shakeTime = 0.35;
    freezeTime = 0.12;
    tune([440, 554, 659, 880]);
    sound(440, 0.7, 880, "triangle");
  }
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
  // Project the in-between lane so blasts stay parallel during lane changes.
  const start = 382 - jumpLift();
  const currentLane =
    (playerX - lanePosition(0, 440)) /
    (lanePosition(1, 440) - lanePosition(0, 440));
  return playerX + ((lanePosition(currentLane, 260) - playerX) * (start - y)) / (start - 260);
}

function drawRoad() {
  context.fillStyle = ["#20152f", "#101827", "#382044"][speedTier];
  context.fillRect(0, 0, width, height);
  context.fillStyle = ["#f8b4", "#8cf5", "#ffd8"][speedTier];
  context.beginPath();
  context.arc(480, 100, [65, 55, 100][speedTier], Math.PI, 0);
  context.fill();

  for (let index = 0; index < 3; index++) {
    const topLeft = 400 + (index * 160) / 3;
    const topRight = 400 + ((index + 1) * 160) / 3;
    const bottomLeft = 100 + (index * 760) / 3;
    const bottomRight = 100 + ((index + 1) * 760) / 3;

    context.fillStyle = roadColors[index];
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

  // Storm repurposes the sparse sky sparkles as rain over the whole scene.
  context.fillStyle = speedTier === 1 ? "#9df8" : "#fff8";
  for (let index = 0; index < (speedTier === 1 ? 18 : 9); index++) {
    const depth = speedTier === 1 ? ((index * 47 + distance) % 500) / 500 : 0;
    context.fillRect(
      (index * 137) % width,
      speedTier === 1 ? depth * depth * height : 20 + ((index * 47) % 70),
      speedTier === 1 ? 1 + depth * 2 : 2,
      speedTier === 1 ? 4 + depth * 20 : 2,
    );
  }
}

function drawPlayer() {
  const lift = jumpLift();
  context.globalAlpha = protection && ((protection * 12) | 0) % 2 ? 0.3 : 1;

  // Seven radians is used as a compact full circle throughout the drawings.
  context.fillStyle = "#24163288";
  context.beginPath();
  context.ellipse(playerX, 468, 39 - lift / 3, 11 - lift / 12, 0, 0, 7);
  context.fill();

  // Positive values stretch a leap. Negative values squash movement or impact.
  const stretch =
    lift / 400 -
    Math.min(0.25, Math.abs(lanePosition(lane, 440) - playerX) / 350) -
    (effectHit ? effectTime / 2 : 0);
  context.save();
  context.translate(playerX, 438 - lift);
  context.scale(1 - stretch, 1 + stretch);
  context.translate(-playerX, lift - 438);

  const step = Math.sin(distance / 12) * 5;
  const ink = "#4b2945";
  context.lineWidth = 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = ink;

  context.fillStyle = "#ffd84d";
  context.beginPath();
  context.moveTo(playerX - 6, 395 - lift);
  context.lineTo(playerX, 365 - lift);
  context.lineTo(playerX + 6, 395 - lift);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#fff5fd";
  context.beginPath();
  context.ellipse(playerX - 15, 398 - lift, 5, 11, -0.4, 0, 7);
  context.ellipse(playerX + 15, 398 - lift, 5, 11, 0.4, 0, 7);
  context.fill();
  context.stroke();

  context.beginPath();
  context.arc(playerX, 407 - lift, 19, 0, 7);
  context.fill();
  context.stroke();

  const maneY = [388, 398, 410];
  const maneR = [8, 10, 11];
  for (let index = 0; index < 3; index++) {
    context.fillStyle = ribbonColors[index];
    context.beginPath();
    context.arc(playerX, maneY[index] - lift, maneR[index], 0, 7);
    context.fill();
    context.stroke();
  }

  // The rump covers the leg tops and lower head to establish rear-view depth.
  context.fillStyle = "#fff5fd";
  context.fillRect(playerX - 20, 452 - lift, 10, 22 + step);
  context.fillRect(playerX + 10, 452 - lift, 10, 22 - step);
  context.strokeRect(playerX - 20, 452 - lift, 10, 22 + step);
  context.strokeRect(playerX + 10, 452 - lift, 10, 22 - step);

  context.fillStyle = "#45414d";
  context.fillRect(playerX - 20, 469 - lift + step, 10, 5);
  context.fillRect(playerX + 10, 469 - lift - step, 10, 5);

  context.fillStyle = "#fff5fd";
  context.beginPath();
  context.ellipse(playerX, 440 - lift, 27, 29, 0, 0, 7);
  context.fill();
  context.stroke();

  const rootY = 434 - lift;
  // Outline every strand first, then overlay color from one narrow tail root.
  for (let pass = 0; pass < 2; pass++) {
    context.lineWidth = pass ? 7 : 11;
    for (let index = 0; index < 3; index++) {
      const offset = (index - 1) * 5;
      context.strokeStyle = pass ? ribbonColors[index] : ink;
      context.beginPath();
      context.moveTo(playerX + (index - 1) * 2, rootY);
      context.bezierCurveTo(
        playerX - 12 + offset,
        rootY + 14,
        playerX + 18 + offset,
        rootY + 28,
        playerX - 5 + offset,
        rootY + 44,
      );
      context.stroke();
    }
  }
  context.restore();
  context.globalAlpha = 1;
}

function drawBurst() {
  if (burstTime) {
    context.globalAlpha = 0.7;
    // The first wide path outlines six animated bands against every lane.
    for (let band = -1; band < 6; band++) {
      context.strokeStyle = band < 0 ? "#4b2945" : `hsl(${band * 60} 90% 60%)`;
      context.lineWidth = band < 0 ? 54 : 8;
      context.beginPath();
      for (let y = 450; y < 550; y += 10) {
        const x =
          playerX + (band < 0 ? 0 : band * 8 - 20) + Math.sin(distance / 25 + y / 18) * 4;
        y === 450 ? context.moveTo(x, y) : context.lineTo(x, y);
      }
      context.stroke();
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
    context.moveTo(playerX, 365 - lift);
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
    const dawnCycle = !speedTier && formationCount >= 4;
    const dawnStep = (formationCount - 4 + dawnOffset) % 6;
    const dawnLane = dawnStep % 3;
    // Dawn rotates lane and hazard type. Every lane appears within three formations.
    // Later acts drop the simplest formations while retaining proven patterns.
    const formationStart = speedTier === 2 ? 6 : 4;
    const formation =
      testing
        ? formations[formationTest >> 1]
        : formationCount < 4
        ? formations[formationCount]
        : dawnCycle
        ? formations[
            dawnLane === 1 ? 12 + (dawnStep & 1) : 4 + (dawnStep & 1)
          ]
        : formations[
            formationStart + ((Math.random() * (12 - formationStart)) | 0)
          ];
    formationRows = formation.split("/");
    mirrorFormation = testing
      ? formationTest++ % 2
      : dawnCycle
        ? dawnLane === 2
        : Math.random() > 0.5;
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
    const x = entity.x;
    const y = entity.y;
    const size = entity.size;
    if (entity.type === star) {
      context.save();
      context.translate(x, y);
      context.rotate(distance / 80);
      context.fillStyle = "#fff6a8";
      context.beginPath();
      context.moveTo(0, -size);
      context.quadraticCurveTo(0, 0, size, 0);
      context.quadraticCurveTo(0, 0, 0, size);
      context.quadraticCurveTo(0, 0, -size, 0);
      context.quadraticCurveTo(0, 0, 0, -size);
      context.fill();
      context.fillStyle = "#fff";
      context.beginPath();
      context.arc(0, 0, size * 0.25, 0, 7);
      context.fill();
      context.restore();
    } else if (entity.type === cloud) {
      context.fillStyle = "#24163266";
      context.beginPath();
      context.ellipse(x, y + size * 1.2, size * 1.5, size * 0.3, 0, 0, 7);
      context.fill();
      context.fillStyle = "#292033";
      context.beginPath();
      context.arc(x, y, size, 0, 7);
      context.arc(x + size, y + size * 0.15, size * 0.75, 0, 7);
      context.arc(x - size, y + size * 0.15, size * 0.75, 0, 7);
      context.fill();
      context.fillStyle = "#ff8bd5";
      context.beginPath();
      context.ellipse(x - size * 0.35, y, size * 0.22, size * 0.09, 0.45, 0, 7);
      context.ellipse(x + size * 0.35, y, size * 0.22, size * 0.09, -0.45, 0, 7);
      context.fill();
    } else {
      // A bridge covers the same outlined chasm used by its rift state.
      context.fillStyle = "#160f20";
      context.strokeStyle = "#a98bff";
      context.lineWidth = size / 6;
      context.beginPath();
      context.moveTo(x - size * 1.8, y - size * 0.1);
      context.lineTo(x - size * 0.8, y - size * 0.35);
      context.lineTo(x, y - size * 0.15);
      context.lineTo(x + size * 0.7, y - size * 0.4);
      context.lineTo(x + size * 1.8, y - size * 0.05);
      context.lineTo(x + size * 1.2, y + size * 0.25);
      context.lineTo(x + size * 0.4, y + size * 0.45);
      context.lineTo(x - size * 0.5, y + size * 0.3);
      context.lineTo(x - size * 1.3, y + size * 0.4);
      context.closePath();
      context.fill();
      context.stroke();
      if (entity.type === bridge) {
        context.fillStyle = "#fff";
        context.fillRect(x - size * 1.6, y - size * 0.25, size * 3.2, size * 0.55);
        for (let index = 0; index < 3; index++) {
          context.fillStyle = ribbonColors[index];
          context.fillRect(
            x - size * 1.5,
            y + size * (index * 0.15 - 0.21),
            size * 3,
            size * 0.13,
          );
        }
      }
    }
  }
}

function drawPanel(title) {
  context.fillStyle = "#120d20e8";
  context.fillRect(145, 55, 670, 430);
  context.fillStyle = "white";
  context.textAlign = "center";
  context.font = "bold 46px sans-serif";
  context.fillText(title, width / 2, 125);
}

function menuItems() {
  return state === 0
    ? ["PLAY  [ENTER]", "CONTROLS", "ABOUT"]
    : state === 2
      ? ["RETRY  [ENTER]", "MAIN MENU  [ESC]"]
      : state === 3
        ? ["CONTINUE ENDLESS  [ENTER]", "MAIN MENU  [ESC]"]
        : state === 4
          ? ["RESUME  [P / ESC]", "CONTROLS", "MAIN MENU  [Q]"]
          : ["BACK  [ESC]"];
}

function drawOptions(items, start = 215) {
  context.font = "bold 20px sans-serif";
  items.forEach((item, index) => {
    context.fillStyle = index === menuChoice ? "#f7d85b" : "#33283d";
    context.fillRect(270, start + index * 58, 420, 44);
    context.strokeStyle = "white";
    context.lineWidth = 2;
    context.strokeRect(270, start + index * 58, 420, 44);
    context.fillStyle = index === menuChoice ? "#20152f" : "white";
    context.fillText(item, width / 2, start + 29 + index * 58);
  });
}

function drawMenu(title, subtitle, footer = "") {
  drawPanel(title);
  context.font = "20px sans-serif";
  context.fillText(subtitle, width / 2, 170);
  drawOptions(menuItems());
  context.font = "18px sans-serif";
  context.fillStyle = "white";
  if (footer) context.fillText(footer, width / 2, 450);
}

function drawKeycap(label, x, y, keyWidth = 52) {
  context.fillStyle = "#33283d";
  context.fillRect(x - keyWidth / 2, y - 24, keyWidth, 38);
  context.strokeStyle = "white";
  context.lineWidth = 2;
  context.strokeRect(x - keyWidth / 2, y - 24, keyWidth, 38);
  context.fillStyle = "white";
  context.textAlign = "center";
  context.font = "bold 20px sans-serif";
  context.fillText(label, x, y + 2);
}

function drawKeypad(keys, x, y) {
  drawKeycap(keys[0], x, y, 38);
  keys.slice(1).forEach((key, index) => drawKeycap(key, x + (index - 1) * 44, y + 42, 38));
}

function drawControls() {
  drawPanel("CONTROLS");
  context.font = "bold 18px sans-serif";
  context.textAlign = "left";
  context.fillText("PRIMARY", 205, 165);
  context.fillText("ALTERNATE", 525, 165);
  drawKeypad(["W", "A", "S", "D"], 230, 195);
  drawKeypad(["↑", "←", "↓", "→"], 570, 195);
  context.font = "bold 16px sans-serif";
  context.textAlign = "left";
  context.fillText("A / D  STEER", 320, 217);
  context.fillText("W / S  MENUS", 320, 242);
  context.fillText("← / →  STEER", 660, 217);
  context.fillText("↑ / ↓  MENUS", 660, 242);
  const actions = ["LEAP", "BLAST", "PAUSE"];
  ["K", "L", "P"].forEach((key, index) => {
    const y = 295 + index * 48;
    drawKeycap(key, 230, y, 46);
    context.textAlign = "left";
    context.fillText(actions[index], 285, y);
  });
  ["Z / SPACE", "X", "ESC"].forEach((key, index) => {
    const y = 295 + index * 48;
    drawKeycap(key, 570, y, key.length > 3 ? 100 : 52);
    context.textAlign = "left";
    context.fillText(actions[index], 635, y);
  });
  context.textAlign = "center";
  drawOptions(menuItems(), 420);
}

function drawAbout() {
  drawPanel("ABOUT");
  context.font = "18px sans-serif";
  context.fillText("2026: SERVERS BOILED RIVERS FOR GHOST MONEY.", width / 2, 190);
  context.fillText("THE FUTURE: THE SKY DIED UNDER SMOG AND GRAY CODE.", width / 2, 220);
  context.font = "bold 24px sans-serif";
  // Let each extra claim land before adding the next one.
  if (aboutTime > 1.6) context.fillText("IN THE END, THERE CAN BE ONLY ONE UNICORN!", width / 2, 270);
  if (aboutTime > 2.9) context.fillText("... AND TWO TRICKS!", width / 2, 310);
  if (aboutTime > 4.6) context.fillText("... IN 13 KB!", width / 2, 350);
  context.font = "18px sans-serif";
  context.fillText("TRICKS + STARS BUILD BURST.", width / 2, 385);
  drawOptions(menuItems(), 420);
}

function drawParticles() {
  if (effectTime) {
    const spread = (0.35 - effectTime) * 150;
    context.globalAlpha = effectTime / 0.35;
    for (let index = 0; index < 8; index++) {
      context.fillStyle = effectHit ? "#f45" : ribbonColors[index % 3];
      context.beginPath();
      context.arc(
        effectX + Math.cos(index * 2.4) * spread,
        effectY + Math.sin(index * 2.4) * spread,
        effectHit ? 7 : 5,
        0,
        7,
      );
      context.fill();
    }
    context.globalAlpha = 1;
  }
}

function draw() {
  const saturation = Math.max(0, worldColor);
  context.save();
  if (shakeTime) {
    context.translate(
      Math.sin(shakeTime * 90) * shakeTime * 28,
      Math.cos(shakeTime * 70) * shakeTime * 16,
    );
  }
  context.filter = `saturate(${saturation}%)`;
  drawRoad();
  drawEntities();
  drawBlast();
  // Feedback stays vivid even when low health desaturates the world.
  context.filter = "none";
  drawBurst();
  context.filter = `saturate(${saturation}%)`;
  drawPlayer();
  context.filter = "none";
  drawParticles();
  context.restore();
  if (state === 1 || state === 3 || state === 4 || (state === 5 && panelReturn === 4)) {
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
    context.fillText(
      burstTime ? `BURST · INVINCIBLE ${burstTime.toFixed(1)}s · 2X SCORE` : `COMBO ${combo}/8`,
      24,
      92,
    );
    context.textAlign = "right";
    context.font = "bold 24px sans-serif";
    context.fillText(
      runTime >= 180 ? "ENDLESS" : `ACT ${speedTier + 1}/3 · ${["DAWN", "STORM", "BLOOM"][speedTier]}`,
      936,
      38,
    );
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
        ? "PRESS K TO LEAP RIFTS"
        : !(learned & 2) && entities.some((entity) => entity.type === cloud)
          ? "PRESS L TO BLAST CLOUDS"
          : "";
    if (lesson) {
      context.textAlign = "center";
      context.fillText(lesson, width / 2, 70);
    }
    if (actFlash) {
      context.textAlign = "center";
      context.font = "bold 42px sans-serif";
      context.fillText(`ACT ${speedTier + 1}/3 · ${["DAWN", "STORM", "BLOOM"][speedTier]}`, width / 2, 150);
    }
  }
  if (state === 0) {
    drawMenu("TWO-TRICK UNICORN", "SURVIVE THREE ACTS · RESTORE THE RAINBOW", `BEST ${best}`);
  } else if (state === 2) {
    drawMenu("GAME OVER", "THE GLOOM WON", `SCORE ${score()}   BEST ${best}`);
  } else if (state === 3) {
    drawMenu("RAINBOW RESTORED!", "THREE ACTS COMPLETE", `SCORE ${score()}`);
  } else if (state === 4) {
    drawMenu("PAUSED", "THE RUN IS FROZEN");
  } else if (state === 5) {
    drawControls();
  } else if (state === 6) {
    drawAbout();
  }
}

function start() {
  if (state === 3 || state === 4) {
    const paused = state === 4;
    state = 1;
    lastTime = performance.now();
    if (paused) sound(440, 0.08, 660, "square");
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
    dawnOffset = (Math.random() * 6) | 0;
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
    effectTime = shakeTime = freezeTime = 0;
    entities = [];
    tune([262, 330, 392]);
    musicStart();
    draw();
  }
}

function title() {
  saveBest();
  state = menuChoice = 0;
  tune([392, 330, 262]);
}

function resume() {
  state = 1;
  lastTime = performance.now();
  sound(440, 0.08, 660, "square");
}

function openPanel(next, origin) {
  state = next;
  panelReturn = origin;
  menuChoice = 0;
  aboutTime = 0;
}

function activateMenu() {
  const screen = state;
  const selected = menuChoice;
  if (screen === 0) {
    if (!selected) start();
    else openPanel(selected + 4, 0);
  } else if (screen === 2) {
    if (!selected) start();
    else title();
  } else if (screen === 3) {
    if (!selected) start();
    else title();
  } else if (screen === 4) {
    if (!selected) resume();
    else if (selected === 1) openPanel(5, 4);
    else title();
  } else {
    state = panelReturn;
    menuChoice = 0;
  }
}

addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "escape") {
    if (state === 1) {
      state = 4;
      menuChoice = 0;
      sound(330, 0.08, 220, "square");
    } else if (state === 4) resume();
    else if (state === 5 || state === 6) {
      state = panelReturn;
      menuChoice = 0;
    } else if (state) title();
    lastTime = performance.now();
    event.preventDefault();
    return;
  }
  if (key === "p" && (state === 1 || state === 4)) {
    if (state === 1) {
      state = 4;
      menuChoice = 0;
      sound(330, 0.08, 220, "square");
    } else resume();
    event.preventDefault();
    return;
  }
  if (state !== 1) {
    if (state === 4 && key === "q") title();
    else if (["arrowup", "w", "arrowdown", "s"].includes(key)) {
      const direction = key === "arrowup" || key === "w" ? -1 : 1;
      const count = menuItems().length;
      menuChoice = (menuChoice + direction + count) % count;
    } else if (key === "enter" && !event.repeat) activateMenu();
    else return;
    event.preventDefault();
    return;
  }
  if (["arrowleft", "a"].includes(key)) {
    lane = Math.max(0, lane - 1);
    event.preventDefault();
  }
  if (["arrowright", "d"].includes(key)) {
    lane = Math.min(2, lane + 1);
    event.preventDefault();
  }
  if (["k", "z"].includes(key) || event.code === "Space") {
    if (leapTime <= 0 && !event.repeat) {
      leapTime = 0.7;
      sound(330, 0.18, 660, "triangle");
    }
    event.preventDefault();
  }
  if (["l", "x"].includes(key)) {
    if (blastTime <= 0 && !event.repeat) {
      blastTime = 0.6;
      sound(1200, 0.12, 300, "sawtooth");
    }
    event.preventDefault();
  }
  if (DEBUG && key === "v" && !event.repeat) {
    testSpeed = (testSpeed + 2) % 4 - 1;
  }
  if (DEBUG && key === "t" && !event.repeat) {
    testSpeed = -1;
    runTime = runTime < 50 ? 50 : runTime < 110 ? 110 : runTime < 180 ? 180 : runTime + 60;
  }
  if (DEBUG && key === "b" && !event.repeat) {
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
    effectTime = shakeTime = freezeTime = 0;
    lane = 1;
    playerX = 480;
    entities = [];
  }
});
canvas.addEventListener("pointerdown", (event) => {
  if (state === 1) return;
  // Convert CSS-scaled pointer coordinates to the fixed canvas coordinates.
  const bounds = canvas.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) * width) / bounds.width;
  const y = ((event.clientY - bounds.top) * height) / bounds.height;
  const start = state === 5 || state === 6 ? 420 : 215;
  const items = menuItems();
  const selected = ((y - start) / 58) | 0;
  if (
    x >= 270 &&
    x <= 690 &&
    y >= start &&
    selected >= 0 &&
    selected < items.length &&
    y <= start + selected * 58 + 44
  ) {
    menuChoice = selected;
    activateMenu();
  }
});
document.addEventListener("visibilitychange", () => {
  lastTime = performance.now();
});

function update(time) {
  // Cap frame gaps so a resumed tab cannot skip collisions.
  let delta = Math.min((time - lastTime) / 1000 || 0, 0.05);
  lastTime = time;

  if (state === 1) {
    // Hitstop freezes the simulation but not rendering or input.
    if (freezeTime) {
      freezeTime = Math.max(0, freezeTime - delta);
      delta = 0;
    }
    runTime += delta;
    // Debug tiers override the authored 50 s and 110 s act boundaries locally.
    const nextTier =
      DEBUG && testSpeed >= 0 ? testSpeed : runTime < 50 ? 0 : runTime < 110 ? 1 : 2;
    if (nextTier !== speedTier) {
      speedTier = nextTier;
      actFlash = 2;
      tune(speedTier === 1 ? [392, 523] : [523, 659, 784]);
    }
    const speed = speeds[speedTier] + Math.min(60, Math.max(0, runTime - 180) / 2);
    distance += delta * speed;
    if (burstTime) bonus += (delta * speed) / 10;
    protection = Math.max(0, protection - delta);
    actFlash = Math.max(0, actFlash - delta);
    effectTime = Math.max(0, effectTime - delta);
    shakeTime = Math.max(0, shakeTime - delta);
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
          particles(entity.x, entity.y, false);
          sound(900, 0.14, 1500);
        }
        else if (entity.type === rift && leapTime > 0.25) {
          entity.type = bridge;
          learned |= 1;
          reward(50, 1);
          return true;
        } else if (burstTime && entity.type !== bridge) {
          // Burst contact clears hazards without stars or score.
          sound(
            entity.type === cloud ? 760 : 420,
            0.1,
            entity.type === cloud ? 1100 : 220,
            "triangle",
            0,
            0.05,
          );
        } else if (entity.type !== bridge && !protection && !burstTime) {
          worldColor -= 25;
          protection = 1;
          combo = 0;
          particles(playerX, 430, true);
          shakeTime = 0.2;
          freezeTime = 0.05;
          sound(160, worldColor <= 0 ? 0.8 : 0.3, 40, "square", 0, 0.13);
          if (worldColor <= 0) {
            state = 2;
            effectTime = shakeTime = freezeTime = 0;
            sound(100, 1, 30, "sawtooth", 0.15, 0.1);
            saveBest();
          }
        }
        // Contact consumes stars and hazards. Repaired bridges keep scrolling.
        return entity.type === bridge;
      }
      return entity.y < 580;
    });
    if (!restored && runTime >= 180) {
      restored = true;
      state = 3;
      sound(523, 0.8, 784, "triangle");
      sound(659, 0.8, 988, "triangle", 0.15);
      sound(784, 1.2, 1175, "triangle", 0.3);
      saveBest();
      entities = [];
      formationRows = [];
      formationDelay = 0.8;
    }
  }
  if (state === 6) aboutTime = Math.min(5, aboutTime + delta);

  draw();
  requestAnimationFrame(update);
}

requestAnimationFrame(update);
