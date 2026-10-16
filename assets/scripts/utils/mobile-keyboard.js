(function () {
  "use strict";

  const SENTINEL = "\u200b";

  let el = null;
  let touchSeen = false;
  let wanted = false;
  let pendingGestureFocus = false;
  let pendingTimer = null;
  let hideTimer = null;
  let programmatic = false;
  let lastVal = SENTINEL;
  let suppressInput = false;
  let current = { mode: "text", enterHint: "done", commitOnBlur: false };

  const isTouchDevice = () =>
    touchSeen ||
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    ((navigator.maxTouchPoints || 0) > 0 && /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent));

  function fire(key, code) {
    for (const type of ["keydown", "keyup"]) {
      window.dispatchEvent(new KeyboardEvent(type, {
        key,
        code: code || "",
        bubbles: true,
        cancelable: true,
      }));
    }
  }

  function emitChars(str) {
    for (const ch of Array.from(str)) {
      if (ch === SENTINEL) continue;
      if (ch === "\n") { fire("Enter", "Enter"); continue; }
      fire(current.mode === "decimal" && ch === "," ? "." : ch);
    }
  }

  function resetBuffer() {
    el.value = SENTINEL;
    lastVal = SENTINEL;
    try { el.setSelectionRange(SENTINEL.length, SENTINEL.length); } catch (_) {}
  }

  function onInput(e) {
    if (suppressInput) {
      lastVal = el.value;
      if (!e.isComposing) resetBuffer();
      return;
    }

    const next = el.value;
    let p = 0;
    const max = Math.min(lastVal.length, next.length);
    while (p < max && lastVal[p] === next[p]) p++;

    for (let i = p; i < lastVal.length; i++) fire("Backspace", "Backspace");
    emitChars(next.slice(p));

    lastVal = next;
    if (!e.isComposing) resetBuffer();
  }

  function onKeyDown(e) {
    if (e.isTrusted && e.key && e.key !== "Unidentified" && e.key !== "Process" && e.keyCode !== 229) {
      suppressInput = true;
      setTimeout(() => { suppressInput = false; }, 0);
    }
  }

  function onBlur() {
    if (programmatic) return;
    const wasWanted = wanted;
    wanted = false;
    if (wasWanted && current.commitOnBlur) fire("Enter", "Enter");
  }

  function focusNow() {
    programmatic = true;
    try { el.focus({ preventScroll: true }); } catch (_) {}
    programmatic = false;
  }

  function onGesture() {
    if (!pendingGestureFocus || !wanted) return;
    pendingGestureFocus = false;
    programmatic = true;
    try { el.blur(); } catch (_) {}
    try { el.focus({ preventScroll: true }); } catch (_) {}
    programmatic = false;
  }

  function build() {
    if (el) return;
    el = document.createElement("input");
    el.type = "text";
    el.id = "mobile-keyboard-bridge";
    el.setAttribute("autocomplete", "off");
    el.setAttribute("autocorrect", "off");
    el.setAttribute("autocapitalize", "off");
    el.setAttribute("spellcheck", "false");
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("data-lpignore", "true");
    el.setAttribute("data-1p-ignore", "true");
    el.tabIndex = -1;

    el.style.cssText =
      "position:fixed;left:0;bottom:0;width:1px;height:1px;padding:0;margin:0;border:0;" +
      "opacity:0;font-size:16px;color:transparent;background:transparent;caret-color:transparent;" +
      "pointer-events:none;z-index:-1;";
    resetBuffer();
    el.addEventListener("input", onInput);
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("compositionend", () => { resetBuffer(); });
    el.addEventListener("blur", onBlur);
    document.body.appendChild(el);
  }

  function show(opts) {
    current = Object.assign({ mode: "text", enterHint: "done", commitOnBlur: false }, opts || {});
    if (!isTouchDevice()) return;
    if (!document.body) return;
    build();

    clearTimeout(hideTimer);
    wanted = true;

    el.setAttribute("inputmode", current.mode);
    el.setAttribute("enterkeyhint", current.enterHint);
    if (document.activeElement !== el) resetBuffer();

    focusNow();
    pendingGestureFocus = true;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pendingGestureFocus = false; }, 1000);
  }

  function hide() {
    wanted = false;
    pendingGestureFocus = false;
    if (!el) return;
    clearTimeout(hideTimer);

    hideTimer = setTimeout(() => {
      if (wanted) return;
      programmatic = true;
      try { el.blur(); } catch (_) {}
      programmatic = false;
      window.scrollTo(0, 0);
    }, 60);
  }

  function watchFlag(obj, prop, opts) {
    let value = !!obj[prop];
    Object.defineProperty(obj, prop, {
      configurable: true,
      enumerable: true,
      get() { return value; },
      set(v) {
        const was = value;
        value = v;
        if (v) show(opts);
        else if (was) hide();
      },
    });
  }

  const markTouch = () => { touchSeen = true; };
  window.addEventListener("touchstart", markTouch, { capture: true, passive: true });
  window.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") markTouch(); }, { capture: true, passive: true });
  for (const type of ["touchend", "pointerup", "click"]) {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  }

  window.MobileKeyboard = { show, hide, watchFlag };
})();
