// script.js (final fixed version - uses CSS-pixel canvas for reliable snapshot/preview)

// --- Element refs ---
const clearBtn = document.querySelector(".clear-btn");
const downloadBtn = document.querySelector(".download-btn") || document.querySelector(".download-png-btn");
const undoBtn = document.querySelector(".undo-btn");
const redoBtn = document.querySelector(".redo-btn");
const sizeInput = document.querySelector(".size-range");
const colorInput = document.querySelector(".color input");
const bgColorInput = document.querySelector(".background input");
const penBtn = document.querySelector(".pen-box");
const eraseBtn = document.querySelector(".eraser-box");
const textBtn = document.querySelector(".text-box");
const shapeSelect = document.querySelector(".shape-select");
const fillCheckbox = document.querySelector(".fill-checkbox");
const brushSelect = document.querySelector(".brush-select");
const pressureCheckbox = document.querySelector(".pressure-checkbox");
const smoothCheckbox = document.querySelector(".smooth-checkbox");
const gridCheckbox = document.querySelector(".grid-checkbox");
const importBtn = document.querySelector(".import-btn");
const importInput = document.querySelector(".import-input");
const saveProjectBtn = document.querySelector(".save-project-btn");
const loadProjectBtn = document.querySelector(".load-project-btn");
const loadInput = document.querySelector(".load-input");
const toolTypeLabel = document.querySelector(".tool-type");

const container = document.querySelector(".canvas-container");
const canvas = document.getElementById("canvas");
const gridCanvas = document.getElementById("grid");
const eraserCursor = document.querySelector(".eraser-cursor");
const ctx = canvas.getContext("2d");
const gctx = gridCanvas ? gridCanvas.getContext("2d") : null;

// --- State ---
let isDrawing = false;
let isErasing = false;
let isTextMode = false;
let tool = "free"; // free, line, rect, circle, triangle, arrow, star
let fillShape = false;
let brush = "pen"; // pen, pencil, marker, spray, calligraphy
let usePressure = false;
let useSmoothing = true;

let startX = 0, startY = 0;
let lastPoint = null;
let snapshot = null;        // ImageData snapshot for preview (CSS-pixel space)
let undoStack = [];
let redoStack = [];

// --- Canvas sizing (CSS pixels, no DPR scaling) ---
function getCssSize() {
  const rect = container.getBoundingClientRect();
  return { w: Math.max(1, Math.floor(rect.width)), h: Math.max(1, Math.floor(rect.height)) };
}

function setupCanvasSimple() {
  const { w, h } = getCssSize();
  // Use CSS pixels as canvas pixel size for simplicity and consistent getImageData/putImageData
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (gridCanvas && gctx) {
    gridCanvas.width = w;
    gridCanvas.height = h;
    gridCanvas.style.width = w + "px";
    gridCanvas.style.height = h + "px";
  }
}

function initCanvas() {
  setupCanvasSimple();
  const { w, h } = getCssSize();
  ctx.fillStyle = bgColorInput.value || "#ffffff";
  ctx.fillRect(0, 0, w, h);
  drawGrid();
  saveState();
}

function resizeKeepContent() {
  // Preserve image content by using toDataURL and redrawing after resize
  const data = canvas.toDataURL("image/png");
  setupCanvasSimple();
  const img = new Image();
  img.src = data;
  img.onload = () => {
    const { w, h } = getCssSize();
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
  };
  drawGrid();
}

// --- Grid overlay ---
function drawGrid() {
  if (!gridCanvas || !gctx) return;
  const { w, h } = getCssSize();
  gctx.clearRect(0, 0, w, h);
  if (!gridCheckbox || !gridCheckbox.checked) return;
  const gap = 25;
  gctx.strokeStyle = "rgba(0,0,0,0.06)";
  gctx.lineWidth = 1;
  for (let x = 0; x < w; x += gap) {
    gctx.beginPath(); gctx.moveTo(x + 0.5, 0); gctx.lineTo(x + 0.5, h); gctx.stroke();
  }
  for (let y = 0; y < h; y += gap) {
    gctx.beginPath(); gctx.moveTo(0, y + 0.5); gctx.lineTo(w, y + 0.5); gctx.stroke();
  }
}

