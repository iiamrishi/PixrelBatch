const fileInput = document.getElementById("fileInput");
const namePatternInput = document.getElementById("namePattern");
const startIndexInput = document.getElementById("startIndex");
const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const keepAspectInput = document.getElementById("keepAspect");

const processBtn = document.getElementById("processBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const clearBtn = document.getElementById("clearBtn");

const previewList = document.getElementById("previewList");
const previewHelp = document.getElementById("previewHelp");
const statsEl = document.getElementById("stats")?.querySelector(".footer-text");

const canvas = document.getElementById("hiddenCanvas");
const ctx = canvas.getContext("2d");

let processedFiles = [];

// Utility: read a File as an Image
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Utility: format bytes
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function updateStats() {
  if (!statsEl) return;
  if (!processedFiles.length) {
    statsEl.textContent = "No files processed yet.";
    return;
  }
  const totalBytes = processedFiles.reduce((sum, f) => sum + (f.blob?.size || 0), 0);
  statsEl.textContent = `${processedFiles.length} file(s) · ${formatBytes(
    totalBytes
  )}`;
}

// Clear previews & state
function resetState() {
  processedFiles.forEach(f => {
    if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
  });
  processedFiles = [];
  previewList.innerHTML = "";
  previewHelp.style.display = "";
  downloadAllBtn.disabled = true;
  updateStats();
}

clearBtn.addEventListener("click", () => {
  fileInput.value = "";
  resetState();
});

// Main processing
processBtn.addEventListener("click", async () => {
  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    alert("Please select at least one image file.");
    return;
  }

  resetState();
  processBtn.disabled = true;
  processBtn.textContent = "Processing…";

  const namePrefix = namePatternInput.value || "image_";
  let index = parseInt(startIndexInput.value, 10);
  if (Number.isNaN(index) || index < 0) index = 1;

  const targetWidthInput = parseInt(widthInput.value, 10);
  const targetHeightInput = parseInt(heightInput.value, 10);
  const keepAspect = keepAspectInput.checked;

  for (const file of files) {
    try {
      const img = await fileToImage(file);

      let targetW = Number.isNaN(targetWidthInput) ? img.width : targetWidthInput;
      let targetH = Number.isNaN(targetHeightInput) ? img.height : targetHeightInput;

      const originalW = img.width;
      const originalH = img.height;

      if (keepAspect) {
        if (!Number.isNaN(targetW) && Number.isNaN(targetHeightInput)) {
          // Only width set
          const scale = targetW / originalW;
          targetH = Math.round(originalH * scale);
        } else if (!Number.isNaN(targetH) && Number.isNaN(targetWidthInput)) {
          // Only height set
          const scale = targetH / originalH;
          targetW = Math.round(originalW * scale);
        }
      }

      // Fallbacks
      if (Number.isNaN(targetW)) targetW = originalW;
      if (Number.isNaN(targetH)) targetH = originalH;

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const blob = await new Promise(resolve => {
        canvas.toBlob(
          b => resolve(b),
          "image/png",
          0.92
        );
      });

      const num = String(index).padStart(3, "0");
      const newName = `${namePrefix}${num}.png`;
      index++;

      const previewUrl = URL.createObjectURL(blob);
      processedFiles.push({
        name: newName,
        blob,
        previewUrl,
        width: targetW,
        height: targetH
      });

      addPreviewItem(newName, previewUrl, blob.size, targetW, targetH);
    } catch (err) {
      console.error("Error processing file", file.name, err);
    }
  }

  if (processedFiles.length) {
    downloadAllBtn.disabled = false;
    previewHelp.style.display = "none";
  } else {
    previewHelp.textContent =
      "No files could be processed. Check the console for errors.";
  }

  updateStats();
  processBtn.disabled = false;
  processBtn.textContent = "Process images";
});

// Add a preview card
function addPreviewItem(name, url, sizeBytes, width, height) {
  const item = document.createElement("div");
  item.className = "preview-item";

  const thumb = document.createElement("div");
  thumb.className = "preview-thumb";

  const img = document.createElement("img");
  img.src = url;
  img.alt = name;
  thumb.appendChild(img);

  const meta = document.createElement("div");
  meta.className = "preview-meta";

  const nameEl = document.createElement("div");
  nameEl.className = "preview-name";
  nameEl.textContent = name;

  const sizeEl = document.createElement("div");
  sizeEl.className = "preview-size";
  sizeEl.textContent = `${width}×${height}px · ${formatBytes(sizeBytes)}`;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "PNG";

  meta.appendChild(nameEl);
  meta.appendChild(sizeEl);
  meta.appendChild(badge);

  item.appendChild(thumb);
  item.appendChild(meta);

  previewList.appendChild(item);
}

// Download all as ZIP
downloadAllBtn.addEventListener("click", async () => {
  if (!processedFiles.length) return;

  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = "Preparing ZIP…";

  try {
    const zip = new JSZip();
    for (const file of processedFiles) {
      zip.file(file.name, file.blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "images.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Error generating ZIP", err);
    alert("Failed to generate ZIP. Check console for details.");
  } finally {
    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = "Download all (ZIP)";
  }
});
