import sqlite3
import threading
from datetime import datetime, date

DB_PATH = "events.db"
_lock = threading.Lock()


def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _lock, _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                prediction TEXT NOT NULL,
                confidence REAL NOT NULL,
                filename TEXT NOT NULL
            )
            """
        )
        conn.commit()


def log_event(prediction, confidence, filename):
    ts = datetime.now().isoformat(timespec="seconds")
    with _lock, _connect() as conn:
        conn.execute(
            "INSERT INTO events (timestamp, prediction, confidence, filename) VALUES (?, ?, ?, ?)",
            (ts, prediction, float(confidence), filename),
        )
        conn.commit()
    return ts


def recent_events(limit=20):
    with _lock, _connect() as conn:
        rows = conn.execute(
            "SELECT timestamp, prediction, confidence, filename "
            "FROM events ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def today_counts():
    today = date.today().isoformat()
    with _lock, _connect() as conn:
        rows = conn.execute(
            "SELECT prediction, COUNT(*) AS c FROM events "
            "WHERE substr(timestamp, 1, 10) = ? GROUP BY prediction",
            (today,),
        ).fetchall()
    counts = {"Hazard": 0, "Distress": 0}
    for r in rows:
        if r["prediction"] in counts:
            counts[r["prediction"]] = r["c"]
    return counts
