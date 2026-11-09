/**
 * JS Modular Default Class WindowHandler (`winh`) Document Object
 * 2026 (c) CoconutCaty 
 * Licensed under MIT License installed using terminal npm
 */

function createElement(tag, className, text) {
  const el = document.createElement(tag);

  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;

  return el;
}

function createRoot(config, id, className) {
  const win = createElement("div", className);

  win.dataset.windowId = String(id);
  win.dataset.windowType = config.type;

  win.style.position = "absolute";
  win.style.left = (config.left ?? 40) + "px";
  win.style.top = (config.top ?? 70) + "px";

  return win;
}

function createTitlebar(win, title, controls = ["minimize", "maximize", "close", "resize"]) {
  const bar = createElement("div", "titlebar");
  const label = createElement("span", "window-title", title);
  const buttons = createElement("div", "window-controls");

  const definitions = {
    minimize: ["−", "Minimize"],
    maximize: ["□", "Maximize"],
    close: ["×", "Close"],
    resize: ["+", "Resize"]
  };

  for (const name of controls) {
    const [symbol, aria] = definitions[name];
    const button = createElement("button", name, symbol);

    button.type = "button";
    button.setAttribute("aria-label", aria);

    buttons.appendChild(button);
  }

  bar.append(label, buttons);
  win.appendChild(bar);

  return bar;
}

function createContent(win, config) {
  const content = createElement("div", "content");

  if (config.content instanceof Node) {
    content.appendChild(config.content);
  } else if (config.html !== undefined) {
    content.innerHTML = config.html;
  } else if (config.content !== undefined) {
    content.textContent = config.content;
  }

  win.appendChild(content);

  return content;
}

function applyDimensions(win, config, defaults = {}) {
  win.style.left = (config.left ?? defaults.left ?? 40) + "px";
  win.style.top = (config.top ?? defaults.top ?? 70) + "px";

  if (config.width != null) {
    win.style.width = config.width + "px";
  } else if (defaults.width != null) {
    win.style.width = defaults.width + "px";
  }

  if (config.height != null) {
    win.style.height = config.height + "px";
  } else if (defaults.height != null) {
    win.style.height = defaults.height + "px";
  }
}

