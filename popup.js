// Ordered key set: home row first, then top row, then bottom row.
// Excludes 't' to reserve it for previous tab switching.
// Mirrors flash.nvim's preference for easy-to-reach keys.
const LABEL_KEYS = "asdfghjklqweruyiopzxcvbnm".split("");

/**
 * Generate `count` prefix-free labels from `keys`.
 *
 * Inspired by the labeling used in flash.nvim: prefer the shortest possible
 * labels (single key while they last) and only grow to multi-key labels when
 * there are more targets than available keys. Expanding the shortest existing
 * label guarantees minimal total keystrokes while keeping the set prefix-free
 * (no label is a prefix of another), so typing can never be ambiguous.
 */
function generateLabels(count, keys = LABEL_KEYS) {
  if (count <= 0) return [];
  const labels = keys.slice();
  while (labels.length < count) {
    // Expand the shortest / earliest label into `keys.length` children.
    const node = labels.shift();
    for (const c of keys) labels.push(node + c);
  }
  return labels.slice(0, count);
}

let entries = []; // [{ tab, label }]
let labelToEntry = new Map();
let typed = "";
let selectedIndex = 0;
let previousTabId = null;

async function init() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  tabs.sort((a, b) => a.index - b.index);

  // Store the currently active tab as the previous tab for next time
  const currentActive = tabs.find((t) => t.active);
  if (currentActive) {
    // Get stored previousTabId from chrome storage
    try {
      const result = await chrome.storage.session.get(["previousTabId"]);
      if (result.previousTabId && result.previousTabId !== currentActive.id) {
        previousTabId = result.previousTabId;
      }
      // Store current tab as the new previous for next popup open
      await chrome.storage.session.set({ previousTabId: currentActive.id });
    } catch (e) {
      console.error("Storage error:", e);
    }
  }

  if (tabs.length === 0) {
    document.getElementById("empty").hidden = false;
    return;
  }

  const labels = generateLabels(tabs.length);
  entries = tabs.map((tab, i) => ({ tab, label: labels[i] }));
  labelToEntry = new Map(entries.map((e) => [e.label, e]));

  render();
  document.addEventListener("keydown", onKeyDown, true);
}

function render() {
  const list = document.getElementById("list");
  list.replaceChildren();

  for (let i = 0; i < entries.length; i++) {
    const { tab, label } = entries[i];
    const row = document.createElement("div");
    row.className = "tab";
    if (tab.active) row.classList.add("active");
    if (i === selectedIndex) row.classList.add("selected");

    const matchesTyped = typed && label.startsWith(typed);
    if (typed && !matchesTyped) row.classList.add("dim");

    const labelEl = document.createElement("span");
    labelEl.className = "label";
    const typedPart = matchesTyped ? typed : "";
    const restPart = label.slice(typedPart.length);
    const typedSpan = document.createElement("span");
    typedSpan.className = "typed";
    typedSpan.textContent = typedPart.toUpperCase();
    const restSpan = document.createElement("span");
    restSpan.className = "rest";
    restSpan.textContent = restPart.toUpperCase();
    labelEl.append(typedSpan, restSpan);

    const fav = document.createElement("img");
    fav.className = "favicon";
    fav.src = tab.favIconUrl || "";
    fav.addEventListener("error", () => {
      fav.style.visibility = "hidden";
    });

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = tab.title || tab.url || "(untitled)";

    row.append(labelEl, fav, title);
    row.addEventListener("click", () => {
      activate(entries[i].tab);
    });
    list.appendChild(row);
  }
  
  // Scroll selected item into view
  if (selectedIndex >= 0 && selectedIndex < entries.length) {
    const rows = list.querySelectorAll(".tab");
    if (rows[selectedIndex]) {
      rows[selectedIndex].scrollIntoView({ block: "nearest" });
    }
  }
}

function onKeyDown(e) {
  const key = e.key;

  if (key === "Escape") {
    e.preventDefault();
    if (typed) {
      typed = "";
      render();
    } else {
      window.close();
    }
    return;
  }

  if (key === "Backspace") {
    e.preventDefault();
    typed = typed.slice(0, -1);
    render();
    return;
  }

  if (key === "ArrowDown") {
    e.preventDefault();
    if (!typed) {
      selectedIndex = (selectedIndex + 1) % entries.length;
      render();
    }
    return;
  }

  if (key === "ArrowUp") {
    e.preventDefault();
    if (!typed) {
      selectedIndex = (selectedIndex - 1 + entries.length) % entries.length;
      render();
    }
    return;
  }

  if (key === "Enter") {
    e.preventDefault();
    if (typed) {
      const exact = labelToEntry.get(typed);
      if (exact) {
        activate(exact.tab);
      }
    } else {
      if (selectedIndex >= 0 && selectedIndex < entries.length) {
        activate(entries[selectedIndex].tab);
      }
    }
    return;
  }

  if (key.length === 1 && /[a-z]/i.test(key)) {
    e.preventDefault();
    const lowerKey = key.toLowerCase();

    // Special case: t switches to previous tab when not typing a label
    if (lowerKey === "t" && !typed && previousTabId) {
      const prevTab = entries.find((en) => en.tab.id === previousTabId);
      if (prevTab) {
        activate(prevTab.tab);
        return;
      }
    }

    const next = typed + lowerKey;

    const exact = labelToEntry.get(next);
    if (exact) {
      activate(exact.tab);
      return;
    }

    const hasPrefix = entries.some((en) => en.label.startsWith(next));
    if (hasPrefix) {
      typed = next;
      render();
    }
  }
}

async function activate(tab) {
  document.removeEventListener("keydown", onKeyDown, true);
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  window.close();
}

init();
