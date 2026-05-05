const { PDFDocument } = PDFLib;

let mergeFiles = [];
let imageFiles = [];

function init() {
  document.getElementById("split-button").addEventListener("click", handleSplitPdf);
  document.getElementById("merge-button").addEventListener("click", handleMergePdf);
  document.getElementById("image-button").addEventListener("click", handleImagesToPdf);

  document.getElementById("merge-files").addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    const invalidFile = files.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));

    if (invalidFile) {
      setStatus("merge-status", "PDF以外のファイルが含まれています。PDFファイルだけを選択してください。", "error");
      event.target.value = "";
      return;
    }

    mergeFiles = mergeFiles.concat(files);
    renderMergeList();
    setStatus("merge-status", files.length ? `${files.length}件のPDFを一覧に追加しました。` : "", files.length ? "success" : "");
    event.target.value = "";
  });

  document.getElementById("image-files").addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    const invalidFile = files.find((file) => !isSupportedImage(file));

    if (invalidFile) {
      setStatus("image-status", "対応していない画像が含まれています。PNG、JPEG、JPG、WebPを選択してください。", "error");
      event.target.value = "";
      return;
    }

    imageFiles = imageFiles.concat(files);
    renderImageList();
    setStatus("image-status", files.length ? `${files.length}件の画像を一覧に追加しました。` : "", files.length ? "success" : "");
    event.target.value = "";
  });

  renderMergeList();
  renderImageList();
}

function setStatus(areaId, message, type) {
  const area = document.getElementById(areaId);
  area.textContent = message || "";
  area.className = "status";

  if (message && type) {
    area.classList.add("is-visible", type);
  }
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function stripPdfExtension(filename) {
  return filename.replace(/\.pdf$/i, "");
}

function parsePageRanges(input, maxPages) {
  const value = input.trim();

  if (!value) {
    throw new Error("ページ指定を入力してください。");
  }

  const pages = [];
  const seen = new Set();
  const parts = value.split(",");

  for (const rawPart of parts) {
    const part = rawPart.trim();

    if (!part) {
      throw new Error("ページ指定の形式が正しくありません。");
    }

    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = part.match(/^\d+$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);

      if (start > end) {
        throw new Error("ページ範囲は小さい番号から大きい番号で指定してください。");
      }

      for (let page = start; page <= end; page += 1) {
        addPageNumber(page, maxPages, pages, seen);
      }
    } else if (singleMatch) {
      addPageNumber(Number(part), maxPages, pages, seen);
    } else {
      throw new Error("ページ指定の形式が正しくありません。例: 1-3,5,8-10");
    }
  }

  return pages;
}

function addPageNumber(page, maxPages, pages, seen) {
  if (!Number.isInteger(page) || page < 1 || page > maxPages) {
    throw new Error(`ページ番号 ${page} は範囲外です。1〜${maxPages} の範囲で指定してください。`);
  }

  if (!seen.has(page)) {
    seen.add(page);
    pages.push(page);
  }
}

async function handleSplitPdf() {
  const fileInput = document.getElementById("split-file");
  const pageInput = document.getElementById("split-pages");
  const file = fileInput.files[0];

  try {
    if (!file) {
      throw new Error("PDFファイルを選択してください。");
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("PDFファイルを選択してください。");
    }

    setStatus("split-status", "PDFを読み込み、指定ページを抽出しています。", "working");

    const sourceBytes = await readFileAsArrayBuffer(file);
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const selectedPages = parsePageRanges(pageInput.value, sourcePdf.getPageCount());
    const outputPdf = await PDFDocument.create();
    const copiedPages = await outputPdf.copyPages(sourcePdf, selectedPages.map((page) => page - 1));

    copiedPages.forEach((page) => outputPdf.addPage(page));

    const outputBytes = await outputPdf.save();
    downloadBytes(outputBytes, `${stripPdfExtension(file.name)}_split.pdf`);
    setStatus("split-status", "指定ページを保存しました。", "success");
  } catch (error) {
    setStatus("split-status", normalizeError(error, "PDFの分割に失敗しました。"), "error");
  }
}

