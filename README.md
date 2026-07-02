# The Map of Everything

A browser-based generative film about networks, growth, collapse, and scale.

The app renders a living 3D map with WebGL, builds the network procedurally in JavaScript, and plays a matching ambient score with the Web Audio API. It prefers WebGL2, falls back to WebGL1 on compatible devices, and provides a lighter Canvas 2D experience when GPU rendering is unavailable. It has no build step and no external dependencies.

This project was created as an experiment with Claude Fable.

## Demo

![Early network growth](assets/demo/01-early-network.jpg)

![Growing generated network](assets/demo/02-growing-network.jpg)

![Wide network field](assets/demo/03-wide-network-field.jpg)

![Network flythrough](assets/demo/04-network-flythrough.jpg)

![Expanded glowing network](assets/demo/05-expanded-network.jpg)

## Quick Start

Open `index.html` in a modern browser that supports WebGL.

For the most reliable local setup, serve the folder with any static file server:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Click **Begin** to start the film.

## Controls

| Key | Action |
| --- | --- |
| `Space` | Pause or resume |
| `Left Arrow` | Skip back 10 seconds |
| `Right Arrow` | Skip forward 10 seconds |
| `R` | Generate a new seed |
| `F` | Toggle fullscreen |
| `M` | Mute or unmute audio |

## URL Options

You can tune or test the film with query parameters:

| Parameter | Example | Description |
| --- | --- | --- |
| `seed` | `?seed=12345` | Replays a specific generated map |
| `n` | `?n=60000` | Sets the total node count |
| `auto` | `?auto=120` | Starts automatically at a timestamp in seconds |
| `hold` | `?auto=120&hold` | Starts at a timestamp and freezes there |

Examples:

```text
http://localhost:8000/?seed=42
http://localhost:8000/?n=60000&auto=95
http://localhost:8000/?auto=234&hold
```

## How It Works

The film begins with a single point, grows into a connected universe of networks, tours through different structures, pulls back into a galaxy-like whole, collapses back to a point, and reveals that point as part of a larger repeating network.

The generated map contains ten structure types:

- neural
- vascular
- city
- social
- galaxy
- roots
- internet
- river
- knowledge
- supply

Each structure is made by the same graph-generation system with different parameters. That shared algorithm is the central idea of the piece: many kinds of systems can look different while following similar rules of connection and growth.

## File Map

| File | Purpose |
| --- | --- |
| `index.html` | Page shell, loading screen, canvas, and inline UI styles |
| `main.js` | WebGL setup, timeline, camera path, rendering loop, post-processing, and input handling |
| `graph.js` | Procedural graph generation, regions, edges, node births, colors, and GPU buffers |
| `shaders.js` | GLSL shader sources for points, lines, glow, bloom, and final composite |
| `audio.js` | Generative ambient score using the Web Audio API |
| `fallback.js` | Lightweight Canvas 2D renderer for browsers without WebGL |

## Requirements

- A modern desktop browser
- WebGL2 or WebGL1 for the full experience; Canvas 2D is used as a fallback
- Audio starts only after the first user interaction, which is required by browser autoplay rules

If the animation is slow, try lowering the node count:

```text
http://localhost:8000/?n=60000
```

## Contributors

- Shreya Komarabattini
- Claude Fable - experimental collaborator
