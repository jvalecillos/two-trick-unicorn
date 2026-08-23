const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const width = canvas.width;
const height = canvas.height;
const ribbonColors = ["#f45", "#ed4", "#57e"];
let state = 0;
let lane = 1;
let playerX = 480;
let lastTime = 0;
let distance = 0;
let bonus = 0;
let spawnDelay = 0;
let entities = [];

function score() {
  return (distance / 10 + bonus) | 0;
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
  context.fillStyle = "#24163288";
  context.beginPath();
  context.ellipse(playerX, 468, 39, 11, 0, 0, 7);
  context.fill();

  context.fillStyle = "#fff5fd";
  context.fillRect(playerX - 25, 412, 50, 52);
  context.fillStyle = "#ff77cc";
  context.fillRect(playerX - 25, 412, 12, 52);
  context.fillStyle = "#ffd84d";
  context.beginPath();
  context.moveTo(playerX, 412);
  context.lineTo(playerX + 9, 382);
  context.lineTo(playerX + 15, 416);
  context.fill();
}

function placeEntity(entity) {
  const progress = (entity.y - 100) / 440;
  const roadWidth = 160 + progress * 600;
  entity.x = 480 - roadWidth / 2 + ((entity.lane + 0.5) * roadWidth) / 3;
  entity.size = 10 + progress * 28;
}

function drawEntities() {
  for (const entity of entities) {
    if (entity.type) {
      context.fillStyle = "#fff6a8";
      context.beginPath();
      context.moveTo(entity.x, entity.y - entity.size);
      context.lineTo(entity.x + entity.size * 0.65, entity.y);
      context.lineTo(entity.x, entity.y + entity.size);
      context.lineTo(entity.x - entity.size * 0.65, entity.y);
      context.fill();
    } else {
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
  drawPlayer();
  if (state === 1) {
    context.fillStyle = "white";
    context.textAlign = "left";
    context.font = "bold 24px sans-serif";
    context.fillText(`SCORE ${score()}`, 24, 38);
  }
  if (state === 0) {
    drawMessage("TWO-TRICK UNICORN", "ENTER OR CLICK TO START");
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
    spawnDelay = 0.8;
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
});
canvas.addEventListener("pointerdown", start);
document.addEventListener("visibilitychange", () => {
  lastTime = performance.now();
});

function update(time) {
  const delta = Math.min((time - lastTime) / 1000 || 0, 0.05);
  lastTime = time;

  if (state === 1) {
    distance += delta * 220;
    playerX += (100 + ((lane + 0.5) * 760) / 3 - playerX) * Math.min(1, delta * 12);
    spawnDelay -= delta;

    if (spawnDelay <= 0) {
      entities.push({
        lane: (Math.random() * 3) | 0,
        type: Math.random() > 0.65,
        y: 100,
      });
      spawnDelay = 0.8 + Math.random() * 0.7;
    }

    entities = entities.filter((entity) => {
      entity.y += delta * 220;
      placeEntity(entity);
      if (
        Math.abs(entity.x - playerX) < entity.size + 25 &&
        entity.y > 405 &&
        entity.y < 465
      ) {
        if (entity.type) bonus += 100;
        else state = 2;
        return false;
      }
      return entity.y < 580;
    });
  }

  draw();
  requestAnimationFrame(update);
}

requestAnimationFrame(update);
