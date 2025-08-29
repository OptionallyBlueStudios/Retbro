        // Helper: get query params
    function getQueryParam(name) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(name);
    }

    // Core → extension mapping
    function coreFromExt(ext) {
      ext = ext.toLowerCase();
      if (["nes","unif","unf","fds"].includes(ext)) return "nes";
      if (["smc","sfc","swc","fig"].includes(ext)) return "snes";
      if (["z64","n64"].includes(ext)) return "n64";
      if (["gb"].includes(ext)) return "gb";
      if (["gba"].includes(ext)) return "gba";
      if (["nds"].includes(ext)) return "nds";
      if (["pce"].includes(ext)) return "pce";
      return "nes"; // default fallback
    }

    // Load a game into EmulatorJS
    function loadGame(url, core, name="rom") {
      // clear UI
      document.getElementById("top")?.remove();
      document.getElementById("box")?.remove();

      const div = document.createElement("div");
      const sub = document.createElement("div");
      div.id = "display";
      sub.id = "game";
      div.appendChild(sub);
      document.body.appendChild(div);

      const cdn = "https://cdn.emulatorjs.org/stable/data/";

      window.EJS_player   = "#game";
      window.EJS_gameName = name;
      window.EJS_biosUrl  = "";
      window.EJS_gameUrl  = url;
      window.EJS_core     = core;
      window.EJS_pathtodata = cdn;
      window.EJS_startOnLoaded = true;
      // 🚫 remove ads
      window.EJS_AdUrl = "";

      const script = document.createElement("script");
      script.src = cdn + "loader.js";
      document.body.appendChild(script);
    }

    // Case 1: ROM provided via query ?rom=URL
    const romParam = getQueryParam("rom");
    if (romParam) {
      const ext = romParam.split(".").pop().split("?")[0];
      const core = coreFromExt(ext);
      const name = romParam.split("/").pop();
      loadGame(romParam, core, name);
    }

    // Case 2: Local file input
    const input = document.getElementById("input");
    input.addEventListener("change", () => {
      const file = input.files[0];
      const ext = file.name.split(".").pop();
      const core = coreFromExt(ext);
      loadGame(file, core, file.name);
    });