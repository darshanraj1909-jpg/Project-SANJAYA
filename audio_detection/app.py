import os
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import database
from monitor import monitor

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

app = FastAPI(title="Hospital Audio Monitoring System")


@app.on_event("startup")
def _startup():
    database.init_db()
    monitor.start()


@app.on_event("shutdown")
def _shutdown():
    monitor.stop()


@app.get("/api/status")
def api_status():
    state = monitor.state()
    state["today"] = database.today_counts()
    return state


@app.get("/api/events")
def api_events(limit: int = 20):
    return database.recent_events(limit)


@app.post("/api/start")
def api_start():
    monitor.start()
    return {"ok": True}


@app.post("/api/stop")
def api_stop():
    monitor.stop()
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
