/*
 * Window Handler
 * Has HTML functionality in createWindow();
 * Minimize, maximize, restore, and focus handling
 */

import { winTypes } from "./classdb/windows.js";

export class WindowHandler {
    constructor(act, options = {}) {
        this.workspace = typeof act === "string"
            ? document.getElementById(act)
            : act;

        if (!this.workspace) {
            throw new Error("WindowHandler: workspace element not found");
        }

        this.options = options;
        this.windowCount = 0;
        this.highestLayer = 1;
        this.windows = new Map();
        this.nextId = 1;

        if (getComputedStyle(this.workspace).position === "static") {
            this.workspace.style.position = "relative";
        }

        this.workspace.style.overflow = "hidden";
    }

    transition(win, target = {}, duration = 300) {
        const keys = ["left", "top", "width", "height"];
        const start = {};
        const computed = getComputedStyle(win);

        for (const key of keys) {
            start[key] = parseFloat(win.style[key]) || parseFloat(computed[key]) || 0;
        }

        const end = {};
        for (const key of keys) {
            end[key] = target[key] !== undefined ? parseFloat(target[key]) : start[key];
        }

        const startTime = performance.now();

        const animate = (now) => {
            const p = Math.min((now - startTime) / duration, 1);
            const t = 1 - Math.pow(1 - p, 3); // Ease out cubic

            for (const key of keys) {
                win.style[key] = (start[key] + (end[key] - start[key]) * t) + "px";
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
            throw new Error("Window requires a .titlebar element");
        }

        win.addEventListener("pointerdown", () => {
            this.focusWindow(win);
        });

        bar.addEventListener("pointerdown", (e) => {
            if (e.target.closest("button, input, select, textarea, a")) {
                return;
            }

            if (win.dataset.maximized === "true") return;
            if (e.button !== undefined && e.button !== 0) return;

            e.preventDefault();
            this.focusWindow(win);

            const area = this.workspace.getBoundingClientRect();
            const rect = win.getBoundingClientRect();

            const startX = e.clientX;
            const startY = e.clientY;
            const originalX = rect.left - area.left;
            const originalY = rect.top - area.top;

            bar.setPointerCapture(e.pointerId);

            const move = (ev) => {
                const maxX = Math.max(0, this.workspace.clientWidth - win.offsetWidth);
                const maxY = Math.max(0, this.workspace.clientHeight - win.offsetHeight);

                const x = originalX + ev.clientX - startX;
                const y = originalY + ev.clientY - startY;

                win.style.left = Math.max(0, Math.min(x, maxX)) + "px";
                win.style.top = Math.max(0, Math.min(y, maxY)) + "px";
            };

            const stop = (ev) => {
                if (bar.hasPointerCapture(ev.pointerId)) {
                    bar.releasePointerCapture(ev.pointerId);
                }
                bar.removeEventListener("pointermove", move);
                bar.removeEventListener("pointerup", stop);
                bar.removeEventListener("pointercancel", stop);
            };

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

        const resize = win.querySelector(".resize") || win.querySelector(".resize-handle");
        if (resize) {
            this.setupResize(win, resize);
        }

        return win;
    }

    focusWindow(win) {
        if (!win || !this.workspace.contains(win)) return;

        this.highestLayer++;
        win.style.zIndex = this.highestLayer;

        this.windows.forEach((item) => {
            item.classList.toggle("focused", item === win);
        });

        if (this.options.onFocus) {
            this.options.onFocus(win);
        }
    }

    createWindow(config = {}) {
        const id = this.nextId++;
        const typeName = config.type || "window";
        const typeFactory = winTypes[typeName];

        if (typeof typeFactory !== "function") {
            throw new Error(`WindowHandler: unknown window type "${typeName}"`);
        }

        const win = typeFactory({
            config: { ...config, type: typeName },
            id,
            handler: this,
            workspace: this.workspace
        });

        if (!(win instanceof HTMLElement)) {
            throw new Error(`WindowHandler: type "${typeName}" must return an HTMLElement`);
        }

        win.dataset.windowId = String(id);
        this.workspace.appendChild(win);
        this.windows.set(id, win);
        this.windowCount++;

        if (win.querySelector(".titlebar")) {
            this.setupWindow(win);
        } else {
            win.addEventListener("pointerdown", () => {
                this.focusWindow(win);
            });
        }

        this.focusWindow(win);

        if (this.options.onCreate) {
            this.options.onCreate(win);
        }

        return win;
    }

    closeWindow(target) {
        const win = this.resolveWindow(target);
        if (!win || !this.workspace.contains(win)) return;

        win.classList.add("closing");

        const cleanup = () => {
            const id = Number(win.dataset.windowId);
            this.windows.delete(id);
            win.remove();
            this.windowCount = Math.max(0, this.windows.size);

            if (this.options.onClose) {
                this.options.onClose(win);
            }
        };

        const handleTransitionEnd = (e) => {
            if (e.target === win) {
                win.removeEventListener("transitionend", handleTransitionEnd);
                cleanup();
            }
        };

        win.addEventListener("transitionend", handleTransitionEnd);

        // Fallback in case transitionend does not trigger
        setTimeout(() => {
            if (this.workspace.contains(win)) {
                win.removeEventListener("transitionend", handleTransitionEnd);
                cleanup();
            }
        }, 350);
    }

    minimizeWindow(target) {
        const win = this.resolveWindow(target);
        if (!win) return;
        
        if (win.dataset.minimized === "true") {
            this.restoreWindow(win);
            return;
        }
        
        // Remember whether the window was maximized before minimizing
        const wasMaximized = win.dataset.maximized === "true";
        win.dataset.wasMaximized = wasMaximized ? "true" : "false";
        
        // ONLY save previous bounds if it is NOT currently maximized.
        // If it is maximized, previousBounds already holds the true original un-maximized dimensions.
        if (!wasMaximized) {
            const computed = getComputedStyle(win);
            win.dataset.previousBounds = JSON.stringify({
                left: win.style.left || computed.left,
                top: win.style.top || computed.top,
                width: win.offsetWidth,
                height: win.offsetHeight
            });
        }
        
        const titlebar = win.querySelector(".titlebar");
        const content = win.querySelector(".content");
        const resize = win.querySelector(".resize") || win.querySelector(".resize-handle");
        
        win.dataset.minimized = "true";
        win.dataset.maximized = "false";
        
        if (titlebar) titlebar.hidden = true;
        if (content) content.hidden = true;
        if (resize) resize.hidden = true;
        
        this.transition(win, {
            left: parseFloat(win.style.left) || 0,
            top: parseFloat(win.style.top) || 0,
            height: 35,
            width: 120
        }, 300);
        
        win.style.minWidth = "0px";
        win.style.minHeight = "0px";
        
        this.focusWindow(win);
    }
    
    restoreWindow(target) {
        const win = this.resolveWindow(target);
        if (!win) return;

        let bounds = {};
        try {
            bounds = JSON.parse(win.dataset.previousBounds || "{}");
        } catch (e) {
            console.error("Invalid previous bounds:", e);
        }

        if (win.dataset.minimized === "true") {
            const wasMaximized = win.dataset.wasMaximized === "true";

            const titlebar = win.querySelector(".titlebar");
            const content = win.querySelector(".content");
            const resize = win.querySelector(".resize") || win.querySelector(".resize-handle");

            if (titlebar) titlebar.hidden = false;
            if (content) content.hidden = false;
            if (resize) resize.hidden = false;

            win.style.minWidth = "";
            win.style.minHeight = "";

            win.dataset.minimized = "false";

            if (wasMaximized) {
                this.transition(win, {
                    left: 0,
                    top: 0,
                    width: this.workspace.clientWidth,
                    height: this.workspace.clientHeight
                }, 300);
                win.dataset.maximized = "true";
            } else {
                this.transition(win, bounds, 300);
                win.dataset.maximized = "false";
            }

            delete win.dataset.wasMaximized;

        } else if (win.dataset.maximized === "true") {
            this.transition(win, bounds, 300);
            win.dataset.maximized = "false";
        }

        this.focusWindow(win);
    }

    maximizeWindow(target) {
        const win = this.resolveWindow(target);
        if (!win) return;
        
        // Restore if already maximized
        if (win.dataset.maximized === "true") {
            this.restoreWindow(win);
            return;
        }
        
        const wasMinimized = win.dataset.minimized === "true";
        const wasMaximizedBeforeMinimize = win.dataset.wasMaximized === "true";
        
        // Restore before maximizing if minimized
        if (wasMinimized) {
            this.restoreWindow(win);
            // If it was maximized before minimizing, restoreWindow already put it back 
            // to maximized, and previousBounds already holds the true original dimensions!
            if (wasMaximizedBeforeMinimize) {
                return;
            }
        }
        const computed = getComputedStyle(win);
            win.dataset.previousBounds = JSON.stringify({
                left: win.style.left || computed.left,
                top: win.style.top || computed.top,
                width: win.offsetWidth,
                height: win.offsetHeight
            });
        // Mark as maximized
        win.dataset.maximized = "true";

        this.focusWindow(win);

        // Animate to workspace dimensions
        this.transition(win, {
            left: 0,
            top: 0,
            width: this.workspace.clientWidth,
            height: this.workspace.clientHeight
        }, 300);
    }

    resolveWindow(target) {
        if (typeof target === "number") {
            return this.windows.get(target) || null;
        }

        if (typeof target === "string") {
            const num = Number(target);
            if (!isNaN(num) && this.windows.has(num)) {
                return this.windows.get(num);
            }
            return this.workspace.querySelector(`[data-window-id="${target}"]`) || null;
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
                const maxW = this.workspace.clientWidth - win.offsetLeft;
                const maxH = this.workspace.clientHeight - win.offsetTop;

                win.style.width = Math.max(180, Math.min(startW + ev.clientX - startX, maxW)) + "px";
                win.style.height = Math.max(100, Math.min(startH + ev.clientY - startY, maxH)) + "px";
            };

            const stop = (ev) => {
                if (handle.hasPointerCapture(ev.pointerId)) {
                    handle.releasePointerCapture(ev.pointerId);
                }
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
        return this.windows.size;
    }

    getWindows() {
   ,     return Array.from(this.windows.values());
    }

    destroy() {
        this.windows.forEach(win => win.remove());
        this.windows.clear();
        this.windowCount = 0;
    }
}
              
