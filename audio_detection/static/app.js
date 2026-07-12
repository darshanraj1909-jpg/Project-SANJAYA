async function ctrl(action) {
  await fetch(`/api/${action}`, { method: "POST" });
  refresh();
}

async function refresh() {
  try {
    const [status, events] = await Promise.all([
      fetch("/api/status").then(r => r.json()),
      fetch("/api/events?limit=20").then(r => r.json()),
    ]);
    renderStatus(status);
    renderEvents(events);
  } catch (e) {
    document.getElementById("status").textContent = "connection error";
  }
}

function renderStatus(s) {
  const micDot = document.getElementById("mic-dot");
  const mic = document.getElementById("mic");
  micDot.className = "dot " + (s.microphone === "ok" ? "ok" : "err");
  mic.textContent = s.microphone === "ok" ? "Connected" : "Not available";

  document.getElementById("listening").textContent = s.listening ? "Active" : "Stopped";
  document.getElementById("status").textContent = s.status;

  const pred = document.getElementById("prediction");
  pred.textContent = s.prediction;
  pred.className = "value pred-" + s.prediction;

  const conf = Math.round((s.confidence || 0) * 100);
  document.getElementById("conf-bar").style.width = conf + "%";
  document.getElementById("confidence").textContent = conf + "%";

  const t = s.today || {};
  document.getElementById("hazard-count").textContent = t.Hazard || 0;
  document.getElementById("distress-count").textContent = t.Distress || 0;
}

function renderEvents(events) {
  const body = document.getElementById("alerts");
  if (!events.length) {
    body.innerHTML = '<tr><td colspan="4" style="color:var(--muted)">No alerts yet</td></tr>';
    return;
  }
  body.innerHTML = events.map(e => `
    <tr>
      <td>${e.timestamp.replace("T", " ")}</td>
      <td class="pred-${e.prediction}">${e.prediction}</td>
      <td>${Math.round(e.confidence * 100)}%</td>
      <td>${e.filename}</td>
    </tr>`).join("");
}

refresh();
setInterval(refresh, 2000);
