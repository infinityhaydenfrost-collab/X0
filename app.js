const STORAGE_KEY = "hayden_notes_v1";
const STORAGE_BACKUP_KEY = "hayden_notes_v1_backup";

const defaultViewPreferences = {
  sortBy: "updatedAt",
  sortDirection: "desc",
  viewMode: "grid",
  cardSize: 36,
  cardStyle: "paper",
  showPreview: true,
  showDate: true,
  groupByMonth: true
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

const defaultFolders = [
  { id: "cerveau", name: "Cerveau", color: "folder-red" },
  { id: "films-series", name: "Films, Séries", color: "folder-blue" },
  { id: "livres", name: "Livres", color: "folder-blue" },
  { id: "cours", name: "Cours", color: "folder-green" }
];

const starterNotes = [
  {
    id: crypto.randomUUID(),
    title: "Première note",
    content: "Bienvenue dans ton app de notes.\n\nL'objectif : une base simple, stable, puis on innove dessus.",
    folderId: "cerveau",
    favorite: true,
    locked: false,
    trashed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let state = loadState();
state.preferences = { ...defaultViewPreferences, ...(state.preferences || {}) };
if (state.preferences.cardWidth && !state.preferences.cardSize) {
  state.preferences.cardSize = convertCardWidthToScale(state.preferences.cardWidth);
}
let currentFilter = "all";
let currentFolderId = null;
let editingNoteId = null;

const sidebar = document.querySelector("#sidebar");
const overlay = document.querySelector("#overlay");
const openSidebarBtn = document.querySelector("#openSidebarBtn");
const closeSidebarBtn = document.querySelector("#closeSidebarBtn");
const folderMenuBtn = document.querySelector("#folderMenuBtn");
const folderActions = document.querySelector("#folderActions");
const createFolderBtn = document.querySelector("#createFolderBtn");
const renameFolderBtn = document.querySelector("#renameFolderBtn");
const colorFolderBtn = document.querySelector("#colorFolderBtn");
const notesArea = document.querySelector("#notesArea");
const pageTitle = document.querySelector("#pageTitle");
const pageSubtitle = document.querySelector("#pageSubtitle");
const breadcrumbFolder = document.querySelector("#breadcrumbFolder");
const searchBtn = document.querySelector("#searchBtn");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
const viewOptionsBtn = document.querySelector("#viewOptionsBtn");
const viewPanel = document.querySelector("#viewPanel");
const sortBySelect = document.querySelector("#sortBySelect");
const sortDirectionSelect = document.querySelector("#sortDirectionSelect");
const viewModeSelect = document.querySelector("#viewModeSelect");
const cardSizeRange = document.querySelector("#cardSizeRange");
const cardSizeValue = document.querySelector("#cardSizeValue");
const cardStyleSelect = document.querySelector("#cardStyleSelect");
const showPreviewToggle = document.querySelector("#showPreviewToggle");
const showDateToggle = document.querySelector("#showDateToggle");
const groupByMonthToggle = document.querySelector("#groupByMonthToggle");
const addNoteBtn = document.querySelector("#addNoteBtn");

const editorModal = document.querySelector("#editorModal");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const noteTitleInput = document.querySelector("#noteTitleInput");
const noteContentInput = document.querySelector("#noteContentInput");
const noteFolderSelect = document.querySelector("#noteFolderSelect");
const favoriteBtn = document.querySelector("#favoriteBtn");
const deleteBtn = document.querySelector("#deleteBtn");
const imageInput = document.querySelector("#imageInput");
const imageControls = document.querySelector("#imageControls");
const coverInput = document.querySelector("#coverInput");
const noteActionSheet = document.querySelector("#noteActionSheet");
const noteActionTitle = document.querySelector("#noteActionTitle");
const coverNoteBtn = document.querySelector("#coverNoteBtn");
const coverPositionControls = document.querySelector("#coverPositionControls");
const removeCoverBtn = document.querySelector("#removeCoverBtn");
const deleteSelectedNoteBtn = document.querySelector("#deleteSelectedNoteBtn");
const closeNoteActionBtn = document.querySelector("#closeNoteActionBtn");
let selectedImageFigure = null;
let selectedNoteId = null;
let savedEditorRange = null;
let autoSaveTimer = null;

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const backup = localStorage.getItem(STORAGE_BACKUP_KEY);

  if (!raw) {
    if (backup) return normalizeLoadedState(backup);

    return {
      folders: defaultFolders,
      notes: starterNotes,
      preferences: defaultViewPreferences
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if ((!parsed.notes || parsed.notes.length === 0) && backup) {
      const backupState = normalizeLoadedState(backup);
      if (backupState.notes.length > 0) return backupState;
    }

    return normalizeState(parsed);
  } catch {
    if (backup) return normalizeLoadedState(backup);

    return {
      folders: defaultFolders,
      notes: starterNotes,
      preferences: defaultViewPreferences
    };
  }
}

function normalizeLoadedState(raw) {
  return normalizeState(JSON.parse(raw));
}

function normalizeState(parsed) {
  return {
    ...parsed,
    folders: parsed.folders?.length ? parsed.folders : defaultFolders,
    notes: Array.isArray(parsed.notes) ? parsed.notes : starterNotes,
    preferences: { ...defaultViewPreferences, ...(parsed.preferences || {}) }
  };
}

function saveState() {
  const previous = localStorage.getItem(STORAGE_KEY);
  if (previous) {
    try {
      const previousState = JSON.parse(previous);
      if (previousState.notes?.length) {
        localStorage.setItem(STORAGE_BACKUP_KEY, previous);
      }
    } catch {
      localStorage.setItem(STORAGE_BACKUP_KEY, previous);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createId(prefix) {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCardWidthFromScale(scale) {
  const normalized = Math.max(1, Math.min(100, Number(scale) || 1));
  return Math.round(92 + ((normalized - 1) / 99) * 168);
}

function convertCardWidthToScale(width) {
  const normalized = Math.max(92, Math.min(260, Number(width) || 132));
  return Math.round(((normalized - 92) / 168) * 99 + 1);
}

function openSidebar() {
  sidebar.classList.add("open");
  overlay.classList.add("show");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

function attachSidebarSwipeClose() {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let tracking = false;
  let swiping = false;

  const start = event => {
    if (!sidebar.classList.contains("open")) return;

    const point = event.touches ? event.touches[0] : event;
    startX = point.clientX;
    startY = point.clientY;
    currentX = startX;
    tracking = true;
    swiping = false;
  };

  const move = event => {
    if (!tracking || !sidebar.classList.contains("open")) return;

    const point = event.touches ? event.touches[0] : event;
    const deltaX = point.clientX - startX;
    const deltaY = point.clientY - startY;

    if (!swiping && Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
      swiping = true;
      sidebar.classList.add("dragging");
    }

    if (!swiping) return;

    currentX = point.clientX;
    const offset = Math.min(0, deltaX);
    sidebar.style.transform = `translateX(${offset}px)`;

    if (event.cancelable) {
      event.preventDefault();
    }
  };

  const end = () => {
    if (!tracking) return;

    const deltaX = currentX - startX;
    const shouldClose = swiping && deltaX < -48;

    tracking = false;
    swiping = false;
    sidebar.classList.remove("dragging");
    sidebar.style.transform = "";

    if (shouldClose) {
      closeSidebar();
    }
  };

  sidebar.addEventListener("touchstart", start, { passive: true });
  sidebar.addEventListener("touchmove", move, { passive: false });
  sidebar.addEventListener("touchend", end);
  sidebar.addEventListener("touchcancel", end);

  overlay.addEventListener("touchstart", start, { passive: true });
  overlay.addEventListener("touchmove", move, { passive: false });
  overlay.addEventListener("touchend", end);
  overlay.addEventListener("touchcancel", end);
}

function getVisibleNotes() {
  const search = searchInput.value.trim().toLowerCase();
  const { sortBy, sortDirection } = state.preferences;

  return state.notes
    .filter(note => {
      if (currentFolderId) return note.folderId === currentFolderId && !note.trashed;
      if (currentFilter === "favorites") return note.favorite && !note.trashed;
      if (currentFilter === "locked") return note.locked && !note.trashed;
      if (currentFilter === "trash") return note.trashed;
      return !note.trashed;
    })
    .filter(note => {
      if (!search) return true;
      const plainContent = isHtmlContent(note.content)
        ? getPlainTextFromHtml(note.content)
        : note.content;

      return (
        note.title.toLowerCase().includes(search) ||
        plainContent.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => compareNotes(a, b, sortBy, sortDirection));
}

function compareNotes(a, b, sortBy, sortDirection) {
  const direction = sortDirection === "asc" ? 1 : -1;
  let result = 0;

  if (sortBy === "title") {
    result = (a.title || "Sans titre").localeCompare(
      b.title || "Sans titre",
      "fr",
      { sensitivity: "base" }
    );
  } else {
    result = new Date(a[sortBy]) - new Date(b[sortBy]);
  }

  return result * direction;
}

function getMonthLabel(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ".");
}

function getShortDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function setFavoriteButton(isFavorite) {
  favoriteBtn.dataset.favorite = String(isFavorite);
  favoriteBtn.innerHTML = isFavorite ? "&#9733;" : "&#9734;";
  favoriteBtn.setAttribute(
    "aria-label",
    isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
  );
}

function isHtmlContent(content) {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

function textToEditorHtml(text) {
  return text
    .split("\n")
    .map(line => `<div>${escapeHtml(line) || "<br>"}</div>`)
    .join("");
}

function getPlainTextFromHtml(html) {
  const preview = document.createElement("div");
  preview.innerHTML = html;
  return preview.textContent.replace(/\s+/g, " ").trim();
}

function prepareContentForSave() {
  noteContentInput.querySelectorAll(".note-image.selected").forEach(image => {
    image.classList.remove("selected");
  });
  noteContentInput.querySelectorAll(".copy-button").forEach(button => {
    button.textContent = "Copier";
  });
}

function focusEditor() {
  noteContentInput.focus();
}

function saveEditorSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  if (noteContentInput.contains(range.commonAncestorContainer)) {
    savedEditorRange = range.cloneRange();
  }
}

function restoreEditorSelection() {
  if (!savedEditorRange) return;

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedEditorRange);
}

function runEditorCommand(command, value = null) {
  focusEditor();
  restoreEditorSelection();
  document.execCommand(command, false, value);
  saveEditorSelection();
}

function insertEditorHtml(html) {
  focusEditor();
  restoreEditorSelection();
  document.execCommand("insertHTML", false, html);
  saveEditorSelection();
}

function insertChecklistItem() {
  insertEditorHtml(
    `<div class="check-line"><input type="checkbox"> <span><br></span></div>`
  );
}

function insertCopyBlock() {
  insertEditorHtml(
    `<div class="copy-block"><button class="copy-button" type="button" contenteditable="false">Copier</button><div class="copy-content" contenteditable="true">Texte a copier</div></div><div><br></div>`
  );
}

function insertImage(src) {
  const figure = document.createElement("figure");
  figure.className = "note-image size-medium";
  figure.setAttribute("contenteditable", "false");

  const image = document.createElement("img");
  image.src = src;
  image.alt = "Image inseree dans la note";

  const spacer = document.createElement("div");
  spacer.innerHTML = "<br>";

  figure.appendChild(image);
  noteContentInput.appendChild(figure);
  noteContentInput.appendChild(spacer);
  noteContentInput.focus();
  saveEditorSelection();
}

function clearSelectedImage() {
  if (selectedImageFigure) {
    selectedImageFigure.classList.remove("selected");
  }

  selectedImageFigure = null;
  imageControls.classList.remove("show");
}

function selectImage(figure) {
  clearSelectedImage();
  selectedImageFigure = figure;
  selectedImageFigure.classList.add("selected");
  imageControls.classList.add("show");
}

function setSelectedImageSize(size) {
  if (!selectedImageFigure) return;

  selectedImageFigure.classList.remove("size-small", "size-medium", "size-full");
  selectedImageFigure.classList.add(`size-${size}`);
}

function deleteSelectedImage() {
  if (!selectedImageFigure) return;

  const image = selectedImageFigure;
  clearSelectedImage();
  image.remove();
}

function openNoteActions(noteId) {
  const note = state.notes.find(item => item.id === noteId);
  if (!note) return;

  selectedNoteId = noteId;
  noteActionTitle.textContent = note.title || "Sans titre";
  coverNoteBtn.textContent = note.coverImage ? "Changer la couverture" : "Ajouter une couverture";
  coverPositionControls.style.display = note.coverImage ? "grid" : "none";
  removeCoverBtn.style.display = note.coverImage ? "block" : "none";
  noteActionSheet.classList.add("open");
  noteActionSheet.setAttribute("aria-hidden", "false");
}

function closeNoteActions() {
  selectedNoteId = null;
  noteActionSheet.classList.remove("open");
  noteActionSheet.setAttribute("aria-hidden", "true");
}

function deleteSelectedNote() {
  const note = state.notes.find(item => item.id === selectedNoteId);
  if (!note) return;

  note.trashed = true;
  note.updatedAt = new Date().toISOString();
  saveState();
  closeNoteActions();
  render();
}

function setSelectedNoteCover(src) {
  const note = state.notes.find(item => item.id === selectedNoteId);
  if (!note) return;

  note.coverImage = src;
  note.coverPosition = note.coverPosition || "50% 50%";
  note.updatedAt = new Date().toISOString();
  saveState();
  closeNoteActions();
  render();
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  return Promise.resolve();
}

function copyBlockContent(button) {
  const block = button.closest(".copy-block");
  const content = block?.querySelector(".copy-content");
  const text = content?.innerText.trim() || "";
  if (!text) return;

  copyTextToClipboard(text).then(() => {
    const previousText = button.textContent;
    button.textContent = "Copie";
    window.setTimeout(() => {
      button.textContent = previousText;
    }, 1200);
  });
}

function removeSelectedNoteCover() {
  const note = state.notes.find(item => item.id === selectedNoteId);
  if (!note) return;

  delete note.coverImage;
  delete note.coverPosition;
  note.updatedAt = new Date().toISOString();
  saveState();
  closeNoteActions();
  render();
}

function setSelectedNoteCoverPosition(position) {
  const note = state.notes.find(item => item.id === selectedNoteId);
  if (!note || !note.coverImage) return;

  note.coverPosition = position;
  note.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSize = 1400;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };

      image.onerror = reject;
      image.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function syncChecklistState() {
  noteContentInput.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    if (checkbox.checked) {
      checkbox.setAttribute("checked", "");
    } else {
      checkbox.removeAttribute("checked");
    }
  });
}

function hasEditorContent() {
  return (
    noteContentInput.textContent.trim() ||
    noteContentInput.querySelector("input, img, hr")
  );
}

function handleEditorTool(action) {
  if (!action) return;

  if (action === "heading") {
    runEditorCommand("formatBlock", "h2");
    return;
  }

  if (action === "checklist") {
    insertChecklistItem();
    return;
  }

  if (action === "bold") {
    runEditorCommand("bold");
    return;
  }

  if (action === "italic") {
    runEditorCommand("italic");
    return;
  }

  if (action === "image") {
    imageInput.click();
    return;
  }

  if (action === "copy") {
    insertCopyBlock();
    return;
  }

  if (action === "divider") {
    insertEditorHtml("<hr>");
  }
}

function renderCounts() {
  document.querySelector("#allCount").textContent = state.notes.filter(n => !n.trashed).length;
  document.querySelector("#favCount").textContent = state.notes.filter(n => n.favorite && !n.trashed).length;
  document.querySelector("#lockedCount").textContent = state.notes.filter(n => n.locked && !n.trashed).length;
  document.querySelector("#trashCount").textContent = state.notes.filter(n => n.trashed).length;
  document.querySelector("#folderMenuCount").textContent = state.folders.length;
}

function createFolder() {
  const name = prompt("Nom du nouveau dossier");
  if (!name || !name.trim()) return;

  const colors = ["folder-red", "folder-blue", "folder-green", "folder-yellow", "folder-purple", "folder-pink"];
  state.folders.push({
    id: createId("folder"),
    name: name.trim(),
    color: colors[state.folders.length % colors.length]
  });

  saveState();
  render();
}

function renameCurrentFolder() {
  if (!currentFolderId) {
    alert("Ouvre d'abord un dossier a renommer.");
    return;
  }

  const folder = state.folders.find(item => item.id === currentFolderId);
  if (!folder) return;

  const name = prompt("Nouveau nom du dossier", folder.name);
  if (!name || !name.trim()) return;

  folder.name = name.trim();
  saveState();
  render();
}

function changeCurrentFolderColor() {
  if (!currentFolderId) {
    alert("Ouvre d'abord un dossier pour changer sa couleur.");
    return;
  }

  const folder = state.folders.find(item => item.id === currentFolderId);
  if (!folder) return;

  const color = prompt("Couleur : rouge, bleu, vert, jaune, violet ou rose", "jaune");
  if (!color) return;

  const colorMap = {
    rouge: "folder-red",
    bleu: "folder-blue",
    vert: "folder-green",
    jaune: "folder-yellow",
    violet: "folder-purple",
    rose: "folder-pink"
  };

  const nextColor = colorMap[color.trim().toLowerCase()];
  if (!nextColor) return;

  folder.color = nextColor;
  saveState();
  render();
}

function renderFolderSelect() {
  noteFolderSelect.innerHTML = "";

  state.folders.forEach(folder => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    noteFolderSelect.appendChild(option);
  });
}

function renderHeader(visibleNotes) {
  let title = "Toutes les notes 2.3";

  if (currentFolderId) {
    title = state.folders.find(folder => folder.id === currentFolderId)?.name ?? "Dossier";
  }

  if (currentFilter === "folders") title = "Dossiers";
  if (currentFilter === "favorites") title = "Favoris";
  if (currentFilter === "locked") title = "Notes verrouillées";
  if (currentFilter === "trash") title = "Corbeille";

  pageTitle.textContent = title;
  pageSubtitle.textContent = currentFilter === "folders"
    ? `${state.folders.length} dossier${state.folders.length > 1 ? "s" : ""}, ${state.notes.filter(note => !note.trashed).length} note${state.notes.filter(note => !note.trashed).length > 1 ? "s" : ""}`
    : `${visibleNotes.length} note${visibleNotes.length > 1 ? "s" : ""}`;
  breadcrumbFolder.textContent = title;
}

function renderNotes() {
  const visibleNotes = getVisibleNotes();
  renderHeader(visibleNotes);

  notesArea.innerHTML = "";
  notesArea.className = `notes-area view-${state.preferences.viewMode} style-${state.preferences.cardStyle}`;
  notesArea.style.setProperty("--note-card-size", `${getCardWidthFromScale(state.preferences.cardSize)}px`);

  if (currentFilter === "folders") {
    renderFolderOverview();
    return;
  }

  if (visibleNotes.length === 0) {
    notesArea.innerHTML = `<p class="empty-state">Aucune note pour l'instant.</p>`;
    return;
  }

  if (!state.preferences.groupByMonth) {
    const grid = renderNotesGrid(visibleNotes);
    notesArea.appendChild(grid);
    return;
  }

  const grouped = new Map();

  visibleNotes.forEach(note => {
    const month = getMonthLabel(note.updatedAt);
    if (!grouped.has(month)) grouped.set(month, []);
    grouped.get(month).push(note);
  });

  grouped.forEach((notes, month) => {
    const group = document.createElement("div");
    group.className = "month-group";

    const title = document.createElement("h2");
    title.className = "month-title";
    title.textContent = month;

    group.appendChild(title);
    group.appendChild(renderNotesGrid(notes));
    notesArea.appendChild(group);
  });
}

function renderFolderOverview() {
  notesArea.className = "notes-area folders-overview";
  notesArea.style.setProperty("--folder-card-size", `${Math.round(getCardWidthFromScale(state.preferences.cardSize) * 0.78)}px`);

  const grid = document.createElement("div");
  grid.className = "folder-card-grid";

  state.folders.forEach(folder => {
    const count = state.notes.filter(note => note.folderId === folder.id && !note.trashed).length;
    const button = document.createElement("button");
    button.className = `folder-card ${folder.color}`;
    button.innerHTML = `
      <span class="folder-card-count">${count}</span>
      <span class="folder-card-paper"></span>
      <span class="folder-card-name">${escapeHtml(folder.name)}</span>
    `;

    button.addEventListener("click", () => {
      currentFolderId = folder.id;
      currentFilter = "folder";
      render();
    });

    grid.appendChild(button);
  });

  notesArea.appendChild(grid);
}

function renderNotesGrid(notes) {
  const grid = document.createElement("div");
  grid.className = "notes-grid";

  notes.forEach(note => {
    grid.appendChild(renderNoteCard(note));
  });

  return grid;
}

function renderNoteCard(note) {
  const card = document.createElement("button");
  const preview = isHtmlContent(note.content)
    ? getPlainTextFromHtml(note.content)
    : note.content;
  const folder = state.folders.find(item => item.id === note.folderId);
  const dateLabel = state.preferences.sortBy === "createdAt"
    ? getShortDate(note.createdAt)
    : getShortDate(note.updatedAt);
  const coverHtml = note.coverImage
    ? `<img class="note-cover" src="${note.coverImage}" alt="Couverture de la note" style="object-position: ${note.coverPosition || "50% 50%"};">`
    : "";
  const paperHtml = state.preferences.showPreview
    ? `<div class="note-paper">${coverHtml || escapeHtml(preview.slice(0, 140))}</div>`
    : "";

  card.className = "note-card";
  card.innerHTML = `
    ${paperHtml}
    <div class="note-card-body">
      <div class="note-title">${escapeHtml(note.title || "Sans titre")}${note.favorite ? " ★" : ""}</div>
      ${state.preferences.showDate ? `<div class="note-date">${dateLabel}${folder ? ` · ${escapeHtml(folder.name)}` : ""}</div>` : ""}
    </div>
  `;

  attachNoteCardActions(card, note.id);
  return card;
}

function attachNoteCardActions(card, noteId) {
  let longPressTimer = null;
  let didLongPress = false;

  const startPress = event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    window.clearTimeout(longPressTimer);
    didLongPress = false;
    longPressTimer = window.setTimeout(() => {
      didLongPress = true;
      openNoteActions(noteId);
    }, 540);
  };

  const cancelPress = () => {
    window.clearTimeout(longPressTimer);
  };

  card.addEventListener("pointerdown", startPress);
  card.addEventListener("pointerup", cancelPress);
  card.addEventListener("pointerleave", cancelPress);
  card.addEventListener("pointercancel", cancelPress);
  card.addEventListener("selectstart", event => event.preventDefault());
  card.addEventListener("dragstart", event => event.preventDefault());
  card.addEventListener("touchstart", event => {
    if (event.touches.length === 1) {
      startPress({ pointerType: "touch" });
    }
  }, { passive: true });
  card.addEventListener("touchend", cancelPress);
  card.addEventListener("touchmove", cancelPress);

  card.addEventListener("contextmenu", event => {
    event.preventDefault();
    openNoteActions(noteId);
  });

  card.addEventListener("click", event => {
    if (didLongPress) {
      event.preventDefault();
      return;
    }

    openEditor(noteId);
  });
}

function renderMenuActiveState() {
  document.querySelectorAll(".menu-item").forEach(item => {
    item.classList.toggle("active", item.dataset.filter === currentFilter && !currentFolderId);
  });
}

function renderViewControls() {
  sortBySelect.value = state.preferences.sortBy;
  sortDirectionSelect.value = state.preferences.sortDirection;
  viewModeSelect.value = state.preferences.viewMode;
  cardSizeRange.value = state.preferences.cardSize;
  cardSizeValue.textContent = state.preferences.cardSize;
  cardStyleSelect.value = state.preferences.cardStyle;
  showPreviewToggle.checked = state.preferences.showPreview;
  showDateToggle.checked = state.preferences.showDate;
  groupByMonthToggle.checked = state.preferences.groupByMonth;
}

function updateViewPreference(key, value) {
  state.preferences[key] = value;
  saveState();
  renderNotes();
}

function render() {
  renderCounts();
  renderFolderSelect();
  renderMenuActiveState();
  renderViewControls();
  renderNotes();
}

function openEditor(noteId = null) {
  editingNoteId = noteId;
  const note = state.notes.find(item => item.id === noteId);

  if (note) {
    noteTitleInput.value = note.title;
    noteContentInput.innerHTML = isHtmlContent(note.content)
      ? note.content
      : textToEditorHtml(note.content);
    noteFolderSelect.value = note.folderId;
    setFavoriteButton(note.favorite);
    deleteBtn.style.display = "inline-grid";
  } else {
    noteTitleInput.value = "";
    noteContentInput.innerHTML = "";
    noteFolderSelect.value = currentFolderId || state.folders[0].id;
    setFavoriteButton(false);
    deleteBtn.style.display = "none";
  }

  editorModal.classList.add("open");
  editorModal.setAttribute("aria-hidden", "false");
  noteTitleInput.focus();
}

function closeEditor() {
  saveNote();
  closeEditorWithoutSave();
}

function closeEditorWithoutSave() {
  editorModal.classList.remove("open");
  editorModal.setAttribute("aria-hidden", "true");
  editingNoteId = null;
  clearSelectedImage();
}

function saveNote(options = {}) {
  const title = noteTitleInput.value.trim() || "Sans titre";
  syncChecklistState();
  prepareContentForSave();
  const content = noteContentInput.innerHTML.trim();
  const folderId = noteFolderSelect.value;

  if (!hasEditorContent() && title === "Sans titre") {
    return;
  }

  const existing = state.notes.find(note => note.id === editingNoteId);

  if (existing) {
    existing.title = title;
    existing.content = content;
    existing.folderId = folderId;
    existing.updatedAt = new Date().toISOString();
  } else {
    state.notes.unshift({
      id: createId("note"),
      title,
      content,
      folderId,
      favorite: favoriteBtn.dataset.favorite === "true",
      locked: false,
      trashed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    editingNoteId = state.notes[0].id;
    deleteBtn.style.display = "inline-grid";
  }

  saveState();
  if (!options.silent) render();
}

function scheduleAutoSave() {
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    if (editorModal.classList.contains("open")) {
      saveNote({ silent: true });
      renderNotes();
    }
  }, 450);
}

function toggleFavorite() {
  const existing = state.notes.find(note => note.id === editingNoteId);

  if (existing) {
    existing.favorite = !existing.favorite;
    setFavoriteButton(existing.favorite);
    saveState();
    render();
    return;
  }

  const isFavorite = favoriteBtn.dataset.favorite === "true";
  setFavoriteButton(!isFavorite);
}

function deleteNote() {
  const existing = state.notes.find(note => note.id === editingNoteId);
  if (!existing) return;

  if (existing.trashed) {
    state.notes = state.notes.filter(note => note.id !== existing.id);
  } else {
    existing.trashed = true;
    existing.updatedAt = new Date().toISOString();
  }

  saveState();
  closeEditorWithoutSave();
  render();
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

openSidebarBtn.addEventListener("click", openSidebar);
closeSidebarBtn.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);
attachSidebarSwipeClose();

folderMenuBtn.addEventListener("click", () => {
  folderActions.classList.toggle("open");
});

createFolderBtn.addEventListener("click", createFolder);
renameFolderBtn.addEventListener("click", renameCurrentFolder);
colorFolderBtn.addEventListener("click", changeCurrentFolderColor);

document.querySelectorAll(".menu-item").forEach(item => {
  item.addEventListener("click", () => {
    currentFolderId = null;
    currentFilter = item.dataset.filter;
    closeSidebar();
    render();
  });
});

searchBtn.addEventListener("click", () => {
  searchPanel.classList.toggle("open");
  searchInput.focus();
});

searchInput.addEventListener("input", renderNotes);

viewOptionsBtn.addEventListener("click", () => {
  viewPanel.classList.toggle("open");
});

sortBySelect.addEventListener("change", () => {
  updateViewPreference("sortBy", sortBySelect.value);
});

sortDirectionSelect.addEventListener("change", () => {
  updateViewPreference("sortDirection", sortDirectionSelect.value);
});

viewModeSelect.addEventListener("change", () => {
  updateViewPreference("viewMode", viewModeSelect.value);
});

cardSizeRange.addEventListener("input", () => {
  cardSizeValue.textContent = cardSizeRange.value;
  updateViewPreference("cardSize", Number(cardSizeRange.value));
});

cardStyleSelect.addEventListener("change", () => {
  updateViewPreference("cardStyle", cardStyleSelect.value);
});

showPreviewToggle.addEventListener("change", () => {
  updateViewPreference("showPreview", showPreviewToggle.checked);
});

showDateToggle.addEventListener("change", () => {
  updateViewPreference("showDate", showDateToggle.checked);
});

groupByMonthToggle.addEventListener("change", () => {
  updateViewPreference("groupByMonth", groupByMonthToggle.checked);
});

addNoteBtn.addEventListener("click", () => openEditor());
cancelEditBtn.addEventListener("click", closeEditor);
favoriteBtn.addEventListener("click", toggleFavorite);
deleteBtn.addEventListener("click", deleteNote);

noteTitleInput.addEventListener("input", scheduleAutoSave);
noteFolderSelect.addEventListener("change", scheduleAutoSave);

noteContentInput.addEventListener("click", event => {
  const copyButton = event.target.closest(".copy-button");
  if (copyButton) {
    event.preventDefault();
    copyBlockContent(copyButton);
    return;
  }

  const imageFigure = event.target.closest(".note-image");

  if (imageFigure) {
    selectImage(imageFigure);
    return;
  }

  clearSelectedImage();
  saveEditorSelection();
});

noteContentInput.addEventListener("keyup", saveEditorSelection);
noteContentInput.addEventListener("mouseup", saveEditorSelection);
noteContentInput.addEventListener("touchend", saveEditorSelection);
noteContentInput.addEventListener("input", () => {
  saveEditorSelection();
  scheduleAutoSave();
});

imageInput.addEventListener("change", async () => {
  const files = Array.from(imageInput.files);
  if (files.length === 0) return;

  for (const file of files) {
    const src = await resizeImageFile(file);
    insertImage(src);
  }
  imageInput.value = "";
  scheduleAutoSave();
});

coverInput.addEventListener("change", async () => {
  const [file] = coverInput.files;
  if (!file) return;

  const src = await resizeImageFile(file);
  setSelectedNoteCover(src);
  coverInput.value = "";
});

noteActionSheet.addEventListener("click", event => {
  if (event.target === noteActionSheet) {
    closeNoteActions();
  }
});

coverNoteBtn.addEventListener("click", () => {
  coverInput.click();
});

coverPositionControls.querySelectorAll("button").forEach(button => {
  button.addEventListener("click", () => {
    setSelectedNoteCoverPosition(button.dataset.coverPosition);
  });
});

removeCoverBtn.addEventListener("click", removeSelectedNoteCover);
deleteSelectedNoteBtn.addEventListener("click", deleteSelectedNote);
closeNoteActionBtn.addEventListener("click", closeNoteActions);

imageControls.querySelectorAll("button").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.imageAction;

    if (action === "delete") {
      deleteSelectedImage();
      return;
    }

    setSelectedImageSize(action);
  });
});

document.querySelectorAll(".editor-tools .tool-button").forEach(button => {
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (button.dataset.action !== "image") {
      saveEditorSelection();
    }
  });
  button.addEventListener("mousedown", event => {
    event.preventDefault();
    if (button.dataset.action !== "image") {
      saveEditorSelection();
    }
  });
  button.addEventListener("click", () => handleEditorTool(button.dataset.action));
});

render();