// --- Undo / Redo ---
function saveState() {
  try {
    undoStack.push(canvas.toDataURL("image/png"));
    if (undoStack.length > 60) undoStack.shift();
    redoStack = [];
  } catch (e) {
    if (undoStack.length > 15) undoStack.shift();
  }
}
function restoreState(from, to) {
  if (!from.length) return;
  to.push(canvas.toDataURL());
  const img = new Image();
  img.src = from.pop();
  img.onload = () => {
    const { w, h } = getCssSize();
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
  };
}

// --- Utilities ---
function getXY(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches[0]) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  }
  return { x: (e.clientX ?? e.pageX) - rect.left, y: (e.clientY ?? e.pageY) - rect.top };
}

function updateTool() {
  ctx.lineWidth = Number(sizeInput.value || 5);
  ctx.strokeStyle = isErasing ? bgColorInput.value : colorInput.value;
  ctx.fillStyle = colorInput.value;
  toolTypeLabel && (toolTypeLabel.textContent = isErasing ? "Eraser" : (isTextMode ? "Text" : (tool === "free" ? "Pen" : "Shape")));
  updateEraserCursor(sizeInput.value);
  eraserCursor.style.display = isErasing ? "block" : "none";
  document.querySelectorAll(".tool-btn").forEach(b => b.classList && b.classList.remove("active"));
  if (isTextMode) textBtn && textBtn.classList.add("active");
  else if (isErasing) eraseBtn && eraseBtn.classList.add("active");
  else penBtn && penBtn.classList.add("active");
}

function updateEraserCursor(size) {
  const px = Number(size || 12);
  eraserCursor.style.width = px + "px";
  eraserCursor.style.height = px + "px";
}
function moveEraserCursor(e) {
  const { x, y } = getXY(e);
  eraserCursor.style.left = x + "px";
  eraserCursor.style.top = y + "px";
}

// --- Brushes ---
function setBrushComposite() {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  switch (brush) {
    case "pencil": ctx.globalAlpha = 0.75; ctx.globalCompositeOperation = "multiply"; break;
    case "marker": ctx.globalAlpha = 0.25; break;
    case "spray": ctx.globalAlpha = 1; break;
    case "calligraphy": ctx.globalAlpha = 1; break;
    default: ctx.globalAlpha = 1;
  }
}

function sprayAt(x, y, radius) {
  const density = Math.max(8, Math.round(radius * 1.5));
  ctx.fillStyle = colorInput.value;
  for (let i = 0; i < density; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    const dx = Math.cos(angle) * r;
    const dy = Math.sin(angle) * r;
    ctx.fillRect(x + dx, y + dy, 1, 1);
  }
}

function calligraphyStamp(from, to, size) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return;
  const steps = Math.max(1, Math.floor(dist / 2));
  const angle = Math.atan2(dy, dx);
  const long = size;
  const short = Math.max(2, size * 0.35);
  ctx.fillStyle = colorInput.value;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = from.x + (to.x - from.x) * t;
    const py = from.y + (to.y - from.y) * t;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle - Math.PI / 6);
    ctx.beginPath();
    ctx.ellipse(0, 0, long / 2, short / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSmoothedQuad(from, to) {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  ctx.quadraticCurveTo(from.x, from.y, mid.x, mid.y);
}

// --- Shapes ---
function drawShape(type, x1, y1, x2, y2) {
  const w = x2 - x1, h = y2 - y1;
  ctx.save();
  ctx.beginPath();
  if (type === "line") {
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if (type === "rect") {
    if (fillShape) ctx.fillRect(x1, y1, w, h);
    ctx.strokeRect(x1, y1, w, h);
  } else if (type === "circle") {
    const r = Math.hypot(w, h);
    ctx.beginPath();
    ctx.arc(x1, y1, r, 0, Math.PI * 2);
    if (fillShape) ctx.fill();
    ctx.stroke();
  } else if (type === "triangle") {
    ctx.moveTo(x1, y2); ctx.lineTo((x1 + x2) / 2, y1); ctx.lineTo(x2, y2);
    ctx.closePath();
    if (fillShape) ctx.fill();
    ctx.stroke();
  } else if (type === "arrow") {
    const headlen = 15;
    const dx = x2 - x1, dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2); ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  } else if (type === "star") {
    const spikes = 5;
    const outerRadius = Math.hypot(w, h);
    const innerRadius = outerRadius / 2.5;
    let rot = Math.PI / 2 * 3;
    const cx = x1, cy = y1;
    const step = Math.PI / spikes;
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.closePath();
    if (fillShape) ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// --- Text ---
function placeTextBox(e) {
  const { x, y } = getXY(e);
  const input = document.createElement("textarea");
  input.className = "canvas-text-input";
  input.style.left = x + "px";
  input.style.top = y + "px";
  input.style.color = colorInput.value;
  input.style.fontSize = sizeInput.value + "px";
  input.rows = 1;
  container.appendChild(input);
  input.focus();

  const commit = () => {
    const text = input.value;
    container.removeChild(input);
    if (!text.trim()) { isTextMode = false; updateTool(); return; }
    ctx.fillStyle = colorInput.value;
    ctx.font = `${parseInt(sizeInput.value, 10)}px Arial`;
    ctx.textBaseline = "top";
    ctx.fillText(text, x, y);
    saveState();
    isTextMode = false; updateTool();
  };

  const cancel = () => { container.removeChild(input); isTextMode = false; updateTool(); };

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); commit(); }
    else if (ev.key === "Escape") { ev.preventDefault(); cancel(); }
  });
  input.addEventListener("blur", commit);
}

