import * as pdfjsLib from "./node_modules/pdfjs-dist/legacy/build/pdf.mjs";

const welcomeView = document.getElementById("welcomeView");
const editorView = document.getElementById("editorView");
const pdfInput = document.getElementById("pdfInput");
const loadPdfBtn = document.getElementById("loadPdfBtn");
const pdfFileName = document.getElementById("pdfFileName");
const homeImageInput = document.getElementById("homeImageInput");
const homeImageSummary = document.getElementById("homeImageSummary");
const homeClearImagesBtn = document.getElementById("homeClearImagesBtn");
const homeOpenImagesBtn = document.getElementById("homeOpenImagesBtn");
const imageInput = document.getElementById("imageInput");
const addImageLabel = document.getElementById("addImageLabel");
const backHomeBtn = document.getElementById("backHomeBtn");
const removeWatermarkBtn = document.getElementById("removeWatermarkBtn");
const deleteImageBtn = document.getElementById("deleteImageBtn");
const saveBtn = document.getElementById("saveBtn");
const editorHint = document.getElementById("editorHint");
const previewContainer = document.getElementById("previewContainer");
const pdfCanvas = document.getElementById("pdfCanvas");
const annotationCanvas = document.getElementById("annotationCanvas");
const imagesLayer = document.getElementById("imagesLayer");
const imageChipTemplate = document.getElementById("imageChipTemplate");
const thumbnailList = document.getElementById("thumbnailList");
const thumbTemplate = document.getElementById("thumbTemplate");
const sidebarTitle = document.getElementById("sidebarTitle");
const pageInfo = document.getElementById("pageInfo");
const toolButtons = [...document.querySelectorAll(".tool-btn")];
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomResetBtn = document.getElementById("zoomResetBtn");
const zoomLabel = document.getElementById("zoomLabel");

const PDFLibGlobal = window.PDFLib;
const PDFDocument = PDFLibGlobal?.PDFDocument;
const StandardFonts = PDFLibGlobal?.StandardFonts;
const rgb = PDFLibGlobal?.rgb;

let sourcePdfBytes = null;
let sourcePdfBytesForLib = null;
let selectedPdfFile = null;
let pdfJsDoc = null;
let pdfPageSize = null;
let currentPageIndex = 0;
let zoomScale = 1.2;
/** @type {"pdf" | "image"} */
let editorMode = "pdf";

let dragState = null;
let resizeState = null;
let selectedImageId = null;
let imageZBase = 10;
let activeTool = "image";
let drawState = null;

const annotationsByPage = new Map();
const imagesByPage = new Map();
const annotationViewportByPage = new Map();

/** @type {{ bytes: ArrayBuffer, mimeType: string, objectUrl: string, name: string }[]} */
let pendingHomeImages = [];

/** @type {{ id: string, bytes: ArrayBuffer, mimeType: string, objectUrl: string, name: string }[]} */
let imageOnlyPages = [];

const HINT_PDF =
  "PDF画像を追加で何枚でも配置。ハンドルで画像の拡大縮小。透かしが気になる画像は「画像の透かしを削除」を試してください。";
const HINT_IMAGE =
  "表示中の画像に「画像の透かしを削除」を試せます。＋ / － で拡大縮小。「画像を保存」で処理後の画像をダウンロードします。";

const hasPdfJs = typeof pdfjsLib !== "undefined";
const hasPdfLib =
  typeof PDFDocument !== "undefined" &&
  typeof StandardFonts !== "undefined" &&
  typeof rgb !== "undefined";

if (hasPdfJs) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs";
}

updateHomeImageSummary();

function getImagesList(pageIndex) {
  if (!imagesByPage.has(pageIndex)) imagesByPage.set(pageIndex, []);
  return imagesByPage.get(pageIndex);
}

function hasAnyImages() {
  for (const list of imagesByPage.values()) {
    if (list.length > 0) return true;
  }
  return false;
}

function revokeAllImageUrls() {
  for (const list of imagesByPage.values()) {
    list.forEach((s) => URL.revokeObjectURL(s.objectUrl));
  }
}

function revokePendingHomeImages() {
  pendingHomeImages.forEach((p) => URL.revokeObjectURL(p.objectUrl));
  pendingHomeImages = [];
  updateHomeImageSummary();
}

