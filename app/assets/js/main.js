/* ---------- DOM ---------- */
const fileInput         = document.getElementById('fileInput');
const menuDiv           = document.getElementById('menu');
const messageDiv        = document.getElementById('message');
const romOverlay        = document.getElementById('romOverlay');
const overlaySystemName = document.getElementById('overlaySystemName');
const searchInput       = document.getElementById('searchInput');
const romListDiv        = document.getElementById('romList');
const romDetailDiv      = document.getElementById('romDetail');

/* ---------- State ---------- */
let systems = [];
let systemIndex = 0;

let romDataGlobal = {};
let roms = [];               // array of ROM urls (strings)
let romButtons = [];         // array of <button>
let romIndex = 0;            // selected index within romButtons
let metadataCache = new Map();

/* ---------- Utilities ---------- */
// decode %20 and remove extension
const decodeName = (s) => decodeURIComponent(s).replace(/\.[^/.]+$/, "");

// keep full display name (incl. region/rev), but simplify for lookup
const toLookupTitle = (name) =>
  name
    .replace(/\[[^\]]*\]/g, "")    // [!], [Proto], etc
    .replace(/\s*\([^)]*\)/g, "")  // (USA), (Rev 1), etc
    .replace(/\s+/g, " ")
    .trim();

// get last segment of path
const basename = (p) => p.split("/").pop();

// Convenience: create element
function el(tag, props={}, ...children){
  const e = document.createElement(tag);
  Object.assign(e, props);
  for(const c of children){
    if (c == null) continue;
    e.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}

/* ---------- Load file from URL parameter ---------- */
async function loadFileFromURLParam() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('retbrorl');
  if (!url) return; // no parameter, do nothing

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const text = await res.text();
    romDataGlobal = JSON.parse(text);

    systems = Object.keys(romDataGlobal);
    if (!systems.length) {
      messageDiv.textContent = "No ROMs found in the file.";
      return;
    }

    messageDiv.textContent = "← → (or D-pad left/right) to choose a system, Enter/A to open.";
    menuDiv.innerHTML = "";
    systems.forEach((sys, i) => {
      const tile = el("div", { className: "system-tile", textContent: sys });
      tile.addEventListener('click', () => { systemIndex = i; updateSystemSelection(); openRomOverlay(); });
      tile.addEventListener('mouseenter', () => { systemIndex = i; updateSystemSelection(); });
      menuDiv.appendChild(tile);
    });
    updateSystemSelection();
  } catch (err) {
    console.error(err);
    messageDiv.textContent = "Could not fetch or parse the JSON file from URL.";
  }
}

// Call on page load
loadFileFromURLParam();

/* ---------- File load ---------- */
fileInput.addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;

  if (!/\.retbrorl$|\.json$/i.test(file.name)){
    messageDiv.textContent = "Please select a valid .retbrorl or .json file.";
    return;
  }

  try{
    const text = await file.text();
    romDataGlobal = JSON.parse(text);

    systems = Object.keys(romDataGlobal);
    if(!systems.length){
      messageDiv.textContent = "No ROMs found in the file.";
      return;
    }

    messageDiv.textContent = "← → (or D-pad left/right) to choose a system, Enter/A to open.";
    menuDiv.innerHTML = "";
    systems.forEach((sys, i) => {
      const tile = el("div", { className:"system-tile", textContent: sys });
      tile.addEventListener('click', () => { systemIndex = i; updateSystemSelection(); openRomOverlay(); });
      tile.addEventListener('mouseenter', () => { systemIndex = i; updateSystemSelection(); });
      menuDiv.appendChild(tile);
    });
    updateSystemSelection();
  }catch(err){
    console.error(err);
    messageDiv.textContent = "Could not read or parse the JSON file.";
  }
});

