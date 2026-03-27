const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreNode = document.getElementById("score");
const livesNode = document.getElementById("lives");
const statusNode = document.getElementById("status");
const restartButton = document.getElementById("restart");
const leftControl = document.getElementById("left-control");
const rightControl = document.getElementById("right-control");
const fireControl = document.getElementById("fire-control");

const config = {
  width: canvas.width,
  height: canvas.height,
  playerSpeed: 5.2,
  bulletSpeed: 8,
  enemyBulletSpeed: 3.4,
  enemyStepDown: 20,
  fireCooldown: 260,
  winScore: 100
};

const keys = {
  left: false,
  right: false
};

const state = {
  player: null,
  bullets: [],
  enemyBullets: [],
  invaders: [],
  shields: [],
  score: 0,
  lives: 3,
  direction: 1,
  moveTimer: 0,
  moveInterval: 620,
  fireTimer: 0,
  gameOver: false,
  win: false,
  animationId: null,
  lastTime: 0
};

function createInvaders() {
  const rows = [
    "00111100",
    "01111110",
    "11111111",
    "11011011"
  ];
  const invaders = [];
  const startX = 120;
  const startY = 92;
  const gapX = 68;
  const gapY = 52;

  rows.forEach((row, rowIndex) => {
    row.split("").forEach((cell, cellIndex) => {
      if (cell === "1") {
        invaders.push({
          x: startX + cellIndex * gapX,
          y: startY + rowIndex * gapY,
          width: 28,
          height: 20,
          alive: true,
          score: 5,
          color: rowIndex < 2 ? "#70e9ff" : "#ff4fd8"
        });
      }
    });
  });

  return invaders;
}

function createShields() {
  return [
    { x: 145, y: 438, width: 90, height: 28, hp: 7 },
    { x: 375, y: 438, width: 90, height: 28, hp: 7 },
    { x: 605, y: 438, width: 90, height: 28, hp: 7 }
  ];
}

function resetGame() {
  state.player = {
    x: config.width / 2 - 26,
    y: config.height - 56,
    width: 52,
    height: 18
  };
  state.bullets = [];
  state.enemyBullets = [];
  state.invaders = createInvaders();
  state.shields = createShields();
  state.score = 0;
  state.lives = 3;
  state.direction = 1;
  state.moveTimer = 0;
  state.moveInterval = 620;
  state.fireTimer = 0;
  state.gameOver = false;
  state.win = false;
  state.lastTime = 0;
  updateHud();
  setStatus("Reach 100 to win");
}

function updateHud() {
  scoreNode.textContent = String(state.score).padStart(3, "0");
  livesNode.textContent = String(state.lives).padStart(2, "0");
}

function setStatus(text) {
  statusNode.textContent = text;
}

function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function shootPlayerBullet() {
  if (state.gameOver) {
    return;
  }

  const activeBullet = state.bullets.find((bullet) => bullet.owner === "player");
  if (activeBullet) {
    return;
  }

  state.bullets.push({
    x: state.player.x + state.player.width / 2 - 2,
    y: state.player.y - 12,
    width: 4,
    height: 12,
    speed: config.bulletSpeed,
    owner: "player"
  });
}

function shootEnemyBullet() {
  const columns = new Map();

  state.invaders.forEach((invader) => {
    if (!invader.alive) {
      return;
    }

    const key = Math.round(invader.x);
    const existing = columns.get(key);
    if (!existing || invader.y > existing.y) {
      columns.set(key, invader);
    }
  });

  const shooters = [...columns.values()];
  if (!shooters.length) {
    return;
  }

  const shooter = shooters[Math.floor(Math.random() * shooters.length)];
  state.enemyBullets.push({
    x: shooter.x + shooter.width / 2 - 3,
    y: shooter.y + shooter.height + 6,
    width: 6,
    height: 14,
    speed: config.enemyBulletSpeed + (100 - state.invaders.length) * 0.01,
    owner: "enemy"
  });
}

function damageShield(bullet, damage = 1) {
  for (const shield of state.shields) {
    if (shield.hp <= 0) {
      continue;
    }
    if (isColliding(bullet, shield)) {
      shield.hp -= damage;
      return true;
    }
  }
  return false;
}

