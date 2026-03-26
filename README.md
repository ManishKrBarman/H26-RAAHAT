<p align="center">
  <img src="https://img.shields.io/badge/🚦_RAAHAT-AI_Traffic_Management-ff6b35?style=for-the-badge&labelColor=1a1a2e" alt="Raahat" />
  <br />
  <h1 align="center">Raahat — AI-Powered Smart Traffic Management System</h1>
  <p align="center">
    <em>Real-time traffic signal optimization using computer vision, audio analysis, and IoT hardware</em>
    <br /><br />
    <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick_Start-▶-28a745?style=flat-square" alt="Quick Start" /></a>
    &nbsp;
    <a href="DOCKER.md"><img src="https://img.shields.io/badge/Docker_Guide-🐳-2496ED?style=flat-square" alt="Docker Guide" /></a>
    &nbsp;
    <a href="esp32/README.md"><img src="https://img.shields.io/badge/ESP32_Setup-📡-E7352C?style=flat-square" alt="ESP32 Setup" /></a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/Node.js-Express_5-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/Python-FastAPI-3776AB?style=flat-square&logo=python&logoColor=white" />
    <img src="https://img.shields.io/badge/YOLOv8-Ultralytics-FF6F00?style=flat-square&logo=pytorch&logoColor=white" />
    <img src="https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white" />
    <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" />
    <img src="https://img.shields.io/badge/ESP32-IoT-E7352C?style=flat-square&logo=espressif&logoColor=white" />
  </p>
</p>

---

## 📋 Table of Contents

