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

export const winTypes = {

    /*
     * Standard window.
     * Titlebar, minimize, maximize, close, optional resizing.
     */
    window({ config, id }) {
        const win = createRoot(config, id, "window");

        applyDimensions(win, config, {
            width: 300,
            height: 220
        });

        createTitlebar(win, config.title || "Window " + id);
        createContent(win, config);

        if (config.resizable) {
            win.appendChild(
                createElement("div", "resize-handle")
            );
        }

        return win;
    },


    /*
     * Operation window.
     * Content-sized, close-only controls, no resizing.
     */
    operation({ config, id }) {
        const win = createRoot(config, id, "window window-operation");

        win.style.width = "max-content";
        win.style.height = "auto";
        win.style.maxWidth = "100vw";

        createTitlebar(
            win,
            config.title || "Operation",
            ["close"]
        );

        const content = createContent(win, config);

        content.style.width = "max-content";
        content.style.maxWidth = "100%";
        content.style.boxSizing = "border-box";
        content.style.overflowWrap = "anywhere";

        applyDimensions(win, config);

        return win;
    },


    /*
     * Selector window.
     * No titlebar or controls.
     * Horizontally movable, with an arrow pointing to its creator.
     */
    selector({ config, id, handler }) {
        const win = createRoot(config, id, "window window-selector");

        const creator = typeof config.creator === "string"
            ? document.querySelector(config.creator)
            : config.creator;

        if (!creator) {
            throw new Error(
                "WindowHandler: selector creator not found"
            );
        }

        const content = createContent(win, config);
        
        let optionsContainer = content.querySelector(".selector-options");
        
        if (!optionsContainer) {
            optionsContainer = content;
            optionsContainer.classList.add("selector-options");
        }
        const optionHeight = Math.max(
            16,
            Number(config.optionHeight) || 36
        );

        // Convert supplied <option> elements into clickable options.
        const options = Array.from(
        optionsContainer.querySelectorAll("option")
        );

        for (const option of options) {
            const item = createElement(
                "button",
                "selector-option",
                option.textContent
            );

            item.type = "button";
            item.dataset.value = option.value;
            if (option.disabled) item.disabled = true;
            option.replaceWith(item);
        }

        optionsContainer.querySelectorAll(".selector-option").forEach(item => {
            item.style.height = optionHeight + "px";
            item.style.fontSize = config.optionFontSize || "14px";

            item.addEventListener("click", () => {
                if (item.disabled) return;

                if (typeof config.onSelect === "function") {
                    config.onSelect(
                        item.dataset.value,
                        item,
                        win
                    );
                }

                handler.closeWindow(win);
            });
        });

        const count = content.querySelectorAll(
            ".selector-option"
        ).length;

        const maxHeight = Math.min(
            count * optionHeight,
            window.innerHeight * 0.8
        );

        optionsContainer.style.maxHeight = maxHeight + "px";
        optionsContainer.style.overflowY = "auto";

        win.style.width = (config.width ?? 200) + "px";
        win.style.height = "auto";
        win.style.maxHeight = "100dvh";

        // The arrow remains inside the selector and points to its creator.
        const arrow = createElement("div", "selector-arrow");
        arrow.setAttribute("aria-hidden", "true");
        win.appendChild(arrow);

        const updateArrow = () => {
            const creatorRect = creator.getBoundingClientRect();
            const winRect = win.getBoundingClientRect();

            const center = creatorRect.left + creatorRect.width / 2;

            const x = Math.max(
                8,
                Math.min(winRect.width - 8, center - winRect.left)
            );

            win.style.setProperty("--arrow-x", x + "px");
        };

        const positionFromCreator = () => {
            const rect = creator.getBoundingClientRect();
            const width = win.offsetWidth;
            const height = win.offsetHeight;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            const center = rect.left + rect.width / 2;

            // 1. Horizontal check (vw bounds) -> Shift left if overflowing right edge
            let x = center - width / 2;
            if (x + width > viewportWidth - 8) {
                x = viewportWidth - width - 8;
            }
            if (x < 8) {
                x = 8;
            }
            win.style.left = x + "px";

            // 2. Vertical check (dvh bounds) -> Flip top if overflowing bottom edge
            const spaceBelow = viewportHeight - rect.bottom;
            const spaceAbove = rect.top;

            const openUp = (rect.bottom + height > viewportHeight - 8) || (height > spaceBelow && spaceAbove > spaceBelow);

            const top = openUp
                ? Math.max(8, rect.top - height - 8)
                : Math.min(rect.bottom + 8, viewportHeight - height - 8);

            win.style.top = top + "px";
            win.dataset.direction = openUp ? "up" : "down";

            // Keep the arrow pointing toward the creator.
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

        // Only horizontal dragging is permitted.
        win.addEventListener("pointerdown", e => {
            handler.focusWindow(win);

            if (e.target.closest(
                "button, input, select, textarea, a"
            )) return;

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


    /*
     * Message window.
     * Text only, wraps automatically, close-only controls.
     */
    message({ config, id }) {
        const win = createRoot(config, id, "window window-message");

        win.style.width = "max-content";
        win.style.height = "auto";
        win.style.maxWidth = "75vw";

        createTitlebar(
            win,
            config.title || "Message",
            ["close"]
        );

        const content = createElement(
            "div",
            "content message-text",
            config.message ?? ""
        );

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
    /*
     * Custom window.
     * The supplied function controls its structure.
     */
    custom({ config, id, handler }) {
        if (typeof config.function !== "function") {
            throw new TypeError(
                'WindowHandler: custom type requires "function"'
            );
        }

        const result = config.function({
            document,
            config,
            id,
            handler
        });

        if (!(result instanceof HTMLElement)) {
            throw new TypeError(
                "WindowHandler: custom function must return an HTMLElement"
            );
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
      
