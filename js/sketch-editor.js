(() => {
  const DEFAULT_ROOM = { widthCm: 300, heightCm: 250 };
  const ITEM_TYPES = {
    door: { label: "კარი", color: "#e4a72e", width: 0.18, height: 0.055 },
    window: { label: "ფანჯარა", color: "#3182ce", width: 0.22, height: 0.045 },
    shower: { label: "დუშთასე", color: "#22a6b3", width: 0.3, height: 0.24 },
    toilet: { label: "ტუალეტი", color: "#805ad5", width: 0.16, height: 0.22 },
    sink: { label: "ხელსაბანი", color: "#209486", width: 0.2, height: 0.14 },
    radiator: { label: "რადიატორი", color: "#d65353", width: 0.18, height: 0.07 },
    glass: { label: "შუშა ESG", color: "#718096", width: 0.25, height: 0.035 },
    outerNiche: { label: "უჯრა გარეთ", color: "#dd6b20", width: 0.2, height: 0.11 },
    innerNiche: { label: "უჯრა შიგნით", color: "#9c6b30", width: 0.2, height: 0.11 },
    floorFill: { label: "იატაკის ამოვსება", color: "#5a9d55", width: 0.34, height: 0.22 }
  };

  const els = {};
  let model = emptyModel();
  let originalModel = emptyModel();
  let selectedId = null;
  let drag = null;
  let callbacks = {};
  let resizeObserver = null;

  function emptyModel() {
    return {
      widthCm: DEFAULT_ROOM.widthCm,
      heightCm: DEFAULT_ROOM.heightCm,
      items: []
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(data) {
    const source = data && typeof data === "object" ? data : {};
    return {
      widthCm: clampNumber(source.widthCm, 100, 1500, DEFAULT_ROOM.widthCm),
      heightCm: clampNumber(source.heightCm, 100, 1500, DEFAULT_ROOM.heightCm),
      items: Array.isArray(source.items)
        ? source.items
            .filter((item) => ITEM_TYPES[item.type])
            .map((item) => ({
              id: item.id || crypto.randomUUID(),
              type: item.type,
              x: clampNumber(item.x, 0, 1, 0.5),
              y: clampNumber(item.y, 0, 1, 0.5),
              rotation: Number(item.rotation) === 90 ? 90 : 0
            }))
        : []
    };
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function hasContent(data) {
    const sketch = normalize(data);
    return (
      sketch.items.length > 0 ||
      sketch.widthCm !== DEFAULT_ROOM.widthCm ||
      sketch.heightCm !== DEFAULT_ROOM.heightCm
    );
  }

  function cacheElements() {
    els.dialog = document.querySelector("#sketchDialog");
    els.canvas = document.querySelector("#sketchCanvas");
    els.openBtn = document.querySelector("#openSketchBtn");
    els.closeBtn = document.querySelector("#closeSketchBtn");
    els.cancelBtn = document.querySelector("#cancelSketchBtn");
    els.saveBtn = document.querySelector("#saveSketchBtn");
    els.clearBtn = document.querySelector("#clearSketchBtn");
    els.rotateBtn = document.querySelector("#rotateSketchItemBtn");
    els.deleteBtn = document.querySelector("#deleteSketchItemBtn");
    els.palette = document.querySelector("#sketchPalette");
    els.widthInput = document.querySelector("#roomWidthInput");
    els.heightInput = document.querySelector("#roomHeightInput");
  }

  function init(options = {}) {
    cacheElements();
    callbacks = options;
    if (!els.dialog || !els.canvas) return;

    els.openBtn?.addEventListener("click", () => open(callbacks.getData?.()));
    els.closeBtn?.addEventListener("click", cancel);
    els.cancelBtn?.addEventListener("click", cancel);
    els.saveBtn?.addEventListener("click", save);
    els.clearBtn?.addEventListener("click", clear);
    els.rotateBtn?.addEventListener("click", rotateSelected);
    els.deleteBtn?.addEventListener("click", deleteSelected);
    els.palette?.addEventListener("click", handlePaletteClick);
    els.widthInput?.addEventListener("input", updateRoomSize);
    els.heightInput?.addEventListener("input", updateRoomSize);

    els.canvas.addEventListener("pointerdown", pointerDown);
    els.canvas.addEventListener("pointermove", pointerMove);
    els.canvas.addEventListener("pointerup", pointerUp);
    els.canvas.addEventListener("pointercancel", pointerUp);

    resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(els.canvas);
    updateSelectionActions();
  }

  function open(data) {
    model = normalize(data);
    originalModel = clone(model);
    selectedId = null;
    els.widthInput.value = model.widthCm;
    els.heightInput.value = model.heightCm;
    updateSelectionActions();

    if (typeof els.dialog.showModal === "function") {
      els.dialog.showModal();
    } else {
      els.dialog.setAttribute("open", "");
    }
    document.body.style.overflow = "hidden";
    requestAnimationFrame(render);
  }

  function close() {
    if (typeof els.dialog.close === "function") els.dialog.close();
    else els.dialog.removeAttribute("open");
    document.body.style.overflow = "";
  }

  function cancel() {
    model = clone(originalModel);
    selectedId = null;
    close();
  }

  function save() {
    model = normalize(model);
    callbacks.setData?.(clone(model));
    callbacks.onSave?.(clone(model), createImage(model));
    close();
  }

  function clear() {
    model = emptyModel();
    selectedId = null;
    els.widthInput.value = model.widthCm;
    els.heightInput.value = model.heightCm;
    updateSelectionActions();
    render();
  }

  function updateRoomSize() {
    model.widthCm = clampNumber(els.widthInput.value, 100, 1500, DEFAULT_ROOM.widthCm);
    model.heightCm = clampNumber(els.heightInput.value, 100, 1500, DEFAULT_ROOM.heightCm);
    render();
  }

  function handlePaletteClick(event) {
    const button = event.target.closest("[data-sketch-type]");
    if (!button) return;
    const type = button.dataset.sketchType;
    if (!ITEM_TYPES[type]) return;

    const positions = [
      [0.25, 0.25],
      [0.5, 0.25],
      [0.75, 0.25],
      [0.25, 0.5],
      [0.5, 0.5],
      [0.75, 0.5],
      [0.25, 0.75],
      [0.5, 0.75],
      [0.75, 0.75]
    ];
    const [x, y] = positions[model.items.length % positions.length];
    const item = {
      id: crypto.randomUUID(),
      type,
      x,
      y,
      rotation: 0
    };
    model.items.push(item);
    selectedId = item.id;
    updateSelectionActions();
    render();
  }

  function rotateSelected() {
    const item = getSelected();
    if (!item) return;
    item.rotation = item.rotation === 90 ? 0 : 90;
    render();
  }

  function deleteSelected() {
    if (!selectedId) return;
    model.items = model.items.filter((item) => item.id !== selectedId);
    selectedId = null;
    updateSelectionActions();
    render();
  }

  function getSelected() {
    return model.items.find((item) => item.id === selectedId) || null;
  }

  function updateSelectionActions() {
    const disabled = !getSelected();
    if (els.rotateBtn) els.rotateBtn.disabled = disabled;
    if (els.deleteBtn) els.deleteBtn.disabled = disabled;
  }

  function pointerDown(event) {
    const view = getView(els.canvas);
    const point = pointerPoint(event, view);
    const item = hitTest(point, view);
    selectedId = item?.id || null;
    updateSelectionActions();

    if (item) {
      drag = {
        id: item.id,
        dx: point.x - item.x,
        dy: point.y - item.y
      };
      els.canvas.setPointerCapture(event.pointerId);
      els.canvas.classList.add("is-dragging");
    }
    render();
  }

  function pointerMove(event) {
    if (!drag) return;
    const view = getView(els.canvas);
    const point = pointerPoint(event, view);
    const item = model.items.find((entry) => entry.id === drag.id);
    if (!item) return;

    const size = getItemSize(item);
    item.x = Math.min(1 - size.width / 2, Math.max(size.width / 2, point.x - drag.dx));
    item.y = Math.min(1 - size.height / 2, Math.max(size.height / 2, point.y - drag.dy));
    render();
  }

  function pointerUp(event) {
    if (drag && els.canvas.hasPointerCapture(event.pointerId)) {
      els.canvas.releasePointerCapture(event.pointerId);
    }
    drag = null;
    els.canvas.classList.remove("is-dragging");
  }

  function pointerPoint(event, view) {
    const rect = els.canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left - view.room.x) / view.room.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top - view.room.y) / view.room.height))
    };
  }

  function hitTest(point) {
    for (let index = model.items.length - 1; index >= 0; index -= 1) {
      const item = model.items[index];
      const size = getItemSize(item);
      if (
        point.x >= item.x - size.width / 2 &&
        point.x <= item.x + size.width / 2 &&
        point.y >= item.y - size.height / 2 &&
        point.y <= item.y + size.height / 2
      ) {
        return item;
      }
    }
    return null;
  }

  function getItemSize(item) {
    const config = ITEM_TYPES[item.type];
    return item.rotation === 90
      ? { width: config.height, height: config.width }
      : { width: config.width, height: config.height };
  }

  function getView(canvas, exportWidth, exportHeight) {
    const cssWidth = exportWidth || Math.max(320, canvas.clientWidth);
    const cssHeight = exportHeight || Math.max(320, canvas.clientHeight);
    const padding = exportWidth ? 80 : Math.max(42, Math.min(68, cssWidth * 0.08));
    const availableWidth = cssWidth - padding * 2;
    const availableHeight = cssHeight - padding * 2;
    const ratio = model.widthCm / model.heightCm;
    let roomWidth = availableWidth;
    let roomHeight = roomWidth / ratio;
    if (roomHeight > availableHeight) {
      roomHeight = availableHeight;
      roomWidth = roomHeight * ratio;
    }
    return {
      width: cssWidth,
      height: cssHeight,
      room: {
        x: (cssWidth - roomWidth) / 2,
        y: (cssHeight - roomHeight) / 2,
        width: roomWidth,
        height: roomHeight
      }
    };
  }

  function sizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context;
  }

  function render() {
    if (!els.canvas || !els.dialog.open) return;
    const context = sizeCanvas(els.canvas);
    const view = getView(els.canvas);
    draw(context, view, true);
  }

  function draw(context, view, interactive) {
    context.clearRect(0, 0, view.width, view.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, view.width, view.height);

    drawGrid(context, view.room);
    context.strokeStyle = "#111111";
    context.lineWidth = interactive ? 5 : 8;
    context.strokeRect(view.room.x, view.room.y, view.room.width, view.room.height);

    context.fillStyle = "#111111";
    context.font = `700 ${interactive ? 13 : 22}px "Segoe UI", Arial, sans-serif`;
    context.textAlign = "center";
    context.fillText(`${model.widthCm} სმ`, view.room.x + view.room.width / 2, view.room.y - (interactive ? 14 : 28));
    context.save();
    context.translate(view.room.x + view.room.width + (interactive ? 22 : 40), view.room.y + view.room.height / 2);
    context.rotate(Math.PI / 2);
    context.fillText(`${model.heightCm} სმ`, 0, 0);
    context.restore();

    model.items.forEach((item) => drawItem(context, view.room, item, interactive && item.id === selectedId, interactive));
  }

  function drawGrid(context, room) {
    const step = Math.max(18, Math.min(room.width, room.height) / 12);
    context.save();
    context.beginPath();
    context.rect(room.x, room.y, room.width, room.height);
    context.clip();
    context.strokeStyle = "#e5e9e8";
    context.lineWidth = 1;
    for (let x = room.x + step; x < room.x + room.width; x += step) {
      context.beginPath();
      context.moveTo(x, room.y);
      context.lineTo(x, room.y + room.height);
      context.stroke();
    }
    for (let y = room.y + step; y < room.y + room.height; y += step) {
      context.beginPath();
      context.moveTo(room.x, y);
      context.lineTo(room.x + room.width, y);
      context.stroke();
    }
    context.restore();
  }

  function drawItem(context, room, item, selected, interactive) {
    const config = ITEM_TYPES[item.type];
    const size = getItemSize(item);
    const width = room.width * size.width;
    const height = room.height * size.height;
    const x = room.x + room.width * item.x - width / 2;
    const y = room.y + room.height * item.y - height / 2;

    context.save();
    context.fillStyle = hexToRgba(config.color, item.type === "floorFill" ? 0.42 : 0.78);
    context.strokeStyle = selected ? "#111111" : config.color;
    context.lineWidth = selected ? (interactive ? 4 : 6) : (interactive ? 2.5 : 4);

    if (item.type === "toilet" || item.type === "sink") {
      context.beginPath();
      context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    } else if (item.type === "glass") {
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
      context.beginPath();
      context.moveTo(x + width * 0.2, y);
      context.lineTo(x + width * 0.35, y + height);
      context.moveTo(x + width * 0.55, y);
      context.lineTo(x + width * 0.7, y + height);
      context.stroke();
    } else if (item.type === "floorFill") {
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
      context.strokeStyle = config.color;
      context.lineWidth = interactive ? 1.5 : 3;
      for (let offset = -height; offset < width; offset += Math.max(10, width / 8)) {
        context.beginPath();
        context.moveTo(x + Math.max(0, offset), y + Math.max(0, -offset));
        context.lineTo(x + Math.min(width, offset + height), y + Math.min(height, height + offset));
        context.stroke();
      }
    } else {
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
    }

    const fontSize = interactive ? Math.max(9, Math.min(13, width / 8)) : Math.max(16, Math.min(24, width / 8));
    context.fillStyle = "#101817";
    context.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    drawWrappedText(context, config.label, x + width / 2, y + height / 2, Math.max(width - 8, 40), fontSize * 1.05);
    context.restore();
  }

  function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((entry, index) => context.fillText(entry, x, startY + index * lineHeight));
  }

  function hexToRgba(hex, alpha) {
    const value = hex.replace("#", "");
    const number = Number.parseInt(value, 16);
    const red = (number >> 16) & 255;
    const green = (number >> 8) & 255;
    const blue = number & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function createImage(data) {
    model = normalize(data || model);
    if (!hasContent(model)) return "";
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 1000;
    const context = canvas.getContext("2d");
    const view = getView(canvas, canvas.width, canvas.height);
    draw(context, view, false);
    return canvas.toDataURL("image/png", 0.95);
  }

  window.BathroomSketch = {
    init,
    open,
    hasContent,
    createImage,
    emptyModel
  };
})();