/* ---------- System carousel selection ---------- */
function updateSystemSelection(){
  const tiles = document.querySelectorAll('.system-tile');
  tiles.forEach(t => t.classList.remove('selected'));
  if (tiles[systemIndex]){
    tiles[systemIndex].classList.add('selected');
    tiles[systemIndex].scrollIntoView({ behavior:"smooth", inline:"center", block:"nearest" });
  }
}

/* ---------- Overlay ---------- */
function openRomOverlay(){
  const systemName = systems[systemIndex];
  overlaySystemName.textContent = systemName;

  roms = romDataGlobal[systemName] || [];
  romListDiv.innerHTML = "";
  romDetailDiv.innerHTML = '<div class="loading">Select a game to see details…</div>';
  metadataCache.clear(); // optional: clear when switching systems

  romButtons = roms.map((url, idx) => {
    const raw   = basename(url);
    const shown = decodeName(raw);     // keep (Japan) (Rev 1) visible
    const btn   = el("button", { textContent: shown });
    btn.dataset.idx = idx;
    btn.dataset.url = url;
    btn.addEventListener('click', () => launchRomByUrl(url));
    btn.addEventListener('mouseenter', () => { romIndex = idx; highlightRomAndShowDetails(); });
    romListDiv.appendChild(btn);
    return btn;
  });

  romIndex = 0;
  highlightRomAndShowDetails();

  romOverlay.style.display = "flex";
  romOverlay.setAttribute("aria-hidden","false");
  searchInput.value = "";
  searchInput.focus({ preventScroll:true });
}

/* ---------- Detailed view ---------- */
async function highlightRomAndShowDetails(){
  // sync selection with visible items only
  const visible = romButtons.filter(b => b.style.display !== "none");
  if (!visible.length){ romDetailDiv.innerHTML = '<div class="error">No results.</div>'; return; }

  // clamp romIndex to a visible element
  const target = visible[Math.min(romIndex, visible.length-1)];
  romButtons.forEach(b => b.classList.remove("selected"));
  target.classList.add("selected");

  // display loading
  romDetailDiv.innerHTML = '<div class="loading">Fetching game info…</div>';

  const displayName = target.textContent;
  const cacheKey = displayName;
  let info = metadataCache.get(cacheKey);
  if (!info){
    info = await fetchGameInfo(displayName);
    metadataCache.set(cacheKey, info);
  }

  renderDetail(info);
}

function renderDetail(info){
  const cover = info.cover || `https://picsum.photos/300/420?random=${encodeURIComponent(info.name)}`;
  const shots = info.screenshots || [];
  const genresJoined = info.genres?.length ? info.genres.join(", ") : (info.genre || "Unknown");

  romDetailDiv.innerHTML = "";
  const top = el("div", { className:"detail-top" },
    el("img", { className:"cover", src: cover, alt:"cover" }),
    el("div", {},
      el("h3", { className:"title", textContent: info.name || "Unknown Title" }),
      el("div", { className:"meta" },
        el("div", {}, el("b", {}, "System: "),     " ", info.system || "Unknown"),
        el("div", {}, el("b", {}, "Genre: "),      " ", genresJoined),
        el("div", {}, el("b", {}, "Developer: "),  " ", info.dev || "Unknown"),
        el("div", {}, el("b", {}, "Publisher: "),  " ", info.publisher || "Unknown"),
        el("div", {}, el("b", {}, "Players: "),    " ", info.players || "Unknown"),
        el("div", {}, el("b", {}, "Year: "),       " ", info.year || "Unknown"),
      )
    )
  );

  const desc = el("div", { className:"desc" }, info.desc || "No description available.");
  romDetailDiv.append(top, desc);

  if (shots.length){
    const grid = el("div", { className:"shots" });
    shots.slice(0, 8).forEach(src => grid.appendChild(el("img", { src, alt:"screenshot" })));
    romDetailDiv.appendChild(grid);
  }
}

