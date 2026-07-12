# Project SANJAYA 👁️🔊

**Intelligent Hospital Surveillance & Patient Monitoring System**
Built for the Citadel Hackathon.

Project Sanjaya is a robust, multimodal perception system designed for continuous patient monitoring and hazard detection. By integrating computer vision and audio processing, the system ensures failsafe surveillance. If visual sensors are compromised or obstructed, the audio perception layer acts as a reliable redundancy mechanism to detect distress and hazards.

## 🚀 Key Features

* **Multimodal Sensor Fusion:** Combines visual and auditory data streams for comprehensive environment awareness.
* **Real-time Patient Posture Recognition:** (Vision Model) Monitors patient positioning to detect anomalies or fall from bed.
* **Fire Detection:** (Vision Model) Identifies visual signatures of fire hazards in the room.
* **Acoustic Hazard & Distress Detection:** (Audio Model) Classifies audio streams into Hazard, Distress, or Normal Speech. Acts as a critical fallback when camera sensors fail or are blinded.

## 🧠 Model Architecture

Project Sanjaya follows a modular AI architecture consisting of two independent inference pipelines integrated into a single monitoring dashboard.

### 🔥 Vision Pipeline (Port: 8005)

A custom-trained computer vision model processes live camera frames and performs multiple tasks simultaneously:

- Detects **Fire**
- Classifies **Patient Posture** into:
  - Standing
  - Sitting
  - Lying on Bed
  - Lying on Floor (Fall Detection)

The processed results are served through a **FastAPI** backend running on:

```
http://localhost:8005
```

---

### 🎤 Audio Pipeline (Port: 8000)

A separately trained deep learning audio model analyzes microphone input using extracted audio features (MFCCs) and classifies sounds into three categories:

- 🚨 Hazard
- 🆘 Distress
- ✅ Normal

The predictions are served through another independent **FastAPI** server running on:

```
http://localhost:8000
```

---

### 🖥️ Frontend Dashboard

A lightweight frontend built using:

- HTML
- CSS
- JavaScript

acts as the central monitoring interface.

The dashboard continuously fetches predictions from both APIs (`localhost:8005` and `localhost:8000`) and displays:

- 🔥 Fire Detection
- 🧍 Patient Posture
- 🚨 Hazard Audio
- 🆘 Distress Audio
- 🛏️ Patient Fall Detection
- ⏱️ Detection Timestamp
- 📊 Live System Status

This architecture keeps the vision and audio models independent while providing a unified real-time monitoring dashboard for healthcare environments.

---

## 🏗️ Repository Structure

```text
project-sanjaya/
│
├── models/                      # Trained AI Models
│   ├── fire_posture_model.pt    # Combined Vision Model
│   └── audio_classifier.pt      # Audio Classification Model
│
├── api/
│   ├── vision_api/
│   │   ├── app.py               # Vision FastAPI Server (Port 8005)
│   │   ├── inference.py
│   │   └── preprocess.py
│   │
│   └── audio_api/
│       ├── app.py               # Audio FastAPI Server (Port 8000)
│       ├── inference.py
│       └── feature_extractor.py
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── assets/
│
├── requirements.txt
├── Dockerfile
└── README.md
```

## 🔄 System Workflow

```text
                  Camera Feed
                       │
                       ▼
        Fire + Patient Posture Model
                       │
             FastAPI (Port 8005)
                       │
                       │
Microphone ──► Audio Classification Model
                       │
             FastAPI (Port 8000)
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
     HTML/CSS/JS Frontend Dashboard
                       │
                       ▼
        Live Alerts & Timestamp Logging
     • Fire Detection
     • Patient Fall Detection
     • Patient Posture
     • Distress Audio
     • Hazard Audio
     • Normal Audio
```