async function handleMergePdf() {
  try {
    if (mergeFiles.length <= 1) {
      throw new Error("結合するPDFを2件以上選択してください。");
    }

    setStatus("merge-status", "PDFを結合しています。", "working");

    const outputPdf = await PDFDocument.create();

    for (const file of mergeFiles) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("PDF以外のファイルが含まれています。");
      }

      const bytes = await readFileAsArrayBuffer(file);
      const sourcePdf = await PDFDocument.load(bytes);
      const pageIndexes = sourcePdf.getPageIndices();
      const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndexes);

      copiedPages.forEach((page) => outputPdf.addPage(page));
    }

    const outputBytes = await outputPdf.save();
    downloadBytes(outputBytes, "merged.pdf");
    setStatus("merge-status", "PDFを結合して保存しました。", "success");
  } catch (error) {
    setStatus("merge-status", normalizeError(error, "PDFの結合に失敗しました。PDFが破損していないか確認してください。"), "error");
  }
}

function renderMergeList() {
  const list = document.getElementById("merge-list");
  list.innerHTML = "";

  if (!mergeFiles.length) {
    list.innerHTML = '<div class="empty-list">PDFはまだ選択されていません。</div>';
    return;
  }

  mergeFiles.forEach((file, index) => {
    list.appendChild(createFileItem(file, index, mergeFiles.length, "merge"));
  });
}

function moveMergeItem(index, direction) {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= mergeFiles.length) {
    return;
  }

  [mergeFiles[index], mergeFiles[nextIndex]] = [mergeFiles[nextIndex], mergeFiles[index]];
  renderMergeList();
}

function removeMergeItem(index) {
  mergeFiles.splice(index, 1);
  renderMergeList();
  setStatus("merge-status", "対象PDFを一覧から削除しました。", "success");
}

async function handleImagesToPdf() {
  try {
    if (!imageFiles.length) {
      throw new Error("変換する画像を選択してください。");
    }

    setStatus("image-status", "画像をPDFに変換しています。", "working");

    const paperSize = document.getElementById("paper-size").value;
    const margin = Number(document.getElementById("image-margin").value);
    const outputPdf = await PDFDocument.create();

    for (const file of imageFiles) {
      if (!isSupportedImage(file)) {
        throw new Error("対応していない画像が含まれています。PNG、JPEG、JPG、WebPを選択してください。");
      }

      const imageElement = await loadImageElement(file);
      const originalWidth = imageElement.naturalWidth;
      const originalHeight = imageElement.naturalHeight;
      const fileName = file.name.toLowerCase();
      let image;

      if (fileName.endsWith(".webp") || file.type === "image/webp") {
        const pngBytes = await convertWebpToPngBytes(file);
        image = await outputPdf.embedPng(pngBytes);
      } else {
        const bytes = await readFileAsArrayBuffer(file);
        image = fileName.endsWith(".png") || file.type === "image/png"
          ? await outputPdf.embedPng(bytes)
          : await outputPdf.embedJpg(bytes);
      }

      const pageSize = getPageSize(paperSize, originalWidth, originalHeight, margin);
      const page = outputPdf.addPage([pageSize.width, pageSize.height]);
      const fitted = fitSize(pageSize.width, pageSize.height, originalWidth, originalHeight, margin);

      page.drawImage(image, {
        x: (pageSize.width - fitted.width) / 2,
        y: (pageSize.height - fitted.height) / 2,
        width: fitted.width,
        height: fitted.height
      });
    }

    const outputBytes = await outputPdf.save();
    downloadBytes(outputBytes, "images_to_pdf.pdf");
    setStatus("image-status", "画像をPDFに変換して保存しました。", "success");
  } catch (error) {
    setStatus("image-status", normalizeError(error, "画像のPDF変換に失敗しました。"), "error");
  }
}