function updateHomeImageSummary() {
  if (!homeImageSummary) return;
  const n = pendingHomeImages.length;
  if (n === 0) {
    homeImageSummary.textContent =
      "未選択（PDFなしで編集、またはPDF読込時に1ページ目へ配置）";
  } else {
    homeImageSummary.textContent = `${n}枚選択中（「画像を開いて編集」か、PDF読込で使えます）`;
  }
  if (homeOpenImagesBtn) {
    homeOpenImagesBtn.classList.toggle("hidden", n === 0);
  }
}

async function flushPendingHomeImagesToFirstPage() {
  if (pendingHomeImages.length === 0 || !pdfCanvas?.width) return;
  const batch = pendingHomeImages.slice();
  pendingHomeImages = [];
  updateHomeImageSummary();

  const list = getImagesList(0);
  let idx = list.length;

  for (const p of batch) {
    await new Promise((resolve) => {
      const imgEl = new Image();
      imgEl.onload = () => {
        const cw = pdfCanvas.width;
        const ch = pdfCanvas.height;
        const maxWidth = Math.max(120, cw * 0.35);
        const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
        const widthPx = maxWidth;
        const heightPx = widthPx / ratio;
        const margin = 20 + idx * 18;
        list.push({
          id: crypto.randomUUID(),
          bytes: p.bytes,
          mimeType: p.mimeType,
          objectUrl: p.objectUrl,
          leftNorm: margin / cw,
          topNorm: margin / ch,
          widthNorm: widthPx / cw,
          heightNorm: heightPx / ch,
        });
        idx += 1;
        resolve();
      };
      imgEl.onerror = () => {
        URL.revokeObjectURL(p.objectUrl);
        resolve();
      };
      imgEl.src = p.objectUrl;
    });
  }
}

function snapshotFiles(fileList) {
  return Array.from(fileList || []);
}

function inferImageMime(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type === "image/png") return "image/png";
  if (type === "image/jpeg" || type === "image/jpg" || type === "image/pjpeg") {
    return "image/jpeg";
  }
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".jfif")) {
    return "image/jpeg";
  }
  return null;
}

function applyEditorChrome() {
  const imageMode = editorMode === "image";
  editorView.classList.toggle("image-mode", imageMode);
  if (addImageLabel) {
    addImageLabel.textContent = imageMode ? "画像を追加" : "PDF画像を追加";
  }
  saveBtn.textContent = imageMode ? "画像を保存" : "保存";
  if (sidebarTitle) {
    sidebarTitle.textContent = imageMode ? "画像一覧" : "サムネイル";
  }
  editorHint.textContent = imageMode ? HINT_IMAGE : HINT_PDF;
  if (zoomResetBtn) {
    zoomResetBtn.textContent = imageMode ? "フィット" : "100%";
  }
  annotationCanvas.style.pointerEvents =
    imageMode || activeTool === "image" ? "none" : "auto";
}

function returnToHome() {
  if (editorMode === "image" && imageOnlyPages.length > 0) {
    pendingHomeImages = imageOnlyPages.map((p) => ({
      bytes: p.bytes,
      mimeType: p.mimeType,
      objectUrl: p.objectUrl,
      name: p.name,
    }));
    imageOnlyPages = [];
    updateHomeImageSummary();
  }
  editorMode = "pdf";
  applyEditorChrome();
  editorView.classList.add("hidden");
  welcomeView.classList.remove("hidden");
  editorHint.classList.add("hidden");
  selectedImageId = null;
}

