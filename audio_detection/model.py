import numpy as np
import librosa
import torch
import torch.nn as nn
import torch.nn.functional as F

SAMPLE_RATE = 22050
DURATION = 5.0
SAMPLES_PER_WINDOW = int(SAMPLE_RATE * DURATION)
N_MELS = 64
N_FFT = 1024
HOP_LENGTH = 512
N_FRAMES = 1 + SAMPLES_PER_WINDOW // HOP_LENGTH

CLASSES = ["Hazard", "Distress", "Normal"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_CLASS = {i: c for i, c in enumerate(CLASSES)}

FOLDER_TO_CLASS = {
    "01_Hazards": "Hazard",
    "02_Distress": "Distress",
    "03_Normal_Ambience": "Normal",
}


def load_waveform(path):
    y, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    return y


def fix_length(y):
    if len(y) < SAMPLES_PER_WINDOW:
        y = np.pad(y, (0, SAMPLES_PER_WINDOW - len(y)))
    else:
        y = y[:SAMPLES_PER_WINDOW]
    return y


def waveform_to_logmel(y):
    y = fix_length(np.asarray(y, dtype=np.float32))
    mel = librosa.feature.melspectrogram(
        y=y,
        sr=SAMPLE_RATE,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        n_mels=N_MELS,
    )
    logmel = librosa.power_to_db(mel, ref=np.max)
    if logmel.shape[1] < N_FRAMES:
        logmel = np.pad(logmel, ((0, 0), (0, N_FRAMES - logmel.shape[1])))
    else:
        logmel = logmel[:, :N_FRAMES]
    logmel = (logmel - logmel.mean()) / (logmel.std() + 1e-6)
    return logmel.astype(np.float32)


def rms_energy(y):
    return float(np.sqrt(np.mean(y ** 2)))


def is_silence(y, threshold=0.005):
    return rms_energy(y) < threshold


def extract_features(path):
    return waveform_to_logmel(load_waveform(path))


def features_to_tensor(logmel):
    return torch.from_numpy(logmel).unsqueeze(0).unsqueeze(0)


class AudioCNN(nn.Module):
    def __init__(self, n_classes=len(CLASSES)):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 16, 3, padding=1)
        self.bn1 = nn.BatchNorm2d(16)
        self.conv2 = nn.Conv2d(16, 32, 3, padding=1)
        self.bn2 = nn.BatchNorm2d(32)
        self.conv3 = nn.Conv2d(32, 64, 3, padding=1)
        self.bn3 = nn.BatchNorm2d(64)
        self.pool = nn.MaxPool2d(2)
        self.dropout = nn.Dropout(0.3)
        self.global_pool = nn.AdaptiveAvgPool2d(1)
        self.fc1 = nn.Linear(64, 64)
        self.fc2 = nn.Linear(64, n_classes)

    def forward(self, x):
        x = self.pool(F.relu(self.bn1(self.conv1(x))))
        x = self.pool(F.relu(self.bn2(self.conv2(x))))
        x = self.pool(F.relu(self.bn3(self.conv3(x))))
        x = self.global_pool(x).flatten(1)
        x = self.dropout(F.relu(self.fc1(x)))
        return self.fc2(x)