const winTypes = {
  window({ config, id }) {
    const win = createRoot(config, id, "window");

    applyDimensions(win, config, {
      width: 300,
      height: 220
    });

    createTitlebar(win, config.title || "Window " + id);
    createContent(win, config);

    if (config.resizable) {
      win.appendChild(createElement("div", "resize-handle"));
    }

    return win;
  },

  operation({ config, id }) {
    const win = createRoot(config, id, "window window-operation");

    win.style.width = "max-content";
    win.style.height = "auto";
    win.style.maxWidth = "100vw";

    createTitlebar(win, config.title || "Operation", ["close"]);

    const content = createContent(win, config);

    content.style.width = "max-content";
    content.style.maxWidth = "100%";
    content.style.boxSizing = "border-box";
    content.style.overflowWrap = "anywhere";

    applyDimensions(win, config);

    return win;
  },

  selector({ config, id, handler }) {
    const win = createRoot(config, id, "window window-selector");

    const creator = typeof config.creator === "string"
      ? document.querySelector(config.creator)
      : config.creator;

    if (!creator) {
      throw new Error("WindowHandler: selector creator not found");
    }

    const content = createContent(win, config);
    content.classList.add("selector-options");

    const optionHeight = Math.max(16, Number(config.optionHeight) || 36);
    const options = Array.from(content.querySelectorAll("option"));

    for (const option of options) {
      const item = createElement("button", "selector-option", option.textContent);

      item.type = "button";
      item.dataset.value = option.value;

      if (option.disabled) item.disabled = true;

      option.replaceWith(item);
    }

    content.querySelectorAll(".selector-option").forEach(item => {
      item.style.height = optionHeight + "px";
      item.style.fontSize = config.optionFontSize || "14px";

      item.addEventListener("click", () => {
        if (item.disabled) return;

        if (typeof config.onSelect === "function") {
          config.onSelect(item.dataset.value, item, win);
        }

        handler.closeWindow(win);
      });
    });

    const count = content.querySelectorAll(".selector-option").length;
    const maxHeight = Math.min(count * optionHeight, window.innerHeight * 0.8);

    content.style.maxHeight = maxHeight + "px";
    content.style.overflowY = "auto";

    win.style.width = (config.width ?? 200) + "px";
    win.style.height = "auto";
    win.style.maxHeight = "100dvh";

    const arrow = createElement("div", "selector-arrow");
    arrow.setAttribute("aria-hidden", "true");
    win.appendChild(arrow);

    const updateArrow = () => {
      const creatorRect = creator.getBoundingClientRect();
      const winRect = win.getBoundingClientRect();
      const center = creatorRect.left + creatorRect.width / 2;

      const x = Math.max(8, Math.min(winRect.width - 8, center - winRect.left));

      win.style.setProperty("--arrow-x", x + "px");
    };

    const positionFromCreator = () => {
      const rect = creator.getBoundingClientRect();
      const width = win.offsetWidth;
      const height = win.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const center = rect.left + rect.width / 2;

      let x = center - width / 2;
      if (x + width > viewportWidth - 8) {
        x = viewportWidth - width - 8;
      }
      if (x < 8) {
        x = 8;
      }
      win.style.left = x + "px";

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = (rect.bottom + height > viewportHeight - 8) || (height > spaceBelow && spaceAbove > spaceBelow);

      const top = openUp
        ? Math.max(8, rect.top - height - 8)
        : Math.min(rect.bottom + 8, viewportHeight - height - 8);

      win.style.top = top + "px";
      win.dataset.direction = openUp ? "up" : "down";

      const arrowWin = win.querySelector(".selector-arrow");
      if (arrowWin) {
        arrowWin.style.top = openUp ? "auto" : "-8px";
        arrowWin.style.bottom = openUp ? "-8px" : "auto";

        if (openUp) {
          arrowWin.style.transform = "translateX(-50%) rotate(180deg)";
        } else {
          arrowWin.style.transform = "translateX(-50%)";
        }
      }

      updateArrow();
    };

    positionFromCreator();

    win.addEventListener("pointerdown", e => {
      handler.focusWindow(win);

      if (e.target.closest("button, input, select, textarea, a")) return;
      if (e.button !== undefined && e.button !== 0) return;

      e.preventDefault();

      const startX = e.clientX;
      const originalX = win.offsetLeft;

      win.setPointerCapture(e.pointerId);

      const move = ev => {
        const width = win.offsetWidth;
        const viewportWidth = window.innerWidth;
        const minX = 8;
        const maxX = viewportWidth - width - 8;
        const proposed = originalX + ev.clientX - startX;
        const x = Math.max(minX, Math.min(maxX, proposed));

        win.style.left = x + "px";
        updateArrow();
      };

      const stop = () => {
        win.removeEventListener("pointermove", move);
        win.removeEventListener("pointerup", stop);
        win.removeEventListener("pointercancel", stop);
      };

      win.addEventListener("pointermove", move);
      win.addEventListener("pointerup", stop);
      win.addEventListener("pointercancel", stop);
    });

    return win;
  },

  message({ config, id }) {
    const win = createRoot(config, id, "window window-message");

    win.style.width = "max-content";
    win.style.height = "auto";
    win.style.maxWidth = "75vw";

    createTitlebar(win, config.title || "Message", ["close"]);

    const content = createElement("div", "content message-text", config.message ?? "");

    content.style.width = "auto";
    content.style.maxWidth = "100%";
    content.style.whiteSpace = "pre-wrap";
    content.style.overflowWrap = "anywhere";
    content.style.boxSizing = "border-box";

    win.appendChild(content);
    applyDimensions(win, config);

    return win;
  },

  clear({ config, id }) {
    const win = createRoot(config, id, "window");
    win.style = config.style;
    win.innerHTML = config.html;
    applyDimensions(win, config);

    return win;
  },

  custom({ config, id, handler }) {
    if (typeof config.function !== "function") {
      throw new TypeError('WindowHandler: custom type requires "function"');
    }

    const result = config.function({
      document,
      config,
      id,
      handler
    });

    if (!(result instanceof HTMLElement)) {
      throw new TypeError("WindowHandler: custom function must return an HTMLElement");
    }

    result.dataset.windowId = String(id);
    result.dataset.windowType = "custom";

    if (!result.style.position) {
      result.style.position = "absolute";
    }

    applyDimensions(result, config);

    return result;
  }
};

export default class WindowHandler {
  constructor(act, options = {}) {
    this.w = typeof act === "string" ? document.getElementById(act) : act;
    if (!this.w) {
      throw new Error("WindowHandler: workspace not found");
    }
    this.o = options;
    this.wc = 0;
    this.hl = 1;
    this.wsq = new Map();
    this.nextId = 1;
    if (getComputedStyle(this.w).position === "static") {
      this.w.style.position = "relative";
    }
    this.w.style.overflow = "hidden";
  }

