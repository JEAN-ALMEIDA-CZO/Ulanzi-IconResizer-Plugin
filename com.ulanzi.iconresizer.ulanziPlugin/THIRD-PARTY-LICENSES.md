# Third-Party Licenses

This plugin bundles or relies on the following third-party libraries and online
services. Each is the property of its respective authors and is distributed
under its own license.

## Bundled libraries

| Component | Use | License | Copyright |
|-----------|-----|---------|-----------|
| `libs/js/gif.js` + `gif.worker.js` | Animated GIF encoding (Animated Generator) | MIT | © 2013 Johan Nordberg |
| `libs/js/gifsicle.min.js` | GIF optimization / resizing (WASM build of Gifsicle) | GPL-2.0 (gifsicle) / MIT (JS wrapper) | © Eddie Kohler; wrapper © Renzo Sambuy |
| `ws` (`node_modules/ws`) | WebSocket client for the Ulanzi SDK channel | MIT | © 2011 Einar Otto Stangvik and contributors |
| `libs/node/*`, `libs/js/ulanziApi.js`, `ulanzideckApi.js` | Ulanzi UlanziDeck SDK | © Ulanzi | © Ulanzi Technology |

## Fonts

Loaded at runtime from **Google Fonts** (not bundled), used in the canvas
renderers of *IconText Generate*, *Animated Generator* and *Batch Pack*:

| Font | License | Copyright |
|------|---------|-----------|
| Inter, Roboto, Poppins, Montserrat, Raleway, Lato, Ubuntu, Oswald, Play, Righteous, Audiowide, Pacifico, Caveat, Bebas Neue | SIL Open Font License 1.1 / Apache License 2.0 | © their respective authors via Google Fonts |

`Impact` and `Arial` are system fonts and are not distributed with this plugin.

## Online services

Used at runtime over HTTPS. No credentials of the end user are collected by the
plugin; only the search term / prompt is sent to the relevant service.

| Service | Use | Notes |
|---------|-----|-------|
| [Iconify API](https://iconify.design) | Vector icon search (*Search Icons*, *Batch Pack*) | Open-source icon index |
| [Pixabay API](https://pixabay.com/api/docs/) | Stock image search (*Search Images*, *AI Generator → Image Bank*) | Free tier API key |
| [images.weserv.nl](https://images.weserv.nl) | Image proxy/resize for thumbnails and downloads | Improves reachability in restricted networks |
| [Google Translate (gtx endpoint)](https://translate.google.com) | Translating any search term to English | Best-effort, public endpoint |
| [Google Gemini API](https://ai.google.dev) | AI image generation (*AI Generator*) | Requires the user's own API key |

---

## MIT License (gif.js, ws)

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the above copyright notice and this permission
notice being included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

## Gifsicle

Gifsicle is licensed under the GNU General Public License, version 2.
See https://www.lcdf.org/gifsicle/ for the full source and license text.
The JavaScript/WASM wrapper is distributed under the MIT License.