/* ---------- Search/filter ---------- */
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  romButtons.forEach(btn => {
    const hit = btn.textContent.toLowerCase().includes(q);
    btn.style.display = hit ? "" : "none";
  });
  // reset selection to the first visible
  romIndex = 0;
  highlightRomAndShowDetails();
});

/* ---------- Launch ---------- */
function launchRomByUrl(url){
  window.location.href = `emulator.html?rom=${encodeURIComponent(url)}`;
}

/* ---------- Keyboard ---------- */
document.addEventListener('keydown', (e) => {
  // overlay open?
  const overlayOpen = romOverlay.style.display === "flex";
  if (overlayOpen){
    if (e.key === "ArrowDown"){ moveSelection(1); }
    else if (e.key === "ArrowUp"){ moveSelection(-1); }
    else if (e.key === "Enter"){ const sel = getSelectedVisible(); if(sel) launchRomByUrl(sel.dataset.url); }
    else if (e.key === "Escape"){ closeOverlay(); }
  }else{
    if (e.key === "ArrowRight"){ systemIndex = (systemIndex + 1) % systems.length; updateSystemSelection(); }
    else if (e.key === "ArrowLeft"){ systemIndex = (systemIndex - 1 + systems.length) % systems.length; updateSystemSelection(); }
    else if (e.key === "Enter"){ openRomOverlay(); }
  }
});

function getVisibleButtons(){
  return romButtons.filter(b => b.style.display !== "none");
}
function getSelectedVisible(){
  const visible = getVisibleButtons();
  return visible[Math.min(romIndex, visible.length-1)];
}
function moveSelection(delta){
  const visible = getVisibleButtons();
  if (!visible.length) return;
  romIndex = (Math.min(romIndex, visible.length-1) + delta + visible.length) % visible.length;
  highlightRomAndShowDetails();
}
function closeOverlay(){
  romOverlay.style.display = "none";
  romOverlay.setAttribute("aria-hidden","true");
  searchInput.blur();
}

/* ---------- Controller (Gamepad API) ---------- */
let gpIndex = null;
let lastAxis = { x:0, y:0 };
let lastMoveTime = 0;
const AXIS_DEADZONE = 0.45;
const REPEAT_DELAY_MS = 160;

window.addEventListener("gamepadconnected", e => { gpIndex = e.gamepad.index; });
window.addEventListener("gamepaddisconnected", () => { gpIndex = null; });

function pollGamepad(){
  if (gpIndex !== null){
    const gp = navigator.getGamepads()[gpIndex];
    if (gp){
      // Buttons
      const A = gp.buttons[0]?.pressed;     // A / Cross
      const B = gp.buttons[1]?.pressed;     // B / Circle
      const START = gp.buttons[9]?.pressed; // Start/Options

      const now = performance.now();

      // Axes (left stick)
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;

      const overlayOpen = romOverlay.style.display === "flex";

      // debounce axis: only trigger when crossing deadzone + small repeat delay
      function axisTrigger(dir, prev, cur){
        return (Math.sign(cur) === dir && Math.abs(cur) > AXIS_DEADZONE && (Math.sign(prev) !== dir || Math.abs(prev) <= AXIS_DEADZONE) )
                || (Math.sign(cur) === dir && Math.abs(cur) > AXIS_DEADZONE && now - lastMoveTime > REPEAT_DELAY_MS);
      }

      if (axisTrigger(-1, lastAxis.x, ax)){ // left
        if (!overlayOpen){ systemIndex = (systemIndex - 1 + systems.length) % systems.length; updateSystemSelection(); }
        lastMoveTime = now;
      }
      if (axisTrigger( 1, lastAxis.x, ax)){ // right
        if (!overlayOpen){ systemIndex = (systemIndex + 1) % systems.length; updateSystemSelection(); }
        lastMoveTime = now;
      }
      if (axisTrigger(-1, lastAxis.y, ay)){ // up
        if (overlayOpen) moveSelection(-1);
        lastMoveTime = now;
      }
      if (axisTrigger( 1, lastAxis.y, ay)){ // down
        if (overlayOpen) moveSelection(1);
        lastMoveTime = now;
      }

      lastAxis = { x: ax, y: ay };

      // Buttons map
      if (A){ // select / open
        if (overlayOpen){
          const sel = getSelectedVisible();
          if (sel) launchRomByUrl(sel.dataset.url);
        }else{
          openRomOverlay();
        }
      }
      if (B){ // back
        if (overlayOpen) closeOverlay();
      }
      if (START && !overlayOpen){
        openRomOverlay();
      }
    }
  }
  requestAnimationFrame(pollGamepad);
}
pollGamepad();

