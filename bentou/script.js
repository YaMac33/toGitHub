const canvas = document.getElementById("sceneCanvas");
const context = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let width = 0;
let height = 0;
let pixelRatio = 1;
let pointerX = 0.5;
let pointerY = 0.5;
let animationFrame = 0;
const pieces = [];

function createPieces() {
  pieces.length = 0;
  const count = Math.max(16, Math.min(34, Math.round((width * height) / 52000)));
  const colors = ["#b63d2c", "#12836d", "#d99b26", "#314151", "#f3f0e8"];

  for (let index = 0; index < count; index += 1) {
    pieces.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 18 + Math.random() * 42,
      speed: 0.12 + Math.random() * 0.34,
      drift: -0.18 + Math.random() * 0.36,
      rotation: Math.random() * Math.PI,
      spin: -0.004 + Math.random() * 0.008,
      color: colors[index % colors.length],
      alpha: 0.08 + Math.random() * 0.1
    });
  }
}

function resizeCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  createPieces();
}

function drawTray(x, y, size, rotation, color, alpha) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.strokeStyle = "rgba(21, 32, 43, 0.14)";
  context.lineWidth = 1;

  const radius = size * 0.16;
  const trayWidth = size * 1.56;
  const trayHeight = size;
  const left = -trayWidth / 2;
  const top = -trayHeight / 2;

  drawRoundedRect(left, top, trayWidth, trayHeight, radius);
  context.fill();
  context.stroke();

  context.globalAlpha = alpha * 0.75;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(left + trayWidth * 0.32, top + trayHeight * 0.48, size * 0.22, 0, Math.PI * 2);
  context.arc(left + trayWidth * 0.68, top + trayHeight * 0.48, size * 0.22, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawRoundedRect(x, y, rectWidth, rectHeight, radius) {
  if (typeof context.roundRect === "function") {
    context.beginPath();
    context.roundRect(x, y, rectWidth, rectHeight, radius);
    return;
  }

  const right = x + rectWidth;
  const bottom = y + rectHeight;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fffdf8");
  gradient.addColorStop(0.48, "#eef5ed");
  gradient.addColorStop(1, "#f8efe1");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.55;
  context.strokeStyle = "rgba(21, 32, 43, 0.055)";
  context.lineWidth = 1;

  for (let x = -80; x < width + 120; x += 44) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + height * 0.26, height);
    context.stroke();
  }

  context.restore();
}

function render(time) {
  drawBackground();

  const pointerOffsetX = (pointerX - 0.5) * 18;
  const pointerOffsetY = (pointerY - 0.5) * 18;

  pieces.forEach((piece, index) => {
    const depth = 0.5 + (index % 5) * 0.12;
    const x = piece.x + pointerOffsetX * depth;
    const y = piece.y + pointerOffsetY * depth;
    drawTray(x, y, piece.size, piece.rotation, piece.color, piece.alpha);

    if (!prefersReducedMotion.matches) {
      piece.y += piece.speed;
      piece.x += piece.drift;
      piece.rotation += piece.spin;

      if (piece.y - piece.size > height + 60) {
        piece.y = -80;
        piece.x = Math.random() * width;
      }

      if (piece.x < -120) {
        piece.x = width + 80;
      } else if (piece.x > width + 120) {
        piece.x = -80;
      }
    }
  });

  if (!prefersReducedMotion.matches) {
    animationFrame = window.requestAnimationFrame(render);
  }
}

function startScene() {
  window.cancelAnimationFrame(animationFrame);
  render(0);

  if (!prefersReducedMotion.matches) {
    animationFrame = window.requestAnimationFrame(render);
  }
}

window.addEventListener("resize", () => {
  resizeCanvas();
  startScene();
});

window.addEventListener("pointermove", (event) => {
  pointerX = event.clientX / Math.max(width, 1);
  pointerY = event.clientY / Math.max(height, 1);
});

if (typeof prefersReducedMotion.addEventListener === "function") {
  prefersReducedMotion.addEventListener("change", startScene);
} else if (typeof prefersReducedMotion.addListener === "function") {
  prefersReducedMotion.addListener(startScene);
}

resizeCanvas();
startScene();