function getImageFitZoomScale(naturalWidth, naturalHeight) {
  const stage = document.querySelector(".stage");
  if (!stage) return 1.2;
  const availW = Math.max(stage.clientWidth - 48, 200);
  const availH = Math.max(stage.clientHeight - 80, 200);
  const fit = Math.min(availW / naturalWidth, availH / naturalHeight, 1);
  return fit * 1.2;
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderImageOnlyPage(pageIndex) {
  const state = imageOnlyPages[pageIndex];
  if (!state) return;
  const img = await loadHtmlImage(state.objectUrl);
  const displayScale = zoomScale / 1.2;
  const w = Math.max(1, Math.round(img.naturalWidth * displayScale));
  const h = Math.max(1, Math.round(img.naturalHeight * displayScale));
  pdfCanvas.width = w;
  pdfCanvas.height = h;
  annotationCanvas.width = w;
  annotationCanvas.height = h;
  annotationCanvas.style.width = `${w}px`;
  annotationCanvas.style.height = `${h}px`;
  previewContainer.style.width = `${w}px`;
  previewContainer.style.height = `${h}px`;
  const ctx = pdfCanvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const name = state.name ? `　${state.name}` : "";
  pageInfo.textContent = `画像: ${pageIndex + 1} / ${imageOnlyPages.length}${name}`;
  zoomLabel.textContent = `${Math.round(displayScale * 100)}%`;
  imagesLayer.innerHTML = "";
}

async function renderImageThumbnails() {
  thumbnailList.innerHTML = "";
  for (let i = 0; i < imageOnlyPages.length; i += 1) {
    const state = imageOnlyPages[i];
    const thumbNode = thumbTemplate.content.firstElementChild.cloneNode(true);
    const thumbCanvas = thumbNode.querySelector(".thumb-canvas");
    const thumbLabel = thumbNode.querySelector(".thumb-label");
    thumbLabel.textContent = state.name || `${i + 1}枚目`;
    if (i === currentPageIndex) thumbNode.classList.add("active");

    try {
      const img = await loadHtmlImage(state.objectUrl);
      if (img.naturalWidth) {
        const maxW = 190;
        const scale = maxW / img.naturalWidth;
        thumbCanvas.width = maxW;
        thumbCanvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        thumbCanvas.getContext("2d").drawImage(
          img,
          0,
          0,
          thumbCanvas.width,
          thumbCanvas.height
        );
      }
    } catch {
      thumbLabel.textContent = `${state.name || i + 1}（表示できません）`;
    }

    thumbNode.addEventListener("click", async () => {
      currentPageIndex = i;
      await renderImageOnlyPage(currentPageIndex);
      setActiveThumbnail();
      updateSaveButtonState();
    });

    thumbnailList.appendChild(thumbNode);
  }
}

async function openImageOnlyEditor() {
  if (pendingHomeImages.length === 0 && imageOnlyPages.length === 0) return;

  editorMode = "image";
  selectedImageId = null;
  currentPageIndex = 0;
  if (homeOpenImagesBtn) homeOpenImagesBtn.disabled = true;

  if (pendingHomeImages.length > 0) {
    imageOnlyPages = pendingHomeImages.map((p) => ({
      id: crypto.randomUUID(),
      bytes: p.bytes,
      mimeType: p.mimeType,
      objectUrl: p.objectUrl,
      name: p.name,
    }));
    pendingHomeImages = [];
    updateHomeImageSummary();
  }

  applyEditorChrome();
  welcomeView.classList.add("hidden");
  editorView.classList.remove("hidden");
  editorHint.classList.remove("hidden");

  try {
    const first = imageOnlyPages[0];
    if (first) {
      const img = await loadHtmlImage(first.objectUrl);
      zoomScale = getImageFitZoomScale(img.naturalWidth, img.naturalHeight);
    }
    await renderImageOnlyPage(currentPageIndex);
    await renderImageThumbnails();
    updateSaveButtonState();
  } catch (error) {
    console.error("画像読み込みエラー:", error);
    alert("画像の読み込みに失敗しました。別のファイルで試してください。");
    returnToHome();
  } finally {
    if (homeOpenImagesBtn) homeOpenImagesBtn.disabled = false;
  }
}

async function addFilesToImageOnlyPages(files) {
  let added = 0;
  for (const file of files) {
    const mimeType = inferImageMime(file);
    if (!mimeType) continue;
    const bytes = (await file.arrayBuffer()).slice(0);
    const objectUrl = URL.createObjectURL(file);
    imageOnlyPages.push({
      id: crypto.randomUUID(),
      bytes,
      mimeType,
      objectUrl,
      name: file.name,
    });
    added += 1;
  }
  return added;
}

async function deleteCurrentImageOnlyPage() {
  if (imageOnlyPages.length === 0) return;
  const [removed] = imageOnlyPages.splice(currentPageIndex, 1);
  if (removed) URL.revokeObjectURL(removed.objectUrl);
  if (imageOnlyPages.length === 0) {
    updateHomeImageSummary();
    returnToHome();
    return;
  }
  currentPageIndex = Math.min(currentPageIndex, imageOnlyPages.length - 1);
  await renderImageOnlyPage(currentPageIndex);
  await renderImageThumbnails();
  updateSaveButtonState();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function editedImageFileName(name, mimeType) {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const base = (name || "image").replace(/\.[^.]+$/, "") || "image";
  return `${base}_edited.${ext}`;
}

async function saveImageOnly() {
  const state = imageOnlyPages[currentPageIndex];
  if (!state) return;
  const blob = new Blob([state.bytes], { type: state.mimeType });
  downloadBlob(blob, editedImageFileName(state.name, state.mimeType));
}

pdfInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  selectedPdfFile = file;
  pdfFileName.textContent = `選択中: ${file.name}`;
  loadPdfBtn.classList.remove("hidden");
});

