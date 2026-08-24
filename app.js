const canvas = document.querySelector('#drawing-canvas');
const ctx = canvas.getContext('2d');
const canvasWrap = document.querySelector('.canvas-wrap');
const hint = document.querySelector('#canvas-hint');
const resultCard = document.querySelector('#result-card');
const statusText = document.querySelector('#status-text');
const instruction = document.querySelector('#instruction');
const scoreValue = document.querySelector('#score-value');
const scoreProgress = document.querySelector('#score-progress');
const centerValue = document.querySelector('#center-value');
const radiusValue = document.querySelector('#radius-value');
const resultMessage = document.querySelector('#result-message');
const resultDetail = document.querySelector('#result-detail');
const pointCount = document.querySelector('#point-count');
const bestScore = document.querySelector('#best-score');

let points = [];
let drawing = false;
let activePointer = null;
let fittedCircle = null;
let best = Number(sessionStorage.getItem('circle-craft-best') || 0);
bestScore.textContent = best ? `${best}%` : '—';

function resizeCanvas() {
  const rect = canvasWrap.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  redraw();
}

function position(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function strokePath(path, color = '#6557dd', width = 4) {
  if (path.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  path.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.linecap = 'round';
  ctx.linejoin = 'round';
  ctx.stroke();
}

function redraw(circle = fittedCircle) {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  strokePath(points);
  if (circle) {
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#62d9bb';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#62d9bb';
    ctx.fill();
  }
}

// Algebraic least-squares circle fit: x² + y² + Ax + By + C = 0.
function fitCircle(path) {
  const n = path.length;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  path.forEach(({ x, y }) => {
    const z = x * x + y * y;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    sxz += x * z; syz += y * z; sz += z;
  });
  const matrix = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const values = [-sxz, -syz, -sz];
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    if (Math.abs(matrix[pivot][col]) < 1e-8) return null;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    [values[col], values[pivot]] = [values[pivot], values[col]];
    for (let row = col + 1; row < 3; row += 1) { const factor = matrix[row][col] / matrix[col][col]; for (let k = col; k < 3; k += 1) matrix[row][k] -= factor * matrix[col][k]; values[row] -= factor * values[col]; }
  }
  const answer = [0, 0, 0];
  for (let row = 2; row >= 0; row -= 1) answer[row] = (values[row] - matrix[row].slice(row + 1).reduce((sum, value, i) => sum + value * answer[row + i + 1], 0)) / matrix[row][row];
  const [a, b, c] = answer;
  const x = -a / 2, y = -b / 2, radiusSquared = x * x + y * y - c;
  return radiusSquared > 0 ? { x, y, radius: Math.sqrt(radiusSquared) } : null;
}

function evaluate(path, circle) {
  const distances = path.map((p) => Math.hypot(p.x - circle.x, p.y - circle.y));
  const rms = Math.sqrt(distances.reduce((sum, d) => sum + (d - circle.radius) ** 2, 0) / distances.length);
  const startEnd = Math.hypot(path[0].x - path.at(-1).x, path[0].y - path.at(-1).y);
  const closure = Math.min(startEnd / Math.max(circle.radius, 1), 1);
  const angles = path.map((p) => Math.atan2(p.y - circle.y, p.x - circle.x)).sort((a, b) => a - b);
  const largestGap = angles.reduce((max, angle, i) => Math.max(max, (angles[(i + 1) % angles.length] + (i === angles.length - 1 ? Math.PI * 2 : 0)) - angle), 0);
  const coveragePenalty = Math.max(0, largestGap / (Math.PI * 2) - .1);
  const shapeError = rms / circle.radius;
  return Math.round(Math.max(0, Math.min(100, 100 * (1 - shapeError * 3.3 - closure * .18 - coveragePenalty * .6))));
}

function reveal(circle, score) {
  fittedCircle = circle;
  redraw(circle);
  const message = score >= 92 ? 'Excellent!' : score >= 80 ? 'Great!' : score >= 62 ? 'Good attempt!' : 'Try again!';
  const detail = score >= 80 ? 'That was wonderfully round. Can you beat your best score?' : 'The mint line is your best-fit circle—compare it with your stroke.';
  resultMessage.textContent = message;
  resultDetail.textContent = detail;
  scoreValue.textContent = `${score}%`;
  centerValue.textContent = `(${Math.round(circle.x)}, ${Math.round(circle.y)})`;
  radiusValue.textContent = `${Math.round(circle.radius)} px`;
  resultCard.classList.remove('revealed');
  void resultCard.offsetWidth;
  resultCard.classList.add('revealed');
  requestAnimationFrame(() => { scoreProgress.style.strokeDashoffset = String(320.44 * (1 - score / 100)); });
  if (score > best) { best = score; sessionStorage.setItem('circle-craft-best', best); bestScore.textContent = `${best}%`; }
}

function finish() {
  drawing = false;
  canvas.releasePointerCapture?.(activePointer);
  activePointer = null;
  if (points.length < 16) { statusText.textContent = 'DRAW A LITTLE MORE'; instruction.textContent = 'Try a larger, smoother circle'; return; }
  const circle = fitCircle(points);
  if (!circle || circle.radius < 20) { statusText.textContent = 'TRY AGAIN'; return; }
  const score = evaluate(points, circle);
  statusText.textContent = 'RESULT READY';
  instruction.textContent = 'Here’s your best-fit circle';
  reveal(circle, score);
}

canvas.addEventListener('pointerdown', (event) => {
  if (drawing) return;
  event.preventDefault();
  points = [position(event)]; fittedCircle = null; drawing = true; activePointer = event.pointerId;
  canvas.setPointerCapture?.(activePointer); hint.classList.add('hidden');
  resultCard.classList.remove('revealed'); scoreProgress.style.strokeDashoffset = '320.44';
  statusText.textContent = 'KEEP GOING'; instruction.textContent = 'Draw a circle in one motion'; pointCount.textContent = '1 point'; redraw();
});
canvas.addEventListener('pointermove', (event) => {
  if (!drawing || event.pointerId !== activePointer) return;
  event.preventDefault();
  const next = position(event); const last = points.at(-1);
  if (Math.hypot(next.x - last.x, next.y - last.y) > 1.5) { points.push(next); strokePath([last, next]); pointCount.textContent = `${points.length} points`; }
});
canvas.addEventListener('pointerup', (event) => { if (drawing && event.pointerId === activePointer) finish(); });
canvas.addEventListener('pointercancel', () => { drawing = false; activePointer = null; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
document.querySelector('#try-again').addEventListener('click', () => { points = []; fittedCircle = null; hint.classList.remove('hidden'); statusText.textContent = 'READY WHEN YOU ARE'; instruction.textContent = 'Draw a circle in one motion'; pointCount.textContent = '0 points'; scoreValue.textContent = '0%'; centerValue.textContent = '—'; radiusValue.textContent = '—'; resultMessage.textContent = 'Ready to draw?'; resultDetail.textContent = 'Complete a circle and we’ll find the best-fit centre and radius.'; resultCard.classList.remove('revealed'); scoreProgress.style.strokeDashoffset = '320.44'; redraw(); });
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