  transition(win, target = {}, duration = 300) {
    const keys = ["left", "top", "width", "height"];
    const start = {};
    for (const key of keys) {
      start[key] = parseFloat(win.style[key]) || parseFloat(getComputedStyle(win)[key]) || 0;
    }
    const end = { ...start, ...target };
    const startTime = performance.now();
    const animate = (now) => {
      const p = Math.min((now - startTime) / duration, 1);
      const t = 1 - Math.pow(1 - p, 3);
      for (const key of keys) {
        win.style[key] = start[key] + (end[key] - start[key]) * t + "px";
      }
      if (p < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  setupWindow(win) {
    const bar = win.querySelector(".titlebar");
    if (!bar) {
      throw new Error("Window requires a .titlebar");
    }
    const handler = this;
    win.addEventListener("pointerdown", function () {
      handler.focusWindow(win);
    });

    bar.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button, input, select, textarea, a")) return;
      if (win.dataset.maximized === "true") return;
      if (e.button !== undefined && e.button !== 0) return;
      
      e.preventDefault();
      handler.focusWindow(win);
      const area = handler.workspace.getBoundingClientRect();
      const rect = win.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const originalX = rect.left - area.left;
      const originalY = rect.top - area.top;
      
      bar.setPointerCapture(e.pointerId);

      function move(ev) {
        const maxX = Math.max(0, handler.workspace.clientWidth - win.offsetWidth);
        const maxY = Math.max(0, handler.workspace.clientHeight - win.offsetHeight);
        const x = originalX + ev.clientX - startX;
        const y = originalY + ev.clientY - startY;
        win.style.left = Math.max(0, Math.min(x, maxX)) + "px";
        win.style.top = Math.max(0, Math.min(y, maxY)) + "px";
      }

      function stop(ev) {
        if (bar.hasPointerCapture(e.pointerId)) {
          bar.releasePointerCapture(e.pointerId);
        }
        bar.removeEventListener("pointermove", move);
        bar.removeEventListener("pointerup", stop);
        bar.removeEventListener("pointercancel", stop);
      }

      bar.addEventListener("pointermove", move);
      bar.addEventListener("pointerup", stop);
      bar.addEventListener("pointercancel", stop);
    });

    win.querySelector(".close")?.addEventListener("click", () => {
      this.closeWindow(win);
    });
    win.querySelector(".minimize")?.addEventListener("click", () => {
      this.minimizeWindow(win);
    });
    win.querySelector(".maximize")?.addEventListener("click", () => {
      this.maximizeWindow(win);
    });

    const resize = win.querySelector(".resize");
    resize?.addEventListener("pointerdown", () => {
      this.setupResize(win, resize);
    });

    const resizeHandle = win.querySelector(".resize-handle");
    if (resizeHandle) {
      this.setupResize(win, resizeHandle);
    }
    return win;
  }

  focusWindow(win) {
    if (!win || !this.w.contains(win)) return;
    this.hl++;
    win.style.zIndex = this.hl;
    this.wsq.forEach(item => {
      item.classList.toggle("focused", item === win);
    });
    if (this.o.onFocus) {
      this.o.onFocus(win);
    }
  }

  createWindow(config = {}) {
    const id = this.nextId++;
    const typeName = config.type || "window";
    const typeFactory = winTypes[typeName];
    if (typeof typeFactory !== "function") {
      throw new Error(`WindowHandler: unknown window type "${typeName}"`);
    }
    const win = typeFactory({ config: { ...config, type: typeName }, id, handler: this, workspace: this.w });
    if (!(win instanceof HTMLElement)) {
      throw new Error(`WindowHandler: type "${typeName}" must return an HTMLElement`);
    }
    win.addEventListener("pointerdown", () => {
      this.focusWindow(win);
    });
    this.w.appendChild(win);
    this.wsq.set(id, win);
    this.wc++;
    if (win.querySelector(".titlebar")) {
      this.setupWindow(win);
    }
    this.focusWindow(win);
    if (this.o.onCreate) {
      this.o.onCreate(win);
    }
    return win;
  }

  closeWindow(target) {
    const win = typeof target === "string" ? this.w.querySelector('[data-window-id="' + target + '"]') : target?.closest ? target.closest(".window") : target;
    if (!win || !this.w.contains(win)) return;
    win.classList.add("closing");
    win.addEventListener("transitionend", () => {
      const id = Number(win.dataset.windowId);
      this.wsq.delete(id);
      win.remove();
      this.wc = Math.max(0, this.wc - 1);
      if (this.o.onClose) {
        this.o.onClose(win);
      }
    });
  }

  minimizeWindow(target) {
    const win = this.resolveWindow(target);
    if (!win) return;
    win.dataset.previousBounds = JSON.stringify({
      left: win.style.left,
      top: win.style.top,
      width: win.style.width,
      height: win.style.height
    });
    if (win.dataset.minimized === "true") {
      this.restoreWindow(win);
      return;
    }
    win.dataset.wasMaximized = win.dataset.maximized === "true" ? "true" : "false";
    const titlebar = win.querySelector(".titlebar");
    const content = win.querySelector(".content");
    const resize = win.querySelector(".resize");
    
    win.dataset.minimized = "true";
    win.dataset.maximized = "false";
    if (titlebar) titlebar.hidden = true;
    if (content) content.hidden = true;
    if (resize) {
      resize.hidden = true;
      resize.style.color = "var(--text-back)";
    }
    
    this.transition(win, {
      left: win.dataset.previousBounds.left,
      top: win.dataset.previousBounds.top,
      height: 35,
    }, 300);
    win.style.minWidth = "0";
    win.style.minHeight = "0";
    this.focusWindow(win);
  }

  restoreWindow(target) {
    const win = this.resolveWindow(target);
    if (!win) return;
    if (win.dataset.minimized === "true") {
      let old = {};
      try {
        old = JSON.parse(win.dataset.previousBounds || "{}");
      } catch (e) {
        console.error("Invalid previous bounds:", e);
      }
      const wasMaximized = win.dataset.wasMaximized === "true";
      const titlebar = win.querySelector(".titlebar");
      const content = win.querySelector(".content");
      const resize = win.querySelector(".resize");
      
      if (titlebar) titlebar.hidden = false;
      if (content) content.hidden = false;
      if (resize) {
        resize.hidden = false;
        resize.style.color = "var(--text)";
      }
      
      win.style.minWidth = "";
      win.style.minHeight = "";
      win.dataset.minimized = "false";
      win.dataset.maximized = "false";
      if (wasMaximized) {
        this.transition(win, {
          left: 0,
          top: 0,
          width: this.w.clientWidth,
          height: this.w.clientHeight
        }, 300);
        win.dataset.maximized = "true";
      } else {
        this.transition(win, old, 300);
      }
      delete win.dataset.wasMaximized;
    } else if (win.dataset.maximized === "true") {
      let old = {};
      try {
        old = JSON.parse(win.dataset.previousBounds || "{}");
      } catch (e) {
        console.error("Invalid previous bounds:", e);
      }
      this.transition(win, old, 300);
      win.dataset.maximized = "false";
    } else {
      return;
    }
    this.focusWindow(win);
  }

  maximizeWindow(target) {
    const win = this.resolveWindow(target);
    if (!win) return;
    if (win.dataset.maximized === "true") {
      this.restoreWindow(win);
      return;
    }
    if (win.dataset.minimized === "true") {
      this.restoreWindow(win);
    }
    win.dataset.previousBounds = JSON.stringify({
      left: parseFloat(win.style.left) || 0,
      top: parseFloat(win.style.top) || 0,
      width: win.offsetWidth,
      height: win.offsetHeight
    });
    win.dataset.maximized = "true";
    this.focusWindow(win);
    this.transition(win, {
      left: 0,
      top: 0,
      width: this.w.clientWidth,
      height: this.w.clientHeight
    }, 300);
  }

  resolveWindow(target) {
    if (typeof target === "number") {
      return this.wsq.get(target) || null;
    }
    if (typeof target === "string") {
      return this.wsq.get(Number(target)) || null;
    }
    return target?.closest ? target.closest(".window") : target || null;
  }

  setupResize(win, handle) {
    handle.addEventListener("pointerdown", e => {
      if (e.button !== undefined && e.button !== 0) return;
      if (win.dataset.maximized === "true") return;
      e.preventDefault();
      e.stopPropagation();
      this.focusWindow(win);
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = win.offsetWidth;
      const startH = win.offsetHeight;
      
      handle.setPointerCapture(e.pointerId);
      
      const move = ev => {
        const maxW = this.w.clientWidth - win.offsetLeft;
        const maxH = this.w.clientHeight - win.offsetTop;
        win.style.width = Math.max(180, Math.min(startW + ev.clientX - startX, maxW)) + "px";
        win.style.height = Math.max(100, Math.min(startH + ev.clientY - startY, maxH)) + "px";
      };
      
      const stop = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", stop);
        handle.removeEventListener("pointercancel", stop);
      };
      
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", stop);
      handle.addEventListener("pointercancel", stop);
    });
  }

  getWindowCount() {
    return this.wsq.size;
  }

  getWindows() {
    return Array.from(this.wsq.values());
  }

  destroy() {
    this.wsq.forEach(win => win.remove());
    this.wsq.clear();
    this.wc = 0;
  }
    }
               
