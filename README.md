# Project SANJAYA 👁️🔊

**Intelligent Room Surveillance & Patient Monitoring System**
Built for the Citadel Hackathon.

Project Sanjaya is a robust, multimodal perception system designed for continuous patient monitoring and hazard detection. By integrating computer vision and audio processing, the system ensures failsafe surveillance. If visual sensors are compromised or obstructed, the audio perception layer acts as a reliable redundancy mechanism to detect distress and hazards.

## 🚀 Key Features

* **Multimodal Sensor Fusion:** Combines visual and auditory data streams for comprehensive environment awareness.
* **Real-time Patient Posture Recognition:** (Vision Model) Monitors patient positioning to detect anomalies or falls.
* **Fire Detection:** (Vision Model) Identifies visual signatures of fire hazards in the room.
* **Acoustic Hazard & Distress Detection:** (Audio Model) Classifies audio streams into Hazard, Distress, or Normal Speech. Acts as a critical fallback when camera sensors fail or are blinded.

## 🧠 Model Architecture

The system relies on three independently trained deep learning models feeding into a centralized inference API:
1.  **Vision Pipeline 1:** Fire Detection Model
2.  **Vision Pipeline 2:** Patient Posture Classification Model
3.  **Audio Pipeline:** Audio Event Classifier (Distress/Hazard/Normal)

## 📁 Repository Structure

```text
project-sanjaya/
│
├── models/                  # Pre-trained weights (.h5, .pt, .pkl)
│   ├── fire_detector.pt
│   ├── posture_model.pt
│   └── audio_classifier.pt
│
├── api/                     # Backend API serving the models
│   ├── app.py               # FastAPI application
│   ├── vision_utils.py      # Image preprocessing & inference
│   └── audio_utils.py       # Audio feature extraction (e.g., MFCCs)
│
├── ui/                      # Dashboard (Streamlit/React)
│   └── dashboard.py         
│
├── requirements.txt         # Python dependencies
├── Dockerfile               # Containerization for deployment
└── README.md