function renderImageList() {
  const list = document.getElementById("image-list");
  list.innerHTML = "";

  if (!imageFiles.length) {
    list.innerHTML = '<div class="empty-list">画像はまだ選択されていません。</div>';
    return;
  }

  imageFiles.forEach((file, index) => {
    list.appendChild(createFileItem(file, index, imageFiles.length, "image"));
  });
}

function moveImageItem(index, direction) {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= imageFiles.length) {
    return;
  }

  [imageFiles[index], imageFiles[nextIndex]] = [imageFiles[nextIndex], imageFiles[index]];
  renderImageList();
}

function removeImageItem(index) {
  imageFiles.splice(index, 1);
  renderImageList();
  setStatus("image-status", "対象画像を一覧から削除しました。", "success");
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました。"));
    reader.readAsArrayBuffer(file);
  });
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像の読み込みに失敗しました。"));
    };
    image.src = url;
  });
}

async function convertWebpToPngBytes(file) {
  const image = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("WebP画像のPNG変換に失敗しました。"));
        return;
      }

      readFileAsArrayBuffer(blob).then(resolve).catch(reject);
    }, "image/png");
  });
}

function fitSize(containerWidth, containerHeight, imageWidth, imageHeight, margin) {
  const availableWidth = Math.max(containerWidth - margin * 2, 1);
  const availableHeight = Math.max(containerHeight - margin * 2, 1);
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);

  return {
    width: imageWidth * scale,
    height: imageHeight * scale
  };
}

function createFileItem(file, index, total, type) {
  const item = document.createElement("div");
  const info = document.createElement("div");
  const name = document.createElement("div");
  const meta = document.createElement("div");
  const actions = document.createElement("div");
  const upButton = document.createElement("button");
  const downButton = document.createElement("button");
  const removeButton = document.createElement("button");

  item.className = "file-item";
  name.className = "file-name";
  meta.className = "file-meta";
  actions.className = "file-actions";
  upButton.className = "small-button";
  downButton.className = "small-button";
  removeButton.className = "small-button";

  name.textContent = `${index + 1}. ${file.name}`;
  meta.textContent = formatFileSize(file.size);
  upButton.textContent = "上へ";
  downButton.textContent = "下へ";
  removeButton.textContent = "削除";
  upButton.type = "button";
  downButton.type = "button";
  removeButton.type = "button";
  upButton.disabled = index === 0;
  downButton.disabled = index === total - 1;

  if (type === "merge") {
    upButton.addEventListener("click", () => moveMergeItem(index, -1));
    downButton.addEventListener("click", () => moveMergeItem(index, 1));
    removeButton.addEventListener("click", () => removeMergeItem(index));
  } else {
    upButton.addEventListener("click", () => moveImageItem(index, -1));
    downButton.addEventListener("click", () => moveImageItem(index, 1));
    removeButton.addEventListener("click", () => removeImageItem(index));
  }

  info.append(name, meta);
  actions.append(upButton, downButton, removeButton);
  item.append(info, actions);

  return item;
}

function getPageSize(paperSize, imageWidth, imageHeight, margin) {
  if (paperSize === "a4-portrait") {
    return { width: 595.28, height: 841.89 };
  }

  if (paperSize === "a4-landscape") {
    return { width: 841.89, height: 595.28 };
  }

  return {
    width: imageWidth + margin * 2,
    height: imageHeight + margin * 2
  };
}

function isSupportedImage(file) {
  const name = file.name.toLowerCase();
  const supportedType = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
  const supportedExtension = /\.(png|jpe?g|webp)$/.test(name);

  return supportedType || supportedExtension;
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normalizeError(error, fallbackMessage) {
  if (error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

document.addEventListener("DOMContentLoaded", init);