function updatePlayer() {
  if (keys.left) {
    state.player.x -= config.playerSpeed;
  }
  if (keys.right) {
    state.player.x += config.playerSpeed;
  }

  state.player.x = Math.max(16, Math.min(config.width - state.player.width - 16, state.player.x));
}

function updateBullets() {
  state.bullets = state.bullets.filter((bullet) => {
    bullet.y -= bullet.speed;

    if (damageShield(bullet)) {
      return false;
    }

    for (const invader of state.invaders) {
      if (invader.alive && isColliding(bullet, invader)) {
        invader.alive = false;
        state.score += invader.score;
        updateHud();
        return false;
      }
    }

    return bullet.y + bullet.height > 0;
  });

  state.enemyBullets = state.enemyBullets.filter((bullet) => {
    bullet.y += bullet.speed;

    if (damageShield(bullet)) {
      return false;
    }

    if (isColliding(bullet, state.player)) {
      state.lives -= 1;
      updateHud();
      if (state.lives <= 0) {
        loseGame("Signal lost");
      } else {
        setStatus("Hit taken");
      }
      return false;
    }

    return bullet.y < config.height;
  });
}

function updateInvaders(delta) {
  state.moveTimer += delta;
  state.fireTimer += delta;

  if (state.fireTimer >= config.fireCooldown) {
    const burstChance = Math.random();
    shootEnemyBullet();
    if (burstChance > 0.74) {
      shootEnemyBullet();
    }
    state.fireTimer = 0;
  }

  if (state.moveTimer < state.moveInterval) {
    return;
  }
  state.moveTimer = 0;

  const living = state.invaders.filter((invader) => invader.alive);
  if (!living.length) {
    if (state.score >= config.winScore) {
      winGame();
    } else {
      loseGame("Wave cleared, but not enough points");
    }
    return;
  }

  const leftEdge = Math.min(...living.map((invader) => invader.x));
  const rightEdge = Math.max(...living.map((invader) => invader.x + invader.width));
  let touchEdge = false;

  if (rightEdge + 24 >= config.width && state.direction === 1) {
    touchEdge = true;
  }

  if (leftEdge <= 24 && state.direction === -1) {
    touchEdge = true;
  }

  if (touchEdge) {
    state.direction *= -1;
    living.forEach((invader) => {
      invader.y += config.enemyStepDown;
    });
  } else {
    living.forEach((invader) => {
      invader.x += 16 * state.direction;
    });
  }

  state.moveInterval = Math.max(150, 620 - (20 - living.length) * 16);

  for (const invader of living) {
    if (invader.y + invader.height >= state.player.y - 6) {
      loseGame("Invaders landed");
      break;
    }
  }
}

function loseGame(message) {
  state.gameOver = true;
  state.win = false;
  setStatus(message);
}

function winGame() {
  state.gameOver = true;
  state.win = true;
  setStatus("You won the wave");
}

function drawBackground() {
  ctx.clearRect(0, 0, config.width, config.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, config.height);
  gradient.addColorStop(0, "#030510");
  gradient.addColorStop(0.6, "#071225");
  gradient.addColorStop(1, "#02060f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, config.width, config.height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 40; i += 1) {
    const x = (i * 73) % config.width;
    const y = (i * 41) % config.height;
    ctx.fillStyle = i % 2 === 0 ? "#70e9ff" : "#ffffff";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(112, 233, 255, 0.2)";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, config.width - 20, config.height - 20);

  ctx.save();
  ctx.globalAlpha = 0.08;
  for (let y = 0; y < config.height; y += 4) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, y, config.width, 1);
  }
  ctx.restore();
}

function drawPlayer() {
  const { x, y, width, height } = state.player;
  ctx.fillStyle = "#d8ff4f";
  ctx.fillRect(x, y, width, height);
  ctx.fillRect(x + 10, y - 8, width - 20, 8);
  ctx.fillRect(x + width / 2 - 4, y - 14, 8, 6);

  ctx.shadowBlur = 20;
  ctx.shadowColor = "#d8ff4f";
  ctx.fillRect(x + 2, y + 2, width - 4, 2);
  ctx.shadowBlur = 0;
}