homeImageInput.addEventListener("change", async (event) => {
  const files = snapshotFiles(event.target.files);
  homeImageInput.value = "";
  if (files.length === 0) return;
  let added = 0;
  for (const file of files) {
    const mimeType = inferImageMime(file);
    if (!mimeType) continue;
    const bytes = (await file.arrayBuffer()).slice(0);
    const objectUrl = URL.createObjectURL(file);
    pendingHomeImages.push({
      bytes,
      mimeType,
      objectUrl,
      name: file.name,
    });
    added += 1;
  }
  updateHomeImageSummary();
  if (added === 0) {
    alert("PNGまたはJPG画像を選択してください。");
  }
});

homeClearImagesBtn.addEventListener("click", () => {
  revokePendingHomeImages();
});

homeOpenImagesBtn.addEventListener("click", () => {
  openImageOnlyEditor().catch(() => {
    alert("画像の読み込みに失敗しました。");
  });
});

backHomeBtn.addEventListener("click", () => {
  returnToHome();
});

loadPdfBtn.addEventListener("click", async () => {
  if (!selectedPdfFile) return;
  if (!hasPdfJs || !hasPdfLib) {
    alert(
      "必要なライブラリの読み込みに失敗しました。ネット接続を確認して、ページを再読み込みしてください。"
    );
    return;
  }
  loadPdfBtn.disabled = true;
  loadPdfBtn.textContent = "読み込み中...";
  try {
    const rawPdfBytes = await selectedPdfFile.arrayBuffer();
    sourcePdfBytes = rawPdfBytes.slice(0);
    sourcePdfBytesForLib = rawPdfBytes.slice(0);
    pdfJsDoc = await pdfjsLib
      .getDocument({ data: new Uint8Array(sourcePdfBytes) })
      .promise;
    currentPageIndex = 0;
    revokeAllImageUrls();
    imagesByPage.clear();
    annotationsByPage.clear();
    annotationViewportByPage.clear();
    selectedImageId = null;
    editorMode = "pdf";
    applyEditorChrome();
    await renderPage(currentPageIndex);
    await flushPendingHomeImagesToFirstPage();
    renderImagesLayer();
    await renderThumbnails();
    welcomeView.classList.add("hidden");
    editorView.classList.remove("hidden");
    editorHint.classList.remove("hidden");
    updateSaveButtonState();
  } catch (error) {
    console.error("PDF読み込みエラー:", error);
    alert(
      "PDFの読み込みに失敗しました。別のPDFで試すか、ページを再読み込みしてもう一度お試しください。"
    );
  } finally {
    loadPdfBtn.disabled = false;
    loadPdfBtn.textContent = "PDF読込";
  }
});

imageInput.addEventListener("change", async (event) => {
  const files = snapshotFiles(event.target.files);
  imageInput.value = "";
  if (files.length === 0) return;

  if (editorMode === "image") {
    const added = await addFilesToImageOnlyPages(files);
    if (added === 0) {
      alert("PNGまたはJPG画像を選択してください。");
      return;
    }
    currentPageIndex = imageOnlyPages.length - 1;
    await renderImageOnlyPage(currentPageIndex);
    await renderImageThumbnails();
    updateSaveButtonState();
    return;
  }

  if (!sourcePdfBytes) {
    alert("先にPDF読込でファイルをアップロードしてください。");
    return;
  }

  for (const file of files) {
    const mimeType = inferImageMime(file);
    if (!mimeType) {
      alert("PNGまたはJPG画像を選択してください。");
      continue;
    }

    const bytes = (await file.arrayBuffer()).slice(0);
    const objectUrl = URL.createObjectURL(file);
    const list = getImagesList(currentPageIndex);
    const idx = list.length;
    const cw = pdfCanvas.width;
    const ch = pdfCanvas.height;

    await new Promise((resolve) => {
      const imgEl = new Image();
      imgEl.onload = () => {
        const maxWidth = Math.max(120, cw * 0.35);
        const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
        const widthPx = maxWidth;
        const heightPx = widthPx / ratio;
        const margin = 20 + idx * 18;

        const state = {
          id: crypto.randomUUID(),
          bytes,
          mimeType,
          objectUrl,
          leftNorm: margin / cw,
          topNorm: margin / ch,
          widthNorm: widthPx / cw,
          heightNorm: heightPx / ch,
        };
        list.push(state);
        selectedImageId = state.id;
        resolve();
      };
      imgEl.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        alert("画像の読み込みに失敗しました。");
        resolve();
      };
      imgEl.src = objectUrl;
    });
  }

  renderImagesLayer();
  updateSaveButtonState();
});

