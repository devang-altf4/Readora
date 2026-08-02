# Readora 📖

Readora is a premium, cross-platform e-reader app and backend service designed to replicate the clean, distraction-free reading experience of Amazon Kindle devices. Built with React Native (Expo) and FastAPI, Readora automatically extracts PDF text and reflows it into Kindle Smart Mode with custom Bookerly typography, smooth horizontal page-swiping, and responsive light/dark themes.

---

## ✨ Features

- **Reflowable Kindle Smart Mode**: Converted PDF text renders cleanly in calibrated Bookerly typography with horizontal page swiping.
- **Kindle Paperwhite Light & Dark Aesthetics**:
  - **Light Mode**: Warm e-paper / vellum off-white background (`#F5F3EC`) with charcoal dark ink text (`#171717`).
  - **Dark Mode**: Pitch dark e-ink background (`#000000`) with soft warm grey body text (`#D0D0D0`).
- **Hardware-Accelerated Page Swiping**: Smooth right-to-left (next page) and left-to-right (previous page) page flipping backed by native CSS column snap.
- **Offline PDF Processing & Caching**: Offline-first SQLite database with background synchronization to FastAPI backend.
- **Kindle Location & Progress Overlay**: Fixed non-overlapping footer display showing exact `Location X of Y` and reading percentage.

---

## 🛠 Tech Stack

- **Mobile App**: React Native, Expo, TypeScript, Expo SQLite, WebView, Zustand, React Native Safe Area Context.
- **Backend API**: Python, FastAPI, PyMuPDF (fitz), MongoDB / Local Storage.

---

## 🚀 Quick Start

### 1. Backend Service
```bash
cd services/api
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Mobile App
```bash
cd apps/mobile
npm install
npx expo start
```

---

## 📜 License

MIT License. Built for high-performance mobile reading.