function drawInvader(invader) {
  const px = invader.x;
  const py = invader.y;
  const c = invader.color;

  ctx.fillStyle = c;
  ctx.shadowBlur = 14;
  ctx.shadowColor = c;

  const pixels = [
    [0, 1], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [3, 1],
    [4, 0], [4, 1], [4, 2], [5, 0], [5, 2], [6, 1]
  ];

  pixels.forEach(([gx, gy]) => {
    ctx.fillRect(px + gx * 4, py + gy * 4, 4, 4);
  });

  ctx.shadowBlur = 0;
}

function drawShields() {
  state.shields.forEach((shield) => {
    if (shield.hp <= 0) {
      return;
    }

    const alpha = shield.hp / 7;
    ctx.fillStyle = `rgba(112, 233, 255, ${0.25 + alpha * 0.45})`;
    ctx.strokeStyle = `rgba(112, 233, 255, ${0.3 + alpha * 0.5})`;
    ctx.lineWidth = 2;
    ctx.fillRect(shield.x, shield.y, shield.width, shield.height);
    ctx.strokeRect(shield.x, shield.y, shield.width, shield.height);
  });
}

function drawBullets() {
  state.bullets.forEach((bullet) => {
    ctx.fillStyle = "#d8ff4f";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#d8ff4f";
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  });

  state.enemyBullets.forEach((bullet) => {
    ctx.fillStyle = "#ff4fd8";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ff4fd8";
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  });

  ctx.shadowBlur = 0;
}

function drawOverlay() {
  if (!state.gameOver) {
    return;
  }

  ctx.fillStyle = "rgba(2, 4, 12, 0.72)";
  ctx.fillRect(0, 0, config.width, config.height);

  ctx.textAlign = "center";
  ctx.fillStyle = state.win ? "#d8ff4f" : "#ff7e7e";
  ctx.font = '700 48px "SFMono-Regular", monospace';
  ctx.fillText(state.win ? "WAVE CLEARED" : "GAME OVER", config.width / 2, config.height / 2 - 8);

  ctx.fillStyle = "#eaf6ff";
  ctx.font = '400 18px "SFMono-Regular", monospace';
  ctx.fillText("Press restart to try again", config.width / 2, config.height / 2 + 32);
  ctx.textAlign = "start";
}

function draw() {
  drawBackground();
  drawShields();
  state.invaders.forEach((invader) => {
    if (invader.alive) {
      drawInvader(invader);
    }
  });
  drawPlayer();
  drawBullets();
  drawOverlay();
}

function tick(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }
  const delta = timestamp - state.lastTime;
  state.lastTime = timestamp;

  if (!state.gameOver) {
    updatePlayer();
    updateBullets();
    updateInvaders(delta);
    if (state.score >= config.winScore) {
      winGame();
    }
  }

  draw();
  state.animationId = window.requestAnimationFrame(tick);
}

function handleKeyChange(event, isPressed) {
  const key = event.key.toLowerCase();

  if (key === "a" || event.key === "ArrowLeft") {
    keys.left = isPressed;
  }

  if (key === "d" || event.key === "ArrowRight") {
    keys.right = isPressed;
  }

  if (event.code === "Space" && isPressed) {
    event.preventDefault();
    if (!state.gameOver) {
      shootPlayerBullet();
    }
  }
}

window.addEventListener("keydown", (event) => {
  handleKeyChange(event, true);
});

window.addEventListener("keyup", (event) => {
  handleKeyChange(event, false);
});

restartButton.addEventListener("click", () => {
  resetGame();
});

function bindHoldControl(element, keyName) {
  const start = (event) => {
    event.preventDefault();
    keys[keyName] = true;
  };
  const end = (event) => {
    event.preventDefault();
    keys[keyName] = false;
  };

  element.addEventListener("pointerdown", start);
  element.addEventListener("pointerup", end);
  element.addEventListener("pointerleave", end);
  element.addEventListener("pointercancel", end);
}

bindHoldControl(leftControl, "left");
bindHoldControl(rightControl, "right");
fireControl.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (!state.gameOver) {
    shootPlayerBullet();
  }
});

resetGame();
state.animationId = window.requestAnimationFrame(tick);