deleteImageBtn.addEventListener("click", () => {
  if (editorMode === "image") {
    deleteCurrentImageOnlyPage();
    return;
  }
  deleteSelectedImage();
});

removeWatermarkBtn.addEventListener("click", () => {
  applyWatermarkReduction().catch(() => {
    alert("画像の処理に失敗しました。");
  });
});

saveBtn.addEventListener("click", async () => {
  if (editorMode === "image") {
    await saveImageOnly();
    return;
  }
  if (!sourcePdfBytesForLib) return;

  const pdfDoc = await PDFDocument.load(sourcePdfBytesForLib.slice(0));
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageCount = pdfDoc.getPageCount();

  for (let pi = 0; pi < pageCount; pi += 1) {
    const page = pdfDoc.getPage(pi);
    const size = page.getSize();
    const vp = annotationViewportByPage.get(pi) || {
      width: size.width,
      height: size.height,
    };

    const imgs = imagesByPage.get(pi) || [];
    for (const img of imgs) {
      const embedded =
        img.mimeType === "image/png"
          ? await pdfDoc.embedPng(img.bytes)
          : await pdfDoc.embedJpg(img.bytes);
      const drawW = img.widthNorm * size.width;
      const drawH = img.heightNorm * size.height;
      const drawX = img.leftNorm * size.width;
      const drawY = size.height - img.topNorm * size.height - drawH;
      page.drawImage(embedded, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH,
      });
    }

    const annotationData = annotationsByPage.get(pi) || [];
    const scaleX = size.width / vp.width;
    const scaleY = size.height / vp.height;

    const textItems = annotationData.filter((item) => item.type === "text");
    const fontSizePdf = 24 * scaleY;
    const textColor = rgb(0.12, 0.35, 0.27);
    textItems.forEach((item) => {
      page.drawText(item.text, {
        x: item.x * scaleX,
        y: size.height - item.y * scaleY,
        size: fontSizePdf,
        font: helvetica,
        color: textColor,
      });
    });

    const overlayItems = annotationData.filter((item) => item.type !== "text");
    if (overlayItems.length > 0) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = vp.width;
      tempCanvas.height = vp.height;
      const tctx = tempCanvas.getContext("2d");
      overlayItems.forEach((item) => drawAnnotation(tctx, item));
      const mergedBytes = await canvasToPngBytes(tempCanvas);
      const overlayPng = await pdfDoc.embedPng(mergedBytes);
      page.drawImage(overlayPng, {
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
      });
    }
  }

  const modifiedPdfBytes = await pdfDoc.save();
  const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "edited.pdf";
  a.click();
  URL.revokeObjectURL(url);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Delete" || event.key === "Backspace") {
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (editorMode === "image" && imageOnlyPages.length > 0) {
      event.preventDefault();
      deleteCurrentImageOnlyPage();
      return;
    }
    if (selectedImageId && activeTool === "image") {
      event.preventDefault();
      deleteSelectedImage();
    }
  }
});

zoomInBtn.addEventListener("click", async () => {
  if (editorMode === "image") {
    zoomScale = Math.min(zoomScale + 0.2, 6);
    await renderImageOnlyPage(currentPageIndex);
    return;
  }
  syncAllImageNormsFromDom();
  zoomScale = Math.min(zoomScale + 0.2, 3);
  await renderPage(currentPageIndex);
});

zoomOutBtn.addEventListener("click", async () => {
  if (editorMode === "image") {
    zoomScale = Math.max(zoomScale - 0.2, 0.24);
    await renderImageOnlyPage(currentPageIndex);
    return;
  }
  syncAllImageNormsFromDom();
  zoomScale = Math.max(zoomScale - 0.2, 0.6);
  await renderPage(currentPageIndex);
});

