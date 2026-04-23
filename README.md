# TopDown ARPG (HTML / CSS / JS)

A browser-based action RPG with top-down combat and dungeon-crawling, built with **TypeScript**, **HTML5 Canvas**, and **Vite** for local development and builds.

## Requirements

- **Node.js 18+** (recommended: current [LTS](https://nodejs.org/))
- **npm** (comes with Node)

## Getting started

### 1. Get the code

**Clone with Git**

```bash
git clone https://github.com/LocalBBQ/TopDownARPG-HTML-CSS-JS.git
cd TopDownARPG-HTML-CSS-JS
```

**Or** on GitHub: **Code → Download ZIP**, then unzip and open a terminal in that folder.

### 2. Install dependencies

```bash
npm install
```

### 3. Run the dev server

```bash
npm run dev
```

Vite prints a local URL (usually **http://localhost:5173**). Open it in **Chrome**, **Edge**, or **Firefox**. The canvas needs this dev server so modules and TypeScript load correctly; opening `index.html` directly from disk is not supported.

### 4. Production build (optional)

```bash
npm run build
```

Output goes to **`dist/`**. You can preview it with:

```bash
npx vite preview
```

To host on **GitHub Pages**, deploy the contents of `dist/` (for example with a GitHub Actions workflow or the Pages “Deploy from branch/folder” flow pointing at `dist` after a build).

## Scripts

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `npm run dev`      | Start Vite dev server with HMR |
| `npm run build`    | Type-check and bundle to `dist/` |
| `npm test`         | Run Vitest once                  |
| `npm run test:watch` | Run Vitest in watch mode     |

## Controls

- **WASD** — move  
- **Shift** — sprint  
- **Space** — dodge  
- **Left click** — attack  
- **Right click** — block  
- **R** — shoot  
- **E** — portal / interact  
- **Tab** — inventory  
- **V** (hold) — Strategy Crafting  

## License

ISC (see `package.json`).