- [About the Project](#-about-the-project)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Local Development Setup](#-local-development-setup)
- [Docker Deployment](#-docker-deployment)
- [API Reference](#-api-reference)
- [AI Models](#-ai-models)
- [ESP32 Hardware Integration](#-esp32-hardware-integration)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [Team](#-team)
- [License](#-license)

---

## 🔍 About the Project

**Raahat** (meaning *"relief"* in Hindi/Urdu) is an intelligent traffic management system that uses AI-powered video and audio analysis to make real-time traffic signal decisions. The system processes live traffic footage through a $\color{orange}{\textsf{YOLOv8}}$ object detection model and a custom $\color{cyan}{\textsf{Audio CNN}}$ classification model to:

- $\color{lightgreen}{\textsf{▸ Count vehicles}}$ and estimate traffic density per lane
- $\color{red}{\textsf{▸ Detect emergency vehicles}}$ (ambulances, fire trucks) through both visual and audio cues
- $\color{gold}{\textsf{▸ Dynamically adjust signal timings}}$ based on real-time traffic conditions
- $\color{red}{\textsf{▸ Provide an emergency green corridor}}$ for first responders
- $\color{cyan}{\textsf{▸ Control physical traffic signals}}$ via ESP32 microcontrollers

> The project was developed as part of **Hackathon H26** — Team Raahat.

---

## ✨ Key Features

| | Feature | Description |
|:-:|---------|-------------|
| 🎥 | ![Video Analysis](https://img.shields.io/badge/Video_Analysis-FF6F00?style=flat-square) | YOLOv8-based vehicle detection, counting, speed estimation, and density classification |
| 🔊 | ![Audio Analysis](https://img.shields.io/badge/Audio_Analysis-9B59B6?style=flat-square) | Mel-spectrogram CNN model to detect emergency sirens (ambulance / fire truck) from video audio |
| 🧠 | ![Sensor Fusion](https://img.shields.io/badge/Sensor_Fusion-E74C3C?style=flat-square) | Weighted fusion of video (40%) and audio (60%) scores for robust emergency detection |
| ⚡ | ![Signal Engine](https://img.shields.io/badge/Signal_Engine-F39C12?style=flat-square) | Background engine (1s tick) that evaluates all lanes and switches signals automatically |
| 🔄 | ![Fairness](https://img.shields.io/badge/Lane_Rotation-2ECC71?style=flat-square) | Score-based penalty system ensures all lanes get green time, preventing starvation |
| 🚨 | ![Emergency](https://img.shields.io/badge/Emergency_Override-FF0000?style=flat-square) | Emergency vehicles trigger instant signal override — bypasses timers |
| 🎛️ | ![Manual](https://img.shields.io/badge/Manual_Control-3498DB?style=flat-square) | Dashboard-based manual signal override for traffic operators |
| 🗺️ | ![Map](https://img.shields.io/badge/Interactive_Map-1ABC9C?style=flat-square) | Leaflet-powered map with intersection markers and real-time signal status |
| 📹 | ![Video](https://img.shields.io/badge/Video_Upload-8E44AD?style=flat-square) | Upload traffic videos per lane, stream them from GridFS, and view analysis results |
| 📡 | ![ESP32](https://img.shields.io/badge/ESP32_IoT-E7352C?style=flat-square) | Physical LED traffic signals controlled via WiFi, synced with the dashboard |
| 🐳 | ![Docker](https://img.shields.io/badge/Docker_Ready-2496ED?style=flat-square) | Full-stack containerized deployment with a single `docker compose up` |

---

## 🏗️ System Architecture

```
               ┌────────────────────────────────────────────────────────┐
               │                    RAAHAT SYSTEM                      │
               └────────────────────────────────────────────────────────┘

  ┌───────────┐     polls /traffic/current     ┌──────────────────────┐
  │  Frontend │◄──────────── (2s) ────────────►│      Backend API     │
  │  React +  │                                │   Node.js + Express  │
  │   Vite    │   upload / stream / control    │                      │
  │  :5173    │◄──────────────────────────────►│       :3000          │
  └───────────┘                                └──────────┬───────────┘
       ▲                                            │           │
       │ browser                              MongoDB │     HTTP │
       │                                      :27017  │          │
  ┌────┴──────┐                              ┌────────▼──┐  ┌────▼──────────┐
  │  Operator │                              │  MongoDB  │  │  Model Server │
  │  (Human)  │                              │  GridFS   │  │  FastAPI      │
  └───────────┘                              │  (Videos) │  │  YOLOv8 +    │
                                             └───────────┘  │  Audio CNN   │
  ┌───────────┐     polls /esp32/signal/:id                 │  :8000       │
  │   ESP32   │◄──────────── (1s) ────────────►             └──────────────┘
  │  + LEDs   │     heartbeat /esp32/heartbeat
  │  (WiFi)   │
  └───────────┘
```

### Data Flow

> **1.** $\color{cyan}{\textsf{Video Upload}}$ → Operator uploads traffic footage per lane via the dashboard
>
> **2.** $\color{green}{\textsf{Storage}}$ → Videos stored in MongoDB GridFS; metadata in `videos` collection
>
> **3.** $\color{orange}{\textsf{Analysis}}$ → Backend sends video to Model Server → YOLOv8 + Audio CNN process it
>
> **4.** $\color{gold}{\textsf{Decision}}$ → Signal Engine reads analysis results → Decision Service scores all lanes
>
> **5.** $\color{lightgreen}{\textsf{Signal}}$ → Best lane gets green; duration based on density (15s–60s)
>
> **6.** $\color{magenta}{\textsf{Display}}$ → Dashboard polls every 2s; ESP32 polls every 1s → both show live signal state

---

## 🛠️ Tech Stack

### $\color{#61DAFB}{\textsf{Frontend}}$

| Technology | Purpose |
|:----------:|---------|
| ![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black) | UI framework |
| ![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=flat-square&logo=vite&logoColor=white) | Build tool & dev server |
| ![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white) | Interactive map |
| ![Axios](https://img.shields.io/badge/Axios-5A29E4?style=flat-square&logo=axios&logoColor=white) | HTTP client |
| ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white) | Custom styling with glassmorphism & animations |

### $\color{#339933}{\textsf{Backend}}$

| Technology | Purpose |
|:----------:|---------|
| ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white) | Runtime |
| ![Express](https://img.shields.io/badge/Express_5-000000?style=flat-square&logo=express&logoColor=white) | Web framework |
| ![Mongoose](https://img.shields.io/badge/Mongoose_9-880000?style=flat-square&logo=mongoose&logoColor=white) | MongoDB ODM |
| ![GridFS](https://img.shields.io/badge/GridFS-47A248?style=flat-square&logo=mongodb&logoColor=white) | Video file storage |
| ![Multer](https://img.shields.io/badge/Multer-FF6600?style=flat-square) | File upload handling |

### $\color{orange}{\textsf{AI / ML}}$

| Technology | Purpose |
|:----------:|---------|
| ![YOLOv8](https://img.shields.io/badge/YOLOv8-FF6F00?style=flat-square&logo=pytorch&logoColor=white) | Vehicle detection & tracking |
| ![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=flat-square&logo=tensorflow&logoColor=white) | Audio emergency classification |
| ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white) | Model serving API |
| ![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&logo=opencv&logoColor=white) | Video frame processing |
| ![Librosa](https://img.shields.io/badge/Librosa-3776AB?style=flat-square&logo=python&logoColor=white) | Audio feature extraction (Mel spectrograms) |

### $\color{#2496ED}{\textsf{Infrastructure}}$

| Technology | Purpose |
|:----------:|---------|
| ![MongoDB](https://img.shields.io/badge/MongoDB_7-47A248?style=flat-square&logo=mongodb&logoColor=white) | Database |
| ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) | Containerized deployment |
| ![nginx](https://img.shields.io/badge/nginx-009639?style=flat-square&logo=nginx&logoColor=white) | Production static file serving |

### $\color{#E7352C}{\textsf{Hardware}}$

| Technology | Purpose |
|:----------:|---------|
| ![ESP32](https://img.shields.io/badge/ESP32_DevKit-E7352C?style=flat-square&logo=espressif&logoColor=white) | Microcontroller for physical signals |
| ![Arduino](https://img.shields.io/badge/Arduino_IDE-00979D?style=flat-square&logo=arduino&logoColor=white) | Firmware development |
| ![LEDs](https://img.shields.io/badge/12×_LEDs-FFD700?style=flat-square) | R/Y/G × 4 lanes — Physical traffic signals |

---

## 📁 Project Structure

```
H26-Raahat/
├── 🖥️ frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   │   ├── AlertsPanel.jsx         # Activity log panel
│   │   │   ├── DeviceStatusPanel.jsx   # ESP32 online/offline status
│   │   │   ├── IntersectionPanel.jsx   # Intersection card with signal grid
│   │   │   ├── ManualControlPanel.jsx  # Manual signal override controls
│   │   │   ├── MapView.jsx             # Leaflet interactive map
│   │   │   ├── SignalGrid.jsx          # Visual traffic signal display
│   │   │   ├── VideoFeedPanel.jsx      # Video playback panel
│   │   │   └── VideoUploadPanel.jsx    # Video upload per lane
│   │   ├── pages/
│   │   │   └── Dashboard.jsx      # Main dashboard page
│   │   ├── config/api.js          # API base URL configuration
│   │   ├── services/api.js        # Axios API client
│   │   ├── App.jsx                # Root component
│   │   └── main.jsx               # Entry point
│   ├── Dockerfile                 # Multi-stage build (Vite → nginx)
│   └── package.json
│
├── ⚙️ backend/                     # Node.js + Express API
│   ├── controllers/
│   │   ├── esp32.controller.js         # ESP32 heartbeat & signal endpoints
│   │   ├── intersection.controller.js  # Intersection CRUD
│   │   ├── traffic.controller.js       # Traffic state & signal control
│   │   └── video.controller.js         # Video upload, analysis, streaming
│   ├── models/
│   │   ├── esp32.model.js              # ESP32 device schema
│   │   ├── intersection.model.js       # Intersection schema
│   │   ├── traffic.model.js            # Traffic data schema
│   │   └── video.model.js              # Video metadata schema
│   ├── routes/
│   │   ├── esp32.routes.js             # /esp32/* routes
│   │   ├── intersection.routes.js      # /intersections/* routes
│   │   ├── traffic.routes.js           # /traffic/* routes
│   │   └── video.routes.js             # /video/* routes
│   ├── services/
│   │   ├── decision.service.js         # Lane scoring & signal decision logic
│   │   ├── model.service.js            # Communication with Python model
│   │   ├── signal.controller.js        # In-memory signal state management
│   │   └── signal.engine.js            # Background signal cycle engine (1s)
│   ├── utils/gridfs.js            # GridFS initialization
│   ├── app.js                     # Express app setup & middleware
│   ├── server.js                  # Entry point (DB connect, engine start)
│   ├── Dockerfile                 # Node.js production image
│   └── package.json
│
├── 🤖 model/                       # Python AI model server
│   ├── predict.py                 # FastAPI server — main predict endpoint
│   ├── predict_video.py           # YOLOv8 vehicle detection & tracking
│   ├── predict_audio.py           # Audio emergency classification (CNN)
│   ├── best2.pt                   # YOLOv8 trained weights
│   ├── raahat_audio_model.h5      # Keras audio classification model
│   ├── requirements.txt           # Python dependencies
│   └── Dockerfile                 # Python production image
│
├── 📡 esp32/                       # ESP32 firmware
│   ├── esp32_signal_controller.ino  # Arduino sketch for LED control
│   └── README.md                  # Hardware wiring & setup guide
│
├── docker-compose.yml             # Full-stack container orchestration
├── .env.example                   # Environment variable template
├── DOCKER.md                      # Detailed Docker deployment guide
├── .gitignore                     # Git ignore rules
└── README.md                      # ← You are here
```

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/ManishKrBarman/H26-Raahat.git
cd H26-Raahat

# Copy environment config
cp .env.example .env

# Start all services
docker compose up -d --build
```

> 🟢 Open **http://localhost:3000** — the full system is running.

> 📖 For advanced Docker configuration, see [DOCKER.md](DOCKER.md).

### Option 2: Local Development

See the [detailed setup instructions](#-local-development-setup) below.

---

## 🔧 Local Development Setup

### Prerequisites

| Tool | Version | Badge |
|------|---------|-------|
| [Node.js](https://nodejs.org/) | 18+ | ![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white) |
| [Python](https://www.python.org/) | 3.9+ | ![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white) |
| [MongoDB](https://www.mongodb.com/try/download/community) | 7+ | ![MongoDB](https://img.shields.io/badge/MongoDB-7+-47A248?style=flat-square&logo=mongodb&logoColor=white) |
| [Git](https://git-scm.com/) | Any | ![Git](https://img.shields.io/badge/Git-latest-F05032?style=flat-square&logo=git&logoColor=white) |

### 1. Clone the Repository

```bash
git clone https://github.com/ManishKrBarman/H26-Raahat.git
cd H26-Raahat
```

### 2. Start MongoDB

Make sure MongoDB is running locally on `mongodb://127.0.0.1:27017`.

```bash
# Or use Docker for just MongoDB
docker compose up -d mongodb
```

### 3. Start the Backend

```bash
cd backend
npm install
npm run dev
```

> 🟢 Backend starts on **http://localhost:3000**

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

> 🟢 Frontend starts on **http://localhost:5173**

### 5. Start the Model Server

```bash
cd model
pip install -r requirements.txt
uvicorn predict:app --reload --port 8000
```

> 🟢 Model API starts on **http://localhost:8000**

> [!NOTE]
> The YOLOv8 model (`best2.pt`) and the audio model (`raahat_audio_model.h5`) must be present in the `model/` directory. These may not be included in the repository due to file size constraints — contact the team for model weights.

### 6. Register an Intersection

```bash
curl -X POST http://localhost:3000/intersections \
  -H "Content-Type: application/json" \
  -d '{
    "intersection_id": "INT-001",
    "name": "Main St & 5th Ave",
    "lanes": ["A", "B", "C", "D"],
    "location": { "lat": 28.6139, "lng": 77.2090 }
  }'
```

### 7. Upload Traffic Video

Use the dashboard's **Video Upload** panel or via API:

```bash
curl -X POST http://localhost:3000/video/upload \
  -F "video=@traffic_lane_a.mp4" \
  -F "intersection_id=INT-001" \
  -F "lane_id=A"
```

---

## 🐳 Docker Deployment

The project includes a complete Docker Compose setup with **4 services**:

| Service | Image | Port | Status |
|---------|-------|:----:|--------|
| `frontend` | nginx:alpine | `3000` | ![Frontend](https://img.shields.io/badge/React_Build-nginx-009639?style=flat-square) |
| `backend` | node:20-alpine | `3001` | ![Backend](https://img.shields.io/badge/Express_API-Node.js-339933?style=flat-square) |
| `model` | python:3.9 | `8000` | ![Model](https://img.shields.io/badge/YOLOv8+CNN-FastAPI-009688?style=flat-square) |
| `mongodb` | mongo:7 | `27017` | ![MongoDB](https://img.shields.io/badge/Database-GridFS-47A248?style=flat-square) |

```bash
docker compose up -d --build     # Start everything
docker compose down              # Stop everything
docker compose logs -f backend   # View backend logs
```

> 📖 Full Docker documentation: [DOCKER.md](DOCKER.md)

---

## 📡 API Reference

### ![Health](https://img.shields.io/badge/Health_Check-28a745?style=flat-square) Health

| Method | Endpoint | Description |
|:------:|----------|-------------|
| ![GET](https://img.shields.io/badge/GET-61AFFE?style=flat-square) | `/health` | Backend health check |
| ![GET](https://img.shields.io/badge/GET-61AFFE?style=flat-square) | `Model :8000/health` | Model server health check |

### ![Intersections](https://img.shields.io/badge/Intersections-F39C12?style=flat-square) Intersections

| Method | Endpoint | Description |
|:------:|----------|-------------|
| ![POST](https://img.shields.io/badge/POST-49CC90?style=flat-square) | `/intersections` | Register a new intersection |
| ![GET](https://img.shields.io/badge/GET-61AFFE?style=flat-square) | `/intersections` | List all intersections |

### ![Traffic](https://img.shields.io/badge/Traffic-E74C3C?style=flat-square) Traffic

| Method | Endpoint | Description |
|:------:|----------|-------------|
| ![GET](https://img.shields.io/badge/GET-61AFFE?style=flat-square) | `/traffic/current` | Get current signal state for all intersections |
| ![POST](https://img.shields.io/badge/POST-49CC90?style=flat-square) | `/traffic/manual` | Manual signal override |
| ![POST](https://img.shields.io/badge/POST-49CC90?style=flat-square) | `/traffic/release` | Release manual override (return to AUTO) |

### ![Video](https://img.shields.io/badge/Video-8E44AD?style=flat-square) Video

| Method | Endpoint | Description |
|:------:|----------|-------------|
| ![POST](https://img.shields.io/badge/POST-49CC90?style=flat-square) | `/video/upload` | Upload traffic video (multipart form) |
| ![POST](https://img.shields.io/badge/POST-49CC90?style=flat-square) | `/video/analyze/:id` | Trigger AI analysis on uploaded video |
| ![GET](https://img.shields.io/badge/GET-61AFFE?style=flat-square) | `/video/stream/:id` | Stream video from GridFS |
| ![GET](https://img.shields.io/badge/GET-61AFFE?style=flat-square) | `/video/intersection/:id` | List videos for an intersection |

### ![ESP32](https://img.shields.io/badge/ESP32-E7352C?style=flat-square) ESP32

| Method | Endpoint | Description |
|:------:|----------|-------------|
| ![POST](https://img.shields.io/badge/POST-49CC90?style=flat-square) | `/esp32/heartbeat` | ESP32 sends heartbeat with status |
| ![GET](https://img.shields.io/badge/GET-61AFFE?style=flat-square) | `/esp32/signal/:intersectionId` | ESP32 polls for current signal state |
| ![GET](https://img.shields.io/badge/GET-61AFFE?style=flat-square) | `/esp32/devices` | List all registered ESP32 devices |

---

## 🤖 AI Models

### 1. $\color{orange}{\textsf{Vehicle Detection — YOLOv8}}$

- **Architecture:** YOLOv8 (Ultralytics) with custom-trained weights (`best2.pt`)
- **Capabilities:**
  - $\color{lightgreen}{\textsf{✔ Real-time vehicle detection and tracking}}$
  - $\color{lightgreen}{\textsf{✔ Vehicle counting per lane}}$
  - $\color{lightgreen}{\textsf{✔ Speed estimation}}$ (pixel displacement × scale factor)
  - $\color{lightgreen}{\textsf{✔ Traffic density classification}}$ → `low` / `medium` / `high`
  - $\color{red}{\textsf{✔ Emergency vehicle visual detection}}$ (ambulance, fire truck)
- **Confidence threshold:** `0.55`
- **Emergency classes:** Class `0` (ambulance), Class `2` (fire truck)

### 2. $\color{#9B59B6}{\textsf{Audio Emergency Classification — CNN}}$

- **Architecture:** Custom Keras CNN trained on Mel-spectrogram features
- **Input:** 3-second audio chunks extracted from video
- **Classes:** `ambulance` · `firetruck` · `traffic`
- **Process:**
  1. Extract audio from video using MoviePy
  2. Split into 3-second chunks
  3. Convert each chunk to Mel spectrogram → resize to $128 \times 128$
  4. Run CNN prediction → majority voting across chunks
- **Emergency detection:** Any chunk classified as ambulance or fire truck triggers emergency

### 3. $\color{#E74C3C}{\textsf{Sensor Fusion}}$

The final emergency decision fuses both models:

```math
\text{final\_score} = \color{orange}{0.4} \times \text{video\_score} + \color{cyan}{0.6} \times \text{audio\_score}
```

$$\text{emergency} = \begin{cases} \color{green}{\textbf{true}} & \text{if final\_score} \geq 0.65 \\ \color{red}{\textbf{false}} & \text{otherwise} \end{cases}$$

> [!IMPORTANT]
> Audio is weighted higher (**60%**) because siren detection is a strong emergency indicator even when visual detection may be ambiguous.

---

## 📡 ESP32 Hardware Integration

The ESP32 microcontroller drives physical LED traffic signals, synced in real-time with the dashboard.

| Specification | Detail |
|:---:|--------|
| 🔴🟡🟢 | **4 lanes × 3 LEDs** = 12 LEDs total |
| 📡 | **Polls backend** every 1 second for signal state |
| 💓 | **Sends heartbeat** for online/offline status tracking |
| 🟡 | **Yellow transition** blinks 3–4 seconds on lane changes |
| ⚠️ | **Manual override** shows blinking yellow for caution |

> 📖 Full hardware setup, wiring diagram, and firmware: [esp32/README.md](esp32/README.md)

---

## 📸 Screenshots

> *Screenshots coming soon — launch the dashboard at `http://localhost:5173` (dev) or `http://localhost:3000` (Docker) to see it live.*

The dashboard features:
- 🟦 **Left Panel** — Intersection list with signal grid, video upload
- 🟩 **Center Panel** — Interactive Leaflet map with intersection markers, video feed player
- 🟧 **Right Panel** — Manual control center, ESP32 device status, activity log
- 🟥 **Emergency Mode** — Red-tinted UI with pulsing alerts when emergency vehicles are detected

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/your-feature`)
3. **Commit** your changes (`git commit -m 'Add some feature'`)
4. **Push** to the branch (`git push origin feature/your-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow existing code style and project structure
- Add comments for non-obvious logic
- Test your changes locally before submitting a PR
- Update documentation if you add new features or API endpoints

---

## 👥 Team

**Team Raahat — Hackathon H26**

| Member | GitHub |
|--------|--------|
| Manish Kr Barman | [![GitHub](https://img.shields.io/badge/@ManishKrBarman-181717?style=flat-square&logo=github)](https://github.com/ManishKrBarman) |

> *Add remaining team members here.*

---

## 📄 License

This project is developed for educational and hackathon purposes.

---

<p align="center">
  <img src="https://img.shields.io/badge/Built_with_❤️_by-Team_Raahat-ff6b35?style=for-the-badge&labelColor=1a1a2e" alt="Team Raahat" />
</p>
