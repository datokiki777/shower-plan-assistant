(() => {
  const DEFAULT_ROOM = { widthCm: 300, heightCm: 250 };
  const ITEM_TYPES = {
    door: { label: "კარი", color: "#c79a45", widthCm: 80, heightCm: 10 },
    window: { label: "ფანჯარა", color: "#5b8db8", widthCm: 100, heightCm: 10 },
    shower: { label: "დუშთასე", color: "#5ca8ad", widthCm: 120, heightCm: 90 },
    toilet: { label: "ტუალეტი", color: "#8b78b5", widthCm: 40, heightCm: 65 },
    sink: { label: "ხელსაბანი", color: "#4f968d", widthCm: 60, heightCm: 45 },
    radiator: { label: "რადიატორი", color: "#bd6b6b", widthCm: 80, heightCm: 15 },
    glass: { label: "შუშა (ESG)", color: "#7d8b96", widthCm: 100, heightCm: 2 },
    outerNiche: { label: "უჯრა გარეთ", color: "#c48454", widthCm: 60, heightCm: 30 },
    innerNiche: { label: "უჯრა შიგნით", color: "#9d7a51", widthCm: 60, heightCm: 30 },
    floorFill: { label: "იატაკის ამოვსება", color: "#79a471", widthCm: 120, heightCm: 90 }
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
              rotation: Number(item.rotation) === 90 ? 90 : 0,
              widthCm: clampNumber(item.widthCm, 2, 1500, ITEM_TYPES[item.type].widthCm),
              heightCm: clampNumber(item.heightCm, 2, 1500, ITEM_TYPES[item.type].heightCm)
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
    els.sizeTitle = document.querySelector("#sketchSizeTitle");
    els.sizeHint = document.querySelector("#sketchSizeHint");
    els.widthLabel = document.querySelector("#sketchWidthLabel");
    els.heightLabel = document.querySelector("#sketchHeightLabel");
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
    els.widthInput?.addEventListener("input", updateActiveSize);
    els.heightInput?.addEventListener("input", updateActiveSize);

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
    updateSelection(null);

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
    updateSelection(null);
    render();
  }

  function updateActiveSize() {
    const item = getSelected();
    if (item) {
      const maxWidth = item.rotation === 90 ? model.heightCm : model.widthCm;
      const maxHeight = item.rotation === 90 ? model.widthCm : model.heightCm;
      item.widthCm = clampNumber(els.widthInput.value, 2, maxWidth, item.widthCm);
      item.heightCm = clampNumber(els.heightInput.value, 2, maxHeight, item.heightCm);
      keepItemInsideRoom(item);
    } else {
      model.widthCm = clampNumber(els.widthInput.value, 100, 1500, DEFAULT_ROOM.widthCm);
      model.heightCm = clampNumber(els.heightInput.value, 100, 1500, DEFAULT_ROOM.heightCm);
      model.items.forEach(keepItemInsideRoom);
    }
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
      rotation: 0,
      widthCm: ITEM_TYPES[type].widthCm,
      heightCm: ITEM_TYPES[type].heightCm
    };
    model.items.push(item);
    updateSelection(item.id);
    render();
  }

  function rotateSelected() {
    const item = getSelected();
    if (!item) return;
    item.rotation = item.rotation === 90 ? 0 : 90;
    keepItemInsideRoom(item);
    syncSizeControls();
    render();
  }

  function deleteSelected() {
    if (!selectedId) return;
    model.items = model.items.filter((item) => item.id !== selectedId);
    updateSelection(null);
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

  function updateSelection(id) {
    selectedId = id;
    updateSelectionActions();
    syncSizeControls();
  }

  function syncSizeControls() {
    const item = getSelected();
    if (item) {
      const config = ITEM_TYPES[item.type];
      els.sizeTitle.textContent = `${config.label} - ზომა`;
      els.sizeHint.textContent = "ჩაწერე ზომა ან ნახაზზე კუთხის მრგვალი სახელური მოქაჩე.";
      els.widthLabel.textContent = item.type === "glass" ? "სიგრძე (სმ)" : "სიგანე (სმ)";
      els.heightLabel.textContent = item.type === "glass" ? "ხაზის სისქე (სმ)" : "სიგრძე (სმ)";
      els.widthInput.min = "2";
      els.heightInput.min = "2";
      els.widthInput.max = String(item.rotation === 90 ? model.heightCm : model.widthCm);
      els.heightInput.max = String(item.rotation === 90 ? model.widthCm : model.heightCm);
      els.widthInput.value = Math.round(item.widthCm);
      els.heightInput.value = Math.round(item.heightCm);
      return;
    }

    els.sizeTitle.textContent = "ოთახის ზომა";
    els.sizeHint.textContent = "ცარიელ ადგილზე დაჭერით ოთახის ზომებზე დაბრუნდები.";
    els.widthLabel.textContent = "სიგანე (სმ)";
    els.heightLabel.textContent = "სიგრძე (სმ)";
    els.widthInput.min = "100";
    els.heightInput.min = "100";
    els.widthInput.max = "1500";
    els.heightInput.max = "1500";
    els.widthInput.value = Math.round(model.widthCm);
    els.heightInput.value = Math.round(model.heightCm);
  }

  function pointerDown(event) {
    event.preventDefault();
    const view = getView(els.canvas);
    const point = pointerPoint(event, view);
    const selected = getSelected();

    if (selected && hitResizeHandle(event, view, selected)) {
      drag = { mode: "resize", id: selected.id };
      els.canvas.setPointerCapture(event.pointerId);
      els.canvas.classList.add("is-dragging");
      return;
    }

    const item = hitTest(point, view);
    updateSelection(item?.id || null);

    if (item) {
      drag = {
        mode: "move",
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
    event.preventDefault();
    const view = getView(els.canvas);
    const point = pointerPoint(event, view);
    const item = model.items.find((entry) => entry.id === drag.id);
    if (!item) return;

    if (drag.mode === "resize") {
      const visualWidthCm = clampNumber(Math.abs(point.x - item.x) * 2 * model.widthCm, 2, model.widthCm, item.widthCm);
      const visualHeightCm = clampNumber(Math.abs(point.y - item.y) * 2 * model.heightCm, 2, model.heightCm, item.heightCm);
      if (item.rotation === 90) {
        item.widthCm = visualHeightCm;
        item.heightCm = visualWidthCm;
      } else {
        item.widthCm = visualWidthCm;
        item.heightCm = visualHeightCm;
      }
      keepItemInsideRoom(item);
      syncSizeControls();
    } else {
      item.x = point.x - drag.dx;
      item.y = point.y - drag.dy;
      keepItemInsideRoom(item);
    }
    render();
  }

  function pointerUp(event) {
    event.preventDefault();
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

  function hitTest(point, view) {
    for (let index = model.items.length - 1; index >= 0; index -= 1) {
      const item = model.items[index];
      const size = getItemSize(item);
      const width = Math.max(size.width, 20 / view.room.width);
      const height = Math.max(size.height, 20 / view.room.height);
      if (
        point.x >= item.x - width / 2 &&
        point.x <= item.x + width / 2 &&
        point.y >= item.y - height / 2 &&
        point.y <= item.y + height / 2
      ) {
        return item;
      }
    }
    return null;
  }

  function getItemSize(item) {
    const width = Math.min(1, item.widthCm / model.widthCm);
    const height = Math.min(1, item.heightCm / model.heightCm);
    return item.rotation === 90
      ? { width: height, height: width }
      : { width, height };
  }

  function keepItemInsideRoom(item) {
    const maxWidth = item.rotation === 90 ? model.heightCm : model.widthCm;
    const maxHeight = item.rotation === 90 ? model.widthCm : model.heightCm;
    item.widthCm = Math.min(item.widthCm, maxWidth);
    item.heightCm = Math.min(item.heightCm, maxHeight);
    const size = getItemSize(item);
    item.x = Math.min(1 - size.width / 2, Math.max(size.width / 2, item.x));
    item.y = Math.min(1 - size.height / 2, Math.max(size.height / 2, item.y));
  }

  function hitResizeHandle(event, view, item) {
    const handle = getResizeHandle(view.room, item);
    const rect = els.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return Math.hypot(x - handle.x, y - handle.y) <= 18;
  }

  function getResizeHandle(room, item) {
    const size = getItemSize(item);
    return {
      x: room.x + room.width * (item.x + size.width / 2),
      y: room.y + room.height * (item.y + size.height / 2)
    };
  }

  function getView(canvas, exportWidth, exportHeight) {
    const cssWidth = exportWidth || Math.max(320, canvas.clientWidth);
    const cssHeight = exportHeight || Math.max(320, canvas.clientHeight);
    const padding = exportWidth ? 80 : Math.max(42, Math.min(68, cssWidth * 0.08));
    const legendHeight = estimateLegendHeight(cssWidth - padding * 2, Boolean(exportWidth));
    const availableWidth = cssWidth - padding * 2;
    const availableHeight = cssHeight - padding * 2 - legendHeight;
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
        y: padding + (availableHeight - roomHeight) / 2,
        width: roomWidth,
        height: roomHeight
      },
      legendY: cssHeight - padding - legendHeight + (exportWidth ? 22 : 12),
      legendWidth: availableWidth
    };
  }

  function getLegendEntries() {
    const used = new Set(model.items.map((item) => item.type));
    return Object.entries(ITEM_TYPES)
      .filter(([type]) => used.has(type))
      .map(([type, config]) => ({ type, ...config }));
  }

  function estimateLegendHeight(width, isExport) {
    const entries = getLegendEntries();
    if (!entries.length) return 0;
    const fontSize = isExport ? 21 : 12;
    const rowHeight = isExport ? 38 : 25;
    const swatch = isExport ? 22 : 13;
    let rows = 1;
    let usedWidth = 0;
    entries.forEach((entry) => {
      const itemWidth = swatch + 10 + entry.label.length * fontSize * 0.58 + (isExport ? 28 : 18);
      if (usedWidth && usedWidth + itemWidth > width) {
        rows += 1;
        usedWidth = itemWidth;
      } else {
        usedWidth += itemWidth;
      }
    });
    return rows * rowHeight + (isExport ? 22 : 14);
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
    context.lineWidth = interactive ? 3 : 5;
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
    drawLegend(context, view, interactive);
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
    context.fillStyle = hexToRgba(config.color, item.type === "floorFill" ? 0.2 : 0.4);
    context.strokeStyle = config.color;
    context.lineWidth = interactive ? 1.5 : 2.5;

    if (item.type === "toilet" || item.type === "sink") {
      context.beginPath();
      context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    } else if (item.type === "glass") {
      context.beginPath();
      context.lineWidth = interactive ? 3 : 5;
      if (item.rotation === 90) {
        context.moveTo(x + width / 2, y);
        context.lineTo(x + width / 2, y + height);
      } else {
        context.moveTo(x, y + height / 2);
        context.lineTo(x + width, y + height / 2);
      }
      context.stroke();
    } else if (item.type === "floorFill") {
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
      context.strokeStyle = config.color;
      context.lineWidth = interactive ? 1 : 2;
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

    if (selected && interactive) {
      context.strokeStyle = "#17211f";
      context.lineWidth = 1.5;
      context.setLineDash([6, 4]);
      context.strokeRect(x - 4, y - 4, width + 8, height + 8);
      context.setLineDash([]);
      const handle = getResizeHandle(room, item);
      context.fillStyle = "#ffffff";
      context.strokeStyle = "#17211f";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(handle.x, handle.y, 7, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  function drawLegend(context, view, interactive) {
    const entries = getLegendEntries();
    if (!entries.length) return;
    const fontSize = interactive ? 12 : 21;
    const rowHeight = interactive ? 25 : 38;
    const swatch = interactive ? 13 : 22;
    let x = view.room.x;
    let y = view.legendY;

    context.save();
    context.font = `700 ${fontSize}px "Segoe UI", Arial, sans-serif`;
    context.textAlign = "left";
    context.textBaseline = "middle";

    entries.forEach((entry) => {
      const textWidth = context.measureText(entry.label).width;
      const itemWidth = swatch + 10 + textWidth + (interactive ? 18 : 28);
      if (x > view.room.x && x + itemWidth > view.room.x + view.legendWidth) {
        x = view.room.x;
        y += rowHeight;
      }

      context.fillStyle = hexToRgba(entry.color, 0.5);
      context.strokeStyle = entry.color;
      context.lineWidth = interactive ? 1 : 2;
      if (entry.type === "glass") {
        context.beginPath();
        context.moveTo(x, y + swatch / 2);
        context.lineTo(x + swatch, y + swatch / 2);
        context.stroke();
      } else {
        context.fillRect(x, y, swatch, swatch);
        context.strokeRect(x, y, swatch, swatch);
      }

      context.fillStyle = "#263835";
      context.fillText(entry.label, x + swatch + 8, y + swatch / 2);
      x += itemWidth;
    });
    context.restore();
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
