// ======================================
// PDF Annotator Web App
// Author: YaMac33
// Source: 未定
// License: Personal Use / No Redistribution
// ======================================

(function () {
  "use strict";

  if (!window.pdfjsLib || !window.PDFLib) {
    alert("PDF.js または pdf-lib が読み込めません。lib フォルダの配置を確認してください。");
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdfjs/pdf.worker.min.js";

  const { PDFDocument, rgb, StandardFonts } = PDFLib;

  const state = {
    pdfDocument: null,
    originalPdfBytes: null,
    fileName: "annotated.pdf",
    pageNumber: 1,
    pageCount: 0,
    scale: 1.2,
    minScale: 0.5,
    maxScale: 3,
    tool: "pen",
    strokeShape: "free",
    drawingKind: "pen",
    eraserMode: "object",
    color: "#d7263d",
    lineWidth: 4,
    nextOrder: 1,
    isDrawing: false,
    isErasing: false,
    hasErasedInGesture: false,
    touchPointers: new Map(),
    isTouchGesture: false,
    gestureStartDistance: 0,
    gestureStartScale: 1.2,
    gestureLastCenter: null,
    gestureZoomFrame: null,
    activeStroke: null,
    pendingTextPosition: null,
    editingTextIndex: null,
    selectedAnnotation: null,
    annotationsByPage: new Map(),
    undoStack: [],
    redoStack: [],
    renderTask: null
  };

  const elements = {
    fileInput: document.getElementById("pdfFileInput"),
    prevButton: document.getElementById("prevPageButton"),
    nextButton: document.getElementById("nextPageButton"),
    pageStatus: document.getElementById("pageStatus"),
    zoomOutButton: document.getElementById("zoomOutButton"),
    zoomInButton: document.getElementById("zoomInButton"),
    zoomStatus: document.getElementById("zoomStatus"),
    undoButton: document.getElementById("undoButton"),
    redoButton: document.getElementById("redoButton"),
    penButton: document.getElementById("penToolButton"),
    textButton: document.getElementById("textToolButton"),
    eraserButton: document.getElementById("eraserToolButton"),
    strokeShapeSelect: document.getElementById("strokeShapeSelect"),
    drawingKindSelect: document.getElementById("drawingKindSelect"),
    eraserModeSelect: document.getElementById("eraserModeSelect"),
    colorInput: document.getElementById("penColorInput"),
    widthInput: document.getElementById("penWidthInput"),
    widthStatus: document.getElementById("penWidthStatus"),
    clearButton: document.getElementById("clearPageButton"),
    saveButton: document.getElementById("savePdfButton"),
    messageArea: document.getElementById("messageArea"),
    viewerShell: document.getElementById("viewerShell"),
    pageLayer: document.getElementById("pageLayer"),
    pdfCanvas: document.getElementById("pdfCanvas"),
    annotationCanvas: document.getElementById("annotationCanvas"),
    textEditor: document.getElementById("textEditor"),
    textEditorInput: document.getElementById("textEditorInput"),
    textConfirmButton: document.getElementById("textConfirmButton"),
    textDeleteButton: document.getElementById("textDeleteButton"),
    textCancelButton: document.getElementById("textCancelButton")
  };

  initializeApp();

  function initializeApp() {
    bindEvents();
    updateToolbarState();
  }

  function bindEvents() {
    elements.fileInput.addEventListener("change", loadSelectedPdf);
    elements.prevButton.addEventListener("click", showPreviousPage);
    elements.nextButton.addEventListener("click", showNextPage);
    elements.zoomOutButton.addEventListener("click", () => changeZoom(-0.2));
    elements.zoomInButton.addEventListener("click", () => changeZoom(0.2));
    elements.undoButton.addEventListener("click", undo);
    elements.redoButton.addEventListener("click", redo);
    elements.penButton.addEventListener("click", () => setTool("pen"));
    elements.textButton.addEventListener("click", () => setTool("text"));
    elements.eraserButton.addEventListener("click", () => setTool("eraser"));
    elements.strokeShapeSelect.addEventListener("change", updateStrokeShape);
    elements.drawingKindSelect.addEventListener("change", updateDrawingKind);
    elements.eraserModeSelect.addEventListener("change", updateEraserMode);
    elements.colorInput.addEventListener("input", updatePenColor);
    elements.widthInput.addEventListener("input", updatePenWidth);
    elements.clearButton.addEventListener("click", clearCurrentPageAnnotations);
    elements.saveButton.addEventListener("click", saveAnnotatedPdf);

    elements.annotationCanvas.addEventListener("pointerdown", handlePointerDown);
    elements.annotationCanvas.addEventListener("pointermove", handlePointerMove);
    elements.annotationCanvas.addEventListener("pointerup", finishPointerAction);
    elements.annotationCanvas.addEventListener("pointercancel", finishPointerAction);
    elements.annotationCanvas.addEventListener("pointerleave", finishPointerAction);

    elements.textConfirmButton.addEventListener("click", confirmTextAnnotation);
    elements.textDeleteButton.addEventListener("click", deleteEditingTextAnnotation);
    elements.textCancelButton.addEventListener("click", hideTextEditor);
    elements.textEditorInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") confirmTextAnnotation();
      if (event.key === "Escape") hideTextEditor();
    });

    document.addEventListener("pointerdown", (event) => {
      if (elements.textEditor.hidden) return;
      if (elements.textEditor.contains(event.target)) return;
      if (event.target === elements.annotationCanvas) return;
      hideTextEditor();
    });
  }

  async function loadSelectedPdf(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      showMessage("PDFファイルを選択してください。", true);
      return;
    }

    try {
      hideTextEditor(false);
      const pdfBytes = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });

      state.pdfDocument = await loadingTask.promise;
      state.originalPdfBytes = pdfBytes;
      state.fileName = file.name.replace(/\.pdf$/i, "") + "_annotated.pdf";
      state.pageNumber = 1;
      state.pageCount = state.pdfDocument.numPages;
      state.annotationsByPage = new Map();
      state.undoStack = [];
      state.redoStack = [];
      state.selectedAnnotation = null;
      state.nextOrder = 1;

      showMessage("PDFを読み込みました。線種、ペン種、消し方を選んで注釈を追加できます。", false);
      await renderCurrentPage();
    } catch (error) {
      console.error(error);
      showMessage("PDFの読み込みに失敗しました。ファイルを確認してください。", true);
      alert("PDFの読み込みに失敗しました。");
    }
  }

  async function renderCurrentPage() {
    if (!state.pdfDocument) {
      updateToolbarState();
      return;
    }

    try {
      if (state.renderTask) {
        state.renderTask.cancel();
        state.renderTask = null;
      }

      const page = await state.pdfDocument.getPage(state.pageNumber);
      const viewport = page.getViewport({ scale: state.scale });

      preparePdfCanvasForViewport(elements.pdfCanvas, viewport);
      prepareAnnotationCanvasForViewport(elements.annotationCanvas, viewport);
      elements.pageLayer.style.width = `${viewport.width}px`;
      elements.pageLayer.style.height = `${viewport.height}px`;

      const context = elements.pdfCanvas.getContext("2d");
      const ratio = window.devicePixelRatio || 1;
      const transform = ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null;

      state.renderTask = page.render({ canvasContext: context, transform, viewport });
      await state.renderTask.promise;
      state.renderTask = null;

      redrawAnnotationCanvas();
      updateToolbarState();
    } catch (error) {
      if (error && error.name === "RenderingCancelledException") return;
      console.error(error);
      showMessage("ページ表示に失敗しました。", true);
    }
  }

  function preparePdfCanvasForViewport(canvas, viewport) {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const context = canvas.getContext("2d");
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function prepareAnnotationCanvasForViewport(canvas, viewport) {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);
  }

  function redrawAnnotationCanvas() {
    const context = elements.annotationCanvas.getContext("2d");
    const width = elements.annotationCanvas.clientWidth;
    const height = elements.annotationCanvas.clientHeight;
    context.clearRect(0, 0, width, height);

    drawAnnotationsInOrder(context, getCurrentPageAnnotations(), width, height, state.scale);
    drawSelectedAnnotationBox(context, width, height);
  }

  function drawAnnotationsInOrder(context, annotations, width, height, scale) {
    getOrderedItems(annotations).forEach((item) => {
      if (item.type === "stroke") drawStroke(context, item.value, width, height, scale);
      if (item.type === "text") drawTextAnnotationOnCanvas(context, item.value, width, height, scale);
    });
  }

  function drawStroke(context, stroke, width, height, scale) {
    if (stroke.points.length < 2) return;

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = stroke.widthPdf * scale;
    context.strokeStyle = stroke.color;
    context.globalAlpha = stroke.opacity ?? 1;
    context.globalCompositeOperation = stroke.mode === "eraser" ? "destination-out" : "source-over";
    context.beginPath();

    stroke.points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });

    context.stroke();
    context.restore();
  }

  function drawTextAnnotationOnCanvas(context, text, width, height, scale) {
    context.save();
    context.fillStyle = text.color;
    context.globalAlpha = text.opacity ?? 1;
    context.font = `${text.fontSizePdf * scale}px sans-serif`;
    context.textBaseline = "top";
    context.fillText(text.value, text.x * width, text.y * height);
    context.restore();
  }

  function drawSelectedAnnotationBox(context, width, height) {
    if (!state.selectedAnnotation) return;
    const box = getSelectedAnnotationBounds(width, height);
    if (!box) return;

    context.save();
    context.setLineDash([6, 4]);
    context.lineWidth = 2;
    context.strokeStyle = "#1769e0";
    context.strokeRect(box.x - 5, box.y - 5, box.width + 10, box.height + 10);
    context.restore();
  }

  function handlePointerDown(event) {
    if (!state.pdfDocument) {
      showMessage("先にPDFを選択してください。", true);
      return;
    }

    if (event.pointerType === "touch") {
      capturePointer(event);
      state.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.touchPointers.size >= 2) {
        event.preventDefault();
        startTouchGesture();
        return;
      }
    }

    const point = getNormalizedPointFromEvent(event);

    if (state.tool === "eraser") {
      startErasing(event, point);
      return;
    }

    if (state.tool === "text") {
      const hitTextIndex = findTextIndexAtPoint(point);
      if (hitTextIndex !== -1) showTextEditorForExistingText(hitTextIndex, event);
      else showTextEditorAtPointer(event, point);
      return;
    }

    startDrawing(event, point);
  }

  function handlePointerMove(event) {
    if (event.pointerType === "touch" && state.touchPointers.has(event.pointerId)) {
      state.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.isTouchGesture) {
        event.preventDefault();
        updateTouchGesture();
        return;
      }
    }

    const point = getNormalizedPointFromEvent(event);

    if (state.isErasing) {
      continueErasing(point);
      return;
    }

    if (!state.isDrawing || !state.activeStroke) return;

    if (state.activeStroke.shape === "line") {
      state.activeStroke.points[1] = point;
    } else {
      state.activeStroke.points.push(point);
    }

    redrawAnnotationCanvas();
  }

  function finishPointerAction(event) {
    if (event.pointerType === "touch") {
      state.touchPointers.delete(event.pointerId);
      if (state.isTouchGesture) {
        event.preventDefault();
        if (state.touchPointers.size < 2) finishTouchGesture();
        return;
      }
    }

    if (state.isErasing) {
      finishErasing(event);
      return;
    }

    if (!state.isDrawing) return;
    state.isDrawing = false;

    if (state.activeStroke && state.activeStroke.points.length === 1) {
      state.activeStroke.points.push(state.activeStroke.points[0]);
    }

    releasePointerCapture(event);
    state.activeStroke = null;
    redrawAnnotationCanvas();
    updateToolbarState();
  }

  function startTouchGesture() {
    cancelActiveAnnotationForTouchGesture();
    captureTouchPointers();
    hideTextEditor(false);
    state.isTouchGesture = true;

    const gesture = getTouchGestureInfo();
    state.gestureStartDistance = gesture.distance;
    state.gestureStartScale = state.scale;
    state.gestureLastCenter = gesture.center;
  }

  function updateTouchGesture() {
    if (state.touchPointers.size < 2 || !state.gestureLastCenter) return;

    const gesture = getTouchGestureInfo();
    const deltaX = gesture.center.x - state.gestureLastCenter.x;
    const deltaY = gesture.center.y - state.gestureLastCenter.y;

    // 2本指で同じ方向へ動かした場合は、表示エリアをスクロールしてページを移動します。
    elements.viewerShell.scrollLeft -= deltaX;
    elements.viewerShell.scrollTop -= deltaY;
    state.gestureLastCenter = gesture.center;

    // 2本指の距離が変わった場合はピンチ拡大・縮小として扱います。
    if (state.gestureStartDistance > 0) {
      const nextScale = clamp(
        state.gestureStartScale * (gesture.distance / state.gestureStartDistance),
        state.minScale,
        state.maxScale
      );

      if (Math.abs(nextScale - state.scale) >= 0.03) {
        scheduleTouchZoom(nextScale);
      }
    }
  }

  function finishTouchGesture() {
    state.isTouchGesture = false;
    state.gestureStartDistance = 0;
    state.gestureLastCenter = null;
    state.activeStroke = null;
    state.isDrawing = false;
    state.isErasing = false;
    releaseTouchPointerCaptures();
    state.touchPointers.clear();
    updateToolbarState();
  }

  function getTouchGestureInfo() {
    const points = Array.from(state.touchPointers.values()).slice(0, 2);
    const first = points[0];
    const second = points[1] || points[0];
    const center = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2
    };
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    return { center, distance };
  }

  function scheduleTouchZoom(nextScale) {
    state.scale = Number(nextScale.toFixed(2));
    if (state.gestureZoomFrame) return;

    state.gestureZoomFrame = requestAnimationFrame(() => {
      state.gestureZoomFrame = null;
      renderCurrentPage();
    });
  }

  function cancelActiveAnnotationForTouchGesture() {
    if (!state.isDrawing && !state.isErasing) return;

    if (state.undoStack.length > 0) {
      const snapshot = state.undoStack.pop();
      state.annotationsByPage = snapshot.annotationsByPage;
      state.nextOrder = snapshot.nextOrder;
    }

    state.isDrawing = false;
    state.isErasing = false;
    state.hasErasedInGesture = false;
    state.activeStroke = null;
    redrawAnnotationCanvas();
    updateToolbarState();
  }

  function capturePointer(event) {
    try {
      if (!elements.annotationCanvas.hasPointerCapture(event.pointerId)) {
        elements.annotationCanvas.setPointerCapture(event.pointerId);
      }
    } catch (error) {
      // capture できない状態なら通常のイベント処理に任せます。
    }
  }

  function captureTouchPointers() {
    state.touchPointers.forEach((point, pointerId) => {
      try {
        if (!elements.annotationCanvas.hasPointerCapture(pointerId)) {
          elements.annotationCanvas.setPointerCapture(pointerId);
        }
      } catch (error) {
        // すでに終了した pointer は無視します。
      }
    });
  }

  function releaseTouchPointerCaptures() {
    state.touchPointers.forEach((point, pointerId) => {
      try {
        if (elements.annotationCanvas.hasPointerCapture(pointerId)) {
          elements.annotationCanvas.releasePointerCapture(pointerId);
        }
      } catch (error) {
        // capture が無い状態なら何もしません。
      }
    });
  }

  function startDrawing(event, point) {
    hideTextEditor(false);
    state.selectedAnnotation = null;
    pushUndoSnapshot();
    elements.annotationCanvas.setPointerCapture(event.pointerId);
    state.isDrawing = true;
    state.activeStroke = createStrokeFromPoint(point, false);
    getCurrentPageAnnotations().strokes.push(state.activeStroke);
    redrawAnnotationCanvas();
  }

  function createStrokeFromPoint(point, isEraser) {
    const opacity = isEraser ? 1 : state.drawingKind === "marker" ? 0.35 : 1;
    const widthMultiplier = isEraser ? 2.5 : state.drawingKind === "marker" ? 3 : 1;

    return {
      mode: isEraser ? "eraser" : "draw",
      kind: isEraser ? "eraser" : state.drawingKind,
      shape: isEraser ? "free" : state.strokeShape,
      color: isEraser ? "#000000" : state.color,
      opacity,
      widthPdf: (state.lineWidth * widthMultiplier) / state.scale,
      order: state.nextOrder++,
      points: isEraser || state.strokeShape === "free" ? [point] : [point, point]
    };
  }

  function startErasing(event, point) {
    hideTextEditor(false);
    state.selectedAnnotation = null;
    state.isErasing = true;
    state.hasErasedInGesture = false;
    elements.annotationCanvas.setPointerCapture(event.pointerId);

    if (state.eraserMode === "partial") {
      pushUndoSnapshot();
      state.hasErasedInGesture = true;
      state.activeStroke = createStrokeFromPoint(point, true);
      getCurrentPageAnnotations().strokes.push(state.activeStroke);
      redrawAnnotationCanvas();
      return;
    }

    eraseObjectAtPoint(point);
  }

  function continueErasing(point) {
    if (state.eraserMode === "partial") {
      if (!state.activeStroke) return;
      state.activeStroke.points.push(point);
      redrawAnnotationCanvas();
      return;
    }

    eraseObjectAtPoint(point);
  }

  function finishErasing(event) {
    state.isErasing = false;
    state.hasErasedInGesture = false;

    if (state.activeStroke && state.activeStroke.points.length === 1) {
      state.activeStroke.points.push(state.activeStroke.points[0]);
    }

    state.activeStroke = null;
    releasePointerCapture(event);
    redrawAnnotationCanvas();
    updateToolbarState();
  }

  function eraseObjectAtPoint(point) {
    const annotations = getCurrentPageAnnotations();
    const hit = findAnnotationAtPoint(point);

    if (!hit) {
      state.selectedAnnotation = null;
      redrawAnnotationCanvas();
      return;
    }

    if (!state.hasErasedInGesture) {
      pushUndoSnapshot();
      state.hasErasedInGesture = true;
    }

    if (hit.type === "text") annotations.texts.splice(hit.index, 1);
    else annotations.strokes.splice(hit.index, 1);

    state.selectedAnnotation = null;
    redrawAnnotationCanvas();
    updateToolbarState();
    showMessage("選択した注釈オブジェクトを削除しました。", false);
  }

  function releasePointerCapture(event) {
    try {
      elements.annotationCanvas.releasePointerCapture(event.pointerId);
    } catch (error) {
      // capture が無い状態なら何もしません。
    }
  }

  function getNormalizedPointFromEvent(event) {
    const rect = elements.annotationCanvas.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    return { x, y };
  }

  function showTextEditorAtPointer(event, point) {
    state.pendingTextPosition = point;
    state.editingTextIndex = null;
    state.selectedAnnotation = null;
    elements.textDeleteButton.hidden = true;
    openTextEditor(event.clientX, event.clientY, "");
  }

  function showTextEditorForExistingText(textIndex, event) {
    const text = getCurrentPageAnnotations().texts[textIndex];
    state.pendingTextPosition = { x: text.x, y: text.y };
    state.editingTextIndex = textIndex;
    state.selectedAnnotation = { type: "text", index: textIndex };
    elements.textDeleteButton.hidden = false;
    openTextEditor(event.clientX, event.clientY, text.value);
    redrawAnnotationCanvas();
  }

  function openTextEditor(clientX, clientY, value) {
    elements.textEditor.style.left = `${clientX + 8}px`;
    elements.textEditor.style.top = `${clientY + 8}px`;
    elements.textEditor.hidden = false;
    elements.textEditorInput.value = value;
    elements.textEditorInput.focus();
    elements.textEditorInput.select();
  }

  function confirmTextAnnotation() {
    if (!state.pendingTextPosition) return;
    const value = elements.textEditorInput.value.trim();
    const annotations = getCurrentPageAnnotations();

    if (!value) {
      if (state.editingTextIndex !== null) deleteEditingTextAnnotation();
      else hideTextEditor();
      return;
    }

    pushUndoSnapshot();
    if (state.editingTextIndex !== null) {
      const text = annotations.texts[state.editingTextIndex];
      text.value = value;
      text.color = state.color;
    } else {
      annotations.texts.push({
        value,
        x: state.pendingTextPosition.x,
        y: state.pendingTextPosition.y,
        color: state.color,
        opacity: 1,
        fontSizePdf: 16 / state.scale,
        order: state.nextOrder++
      });
    }

    hideTextEditor();
    redrawAnnotationCanvas();
    updateToolbarState();
  }

  function deleteEditingTextAnnotation() {
    if (state.editingTextIndex === null) {
      hideTextEditor();
      return;
    }

    const annotations = getCurrentPageAnnotations();
    if (!annotations.texts[state.editingTextIndex]) {
      hideTextEditor();
      return;
    }

    pushUndoSnapshot();
    annotations.texts.splice(state.editingTextIndex, 1);
    hideTextEditor();
    redrawAnnotationCanvas();
    updateToolbarState();
    showMessage("テキスト注釈を削除しました。", false);
  }

  function hideTextEditor(redraw = true) {
    state.pendingTextPosition = null;
    state.editingTextIndex = null;
    state.selectedAnnotation = null;
    elements.textEditor.hidden = true;
    elements.textDeleteButton.hidden = true;
    if (redraw && state.pdfDocument) redrawAnnotationCanvas();
  }

  function findAnnotationAtPoint(point) {
    const textIndex = findTextIndexAtPoint(point);
    if (textIndex !== -1) return { type: "text", index: textIndex };

    const strokeIndex = findStrokeIndexAtPoint(point);
    if (strokeIndex !== -1) return { type: "stroke", index: strokeIndex };

    return null;
  }

  function findTextIndexAtPoint(point) {
    const annotations = getCurrentPageAnnotations();
    const width = elements.annotationCanvas.clientWidth;
    const height = elements.annotationCanvas.clientHeight;
    const context = elements.annotationCanvas.getContext("2d");

    for (let index = annotations.texts.length - 1; index >= 0; index -= 1) {
      const text = annotations.texts[index];
      const fontSize = text.fontSizePdf * state.scale;
      context.save();
      context.font = `${fontSize}px sans-serif`;
      const textWidth = Math.max(context.measureText(text.value).width, 24);
      context.restore();

      const x = point.x * width;
      const y = point.y * height;
      const left = text.x * width - 4;
      const top = text.y * height - 4;
      const right = left + textWidth + 8;
      const bottom = top + fontSize + 10;

      if (x >= left && x <= right && y >= top && y <= bottom) return index;
    }

    return -1;
  }

  function findStrokeIndexAtPoint(point) {
    const annotations = getCurrentPageAnnotations();
    const width = elements.annotationCanvas.clientWidth;
    const height = elements.annotationCanvas.clientHeight;
    const x = point.x * width;
    const y = point.y * height;

    for (let index = annotations.strokes.length - 1; index >= 0; index -= 1) {
      const stroke = annotations.strokes[index];
      if (stroke.mode === "eraser") continue;
      const threshold = Math.max(stroke.widthPdf * state.scale + 8, 12);

      for (let pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
        const previous = stroke.points[pointIndex - 1];
        const current = stroke.points[pointIndex];
        const distance = getDistanceToSegment(
          x,
          y,
          previous.x * width,
          previous.y * height,
          current.x * width,
          current.y * height
        );

        if (distance <= threshold) return index;
      }
    }

    return -1;
  }

  function getSelectedAnnotationBounds(width, height) {
    if (!state.selectedAnnotation) return null;
    const annotations = getCurrentPageAnnotations();
    if (state.selectedAnnotation.type === "text") {
      const text = annotations.texts[state.selectedAnnotation.index];
      if (!text) return null;
      const context = elements.annotationCanvas.getContext("2d");
      const fontSize = text.fontSizePdf * state.scale;
      context.save();
      context.font = `${fontSize}px sans-serif`;
      const textWidth = Math.max(context.measureText(text.value).width, 24);
      context.restore();
      return { x: text.x * width, y: text.y * height, width: textWidth, height: fontSize };
    }

    return null;
  }

  function getCurrentPageAnnotations() {
    if (!state.annotationsByPage.has(state.pageNumber)) {
      state.annotationsByPage.set(state.pageNumber, { strokes: [], texts: [] });
    }
    return state.annotationsByPage.get(state.pageNumber);
  }

  function getAnnotationsForPage(pageNumber) {
    return state.annotationsByPage.get(pageNumber) || { strokes: [], texts: [] };
  }

  function getOrderedItems(annotations) {
    const strokes = annotations.strokes.map((stroke, index) => ({
      type: "stroke",
      value: stroke,
      order: stroke.order ?? index
    }));
    const texts = annotations.texts.map((text, index) => ({
      type: "text",
      value: text,
      order: text.order ?? index + 100000
    }));
    return strokes.concat(texts).sort((a, b) => a.order - b.order);
  }

  function clearCurrentPageAnnotations() {
    if (!state.pdfDocument) {
      showMessage("先にPDFを選択してください。", true);
      return;
    }

    if (!confirm("現在ページの注釈を削除しますか？")) return;
    pushUndoSnapshot();
    state.annotationsByPage.set(state.pageNumber, { strokes: [], texts: [] });
    hideTextEditor(false);
    redrawAnnotationCanvas();
    updateToolbarState();
    showMessage("現在ページの注釈を削除しました。", false);
  }

  async function saveAnnotatedPdf() {
    if (!state.originalPdfBytes) {
      showMessage("保存するPDFがありません。先にPDFを選択してください。", true);
      return;
    }

    try {
      hideTextEditor(false);
      showMessage("PDFへ注釈を焼き込み中です。少しお待ちください。", false);
      const pdfDoc = await PDFDocument.load(state.originalPdfBytes.slice(0));
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        const annotations = getAnnotationsForPage(index + 1);
        if (annotations.strokes.length === 0 && annotations.texts.length === 0) continue;

        if (mustBakeWholePageAsImage(annotations)) {
          const pngDataUrl = createAnnotationOverlayPng(annotations, page.getWidth(), page.getHeight());
          const pngImage = await pdfDoc.embedPng(pngDataUrl);
          page.drawImage(pngImage, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
          continue;
        }

        if (annotations.strokes.length > 0) {
          const pngDataUrl = createAnnotationOverlayPng({ strokes: annotations.strokes, texts: [] }, page.getWidth(), page.getHeight());
          const pngImage = await pdfDoc.embedPng(pngDataUrl);
          page.drawImage(pngImage, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
        }

        if (annotations.texts.length > 0) {
          const textsDrawnByPdf = drawTextAnnotationsOnPdfPage(page, annotations.texts, font);
          const fallbackTexts = annotations.texts.filter((text, textIndex) => !textsDrawnByPdf.has(textIndex));

          if (fallbackTexts.length > 0) {
            const pngDataUrl = createAnnotationOverlayPng({ strokes: [], texts: fallbackTexts }, page.getWidth(), page.getHeight());
            const pngImage = await pdfDoc.embedPng(pngDataUrl);
            page.drawImage(pngImage, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), state.fileName);
      showMessage("編集済みPDFをダウンロードしました。", false);
    } catch (error) {
      console.error(error);
      showMessage("保存に失敗しました。注釈データまたはPDFを確認してください。", true);
      alert("保存に失敗しました。");
    }
  }

  function mustBakeWholePageAsImage(annotations) {
    return annotations.strokes.some((stroke) => stroke.mode === "eraser" || (stroke.opacity ?? 1) < 1);
  }

  function createAnnotationOverlayPng(annotations, pageWidth, pageHeight) {
    const qualityScale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(pageWidth * qualityScale);
    canvas.height = Math.ceil(pageHeight * qualityScale);

    const context = canvas.getContext("2d");
    context.setTransform(qualityScale, 0, 0, qualityScale, 0, 0);
    context.clearRect(0, 0, pageWidth, pageHeight);
    drawAnnotationsInOrder(context, annotations, pageWidth, pageHeight, 1);
    return canvas.toDataURL("image/png");
  }

  function drawTextAnnotationsOnPdfPage(page, texts, font) {
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const drawnTextIndexes = new Set();

    texts.forEach((text, index) => {
      const fontSize = text.fontSizePdf;
      try {
        page.drawText(text.value, {
          x: text.x * pageWidth,
          y: pageHeight - text.y * pageHeight - fontSize,
          size: fontSize,
          font,
          color: hexToRgb(text.color)
        });
        drawnTextIndexes.add(index);
      } catch (error) {
        console.warn("drawTextで扱えない文字をPNG注釈として保存します。", error);
      }
    });

    return drawnTextIndexes;
  }

  function pushUndoSnapshot() {
    state.undoStack.push({
      annotationsByPage: cloneAnnotationsMap(state.annotationsByPage),
      nextOrder: state.nextOrder
    });
    state.redoStack = [];
    updateToolbarState();
  }

  function undo() {
    if (state.undoStack.length === 0) return;
    state.redoStack.push({
      annotationsByPage: cloneAnnotationsMap(state.annotationsByPage),
      nextOrder: state.nextOrder
    });
    const snapshot = state.undoStack.pop();
    state.annotationsByPage = snapshot.annotationsByPage;
    state.nextOrder = snapshot.nextOrder;
    hideTextEditor(false);
    redrawAnnotationCanvas();
    updateToolbarState();
  }

  function redo() {
    if (state.redoStack.length === 0) return;
    state.undoStack.push({
      annotationsByPage: cloneAnnotationsMap(state.annotationsByPage),
      nextOrder: state.nextOrder
    });
    const snapshot = state.redoStack.pop();
    state.annotationsByPage = snapshot.annotationsByPage;
    state.nextOrder = snapshot.nextOrder;
    hideTextEditor(false);
    redrawAnnotationCanvas();
    updateToolbarState();
  }

  function cloneAnnotationsMap(sourceMap) {
    const clonedMap = new Map();
    sourceMap.forEach((annotations, pageNumber) => {
      clonedMap.set(pageNumber, {
        strokes: annotations.strokes.map((stroke) => ({
          mode: stroke.mode,
          kind: stroke.kind,
          shape: stroke.shape,
          color: stroke.color,
          opacity: stroke.opacity,
          widthPdf: stroke.widthPdf,
          order: stroke.order,
          points: stroke.points.map((point) => ({ x: point.x, y: point.y }))
        })),
        texts: annotations.texts.map((text) => ({ ...text }))
      });
    });
    return clonedMap;
  }

  function showPreviousPage() {
    if (!state.pdfDocument || state.pageNumber <= 1) return;
    hideTextEditor(false);
    state.pageNumber -= 1;
    renderCurrentPage();
  }

  function showNextPage() {
    if (!state.pdfDocument || state.pageNumber >= state.pageCount) return;
    hideTextEditor(false);
    state.pageNumber += 1;
    renderCurrentPage();
  }

  function changeZoom(delta) {
    if (!state.pdfDocument) {
      showMessage("先にPDFを選択してください。", true);
      return;
    }

    state.scale = clamp(Number((state.scale + delta).toFixed(2)), state.minScale, state.maxScale);
    hideTextEditor(false);
    renderCurrentPage();
  }

  function setTool(toolName) {
    state.tool = toolName;
    hideTextEditor();
    elements.penButton.classList.toggle("active", toolName === "pen");
    elements.textButton.classList.toggle("active", toolName === "text");
    elements.eraserButton.classList.toggle("active", toolName === "eraser");
    elements.annotationCanvas.classList.toggle("text-mode", toolName === "text");
    elements.annotationCanvas.classList.toggle("eraser-mode", toolName === "eraser");
  }

  function updateStrokeShape() {
    state.strokeShape = elements.strokeShapeSelect.value;
  }

  function updateDrawingKind() {
    state.drawingKind = elements.drawingKindSelect.value;
  }

  function updateEraserMode() {
    state.eraserMode = elements.eraserModeSelect.value;
  }

  function updatePenColor() {
    state.color = elements.colorInput.value;
  }

  function updatePenWidth() {
    state.lineWidth = Number(elements.widthInput.value);
    elements.widthStatus.textContent = String(state.lineWidth);
  }

  function updateToolbarState() {
    const hasPdf = Boolean(state.pdfDocument);
    elements.prevButton.disabled = !hasPdf || state.pageNumber <= 1;
    elements.nextButton.disabled = !hasPdf || state.pageNumber >= state.pageCount;
    elements.zoomOutButton.disabled = !hasPdf || state.scale <= state.minScale;
    elements.zoomInButton.disabled = !hasPdf || state.scale >= state.maxScale;
    elements.undoButton.disabled = !hasPdf || state.undoStack.length === 0;
    elements.redoButton.disabled = !hasPdf || state.redoStack.length === 0;
    elements.clearButton.disabled = !hasPdf;
    elements.saveButton.disabled = !hasPdf;

    elements.pageStatus.textContent = hasPdf ? `${state.pageNumber} / ${state.pageCount}` : "未読込";
    elements.zoomStatus.textContent = `${Math.round(state.scale * 100)}%`;
  }

  function showMessage(message, isError) {
    elements.messageArea.textContent = message;
    elements.messageArea.classList.toggle("error", Boolean(isError));
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function hexToRgb(hexColor) {
    const normalized = hexColor.replace("#", "");
    const red = parseInt(normalized.slice(0, 2), 16) / 255;
    const green = parseInt(normalized.slice(2, 4), 16) / 255;
    const blue = parseInt(normalized.slice(4, 6), 16) / 255;
    return rgb(red, green, blue);
  }

  function getDistanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);

    const progress = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    const nearestX = ax + progress * dx;
    const nearestY = ay + progress * dy;
    return Math.hypot(px - nearestX, py - nearestY);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
})();