/* ---------- ScreenScraper API (no key) + Picsum fallback ---------- */
async function fetchGameInfo(displayName){
  // Build a smart lookup title to improve matches
  const cleanDisplay = decodeName(displayName);
  const lookup = toLookupTitle(cleanDisplay);

  // Compose URL with demo creds (public)
  const url = `https://www.screenscraper.fr/api2/jeuInfos.php?devid=demo&devpassword=demo&softname=demo&output=json&romnom=${encodeURIComponent(lookup)}`;

  try{
    const res = await fetch(url, { method:"GET" });
    // If CORS blocks or network fails, fall through to catch
    const json = await res.json();

    // The API may return an object or array; normalize:
    let game = json?.response?.jeu;
    if (Array.isArray(game)) game = game[0];

    if (!game) throw new Error("No game data");

    // medias can be 'medias' (array) or 'media' (array/object)
    let medias = game.medias ?? game.media ?? [];
    if (!Array.isArray(medias) && medias) medias = [medias];

    const getMediaUrl = (types) => {
      if (!Array.isArray(medias)) return "";
      const found = medias.find(m =>
        typeof m?.type === "string" &&
        types.some(t => m.type.toLowerCase().includes(t))
      );
      return found?.url || "";
    };

    const cover =
      getMediaUrl(["box-2d","box","boxart","cover","2d"]) ||
      `https://picsum.photos/300/420?random=${encodeURIComponent(lookup)}`;

    // screenshots: try a few common tags
    const shots = (Array.isArray(medias) ? medias : [])
      .filter(m => typeof m?.type === "string" && /screen|screenshot|title|in-game|ingame/.test(m.type.toLowerCase()))
      .map(m => m.url)
      .filter(Boolean);

    // genres can be array of objects or a string
    let genres = [];
    if (Array.isArray(game.genres)) {
      genres = game.genres.map(g => g?.nom || g?.name).filter(Boolean);
    } else if (typeof game.genre === "string") {
      genres = [game.genre];
    }

    const info = {
      name: game.nom || cleanDisplay,
      desc: game.synopsis || game.overview || "No description available.",
      cover,
      screenshots: shots,
      system: game.systeme?.nom || game.system?.name || "",
      genres,
      genre: genres[0] || "",
      dev: game.developpeur?.nom || game.developer?.name || "",
      publisher: game.editeur?.nom || game.publisher?.name || "",
      players: game.joueurs?.text || game.players || "",
      year: game.annee || game.year || ""
    };

    // Fill unknowns with sane defaults
    for (const k of ["system","dev","publisher","players","year"]){
      if (!info[k]) info[k] = "Unknown";
    }
    if (!info.genres?.length && !info.genre) info.genre = "Unknown";

    return info;

  }catch(err){
    console.warn("ScreenScraper lookup failed:", err);
    // Fallback
    return {
      name: cleanDisplay,
      desc: "No info found.",
      cover: `https://picsum.photos/300/420?random=${encodeURIComponent(lookup)}`,
      screenshots: [],
      system: "Unknown",
      genres: [],
      genre: "Unknown",
      dev: "Unknown",
      publisher: "Unknown",
      players: "Unknown",
      year: "Unknown"
    };
  }
}