// --- Core drawing flow (pointer events) ---
// IMPORTANT: snapshot is captured as ImageData in CSS-pixel coordinates (getImageData(0,0,canvas.width,canvas.height))
// On pointermove for shapes we always restore with putImageData(snapshot,0,0) then preview. Final shape drawn on pointerup.

function pointerDown(e) {
  if (e.button === 2) return;
  canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);

  if (isTextMode) return;

  isDrawing = true;
  const { x, y } = getXY(e);
  startX = x; startY = y;
  lastPoint = { x, y };

  // capture snapshot in CSS pixel space
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

  setBrushComposite();
  if (isErasing) { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = bgColorInput.value; ctx.fillStyle = bgColorInput.value; }
  else { ctx.strokeStyle = colorInput.value; ctx.fillStyle = colorInput.value; }

  if (tool === "free") {
    if (brush === "calligraphy") calligraphyStamp(lastPoint, { x: lastPoint.x + 0.01, y: lastPoint.y + 0.01 }, Number(sizeInput.value));
    else if (brush === "spray") sprayAt(x, y, Number(sizeInput.value) / 2);
    else { ctx.beginPath(); ctx.moveTo(x, y); }
  }

  if (isErasing) { eraserCursor.style.display = "block"; moveEraserCursor(e); }
}

