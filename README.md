# ⚡ EasyFlash : Web-Based ESP32 Firmware Flasher
<p align="center">
  <strong>A modern, zero-install Web Serial firmware flashing station and project dashboard for ESP32 microcontrollers.</strong>
</p>

<p align="center">
  <a href="https://mukeshsankhla.github.io/EasyFlash/"><img src="https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-2563eb?style=for-the-badge&logo=github" alt="Live Demo" /></a>
  <img src="https://img.shields.io/badge/Web%20Serial%20API-Supported-10b981?style=for-the-badge&logo=googlechrome" alt="Web Serial API" />
  <img src="https://img.shields.io/badge/Vite-8.x-646cff?style=for-the-badge&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/ESP32-S3%20%7C%20P4%20%7C%20C3%20%7C%20Classic-d97706?style=for-the-badge&logo=espressif" alt="ESP32 Family" />
</p>

---

## 🌟 Overview

**EasyFlash** is an ultra-fast, client-side web flasher designed for hardware creators, makers, and open-source embedded developers. Users can flash pre-compiled binaries (`.bin`) directly to ESP32 boards from Google Chrome or Microsoft Edge—**no Python, drivers, or command-line tools required**.

---

## ✨ Features

- **🚀 Zero-Install Flashing**: Leverages the browser-native **Web Serial API** and `esptool-js` to communicate directly with ESP32 bootloaders via USB-C / UART.
- **📦 Multi-Firmware Versioning**: Switch between multiple firmware editions, release builds, and historical versions on a single project page.
- **📝 Clean Version Notes**: Markdown-style changelogs, release dates, and technical build summaries rendered per firmware build.
- **⚡ Live Cloud Flash Counter**: Real-time synchronization across clients powered by **Firebase Firestore**, tracking total community flash milestones.
- **📈 5-Stage Real-Time Pipeline**:
  - `Connect`: Baud rate negotiation and ESP32 chip family identification (`ESP32-S3`, `ESP32-P4`, etc.).
  - `Download`: Client-side binary fetching with live byte progression.
  - `Flash`: Byte-accurate block transfer with dynamic memory write monitoring.
  - `Verify`: Chip-level hardware MD5 checksum scanning animation.
  - `Complete`: Automatic hardware RTS/DTR reset to boot directly into the new firmware.
- **💻 Built-in Serial Terminal**: Full-featured Web Serial monitor with configurable baud rates (115200 to 921600), ASCII/Hex send input, auto-scrolling, and copy tools.
- **🔗 Clean URLs**: Modern HTML5 history routing (`/project/ai-buddy`) with seamless GitHub Pages SPA redirect fallback.
- **🎨 Premium UI Design**: Elegant paper-light theme with custom dark terminal components, animated state indicators, and responsive card layouts.

---

## 🛠️ Supported Hardware

EasyFlash supports all major Espressif chipsets:
- **ESP32** (Classic)
- **ESP32-S2**
- **ESP32-S3** (e.g. AI Buddy, Xiao ESP32S3, Freenove)
- **ESP32-C2 / ESP32-C3 / ESP32-C5 / ESP32-C6 / ESP32-C61**
- **ESP32-H2**
- **ESP32-P4** (e.g. DFRobot FireBeetle 2 ESP32-P4 DSI PC Displays)
- **ESP8266** (Legacy)

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+ and `npm`
- A Chromium-based browser (Google Chrome, Microsoft Edge, Brave, Opera)

### 1. Clone & Install
```bash
git clone https://github.com/MukeshSankhla/EasyFlash.git
cd EasyFlash
npm install
```

### 2. Run Local Dev Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173/EasyFlash/`.

### 3. Build for Production
```bash
npm run build
```
Production assets are generated in the `dist/` directory.

---

## 📁 Project Configuration (`src/projects.json`)

To add your own hardware projects and firmware builds, modify [`src/projects.json`](src/projects.json):

```json
[
  {
    "id": "ai-buddy",
    "title": "AI Buddy",
    "publishDate": "July 2026",
    "description": "AI Buddy voice assistant firmware for interactive ESP32-S3 desktop robots.",
    "coverImage": "https://raw.githubusercontent.com/MukeshSankhla/AI-Buddy/main/images/Cover.png",
    "docLink": "https://www.hackster.io/Mukesh_Sankhla/build-an-open-source-ai-buddy",
    "githubLink": "https://github.com/MukeshSankhla/AI-Buddy",
    "compatibleBoard": "ESP32-S3",
    "firmwares": [
      {
        "version": "v2.1.0",
        "name": "Voice Assistant Edition (Latest)",
        "releaseDate": "July 2026",
        "firmwareUrl": "https://raw.githubusercontent.com/MukeshSankhla/AI-Buddy/main/xiaozhi_v2.1.0.bin",
        "flashAddress": "0x00",
        "versionNote": "Optimized wake word detection and low-latency OPUS streaming."
      },
      {
        "version": "v2.0.0",
        "name": "Legacy Edition",
        "releaseDate": "June 2026",
        "firmwareUrl": "https://raw.githubusercontent.com/MukeshSankhla/AI-Buddy/main/xiaozhi_v2.0.0.bin",
        "flashAddress": "0x00",
        "versionNote": "Initial stable release with basic voice commands."
      }
    ]
  }
]
```

---

## ☁️ Firebase Firestore Setup (Flash Counter)

EasyFlash connects to Cloud Firestore to track and increment community flash counts in real-time.

### Firestore Security Rules
In your [Firebase Console](https://console.firebase.google.com/), set your rules for the `project_stats` collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /project_stats/{projectId} {
      allow read, write: if true;
    }
  }
}
```

---

## 🚢 Automated GitHub Pages Deployment

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys the application on every push to `main`.

1. Go to your repository **Settings** → **Pages**.
2. Set **Build and deployment Source** to **GitHub Actions**.
3. Push to `main` branch to trigger the live deployment.

---

## 👨‍💻 Author & Credits

Created with 💖 by **[Mukesh Sankhla](https://www.linkedin.com/in/mukeshsankhla/)** / **[Maker Brains](https://www.makerbrains.com)**.

- 🌐 **Website**: [Maker Brains](https://www.makerbrains.com)
- 🛠️ **Hackster.io**: [Mukesh Sankhla Projects](https://www.hackster.io/Mukesh_Sankhla)
- 🐙 **GitHub**: [@MukeshSankhla](https://github.com/MukeshSankhla)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
