import argparse
import os
import glob
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split, WeightedRandomSampler

from model import (
    AudioCNN,
    CLASSES,
    CLASS_TO_IDX,
    FOLDER_TO_CLASS,
    load_waveform,
    fix_length,
    waveform_to_logmel,
    SAMPLE_RATE,
)

DEFAULT_DATASET = r"C:\Users\tuhin\Music\Audio Dataset"


def augment_waveform(y):
    if np.random.rand() < 0.5:
        noise_amp = np.random.uniform(0.001, 0.008)
        y = y + noise_amp * np.random.randn(len(y)).astype(np.float32)
    if np.random.rand() < 0.5:
        shift = np.random.randint(-SAMPLE_RATE // 2, SAMPLE_RATE // 2)
        y = np.roll(y, shift)
    if np.random.rand() < 0.3:
        gain = np.random.uniform(0.7, 1.3)
        y = y * gain
    return y


class AudioDataset(Dataset):
    def __init__(self, items, augment=False):
        self.items = items
        self.augment = augment

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        path, label = self.items[idx]
        y = load_waveform(path)
        y = fix_length(y)
        if self.augment:
            y = augment_waveform(y)
        feat = waveform_to_logmel(y)
        x = torch.from_numpy(feat).unsqueeze(0)
        return x, label


def scan_dataset(root):
    items = []
    for folder, cls in FOLDER_TO_CLASS.items():
        folder_path = os.path.join(root, folder)
        if not os.path.isdir(folder_path):
            raise FileNotFoundError(f"Missing class folder: {folder_path}")
        wavs = glob.glob(os.path.join(folder_path, "*.wav"))
        for w in wavs:
            items.append((w, CLASS_TO_IDX[cls]))
    if not items:
        raise RuntimeError("No .wav files found in dataset.")
    return items


def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    items = scan_dataset(args.dataset)
    labels = [lbl for _, lbl in items]
    counts = np.bincount(labels, minlength=len(CLASSES))
    print("Samples per class:", dict(zip(CLASSES, counts.tolist())))

    all_ds = AudioDataset(items, augment=False)
    val_size = max(1, int(len(all_ds) * args.val_split))
    train_size = len(all_ds) - val_size
    gen = torch.Generator().manual_seed(42)
    train_indices, val_indices = random_split(
        range(len(all_ds)), [train_size, val_size], generator=gen,
    )

    train_items = [items[i] for i in train_indices.indices]
    val_items = [items[i] for i in val_indices.indices]

    train_ds = AudioDataset(train_items, augment=True)
    val_ds = AudioDataset(val_items, augment=False)

    train_labels = [lbl for _, lbl in train_items]
    sample_weights = []
    train_counts = np.bincount(train_labels, minlength=len(CLASSES))
    weight_per_class = 1.0 / np.maximum(train_counts, 1)
    for lbl in train_labels:
        sample_weights.append(weight_per_class[lbl])
    sampler = WeightedRandomSampler(sample_weights, len(sample_weights))

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, sampler=sampler)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size)

    class_weights = torch.tensor(
        counts.sum() / (len(CLASSES) * np.maximum(counts, 1)),
        dtype=torch.float32,
    ).to(device)

    model = AudioCNN().to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_acc = 0.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        total, correct, loss_sum = 0, 0, 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            loss_sum += loss.item() * x.size(0)
            correct += (out.argmax(1) == y).sum().item()
            total += x.size(0)
        train_acc = correct / total
        scheduler.step()

        model.eval()
        vtotal, vcorrect = 0, 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                out = model(x)
                vcorrect += (out.argmax(1) == y).sum().item()
                vtotal += x.size(0)
        val_acc = vcorrect / max(1, vtotal)
        print(f"Epoch {epoch}/{args.epochs} "
              f"loss={loss_sum/total:.4f} train_acc={train_acc:.3f} val_acc={val_acc:.3f}")

        if val_acc >= best_acc:
            best_acc = val_acc
            torch.save({"state_dict": model.state_dict(), "classes": CLASSES}, args.out)
            print(f"  saved -> {args.out} (val_acc={best_acc:.3f})")

    print(f"Done. Best val_acc={best_acc:.3f}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dataset", default=DEFAULT_DATASET)
    p.add_argument("--out", default="audio_model.pt")
    p.add_argument("--epochs", type=int, default=40)
    p.add_argument("--batch_size", type=int, default=16)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--val_split", type=float, default=0.2)
    train(p.parse_args())


if __name__ == "__main__":
    main()
