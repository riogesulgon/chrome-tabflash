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

let allTabs = []; // All tabs in their original order
let displayedTabs = []; // Tabs in the current sort order
let entries = []; // [{ tab, label }] - for label lookup
let labelToEntry = new Map();
let typed = "";
let selectedIndex = 0;
let previousTabId = null;
let sortMode = "tabOrder"; // "tabOrder" or "alphabetical"

async function init() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  tabs.sort((a, b) => a.index - b.index);
  allTabs = tabs;

  // Store the currently active tab as the previous tab for next time
  const currentActive = tabs.find((t) => t.active);
  if (currentActive) {
    try {
      const result = await chrome.storage.session.get(["previousTabId"]);
      if (result.previousTabId && result.previousTabId !== currentActive.id) {
        previousTabId = result.previousTabId;
      }
      await chrome.storage.session.set({ previousTabId: currentActive.id });
    } catch (e) {
      console.error("Storage error:", e);
    }
  }

  if (tabs.length === 0) {
    document.getElementById("empty").hidden = false;
    return;
  }

  updateDisplayedTabs();
  render();
  document.addEventListener("keydown", onKeyDown, true);
  document.getElementById("merge-btn").addEventListener("click", mergeAllWindows);
  document.getElementById("sort-btn").addEventListener("click", toggleSort);
  document.getElementById("new-window-btn").addEventListener("click", openSelectedInNewWindow);
}

function updateDisplayedTabs() {
  if (sortMode === "alphabetical") {
    displayedTabs = [...allTabs].sort((a, b) => {
      const titleA = (a.title || a.url || "(untitled)").toLowerCase();
      const titleB = (b.title || b.url || "(untitled)").toLowerCase();
      return titleA.localeCompare(titleB);
    });
  } else {
    displayedTabs = [...allTabs];
  }

  // Generate labels for displayed tabs
  const labels = generateLabels(displayedTabs.length);
  entries = displayedTabs.map((tab, i) => ({ tab, label: labels[i] }));
  labelToEntry = new Map(entries.map((e) => [e.label, e]));

  // Reset selected index when sort changes
  selectedIndex = 0;
  typed = "";
}

function toggleSort() {
  sortMode = sortMode === "tabOrder" ? "alphabetical" : "tabOrder";
  const btn = document.getElementById("sort-btn");
  btn.textContent = sortMode === "alphabetical" ? "Sort: Alphabetical" : "Sort: Tab order";
  updateDisplayedTabs();
  render();
}

function getCurrentTargetTab() {
  if (typed) {
    const exact = labelToEntry.get(typed);
    return exact ? exact.tab : null;
  }
  if (selectedIndex >= 0 && selectedIndex < entries.length) {
    return entries[selectedIndex].tab;
  }
  return null;
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
    const targetTab = getCurrentTargetTab();
    if (targetTab) {
      activate(targetTab);
    }
    return;
  }

  if (key === "Shift" && e.shiftKey) {
    // Let shift be processed with the next key
    return;
  }

  if (e.shiftKey && key.toUpperCase() === "M") {
    e.preventDefault();
    mergeAllWindows();
    return;
  }

  if (e.shiftKey && key.toUpperCase() === "S") {
    e.preventDefault();
    toggleSort();
    return;
  }

  if (e.shiftKey && key.toUpperCase() === "N") {
    e.preventDefault();
    openSelectedInNewWindow();
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

async function openSelectedInNewWindow() {
  const btn = document.getElementById("new-window-btn");
  const targetTab = getCurrentTargetTab();

  if (!targetTab) {
    const originalText = btn.textContent;
    btn.textContent = "No exact selection";
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1200);
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Opening...";

  try {
    await chrome.windows.create({ tabId: targetTab.id, focused: true });
    window.close();
  } catch (e) {
    console.error("Open in new window error:", e);
    btn.textContent = "Error opening";
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 1200);
  }
}

async function mergeAllWindows() {
  const btn = document.getElementById("merge-btn");
  btn.disabled = true;
  btn.textContent = "Merging...";

  try {
    const currentWindow = await chrome.windows.getCurrent();
    const allWindows = await chrome.windows.getAll();
    const otherWindows = allWindows.filter((w) => w.id !== currentWindow.id);

    if (otherWindows.length === 0) {
      btn.textContent = "No other windows";
      setTimeout(() => {
        btn.textContent = "Merge all windows";
        btn.disabled = false;
      }, 2000);
      return;
    }

    for (const win of otherWindows) {
      const tabs = await chrome.tabs.query({ windowId: win.id });
      const tabIds = tabs.map((t) => t.id);
      await chrome.tabs.move(tabIds, { windowId: currentWindow.id, index: -1 });
    }

    btn.textContent = "Merged!";
    setTimeout(() => {
      window.close();
    }, 500);
  } catch (e) {
    console.error("Merge error:", e);
    btn.textContent = "Error merging";
    btn.disabled = false;
  }
}

init();
