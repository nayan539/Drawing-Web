const clearBtn = document.querySelector(".clear-btn");
const sizeInput = document.querySelector(".size-range");
const colorInput = document.querySelector(".color input");
const bgColorInput = document.querySelector(".background input");
const penBtn = document.querySelector(".pen-box");
const eraseBtn = document.querySelector(".eraser-box");
const canvas = document.getElementById("canvas");
const toolTypeLabel = document.querySelector(".tool-type");

let isDrawing = false;
let isErasing = false;

const context = canvas.getContext("2d");

// Setup canvas on load
function styleCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.style.backgroundColor = bgColorInput.value;
    context.lineCap = "round";
    updateTool();
}

function updateTool() {
    context.lineWidth = sizeInput.value;
    context.strokeStyle = isErasing ? bgColorInput.value : colorInput.value;
    toolTypeLabel.textContent = isErasing ? "Eraser" : "Pen";
}

function getXY(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function startDrawing(e) {
    isDrawing = true;
    const { x, y } = getXY(e);
    context.beginPath();
    context.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    const { x, y } = getXY(e);
    context.lineTo(x, y);
    context.stroke();
}

function stopDrawing() {
    isDrawing = false;
    context.closePath();
}

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

canvas.addEventListener("touchstart", startDrawing);
canvas.addEventListener("touchmove", draw);
canvas.addEventListener("touchend", stopDrawing);

clearBtn.addEventListener("click", () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.backgroundColor = bgColorInput.value;
});

sizeInput.addEventListener("input", updateTool);
colorInput.addEventListener("input", () => { if (!isErasing) updateTool(); });
bgColorInput.addEventListener("input", () => {
    canvas.style.backgroundColor = bgColorInput.value;
    if (isErasing) updateTool();
});

penBtn.addEventListener("click", () => {
    isErasing = false;
    updateTool();
});

eraseBtn.addEventListener("click", () => {
    isErasing = true;
    updateTool();
});

window.onload = styleCanvas;