function pointerMove(e) {
  if (isErasing) moveEraserCursor(e);
  if (!isDrawing) return;

  const { x, y } = getXY(e);
  let width = Number(sizeInput.value || 5);
  if (usePressure && typeof e.pressure === "number" && e.pressure > 0) width = Math.max(1, width * e.pressure);
  ctx.lineWidth = width;

  if (isErasing) { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = bgColorInput.value; ctx.fillStyle = bgColorInput.value; }
  else { ctx.strokeStyle = colorInput.value; ctx.fillStyle = colorInput.value; }

  if (tool === "free") {
    if (brush === "spray") sprayAt(x, y, width / 2);
    else if (brush === "calligraphy") calligraphyStamp(lastPoint, { x, y }, width);
    else {
      if (useSmoothing && lastPoint) {
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        drawSmoothedQuad(lastPoint, { x, y });
        ctx.stroke();
      } else {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  } else {
    // SHAPE PREVIEW: restore snapshot then draw preview
    ctx.putImageData(snapshot, 0, 0);
    drawShape(tool, startX, startY, x, y);
  }

  lastPoint = { x, y };
}

function pointerUp(e) {
  if (isErasing) eraserCursor.style.display = "none";
  if (!isDrawing) return;
  isDrawing = false;
  const { x, y } = getXY(e);

  if (tool === "free") {
    if (brush !== "spray" && brush !== "calligraphy") ctx.closePath();
  } else {
    // finalize shape once: restore snapshot then draw final
    ctx.putImageData(snapshot, 0, 0);
    drawShape(tool, startX, startY, x, y);
  }

  saveState();
  try { canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId); } catch (err) {}
}

// Attach pointer events
if (window.PointerEvent) {
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
} else {
  // fallback
  canvas.addEventListener("mousedown", pointerDown);
  canvas.addEventListener("mousemove", pointerMove);
  canvas.addEventListener("mouseup", pointerUp);
  canvas.addEventListener("touchstart", (e) => pointerDown(e), { passive: true });
  canvas.addEventListener("touchmove", (e) => pointerMove(e), { passive: true });
  canvas.addEventListener("touchend", (e) => pointerUp(e), { passive: true });
}

// --- UI handlers ---
clearBtn && clearBtn.addEventListener("click", () => {
  const { w, h } = getCssSize();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bgColorInput.value;
  ctx.fillRect(0, 0, w, h);
  saveState();
});

downloadBtn && downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "drawing.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

undoBtn && undoBtn.addEventListener("click", () => restoreState(undoStack, redoStack));
redoBtn && redoBtn.addEventListener("click", () => restoreState(redoStack, undoStack));

sizeInput && sizeInput.addEventListener("input", updateTool);
colorInput && colorInput.addEventListener("input", () => { if (!isErasing) updateTool(); });
bgColorInput && bgColorInput.addEventListener("input", () => {
  const { w, h } = getCssSize();
  const data = ctx.getImageData(0, 0, w, h);
  ctx.fillStyle = bgColorInput.value;
  ctx.fillRect(0, 0, w, h);
  ctx.putImageData(data, 0, 0);
  saveState();
});

penBtn && penBtn.addEventListener("click", () => { isErasing = false; isTextMode = false; updateTool(); });
eraseBtn && eraseBtn.addEventListener("click", () => { isErasing = true; isTextMode = false; tool = "free"; setBrushComposite(); updateTool(); });

textBtn && textBtn.addEventListener("click", () => {
  isTextMode = true; isErasing = false; tool = "free"; updateTool();
  canvas.addEventListener("click", placeTextBox, { once: true });
});

shapeSelect && shapeSelect.addEventListener("change", (e) => {
  tool = e.target.value;
  if (tool !== "free") { isErasing = false; isTextMode = false; updateTool(); }
});

fillCheckbox && fillCheckbox.addEventListener("change", (e) => { fillShape = e.target.checked; });
brushSelect && brushSelect.addEventListener("change", (e) => { brush = e.target.value; setBrushComposite(); });
pressureCheckbox && pressureCheckbox.addEventListener("change", (e) => { usePressure = e.target.checked; });
smoothCheckbox && smoothCheckbox.addEventListener("change", (e) => { useSmoothing = e.target.checked; });
gridCheckbox && gridCheckbox.addEventListener("change", drawGrid);

importBtn && importBtn.addEventListener("click", () => importInput && importInput.click());
importInput && importInput.addEventListener("change", () => {
  const file = importInput.files[0]; if (!file) return;
  const img = new Image(); const reader = new FileReader();
  reader.onload = () => { img.src = reader.result; };
  reader.readAsDataURL(file);
  img.onload = () => {
    const { w, h } = getCssSize();
    const scale = Math.min(w / img.width, h / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    const x = (w - iw) / 2, y = (h - ih) / 2;
    ctx.drawImage(img, x, y, iw, ih);
    saveState();
    importInput.value = "";
  };
});

saveProjectBtn && saveProjectBtn.addEventListener("click", () => {
  const project = { version: 1, background: bgColorInput.value, image: canvas.toDataURL("image/png") };
  const blob = new Blob([JSON.stringify(project)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = "project.json"; a.click(); URL.revokeObjectURL(url);
});

loadProjectBtn && loadProjectBtn.addEventListener("click", () => loadInput && loadInput.click());
loadInput && loadInput.addEventListener("change", () => {
  const file = loadInput.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const proj = JSON.parse(reader.result);
      const { w, h } = getCssSize();
      bgColorInput.value = proj.background || "#ffffff";
      ctx.fillStyle = bgColorInput.value; ctx.fillRect(0, 0, w, h);
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, w, h); saveState(); };
      img.src = proj.image;
    } catch (err) { alert("Invalid project file."); }
    loadInput.value = "";
  };
  reader.readAsText(file);
});

// Keyboard
window.addEventListener("keydown", (e) => {
  const z = (e.key === "z" || e.key === "Z"); const y = (e.key === "y" || e.key === "Y");
  if ((e.ctrlKey || e.metaKey) && z && !e.shiftKey) { e.preventDefault(); undoBtn && undoBtn.click(); }
  else if ((e.ctrlKey || e.metaKey) && (y || (z && e.shiftKey))) { e.preventDefault(); redoBtn && redoBtn.click(); }
});

// Resize
window.addEventListener("resize", resizeKeepContent);

// Init
window.addEventListener("load", () => {
  initCanvas();
  updateTool();
});
