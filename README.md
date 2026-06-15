# Tab Flash

A Chrome extension that shows every open tab in the current window and lets you jump to any of them by typing a short, dynamically generated key label, inspired by [flash.nvim](https://github.com/folke/flash.nvim).

## Features

- **Dynamic label generation** — Each tab gets a single-key or multi-key label, generated to be prefix-free and minimal
- **Keyboard-first navigation** — Type labels to jump, use arrow keys to browse, or click directly
- **Previous tab switching** — Press `t` to instantly jump back to the previous tab
- **Real-time visual feedback** — See typed keys highlighted in golden tones, non-matching tabs dimmed out
- **Light sepia theme** — Warm, vintage aesthetic that's easy on the eyes

## How it works

When you open the popup, each tab is assigned a label from a set of home-row-first keys (`asdfghjkl...`). Labels are generated to be **prefix-free** and as short as possible:

- With 25 or fewer tabs (excluding 't'), every tab gets a single-key label
- With more tabs, the shortest labels expand into multi-key labels so that no label is a prefix of another, keeping typing unambiguous

Type a label to jump to that tab. For multi-key labels, the portion you've already typed turns golden and non-matching tabs dim out, just like flash.

## Controls

| Key(s) | Action |
|--------|--------|
| **Type label keys** | Jump to matching tab |
| **`t`** | Switch to previous tab (works anytime, not typed as a label) |
| **Arrow Up/Down** | Navigate tab list (when not typing a label) |
| **`Enter`** | Switch to selected or typed tab |
| **`Backspace`** | Remove last typed key |
| **`Esc`** | Clear input or close popup |
| **Click tab** | Jump to that tab |

## Install (Developer Mode)

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked** and select the `chrome-tabber` folder
4. The Tab Flash icon now appears in your toolbar
5. Optional but highly recommended, set a keyboard shortcut at `chrome://extensions/shortcuts`

## Usage Examples

### Example 1: 5 tabs open

```
Tab 1 (Gmail)              → Label: A
Tab 2 (GitHub)             → Label: S
Tab 3 (Stack Overflow)     → Label: D
Tab 4 (Docs)               → Label: F
Tab 5 (YouTube)            → Label: G
```

Press `s` to jump to GitHub.

### Example 2: 30 tabs open

```
25 single-key labels (A–Z, excluding T)
5 two-key labels starting with wrapped keys:
  Label: AA, AS, AD, AF, AG...
```

Press `a` then `s` to jump to one of the two-key labeled tabs.

### Example 3: Switch between two tabs

```
You're on Tab A and switch to Tab B using the extension.
Next time you open the extension, press `t` to jump back to Tab A.
```

## Design Notes

- **'t' is reserved** for previous-tab switching and cannot be assigned as a label
- **Prefix-free labels** mean you never need to wait or guess—typing immediately narrows down or commits to a choice
- **Session storage** means the previous tab ID persists across popup opens, but resets when the browser closes
- **Light sepia theme** uses a warm color palette inspired by vintage typography

## Troubleshooting

**Extension doesn't appear in toolbar?**
- Check that it's enabled in `chrome://extensions`
- Refresh the page with `Ctrl+Shift+R` or via the extensions page

**Labels look wrong or are missing?**
- Reload the extension by clicking the refresh icon on its card in `chrome://extensions`

**Previous tab switching not working?**
- Make sure you're not actively typing a label when you press `t`
- The previous tab must still exist in the current window

## Development

Files:
- `manifest.json` — Extension configuration (Manifest V3)
- `popup.html` — Popup UI structure
- `popup.css` — Styling (light sepia theme)
- `popup.js` — Core logic (label generation, keybindings, tab switching)
- `README.md` — This file

## License

Free to use and modify. Inspired by [flash.nvim](https://github.com/folke/flash.nvim).
