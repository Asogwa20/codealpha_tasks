# Precious Tech Gallary — Advanced Image Gallery & Image Discovery

A professional, browser-based image management and discovery application built with **HTML5, CSS3, and vanilla JavaScript** (no frontend frameworks). It supports local gallery management with persistent storage, album organization, favourites, trash/restore, a basic canvas image editor, and online image discovery via the **Wikimedia Commons API**.

## Features

### Dashboard
- Overview stats: total images, total albums, favourites, recently added count
- Storage usage estimate (via browser Storage API when available)
- Quick upload (button and drag-and-drop)
- Recently uploaded image preview grid

### My Gallery
- Multiple image uploads and drag-and-drop upload
- Image metadata: title, description, category, tags
- Local search (top search bar) across titles, tags, descriptions, categories, and filenames
- Sorting: newest/oldest, name A–Z/Z–A, largest size
- Filtering by category and tag
- Favourite toggle
- Selection mode with bulk delete (moves to Trash) and bulk download
- Individual actions: view, edit details, edit image, add/manage albums, download, delete
- Full-screen lightbox preview

### Online Image Discovery (Explore Images)
- Dedicated Explore Images page powered by the **Wikimedia Commons API**
- Keyword search with thumbnail results
- Displays title, author/creator (when available), licence, source page, and description
- Image preview dialog with metadata
- Import image into My Gallery
- Download image (with fallback to opening the source page if direct download is restricted)
- Handles loading states, empty results, API/network errors, and CORS-related import restrictions by offering to open the original source page

### Image Editor
- Browser-based editor using the **HTML Canvas API**
- Tools: crop, rotate (left/right), horizontal/vertical flip, resize (with aspect-ratio lock), brightness, contrast, basic filters (grayscale, sepia, invert, saturate)
- Reset changes and live preview before saving
- **Never overwrites the original image** — saves an edited copy to the gallery

### Albums and Favourites
- Create, rename, and delete albums
- Add/remove images to/from albums (via image details dialog and album view)
- An image can belong to multiple albums
- View album contents
- Mark and unmark favourites; dedicated Favourites view

### Trash (recycle bin)
- Deleted gallery images are moved to Trash
- Restore images from Trash or permanently delete them
- Empty Trash action (with confirmation)

### Lightbox
- Full-screen image preview
- Previous/next navigation
- Image information (title, metadata, description, attribution/licence when available)
- Actions: favourite, edit, download, delete
- Keyboard navigation: `←`/`→` to navigate, `Esc` to close

### User Experience
- Welcome guide on first visit
- Quick Help page
- Empty states and loading indicators
- Confirmation dialogs before destructive actions
- Success/error toast notifications
- Responsive layout with mobile-friendly sidebar/navigation
- Dark and light themes (preference saved locally)
- Accessible labels, focus-visible styles, and keyboard-operable controls where practical

## Technologies
- **HTML5** — semantic structure, dialogs, accessible controls
- **CSS3** — responsive layout, masonry/grid views, theming with CSS variables, transitions
- **Vanilla JavaScript (ES modules)** — application logic
- **IndexedDB** — persistent local storage for images, albums, and trash
- **localStorage** — lightweight preferences (theme, welcome state)
- **HTML Canvas API** — image editing operations
- **Wikimedia Commons API** — online image search and metadata

## Folder structure

```text
image-gallery/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── app.js            # App bootstrap, state, routing, dashboard, dialogs, wiring
│   ├── gallery.js        # Gallery rendering, filters UI, cards, selection, object URLs
│   ├── storage.js        # IndexedDB/localStorage persistence and storage helpers
│   ├── upload.js         # File validation, drag-and-drop, import pipeline
│   ├── search.js         # Local search/filter/sort utilities
│   ├── online-images.js  # Wikimedia Commons search, preview, import/download
│   ├── editor.js         # Canvas-based image editor (save edited copies)
│   ├── albums.js         # Album CRUD and album views
│   └── lightbox.js       # Full-screen preview, navigation, actions
└── assets/
    └── icons/
```

## How to run

Because the app uses ES modules (`<script type="module">`), it should be served over HTTP rather than opened directly as a file in some browsers.

1. Open a terminal in the `image-gallery` folder.
2. Start a local static server. Examples:
   - **Python 3:** `python -m http.server 8000`
   - **Node (npx):** `npx serve .`
   - **VS Code:** use the "Live Server" extension
3. Open the shown URL in your browser, e.g. `http://localhost:8000`.

No build step or external dependencies are required.

## How online image discovery works

- The Explore Images page queries the **Wikimedia Commons** API endpoint: `https://commons.wikimedia.org/w/api.php`.
- Searches use `action=query` with `generator=search` in the file namespace (`gsrnamespace=6`) to find media files.
- For each result, the app requests image info and metadata (`prop=imageinfo`, `iiprop=url|extmetadata|size|mime|user`, plus thumbnail URLs).
- The UI displays available metadata such as title, author/creator, licence, source page, description, and thumbnail preview.
- **Importing:** the app attempts to fetch the original (or thumbnail) image as a blob and store it locally in IndexedDB along with attribution/licence/source metadata.
- **CORS/browser restrictions:** if a remote image cannot be fetched/imported directly due to browser or network restrictions, the app informs the user and offers to open the original Wikimedia Commons source page (download also falls back to the source page when direct download is blocked).
- Search results are fetched live from the API (not hardcoded). The app respects Wikimedia Commons terms and expects users to follow applicable licence/attribution requirements.

## Image storage and limitations

- **Local-only storage:** gallery images, albums, and trash are stored in your browser using **IndexedDB**. They persist across refresh/reopen in the same browser/profile, but clearing site data/browser storage will remove them.
- **Storage quotas:** browsers impose storage limits. The dashboard shows an estimate when available; uploads/imports may fail when storage is full. The app reports quota-related errors and suggests freeing space (e.g. emptying trash).
- **Upload limits/validation:** uploads accept common image formats (JPEG, PNG, GIF, WebP, BMP, SVG) with a per-file size limit (20 MB) and basic type checks.
- **Bulk download:** implemented as sequential downloads for practicality; browsers may prompt or block multiple automatic downloads depending on settings.
- **Remote import variability:** some Wikimedia files may be large or restricted by cross-origin/network conditions; when direct import/download fails, the app provides a supported fallback to open the source page.
- **Metadata safety:** user/API-provided text is rendered safely (escaped) to prevent unsafe HTML injection.
- **Object URLs:** blob URLs created for rendering are revoked when replaced or on unload to reduce leaks.
- **Not a backup/sync service:** data is not synced across devices or browsers.

## Image licensing and attribution

Images discovered via Wikimedia Commons are subject to their individual licences. The app shows licence and creator information when provided by the API and stores attribution/source/licence metadata with imported images, but **you are responsible** for complying with the licence terms (including attribution, share-alike, or other requirements) when using or redistributing images.

## Notes

- This is a client-side application; no private API keys are embedded.
- Tested features depend on browser support for IndexedDB, Canvas, Fetch, and ES modules (modern browsers recommended).
