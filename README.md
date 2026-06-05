# C.A.B.I.N.E.T.

**C**abinet **A**nd **B**locks **I**s **N**ot **E**tch **T**ogether

3D cabinet design tool built with Three.js.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:8080` in your browser.

## Controls

| Key | Action |
|-----|--------|
| V | Select tool |
| G | Move tool |
| Ctrl | Toggle select/move |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Delete | Remove selected |
| F2 | Rename selected |
| Escape | Deselect / close panels |

## Structure

```
├── index.html          # Entry point
├── css/
│   └── style.css       # All styles
├── js/
│   ├── cabinet.js      # CabinetNode class, cell system
│   ├── state.js        # Save/load, undo/redo, auto-save
│   ├── ui.js           # Sidebar, props, dialogs, calculator
│   └── app.js          # Scene setup, event handlers, main loop
```
HOLE PROJECT IS AI use whit caution!
