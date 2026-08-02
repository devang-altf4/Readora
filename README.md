# Readora 📖

> **Readora** is a premium, distraction-free digital e-reader and library platform designed to replicate the clean, tactile reading experience of Amazon Kindle devices. Built with **React Native (Expo)** and **FastAPI**, Readora automatically extracts, parses, and reflows books into customizable Smart Reading mode with Bookerly/Baskerville typography, horizontal page-flipping, dynamic e-paper themes, and cloud synchronization.

---

## ✨ Key Features

- **📖 Multi-Format Book Support**: Full support for importing and reading **PDF, EPUB, KEPUB, MOBI, AZW, AZW3, HTML, TXT, and DOCX** files.
- **⚡ Instant Cover Extraction**: Backend extracts Page 0 covers synchronously upon upload (~15ms) so your library displays real e-book cover art immediately.
- **📱 Reflowable Kindle Smart Reader**: 
  - Reflows fixed documents into responsive, beautiful typography.
  - Customizable font family (Serif *Libre Baskerville* / Sans-Serif), font size, and line height.
  - Smooth horizontal right-to-left page swiping with native touch controls.
  - Real-time **Location X of Y** and percentage reading progress footer.
- **🎨 Kindle Paperwhite & E-Ink Dark Themes**:
  - **Dark Mode (Default)**: Pitch dark e-ink background (`#000000`) with soft warm grey text (`#D0D0D0`) for night reading.
  - **Light Mode**: Warm e-paper vellum background (`#F5F3EC`) with crisp black (`#171717`) text and controls.
- **📚 Curated Starter Library & Personal Collection**:
  - Includes pre-seeded classic e-books (*Designing Data-Intensive Applications*, *Hamlet*, *Sherlock Holmes*).
  - Search, filter, and sort your personal collection by Last Opened, Title, or Reading Progress.
  - Toggle seamlessly between **Grid (`☷`)** and **List (`≡`)** views.
  - Programmatic 3D Hardcover Book Cover cards with deterministic literary color palettes for books without embedded cover images.
- **💾 Offline-First Architecture**: Powered by local SQLite database with background cloud sync to FastAPI backend.

---

## 🛠 Tech Stack

### Mobile App (`apps/mobile`)
- **Framework**: React Native, Expo SDK 54, Expo Router v6
- **Language**: TypeScript
- **State & Database**: Zustand, Expo SQLite
- **UI & Motion**: React Native Reanimated, Safe Area Context, Vector Icons
- **Build System**: Expo Application Services (EAS)

### Backend API (`services/api`)
- **Framework**: Python 3.11, FastAPI, Uvicorn
- **Parsing & PDF**: PyMuPDF (`fitz`), BeautifulSoup4, Python-Multipart
- **Database & Storage**: MongoDB Atlas, Local File Storage
- **Deployment**: Render Web Service + UptimeRobot Keep-Alive

---

## 🏗 Project Structure

```text
Readora/
├── apps/
│   └── mobile/                # React Native Expo Mobile Application
│       ├── app/               # Expo Router pages (Home, Library, Readers, Settings)
│       ├── src/
│       │   ├── components/    # BookCoverCard, UI components
│       │   ├── database/      # SQLite repository layers
│       │   ├── services/      # API client & Import service
│       │   ├── state/         # Zustand store handlers
│       │   └── theme/         # Light/Dark e-ink design system
│       └── eas.json           # EAS Build configuration (APK / AAB)
│
└── services/
    └── api/                   # FastAPI Backend Microservice
        ├── app/
        │   ├── api/v1/        # REST Endpoints (Books, Catalog, Health, Auth)
        │   ├── core/          # Config & Logging
        │   ├── repositories/ # MongoDB Data Repositories
        │   ├── services/      # Book extraction & Cover generation pipeline
        │   └── storage/       # File storage service
        └── requirements.txt
```

---

## 🚀 Quick Start Guide

### 1. Run Backend Locally
```bash
cd services/api
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend health check will be available at: `http://localhost:8000/api/v1/health`

### 2. Run Mobile App Locally
```bash
cd apps/mobile
npm install
npx expo start
```

---

## ☁️ Production Deployment & Build

### Backend (Render Deployment)
- **Root Directory**: `services/api`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Endpoint**: `https://YOUR-APP.onrender.com/api/v1/health` *(Keep awake via UptimeRobot every 5 mins)*

### Mobile App Build (Expo EAS)
```bash
cd apps/mobile

# Build APK for direct phone installation (Friends / Internal Testing)
npx eas-cli@latest build --platform android --profile preview

# Build AAB for Google Play Console Submission
npx eas-cli@latest build --platform android --profile production
```

---

## 📜 License

MIT License. Designed and crafted for high-performance, distraction-free mobile reading.