zoomResetBtn.addEventListener("click", async () => {
  if (editorMode === "image") {
    const state = imageOnlyPages[currentPageIndex];
    if (!state) return;
    try {
      const img = await loadHtmlImage(state.objectUrl);
      zoomScale = getImageFitZoomScale(img.naturalWidth, img.naturalHeight);
    } catch {
      zoomScale = 1.2;
    }
    await renderImageOnlyPage(currentPageIndex);
    return;
  }
  syncAllImageNormsFromDom();
  zoomScale = 1.2;
  await renderPage(currentPageIndex);
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTool = button.dataset.tool || "image";
    toolButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    annotationCanvas.style.pointerEvents = activeTool === "image" ? "none" : "auto";
    annotationCanvas.style.cursor =
      activeTool === "text" ? "text" : activeTool === "rect" ? "crosshair" : "default";
  });
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function syncAllImageNormsFromDom() {
  const list = getImagesList(currentPageIndex);
  list.forEach((state) => {
    const el = imagesLayer.querySelector(`[data-image-id="${state.id}"]`);
    if (el) syncNormsFromElement(el, state);
  });
}

function layoutImageChipFromNorms(el, state) {
  const w = pdfCanvas.width;
  const h = pdfCanvas.height;
  el.style.left = `${state.leftNorm * w}px`;
  el.style.top = `${state.topNorm * h}px`;
  el.style.width = `${state.widthNorm * w}px`;
  el.style.height = `${state.heightNorm * h}px`;
}

function syncNormsFromElement(el, state) {
  const w = pdfCanvas.width;
  const h = pdfCanvas.height;
  if (!w || !h) return;
  state.leftNorm = parseFloat(el.style.left) / w;
  state.topNorm = parseFloat(el.style.top) / h;
  state.widthNorm = el.offsetWidth / w;
  state.heightNorm = el.offsetHeight / h;
}

function selectImageChip(id) {
  selectedImageId = id;
  [...imagesLayer.querySelectorAll(".image-overlay")].forEach((el) => {
    const match = el.dataset.imageId === id;
    el.classList.toggle("selected", match);
    if (match) el.style.zIndex = String(++imageZBase);
  });
  updateSaveButtonState();
}

function getSelectedImageState() {
  if (!selectedImageId) return null;
  const list = getImagesList(currentPageIndex);
  return list.find((s) => s.id === selectedImageId) || null;
}

async function reduceWatermarkOnState(state) {
  const img = await loadHtmlImage(state.objectUrl);
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (!w || !h) return false;
  const maxPx = 4096;
  if (w > maxPx || h > maxPx) {
    const scale = Math.min(maxPx / w, maxPx / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.filter = "contrast(1.28) brightness(1.04) saturate(1.05)";
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";
  const outMime = state.mimeType === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((res) => {
    canvas.toBlob(res, outMime, outMime === "image/jpeg" ? 0.92 : undefined);
  });
  if (!blob) return false;
  const newBytes = (await blob.arrayBuffer()).slice(0);
  URL.revokeObjectURL(state.objectUrl);
  state.bytes = newBytes;
  state.mimeType = outMime;
  state.objectUrl = URL.createObjectURL(blob);
  return true;
}

async function applyWatermarkReduction() {
  if (editorMode === "image") {
    const state = imageOnlyPages[currentPageIndex];
    if (!state) return;
    const ok = await reduceWatermarkOnState(state);
    if (!ok) return;
    await renderImageOnlyPage(currentPageIndex);
    await renderImageThumbnails();
    updateSaveButtonState();
    return;
  }
  const state = getSelectedImageState();
  if (!state) return;
  const ok = await reduceWatermarkOnState(state);
  if (!ok) return;
  renderImagesLayer();
  selectImageChip(state.id);
  updateSaveButtonState();
}

function deleteSelectedImage() {
  if (!selectedImageId) return;
  const list = getImagesList(currentPageIndex);
  const i = list.findIndex((s) => s.id === selectedImageId);
  if (i === -1) return;
  const [removed] = list.splice(i, 1);
  URL.revokeObjectURL(removed.objectUrl);
  selectedImageId = null;
  renderImagesLayer();
  updateSaveButtonState();
}

function bindResizeHandle(handle, mode, el, state) {
  handle.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    selectImageChip(state.id);
    const rect = el.getBoundingClientRect();
    resizeState = {
      mode,
      targetEl: el,
      targetState: state,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      ratio: rect.width / rect.height,
    };
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!resizeState || resizeState.targetEl !== el || resizeState.mode !== mode) return;
    const left = parseFloat(el.style.left || "0");
    const top = parseFloat(el.style.top || "0");
    const maxW = pdfCanvas.clientWidth - left;
    const maxH = pdfCanvas.clientHeight - top;

    if (mode === "se") {
      const delta = event.clientX - resizeState.startX;
      let nextWidth = clamp(resizeState.width + delta, 40, maxW);
      let nextHeight = nextWidth / resizeState.ratio;
      if (nextHeight > maxH) {
        nextHeight = maxH;
        nextWidth = nextHeight * resizeState.ratio;
      }
      el.style.width = `${nextWidth}px`;
      el.style.height = `${nextHeight}px`;
      return;
    }

    if (mode === "e") {
      const delta = event.clientX - resizeState.startX;
      const nextWidth = clamp(resizeState.width + delta, 40, maxW);
      el.style.width = `${nextWidth}px`;
      el.style.height = `${resizeState.height}px`;
      return;
    }

    if (mode === "s") {
      const delta = event.clientY - resizeState.startY;
      const nextHeight = clamp(resizeState.height + delta, 40, maxH);
      el.style.width = `${resizeState.width}px`;
      el.style.height = `${nextHeight}px`;
    }
  });

  handle.addEventListener("pointerup", () => {
    if (resizeState?.targetEl === el && resizeState.mode === mode) {
      syncNormsFromElement(el, state);
      resizeState = null;
    }
  });
}

