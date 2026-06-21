(() => {
  const DEFAULT_ROOM = { widthCm: 300, heightCm: 250 };
  const ITEM_TYPES = {
    door: { label: "კარი", color: "#c79a45", widthCm: 80, heightCm: 10 },
    window: { label: "ფანჯარა", color: "#5b8db8", widthCm: 100, heightCm: 10 },
    shower: { label: "დუშთასე", color: "#5ca8ad", widthCm: 120, heightCm: 90 },
    toilet: { label: "ტუალეტი", color: "#8b78b5", widthCm: 40, heightCm: 65 },
    sink: { label: "ხელსაბანი", color: "#4f968d", widthCm: 60, heightCm: 45 },
    radiator: { label: "რადიატორი", color: "#bd6b6b", widthCm: 80, heightCm: 15 },
    glass: { label: "შუშა (ESG)", color: "#d55454", widthCm: 100, heightCm: 2 },
    glassDoor: { label: "შუშის კარი", color: "#e58b8b", widthCm: 80, heightCm: 2 },
    innerWall: { label: "შიდა კედელი", color: "#404846", widthCm: 120, heightCm: 8 },
    panelZone: { label: "პანელის ზონა", color: "#7596ad", widthCm: 120, heightCm: 180 },
    outerNiche: { label: "გარე უჯრა", color: "#c48454", widthCm: 60, heightCm: 30 },
    innerNiche: { label: "შიდა უჯრა", color: "#9d7a51", widthCm: 60, heightCm: 30 },
    floorFill: { label: "იატაკის ამოვსება", color: "#79a471", widthCm: 120, heightCm: 90 },
    brauseset: { label: "Brauseset", color: "#3979b7", widthCm: 16, heightCm: 16, sizing: "fixed" },
    regendusche: { label: "Regendusche", color: "#7867b8", widthCm: 20, heightCm: 20, sizing: "fixed" },
    mischbatterie: { label: "Mischbatterie", color: "#d18434", widthCm: 28, heightCm: 16, sizing: "fixed" },
    thermomischbatterie: { label: "Thermomischbatterie", color: "#b64f6c", widthCm: 30, heightCm: 17, sizing: "fixed" },
    haltegriff: { label: "Haltegriff", color: "#397f5d", widthCm: 60, heightCm: 8, sizing: "length" }
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
      note: "",
      items: []
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(data) {
    const source = data && typeof data === "object" ? data : {};
    const widthCm = clampNumber(source.widthCm, 100, 1500, DEFAULT_ROOM.widthCm);
    const heightCm = clampNumber(source.heightCm, 100, 1500, DEFAULT_ROOM.heightCm);
    return {
      widthCm,
      heightCm,
      note: String(source.note || "").trim(),
      items: Array.isArray(source.items)
        ? source.items
            .filter((item) => ITEM_TYPES[item.type])
            .map((item) => ({
              id: item.id || crypto.randomUUID(),
              type: item.type,
              x: clampNumber(item.x, 0, 1, 0.5),
              y: clampNumber(item.y, 0, 1, 0.5),
              rotation: normalizeRotation(item.rotation),
              widthCm: clampNumber(item.widthCm, 2, 1500, ITEM_TYPES[item.type].widthCm),
              heightCm: clampNumber(item.heightCm, 2, 1500, ITEM_TYPES[item.type].heightCm),
              wall: item.type === "door" ? normalizeDoorWall(item.wall, item.x, item.y) : null,
              wallTargetId: item.type === "door" ? item.wallTargetId || null : null,
              flip: item.type === "door" || item.type === "glassDoor" ? Boolean(item.flip) : false
            }))
            .map((item) => (
              item.type === "door" && !item.wallTargetId
                ? snapDoorToWall(item, item.wall, widthCm, heightCm)
                : item
            ))
        : []
    };
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeRotation(value) {
    const rotation = Math.round(Number(value) / 90) * 90;
    return ((rotation % 360) + 360) % 360;
  }

  function isVerticalRotation(item) {
    return item.rotation === 90 || item.rotation === 270;
  }

  function getSizingMode(item) {
    return ITEM_TYPES[item.type]?.sizing || "free";
  }

  function canResize(item) {
    return getSizingMode(item) !== "fixed";
  }

  function normalizeDoorWall(wall, x = 0.5, y = 0.5) {
    if (["top", "right", "bottom", "left"].includes(wall)) return wall;
    const distances = [
      ["top", y],
      ["right", 1 - x],
      ["bottom", 1 - y],
      ["left", x]
    ];
    distances.sort((a, b) => a[1] - b[1]);
    return distances[0][0];
  }

  function snapDoorToWall(
    item,
    wall = normalizeDoorWall(null, item.x, item.y),
    roomWidthCm = model.widthCm,
    roomHeightCm = model.heightCm
  ) {
    item.wall = wall;
    item.wallTargetId = null;
    item.rotation = wall === "left" || wall === "right" ? 90 : 0;
    const half = getDoorHalfSpan(item, wall, roomWidthCm, roomHeightCm);
    if (wall === "top" || wall === "bottom") {
      item.x = Math.min(1 - half, Math.max(half, item.x));
      item.y = wall === "top" ? 0 : 1;
    } else {
      item.x = wall === "left" ? 0 : 1;
      item.y = Math.min(1 - half, Math.max(half, item.y));
    }
    return item;
  }

  function snapDoorToNearestWall(item) {
    const candidates = [
      { distance: item.y * model.heightCm, kind: "outer", wall: "top" },
      { distance: (1 - item.x) * model.widthCm, kind: "outer", wall: "right" },
      { distance: (1 - item.y) * model.heightCm, kind: "outer", wall: "bottom" },
      { distance: item.x * model.widthCm, kind: "outer", wall: "left" }
    ];

    model.items
      .filter((entry) => entry.type === "innerWall" && entry.id !== item.id)
      .forEach((wallItem) => {
        const size = getItemSize(wallItem);
        const vertical = isVerticalRotation(wallItem);
        const minX = wallItem.x - size.width / 2;
        const maxX = wallItem.x + size.width / 2;
        const minY = wallItem.y - size.height / 2;
        const maxY = wallItem.y + size.height / 2;
        const closestX = Math.min(maxX, Math.max(minX, item.x));
        const closestY = Math.min(maxY, Math.max(minY, item.y));
        const dx = (item.x - closestX) * model.widthCm;
        const dy = (item.y - closestY) * model.heightCm;
        candidates.push({
          distance: Math.hypot(dx, dy),
          kind: "inner",
          wallItem,
          wall: vertical
            ? (item.x <= wallItem.x ? "right" : "left")
            : (item.y <= wallItem.y ? "bottom" : "top")
        });
      });

    candidates.sort((a, b) => a.distance - b.distance);
    const nearest = candidates[0];
    return nearest.kind === "inner"
      ? snapDoorToInnerWall(item, nearest.wallItem, nearest.wall)
      : snapDoorToWall(item, nearest.wall);
  }

  function snapDoorToInnerWall(item, wallItem, wall) {
    const wallSize = getItemSize(wallItem);
    const vertical = isVerticalRotation(wallItem);
    item.wall = wall;
    item.wallTargetId = wallItem.id;
    item.rotation = vertical ? 90 : 0;
    if (vertical) {
      const half = item.widthCm / model.heightCm / 2;
      const min = wallItem.y - wallSize.height / 2 + half;
      const max = wallItem.y + wallSize.height / 2 - half;
      item.x = wallItem.x;
      item.y = min <= max ? Math.min(max, Math.max(min, item.y)) : wallItem.y;
    } else {
      const half = item.widthCm / model.widthCm / 2;
      const min = wallItem.x - wallSize.width / 2 + half;
      const max = wallItem.x + wallSize.width / 2 - half;
      item.x = min <= max ? Math.min(max, Math.max(min, item.x)) : wallItem.x;
      item.y = wallItem.y;
    }
    return item;
  }

  function resnapDoor(item) {
    if (!item.wallTargetId) return snapDoorToWall(item, item.wall);
    const wallItem = model.items.find((entry) => entry.id === item.wallTargetId && entry.type === "innerWall");
    return wallItem ? snapDoorToInnerWall(item, wallItem, item.wall) : snapDoorToNearestWall(item);
  }

  function syncDoorsOnInnerWall(wallItem) {
    if (wallItem.type !== "innerWall") return;
    model.items
      .filter((entry) => entry.type === "door" && entry.wallTargetId === wallItem.id)
      .forEach((door) => snapDoorToInnerWall(door, wallItem, door.wall));
  }

  function getDoorHalfSpan(item, wall = item.wall, roomWidthCm = model.widthCm, roomHeightCm = model.heightCm) {
    const roomLength = wall === "top" || wall === "bottom" ? roomWidthCm : roomHeightCm;
    return Math.min(0.5, item.widthCm / roomLength / 2);
  }

  function hasContent(data) {
    const sketch = normalize(data);
    return (
      sketch.items.length > 0 ||
      Boolean(sketch.note) ||
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
    els.flipBtn = document.querySelector("#flipSketchItemBtn");
    els.deleteBtn = document.querySelector("#deleteSketchItemBtn");
    els.palette = document.querySelector("#sketchPalette");
    els.widthInput = document.querySelector("#roomWidthInput");
    els.heightInput = document.querySelector("#roomHeightInput");
    els.sizeTitle = document.querySelector("#sketchSizeTitle");
    els.sizeHint = document.querySelector("#sketchSizeHint");
    els.widthLabel = document.querySelector("#sketchWidthLabel");
    els.heightLabel = document.querySelector("#sketchHeightLabel");
    els.noteInput = document.querySelector("#sketchNoteInput");
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
    els.flipBtn?.addEventListener("click", flipSelected);
    els.deleteBtn?.addEventListener("click", deleteSelected);
    els.palette?.addEventListener("click", handlePaletteClick);
    els.widthInput?.addEventListener("input", updateActiveSize);
    els.heightInput?.addEventListener("input", updateActiveSize);
    els.noteInput?.addEventListener("input", () => {
      model.note = els.noteInput.value;
      render();
    });

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
    els.noteInput.value = model.note;
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
    els.noteInput.value = "";
    updateSelection(null);
    render();
  }

  function updateActiveSize() {
    const item = getSelected();
    if (item) {
      const sizing = getSizingMode(item);
      if (sizing === "fixed") return;
      const maxWidth = isVerticalRotation(item) ? model.heightCm : model.widthCm;
      const maxHeight = isVerticalRotation(item) ? model.widthCm : model.heightCm;
      item.widthCm = clampNumber(els.widthInput.value, 2, maxWidth, item.widthCm);
      if (sizing !== "length") {
        item.heightCm = clampNumber(els.heightInput.value, 2, maxHeight, item.heightCm);
      }
      if (item.type === "door") resnapDoor(item);
      else {
        keepItemInsideRoom(item);
        syncDoorsOnInnerWall(item);
      }
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
      heightCm: ITEM_TYPES[type].heightCm,
      wall: type === "door" ? "top" : null,
      flip: false
    };
    if (type === "door") {
      item.x = 0.5;
      item.y = 0;
      snapDoorToWall(item, "top");
    } else {
      keepItemInsideRoom(item);
    }
    model.items.push(item);
    updateSelection(item.id);
    render();
  }

  function rotateSelected() {
    const item = getSelected();
    if (!item) return;
    if (item.type === "door") return;
    item.rotation = (item.rotation + 90) % 360;
    keepItemInsideRoom(item);
    syncDoorsOnInnerWall(item);
    syncSizeControls();
    render();
  }

  function flipSelected() {
    const item = getSelected();
    if (!item || (item.type !== "door" && item.type !== "glassDoor")) return;
    item.flip = !item.flip;
    render();
  }

  function deleteSelected() {
    if (!selectedId) return;
    const removed = getSelected();
    model.items = model.items.filter((item) => item.id !== selectedId);
    if (removed?.type === "innerWall") {
      model.items
        .filter((item) => item.type === "door" && item.wallTargetId === removed.id)
        .forEach((door) => {
          door.wallTargetId = null;
          snapDoorToNearestWall(door);
        });
    }
    updateSelection(null);
    render();
  }

  function getSelected() {
    return model.items.find((item) => item.id === selectedId) || null;
  }

  function updateSelectionActions() {
    const item = getSelected();
    const disabled = !item;
    if (els.rotateBtn) els.rotateBtn.disabled = disabled || item?.type === "door";
    if (els.flipBtn) els.flipBtn.disabled = disabled || (item?.type !== "door" && item?.type !== "glassDoor");
    if (els.deleteBtn) els.deleteBtn.disabled = disabled;
    if (els.rotateBtn) els.rotateBtn.textContent = "↻ 90°";
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
      els.sizeHint.textContent = item.type === "door"
        ? "კარი მხოლოდ კედელზე მოძრაობს. ღილაკით გაღების მხარეს შეცვლი."
        : item.type === "glassDoor"
          ? "შუშის კარი თავისუფლად მოძრაობს. შეგიძლია მოატრიალო და გაღების მხარე შეცვალო."
          : "ჩაწერე ზომა ან ნახაზზე კუთხის მრგვალი სახელური მოქაჩე.";
      const isLine = item.type === "glass" || item.type === "glassDoor" || item.type === "innerWall";
      const sizing = getSizingMode(item);
      els.widthLabel.textContent = isLine || sizing === "length" ? "სიგრძე (სმ)" : item.type === "door" ? "კარის სიგანე (სმ)" : "სიგანე (სმ)";
      els.heightLabel.textContent = isLine || sizing === "length" ? "ხაზის სისქე (სმ)" : item.type === "door" ? "კედლის სისქე (სმ)" : "სიგრძე (სმ)";
      els.widthInput.min = "2";
      els.heightInput.min = "2";
      els.widthInput.max = String(isVerticalRotation(item) ? model.heightCm : model.widthCm);
      els.heightInput.max = String(isVerticalRotation(item) ? model.widthCm : model.heightCm);
      els.widthInput.value = Math.round(item.widthCm);
      els.heightInput.value = Math.round(item.heightCm);
      els.widthInput.disabled = sizing === "fixed";
      els.heightInput.disabled = sizing === "fixed" || sizing === "length";
      if (sizing === "fixed") {
        els.sizeHint.textContent = "ამ ელემენტის ზომა ფიქსირებულია. შესაძლებელია მხოლოდ გადაადგილება და მოტრიალება.";
      } else if (sizing === "length") {
        els.sizeHint.textContent = "შეგიძლია მხოლოდ სახელურის სიგრძე შეცვალო და მოატრიალო.";
      }
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
    els.widthInput.disabled = false;
    els.heightInput.disabled = false;
  }

  function pointerDown(event) {
    event.preventDefault();
    const view = getView(els.canvas);
    const point = pointerPoint(event, view);
    const selected = getSelected();

    if (selected && canResize(selected) && hitResizeHandle(event, view, selected)) {
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
      if (item.type === "door") {
        const roomLength = item.wall === "top" || item.wall === "bottom" ? model.widthCm : model.heightCm;
        const pointerAlongWall = item.wall === "top" || item.wall === "bottom" ? point.x : point.y;
        item.widthCm = clampNumber(Math.abs(pointerAlongWall - (item.wall === "top" || item.wall === "bottom" ? item.x : item.y)) * 2 * roomLength, 20, roomLength, item.widthCm);
        resnapDoor(item);
        syncSizeControls();
        render();
        return;
      }
      if (getSizingMode(item) === "length") {
        const pointerDistance = isVerticalRotation(item)
          ? Math.abs(point.y - item.y) * 2 * model.heightCm
          : Math.abs(point.x - item.x) * 2 * model.widthCm;
        item.widthCm = clampNumber(pointerDistance, 10, isVerticalRotation(item) ? model.heightCm : model.widthCm, item.widthCm);
        keepItemInsideRoom(item);
        syncSizeControls();
        render();
        return;
      }
      const visualWidthCm = clampNumber(Math.abs(point.x - item.x) * 2 * model.widthCm, 2, model.widthCm, item.widthCm);
      const visualHeightCm = clampNumber(Math.abs(point.y - item.y) * 2 * model.heightCm, 2, model.heightCm, item.heightCm);
      if (isVerticalRotation(item)) {
        item.widthCm = visualHeightCm;
        item.heightCm = visualWidthCm;
      } else {
        item.widthCm = visualWidthCm;
        item.heightCm = visualHeightCm;
      }
      keepItemInsideRoom(item);
      syncDoorsOnInnerWall(item);
      syncSizeControls();
    } else {
      item.x = point.x - drag.dx;
      item.y = point.y - drag.dy;
      if (item.type === "door") snapDoorToNearestWall(item);
      else {
        keepItemInsideRoom(item);
        syncDoorsOnInnerWall(item);
      }
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
    if (item.type === "door") {
      if (item.wall === "left" || item.wall === "right") {
        return {
          width: Math.min(1, item.heightCm / model.widthCm),
          height: Math.min(1, item.widthCm / model.heightCm)
        };
      }
      return {
        width: Math.min(1, item.widthCm / model.widthCm),
        height: Math.min(1, item.heightCm / model.heightCm)
      };
    }
    const width = Math.min(1, item.widthCm / model.widthCm);
    const height = Math.min(1, item.heightCm / model.heightCm);
    return isVerticalRotation(item)
      ? { width: height, height: width }
      : { width, height };
  }

  function keepItemInsideRoom(item) {
    if (item.type === "door") {
      snapDoorToWall(item, item.wall);
      return;
    }
    const maxWidth = isVerticalRotation(item) ? model.heightCm : model.widthCm;
    const maxHeight = isVerticalRotation(item) ? model.widthCm : model.heightCm;
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
    const noteHeight = estimateNoteHeight(cssWidth - padding * 2, Boolean(exportWidth));
    const bottomHeight = legendHeight + noteHeight;
    const availableWidth = cssWidth - padding * 2;
    const availableHeight = cssHeight - padding * 2 - bottomHeight;
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
      legendY: cssHeight - padding - bottomHeight + (exportWidth ? 22 : 12),
      noteY: cssHeight - padding - noteHeight + (exportWidth ? 20 : 10),
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

  function estimateNoteHeight(width, isExport) {
    if (!model.note.trim()) return 0;
    const fontSize = isExport ? 22 : 12;
    const lineHeight = isExport ? 32 : 18;
    const charactersPerLine = Math.max(18, Math.floor(width / (fontSize * 0.58)));
    const lines = model.note.split(/\r?\n/).reduce((total, line) => {
      return total + Math.max(1, Math.ceil(line.length / charactersPerLine));
    }, 0);
    return lines * lineHeight + (isExport ? 52 : 34);
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
    drawNote(context, view, interactive);
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

    if (item.type === "door") {
      drawDoor(context, room, item, selected, interactive);
      return;
    }
    if (item.type === "glassDoor") {
      drawGlassDoor(context, room, item, selected, interactive);
      return;
    }
    if (item.type === "innerWall") {
      drawInnerWall(context, room, item, selected, interactive);
      return;
    }
    if (item.type === "panelZone") {
      drawPanelZone(context, room, item, selected, interactive);
      return;
    }
    if (item.type === "brauseset" || item.type === "regendusche") {
      drawShowerFixture(context, room, item, selected, interactive);
      return;
    }
    if (item.type === "mischbatterie" || item.type === "thermomischbatterie") {
      drawMixerFixture(context, room, item, selected, interactive);
      return;
    }
    if (item.type === "haltegriff") {
      drawGrabBar(context, room, item, selected, interactive);
      return;
    }

    context.save();
    context.fillStyle = hexToRgba(config.color, item.type === "floorFill" ? 0.2 : 0.4);
    context.strokeStyle = config.color;
    context.lineWidth = interactive ? 1.5 : 2.5;

    if (item.type === "toilet") {
      const radius = Math.min(width, height) * 0.28;
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
      context.fill();
      context.stroke();
      context.beginPath();
      context.ellipse(x + width / 2, y + height * 0.62, width * 0.3, height * 0.25, 0, 0, Math.PI * 2);
      context.stroke();
    } else if (item.type === "sink") {
      context.beginPath();
      context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.ellipse(x + width / 2, y + height / 2, width * 0.32, height * 0.28, 0, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(x + width / 2, y + height * 0.25, Math.max(2, width * 0.035), 0, Math.PI * 2);
      context.fillStyle = config.color;
      context.fill();
    } else if (item.type === "glass") {
      context.beginPath();
      context.lineWidth = interactive ? 3 : 5;
      if (isVerticalRotation(item)) {
        context.moveTo(x + width / 2, y);
        context.lineTo(x + width / 2, y + height);
      } else {
        context.moveTo(x, y + height / 2);
        context.lineTo(x + width, y + height / 2);
      }
      context.stroke();
      drawGlassLabel(context, x, y, width, height, item, interactive);
    } else if (item.type === "radiator") {
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
      context.strokeStyle = config.color;
      const bars = Math.max(3, Math.round(width / 12));
      for (let index = 1; index < bars; index += 1) {
        const barX = x + (width * index) / bars;
        context.beginPath();
        context.moveTo(barX, y + 2);
        context.lineTo(barX, y + height - 2);
        context.stroke();
      }
    } else if (item.type === "shower") {
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
      const vertical = isVerticalRotation(item);
      const drainX = vertical ? x + width * 0.2 : x + width / 2;
      const drainY = vertical ? y + height / 2 : y + height * 0.2;
      context.fillStyle = "#111111";
      context.beginPath();
      context.arc(drainX, drainY, Math.max(3, Math.min(width, height) * 0.045), 0, Math.PI * 2);
      context.fill();
    } else if (item.type === "floorFill") {
      drawHatchedArea(context, x, y, width, height, config.color, interactive, 0.2);
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
      if (canResize(item)) drawResizeHandle(context, room, item);
    }
    context.restore();
  }

  function drawShowerFixture(context, room, item, selected, interactive) {
    const config = ITEM_TYPES[item.type];
    const size = getItemSize(item);
    const width = room.width * size.width;
    const height = room.height * size.height;
    const x = room.x + room.width * item.x - width / 2;
    const y = room.y + room.height * item.y - height / 2;

    context.save();
    context.strokeStyle = config.color;
    context.lineWidth = interactive ? 3 : 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + width, y + height);
    context.moveTo(x + width, y);
    context.lineTo(x, y + height);
    context.stroke();
    drawSelection(context, room, item, x, y, width, height, selected, interactive);
    context.restore();
  }

  function drawMixerFixture(context, room, item, selected, interactive) {
    const config = ITEM_TYPES[item.type];
    const size = getItemSize(item);
    const width = room.width * size.width;
    const height = room.height * size.height;
    const x = room.x + room.width * item.x - width / 2;
    const y = room.y + room.height * item.y - height / 2;

    context.save();
    context.fillStyle = hexToRgba(config.color, 0.12);
    context.strokeStyle = config.color;
    context.lineWidth = interactive ? 2 : 3.5;
    context.beginPath();
    context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    const crossSize = Math.min(width, height) * 0.3;
    [x + width * 0.34, x + width * 0.66].forEach((centerX) => {
      const centerY = y + height / 2;
      context.beginPath();
      context.moveTo(centerX - crossSize / 2, centerY - crossSize / 2);
      context.lineTo(centerX + crossSize / 2, centerY + crossSize / 2);
      context.moveTo(centerX + crossSize / 2, centerY - crossSize / 2);
      context.lineTo(centerX - crossSize / 2, centerY + crossSize / 2);
      context.stroke();
    });
    drawSelection(context, room, item, x, y, width, height, selected, interactive);
    context.restore();
  }

  function drawGrabBar(context, room, item, selected, interactive) {
    const config = ITEM_TYPES.haltegriff;
    const size = getItemSize(item);
    const width = room.width * size.width;
    const height = room.height * size.height;
    const x = room.x + room.width * item.x - width / 2;
    const y = room.y + room.height * item.y - height / 2;
    const vertical = isVerticalRotation(item);
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const startX = vertical ? centerX : x;
    const startY = vertical ? y : centerY;
    const endX = vertical ? centerX : x + width;
    const endY = vertical ? y + height : centerY;
    const cap = interactive ? 7 : 11;

    context.save();
    context.strokeStyle = config.color;
    context.lineWidth = interactive ? 4 : 7;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.lineWidth = interactive ? 2 : 3.5;
    context.beginPath();
    if (vertical) {
      context.moveTo(startX - cap, startY);
      context.lineTo(startX + cap, startY);
      context.moveTo(endX - cap, endY);
      context.lineTo(endX + cap, endY);
    } else {
      context.moveTo(startX, startY - cap);
      context.lineTo(startX, startY + cap);
      context.moveTo(endX, endY - cap);
      context.lineTo(endX, endY + cap);
    }
    context.stroke();
    drawSelection(context, room, item, x, y, width, height, selected, interactive);
    context.restore();
  }

  function drawInnerWall(context, room, item, selected, interactive) {
    const color = ITEM_TYPES.innerWall.color;
    const size = getItemSize(item);
    const width = room.width * size.width;
    const height = room.height * size.height;
    const x = room.x + room.width * item.x - width / 2;
    const y = room.y + room.height * item.y - height / 2;

    context.save();
    context.fillStyle = hexToRgba(color, 0.72);
    context.strokeStyle = color;
    context.lineWidth = interactive ? 1.5 : 2.5;
    context.fillRect(x, y, width, height);
    context.strokeRect(x, y, width, height);
    drawSelection(context, room, item, x, y, width, height, selected, interactive);
    context.restore();
  }

  function drawPanelZone(context, room, item, selected, interactive) {
    const color = ITEM_TYPES.panelZone.color;
    const size = getItemSize(item);
    const width = room.width * size.width;
    const height = room.height * size.height;
    const x = room.x + room.width * item.x - width / 2;
    const y = room.y + room.height * item.y - height / 2;

    context.save();
    drawHatchedArea(context, x, y, width, height, color, interactive, 0.16);
    drawSelection(context, room, item, x, y, width, height, selected, interactive);
    context.restore();
  }

  function drawHatchedArea(context, x, y, width, height, color, interactive, alpha) {
    context.fillStyle = hexToRgba(color, alpha);
    context.strokeStyle = color;
    context.lineWidth = interactive ? 1.2 : 2;
    context.fillRect(x, y, width, height);
    context.strokeRect(x, y, width, height);
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    const spacing = Math.max(interactive ? 12 : 20, width / 9);
    for (let offset = -height; offset < width + height; offset += spacing) {
      context.beginPath();
      context.moveTo(x + offset, y + height);
      context.lineTo(x + offset + height, y);
      context.stroke();
    }
    context.restore();
  }

  function drawSelection(context, room, item, x, y, width, height, selected, interactive) {
    if (!selected || !interactive) return;
    context.strokeStyle = "#17211f";
    context.lineWidth = 1.5;
    context.setLineDash([6, 4]);
    context.strokeRect(x - 4, y - 4, width + 8, height + 8);
    context.setLineDash([]);
    if (canResize(item)) drawResizeHandle(context, room, item);
  }

  function drawResizeHandle(context, room, item) {
    const handle = getResizeHandle(room, item);
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#17211f";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(handle.x, handle.y, 7, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  function drawGlassDoor(context, room, item, selected, interactive) {
    const color = ITEM_TYPES.glassDoor.color;
    const vertical = isVerticalRotation(item);
    const length = vertical
      ? room.height * (item.widthCm / model.heightCm)
      : room.width * (item.widthCm / model.widthCm);
    const centerX = room.x + room.width * item.x;
    const centerY = room.y + room.height * item.y;
    const closedAngle = (item.rotation * Math.PI) / 180;
    const directionX = Math.cos(closedAngle);
    const directionY = Math.sin(closedAngle);
    const hingeX = centerX - directionX * length / 2;
    const hingeY = centerY - directionY * length / 2;
    const openAngle = closedAngle + (item.flip ? -Math.PI / 2 : Math.PI / 2);
    const anticlockwise = item.flip;
    const closedX = hingeX + Math.cos(closedAngle) * length;
    const closedY = hingeY + Math.sin(closedAngle) * length;

    context.save();
    context.strokeStyle = color;
    context.lineWidth = interactive ? 3 : 5;
    context.beginPath();
    context.moveTo(hingeX, hingeY);
    context.lineTo(closedX, closedY);
    context.stroke();

    context.setLineDash(interactive ? [5, 4] : [9, 7]);
    context.beginPath();
    context.arc(hingeX, hingeY, length, closedAngle, openAngle, anticlockwise);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = color;
    context.beginPath();
    context.arc(hingeX, hingeY, interactive ? 3 : 5, 0, Math.PI * 2);
    context.fill();

    if (selected && interactive) {
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

  function drawGlassLabel(context, x, y, width, height, item, interactive) {
    const label = "შუშა";
    const fontSize = interactive ? 11 : 19;
    context.save();
    context.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const textWidth = context.measureText(label).width;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const labelX = isVerticalRotation(item) ? centerX + textWidth / 2 + 10 : centerX;
    const labelY = isVerticalRotation(item) ? centerY : centerY - fontSize;
    context.fillStyle = "rgba(255, 255, 255, 0.88)";
    context.fillRect(labelX - textWidth / 2 - 4, labelY - fontSize / 2 - 2, textWidth + 8, fontSize + 4);
    context.fillStyle = "#44515b";
    context.fillText(label, labelX, labelY);
    context.restore();
  }

  function drawDoor(context, room, item, selected, interactive) {
    const color = ITEM_TYPES.door.color;
    const horizontal = item.wall === "top" || item.wall === "bottom";
    const opening = horizontal
      ? room.width * (item.widthCm / model.widthCm)
      : room.height * (item.widthCm / model.heightCm);
    const centerX = room.x + room.width * item.x;
    const centerY = room.y + room.height * item.y;
    let hingeX = centerX;
    let hingeY = centerY;
    let closedAngle = 0;
    let openAngle = 0;
    let anticlockwise = false;

    if (item.wall === "top") {
      hingeX = centerX + (item.flip ? opening / 2 : -opening / 2);
      closedAngle = item.flip ? Math.PI : 0;
      openAngle = Math.PI / 2;
      anticlockwise = item.flip;
    } else if (item.wall === "bottom") {
      hingeX = centerX + (item.flip ? opening / 2 : -opening / 2);
      closedAngle = item.flip ? Math.PI : 0;
      openAngle = -Math.PI / 2;
      anticlockwise = !item.flip;
    } else if (item.wall === "left") {
      hingeY = centerY + (item.flip ? opening / 2 : -opening / 2);
      closedAngle = item.flip ? -Math.PI / 2 : Math.PI / 2;
      openAngle = 0;
      anticlockwise = !item.flip;
    } else {
      hingeY = centerY + (item.flip ? opening / 2 : -opening / 2);
      closedAngle = item.flip ? -Math.PI / 2 : Math.PI / 2;
      openAngle = Math.PI;
      anticlockwise = item.flip;
    }

    const closedX = hingeX + Math.cos(closedAngle) * opening;
    const closedY = hingeY + Math.sin(closedAngle) * opening;
    const openX = hingeX + Math.cos(openAngle) * opening;
    const openY = hingeY + Math.sin(openAngle) * opening;

    context.save();
    context.strokeStyle = "#ffffff";
    context.lineWidth = interactive ? 7 : 11;
    context.beginPath();
    context.moveTo(hingeX, hingeY);
    context.lineTo(closedX, closedY);
    context.stroke();

    context.strokeStyle = color;
    context.lineWidth = interactive ? 2 : 3.5;
    context.beginPath();
    context.moveTo(hingeX, hingeY);
    context.lineTo(openX, openY);
    context.stroke();

    context.setLineDash(interactive ? [5, 4] : [9, 7]);
    context.beginPath();
    context.arc(hingeX, hingeY, opening, closedAngle, openAngle, anticlockwise);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = color;
    context.beginPath();
    context.arc(hingeX, hingeY, interactive ? 3 : 5, 0, Math.PI * 2);
    context.fill();

    if (selected && interactive) {
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
      if (entry.type === "glass" || entry.type === "glassDoor" || entry.type === "innerWall") {
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

  function drawNote(context, view, interactive) {
    const note = model.note.trim();
    if (!note) return;
    const fontSize = interactive ? 12 : 22;
    const lineHeight = interactive ? 18 : 32;
    const labelHeight = interactive ? 18 : 30;
    const maxWidth = view.legendWidth;
    let y = view.noteY;

    context.save();
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = "#263835";
    context.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
    context.fillText("განმარტება:", view.room.x, y);
    y += labelHeight;
    context.font = `500 ${fontSize}px "Segoe UI", Arial, sans-serif`;

    wrapTextLines(context, note, maxWidth).forEach((line) => {
      context.fillText(line, view.room.x, y);
      y += lineHeight;
    });
    context.restore();
  }

  function wrapTextLines(context, text, maxWidth) {
    const lines = [];
    text.split(/\r?\n/).forEach((paragraph) => {
      if (!paragraph.trim()) {
        lines.push("");
        return;
      }
      let line = "";
      paragraph.trim().split(/\s+/).forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (line && context.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      });
      if (line) lines.push(line);
    });
    return lines;
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