function wireImageChip(el, state) {
  const hSe = el.querySelector(".resize-handle-se");
  const hE = el.querySelector(".resize-handle-e");
  const hS = el.querySelector(".resize-handle-s");

  el.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".resize-handle")) return;
    selectImageChip(state.id);
    const rect = el.getBoundingClientRect();
    const pc = previewContainer.getBoundingClientRect();
    dragState = {
      targetEl: el,
      targetState: state,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left - pc.left,
      top: rect.top - pc.top,
    };
    el.setPointerCapture(event.pointerId);
  });

  el.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.targetEl !== el) return;
    const nextLeft = dragState.left + (event.clientX - dragState.startX);
    const nextTop = dragState.top + (event.clientY - dragState.startY);
    const maxLeft = pdfCanvas.clientWidth - el.offsetWidth;
    const maxTop = pdfCanvas.clientHeight - el.offsetHeight;
    el.style.left = `${clamp(nextLeft, 0, maxLeft)}px`;
    el.style.top = `${clamp(nextTop, 0, maxTop)}px`;
  });

  el.addEventListener("pointerup", () => {
    if (dragState?.targetEl === el) {
      syncNormsFromElement(el, state);
      dragState = null;
    }
  });

  bindResizeHandle(hSe, "se", el, state);
  bindResizeHandle(hE, "e", el, state);
  bindResizeHandle(hS, "s", el, state);
}

function renderImagesLayer() {
  imagesLayer.innerHTML = "";
  const list = getImagesList(currentPageIndex);
  list.forEach((state) => {
    const node = imageChipTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.imageId = state.id;
    const img = node.querySelector(".chip-img");
    img.src = state.objectUrl;
    layoutImageChipFromNorms(node, state);
    wireImageChip(node, state);
    if (state.id === selectedImageId) {
      node.classList.add("selected");
      node.style.zIndex = String(++imageZBase);
    }
    imagesLayer.appendChild(node);
  });
}

async function renderPage(pageIndex) {
  const page = await pdfJsDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: zoomScale });
  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;
  annotationCanvas.width = viewport.width;
  annotationCanvas.height = viewport.height;
  annotationCanvas.style.width = `${viewport.width}px`;
  annotationCanvas.style.height = `${viewport.height}px`;
  previewContainer.style.width = `${viewport.width}px`;
  previewContainer.style.height = `${viewport.height}px`;

  const context = pdfCanvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;

  if (!sourcePdfBytesForLib) return;
  const loadedPdf = await PDFDocument.load(sourcePdfBytesForLib.slice(0));
  pdfPageSize = loadedPdf.getPage(pageIndex).getSize();
  pageInfo.textContent = `ページ: ${pageIndex + 1} / ${pdfJsDoc.numPages}`;
  zoomLabel.textContent = `${Math.round((zoomScale / 1.2) * 100)}%`;

  annotationViewportByPage.set(pageIndex, {
    width: annotationCanvas.width,
    height: annotationCanvas.height,
  });
  redrawAnnotations(annotationsByPage.get(pageIndex) || []);
  renderImagesLayer();
}

async function renderThumbnails() {
  thumbnailList.innerHTML = "";
  for (let i = 0; i < pdfJsDoc.numPages; i += 1) {
    const thumbNode = thumbTemplate.content.firstElementChild.cloneNode(true);
    const thumbCanvas = thumbNode.querySelector(".thumb-canvas");
    const thumbLabel = thumbNode.querySelector(".thumb-label");
    thumbLabel.textContent = `${i + 1}ページ`;
    if (i === currentPageIndex) thumbNode.classList.add("active");

    const page = await pdfJsDoc.getPage(i + 1);
    const viewport = page.getViewport({ scale: 0.23 });
    thumbCanvas.width = viewport.width;
    thumbCanvas.height = viewport.height;
    await page.render({
      canvasContext: thumbCanvas.getContext("2d"),
      viewport,
    }).promise;

    thumbNode.addEventListener("click", async () => {
      syncAllImageNormsFromDom();
      currentPageIndex = i;
      selectedImageId = null;
      await renderPage(currentPageIndex);
      setActiveThumbnail();
      updateSaveButtonState();
    });

    thumbnailList.appendChild(thumbNode);
  }
}

function setActiveThumbnail() {
  [...thumbnailList.children].forEach((node, idx) => {
    node.classList.toggle("active", idx === currentPageIndex);
  });
}

function hasAnyAnnotations() {
  for (const list of annotationsByPage.values()) {
    if (list.length > 0) return true;
  }
  return false;
}

function updateSaveButtonState() {
  if (editorMode === "image") {
    const hasPage = imageOnlyPages.length > 0;
    saveBtn.disabled = !hasPage;
    removeWatermarkBtn.disabled = !hasPage;
    deleteImageBtn.disabled = !hasPage;
    return;
  }
  const list = getImagesList(currentPageIndex);
  const hasSelected =
    Boolean(selectedImageId) && list.some((s) => s.id === selectedImageId);
  const ready = sourcePdfBytes && (hasAnyImages() || hasAnyAnnotations());
  saveBtn.disabled = !ready;
  removeWatermarkBtn.disabled = !hasSelected;
  deleteImageBtn.disabled = !hasSelected;
}

annotationCanvas.addEventListener("pointerdown", (event) => {
  if (activeTool === "image") return;
  const pt = toCanvasPoint(event);
  const items = annotationsByPage.get(currentPageIndex) || [];
  annotationsByPage.set(currentPageIndex, items);

  if (activeTool === "text") {
    const text = window.prompt("入力するテキスト");
    if (!text) return;
    items.push({ type: "text", x: pt.x, y: pt.y, text });
    redrawAnnotations(items);
    updateSaveButtonState();
    return;
  }

  if (activeTool === "stamp") {
    items.push({ type: "stamp", x: pt.x, y: pt.y, stamp: "✅" });
    redrawAnnotations(items);
    updateSaveButtonState();
    return;
  }

  if (activeTool === "rect") {
    drawState = { type: "rect", start: pt, current: pt };
  }
});

annotationCanvas.addEventListener("pointermove", (event) => {
  if (!drawState) return;
  const pt = toCanvasPoint(event);
  drawState.current = pt;
  redrawAnnotations(annotationsByPage.get(currentPageIndex) || [], drawState);
});

annotationCanvas.addEventListener("pointerup", () => {
  if (!drawState || drawState.type !== "rect") return;
  const items = annotationsByPage.get(currentPageIndex) || [];
  items.push({
    type: "rect",
    x1: drawState.start.x,
    y1: drawState.start.y,
    x2: drawState.current.x,
    y2: drawState.current.y,
  });
  drawState = null;
  redrawAnnotations(items);
  updateSaveButtonState();
});

function toCanvasPoint(event) {
  const rect = annotationCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function redrawAnnotations(items, draft = null) {
  const ctx = annotationCanvas.getContext("2d");
  ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  items.forEach((item) => drawAnnotation(ctx, item));
  if (draft) drawAnnotation(ctx, draft, true);
}

function drawAnnotation(ctx, item, isDraft = false) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1f5a46";
  ctx.fillStyle = "#1f5a46";
  if (isDraft) ctx.globalAlpha = 0.65;

  if (item.type === "text") {
    ctx.font = "24px Segoe UI";
    ctx.fillText(item.text, item.x, item.y);
  } else if (item.type === "stamp") {
    ctx.font = "30px Segoe UI Emoji";
    ctx.fillText(item.stamp, item.x, item.y);
  } else if (item.type === "rect") {
    const x1 = item.x1 ?? item.start?.x;
    const y1 = item.y1 ?? item.start?.y;
    const x2 = item.x2 ?? item.current?.x;
    const y2 = item.y2 ?? item.current?.y;
    if (x1 == null || y1 == null || x2 == null || y2 == null) return;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }
  ctx.restore();
}

function canvasToPngBytes(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const ab = await blob.arrayBuffer();
      resolve(ab);
    }, "image/png");
  });
}
