# Monitoring Stack — Full Setup Documentation

This document explains every decision, every file, and every command used to
build this monitoring stack from scratch. Follow it in order and you will end
up with an identical running system.

---

## Table of Contents

1. [What Was Built](#1-what-was-built)
2. [How the Pieces Fit Together](#2-how-the-pieces-fit-together)
3. [Prerequisites](#3-prerequisites)
4. [Installing Docker (via Colima)](#4-installing-docker-via-colima)
5. [Project Structure](#5-project-structure)
6. [File-by-File Explanation](#6-file-by-file-explanation)
   - [docker-compose.yml](#61-docker-composeyml)
   - [prometheus/prometheus.yml](#62-prometheusprometheusvml)
   - [grafana/provisioning/datasources/prometheus.yml](#63-grafanaprovisioningdatasourcesprometheusvml)
   - [grafana/provisioning/dashboards/dashboards.yml](#64-grafanaprovisioningdashboardsdashboardsvml)
   - [grafana/provisioning/dashboards/node-metrics.json](#65-grafanaprovisioningdashboardsnode-metricsjson)
7. [Starting the Stack](#7-starting-the-stack)
8. [Verifying Everything Works](#8-verifying-everything-works)
9. [What Each Dashboard Panel Shows](#9-what-each-dashboard-panel-shows)
10. [PromQL Queries Explained](#10-promql-queries-explained)
11. [Useful Commands](#11-useful-commands)
12. [Troubleshooting](#12-troubleshooting)
13. [How Data Flows (End-to-End)](#13-how-data-flows-end-to-end)

---

## 1. What Was Built

A local machine monitoring stack consisting of three services:

| Service | Role | Port |
|---|---|---|
| **node_exporter** | Collects raw metrics from the OS (CPU, memory, disk, network) and exposes them as text over HTTP | 9100 |
| **Prometheus** | Scrapes those metrics from node_exporter every 15 seconds and stores them in a time-series database | 9090 |
| **Grafana** | Reads from Prometheus and displays the metrics as live graphs in a browser dashboard | 3000 |

All three run as Docker containers, wired together with Docker Compose.

---

## 2. How the Pieces Fit Together

```
Your Machine
│
├── node_exporter container (port 9100)
│     Reads /proc, /sys from the host OS
│     Exposes metrics as plain text at :9100/metrics
│
├── Prometheus container (port 9090)
│     Every 15s: pulls from node_exporter:9100/metrics
│     Stores data in a time-series database (volume: prometheus_data)
│     Exposes a query API and basic UI at :9090
│
└── Grafana container (port 3000)
      Connects to Prometheus as a data source
      Reads metric data via PromQL queries
      Renders live graphs in your browser at :3000
```

The three containers share an internal Docker network called `monitoring`.
Inside that network, containers can reach each other by name
(e.g. Prometheus connects to `node_exporter:9100`, not `localhost:9100`).

---

## 3. Prerequisites

Before starting, make sure you have:

- **macOS** (these instructions are macOS-specific)
- **Homebrew** installed — if not:
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```
- **Git** installed:
  ```bash
  git --version   # should print a version number
  ```
- At least **2 GB of free disk space** (for Docker images)
- Internet connection (to pull Docker images on first run)

---

## 4. Installing Docker (via Colima)

Docker has two parts: the **CLI** (the `docker` command) and the **daemon**
(the background engine that actually runs containers). On macOS, Docker Desktop
is the common way to get both, but we used **Colima** — a lightweight
open-source alternative that runs a Linux VM silently in the background.

### Step 1 — Install Colima

```bash
brew install colima
```

This also installs `lima` (the VM engine Colima uses) as a dependency.

### Step 2 — Start Colima

```bash
colima start
```

This will:
- Download a Linux VM image (~500 MB, only on first run, takes a few minutes)
- Start the VM
- Set up the Docker daemon inside the VM
- Create a Docker socket your Mac's Docker CLI can connect to

You will see output like:
```
INFO  starting colima
INFO  runtime: docker
INFO  creating and starting ... context=vm
INFO  downloading disk image ... context=vm
...
INFO  done
```

After this, `docker` commands work normally from your Mac terminal.

### Step 3 — Verify Docker is working

```bash
docker ps
```

Should return an empty table (no containers yet), not an error.

### Note on macOS and node_exporter

On macOS, Docker containers run inside a Linux VM (managed by Colima).
node_exporter mounts `/proc` and `/sys` from inside that VM — not from macOS
directly. This means the metrics you see are for the Linux VM, not your Mac's
hardware. For learning purposes this is perfectly fine — the data is real
and the setup is identical to how you'd run it on a Linux server.

---

## 5. Project Structure

```
Basic-Automation/
├── docker-compose.yml                              # Defines all 3 services
├── prometheus/
│   └── prometheus.yml                             # Prometheus scrape config
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── prometheus.yml                     # Auto-connects Grafana → Prometheus
        └── dashboards/
            ├── dashboards.yml                     # Tells Grafana where to load dashboards from
            └── node-metrics.json                  # The pre-built dashboard (8 panels)
```

Every file is deliberately committed to Git so the entire setup is
reproducible with a single `git clone` + `docker compose up -d`.

---

## 6. File-by-File Explanation

### 6.1 `docker-compose.yml`

This is the master file. It defines all three services, their configuration,
networking, and storage volumes.

```yaml
version: '3.8'
```
Declares the Compose file format version. The `version` key is now technically
obsolete in newer Docker Compose versions (you may see a warning about it —
it's harmless).

---

#### Prometheus service

```yaml
prometheus:
  image: prom/prometheus:latest
  container_name: prometheus
  volumes:
    - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'
    - '--storage.tsdb.retention.time=15d'
    - '--web.enable-lifecycle'
  ports:
    - "9090:9090"
  restart: unless-stopped
  networks:
    - monitoring
```

- `image: prom/prometheus:latest` — pulls the official Prometheus image from
  Docker Hub.
- `volumes`:
  - `./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml` — mounts our
    local config file into the container. Left of `:` is the file on your Mac;
    right of `:` is where the container reads it from.
  - `prometheus_data:/prometheus` — named volume for persistent storage. Without
    this, all scraped data is lost when the container restarts.
- `command` — flags passed to the Prometheus binary inside the container:
  - `--config.file` — tells Prometheus where its config is.
  - `--storage.tsdb.path` — where to write the time-series database.
  - `--storage.tsdb.retention.time=15d` — keep 15 days of data, then delete old
    data automatically.
  - `--web.enable-lifecycle` — allows you to reload the config without
    restarting (`curl -X POST http://localhost:9090/-/reload`).
- `ports: "9090:9090"` — maps port 9090 on your Mac to port 9090 inside the
  container. Format is `HOST:CONTAINER`.
- `restart: unless-stopped` — auto-restart if the container crashes. Does not
  restart if you manually stop it with `docker compose down`.
- `networks: monitoring` — joins the internal `monitoring` bridge network.

---

#### Grafana service

```yaml
grafana:
  image: grafana/grafana:latest
  container_name: grafana
  volumes:
    - grafana_data:/var/lib/grafana
    - ./grafana/provisioning:/etc/grafana/provisioning
  environment:
    - GF_SECURITY_ADMIN_USER=admin
    - GF_SECURITY_ADMIN_PASSWORD=admin
    - GF_USERS_ALLOW_SIGN_UP=false
    - GF_SERVER_HTTP_PORT=3000
  ports:
    - "3000:3000"
  depends_on:
    - prometheus
  restart: unless-stopped
  networks:
    - monitoring
```

- `volumes`:
  - `grafana_data:/var/lib/grafana` — persists Grafana's database (users,
    dashboards created via UI, settings).
  - `./grafana/provisioning:/etc/grafana/provisioning` — mounts our entire
    provisioning folder into the container. This is how Grafana auto-loads our
    datasource and dashboard on startup without any manual clicking.
- `environment` — sets Grafana's configuration via environment variables:
  - `GF_SECURITY_ADMIN_USER` — admin username.
  - `GF_SECURITY_ADMIN_PASSWORD` — admin password.
  - `GF_USERS_ALLOW_SIGN_UP=false` — disables public self-registration.
  - `GF_SERVER_HTTP_PORT` — which port Grafana listens on inside the container.
- `depends_on: prometheus` — Docker Compose starts Prometheus before Grafana.
  Note: this only controls start order, not readiness. Grafana may still try to
  connect before Prometheus is fully ready — this is fine because Grafana retries.

---

#### node_exporter service

```yaml
node_exporter:
  image: prom/node-exporter:latest
  container_name: node_exporter
  volumes:
    - /proc:/host/proc:ro
    - /sys:/host/sys:ro
    - /:/rootfs:ro
  command:
    - '--path.procfs=/host/proc'
    - '--path.rootfs=/rootfs'
    - '--path.sysfs=/host/sys'
    - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
  ports:
    - "9100:9100"
  restart: unless-stopped
  networks:
    - monitoring
```

- `volumes` — mounts the host OS's virtual filesystems into the container in
  read-only mode (`:ro`). This is how node_exporter reads CPU, memory, disk, and
  network data directly from the Linux kernel:
  - `/proc` — the Linux process filesystem. Contains CPU usage, memory stats,
    running processes, network stats, etc.
  - `/sys` — the Linux system filesystem. Contains hardware and driver info.
  - `/` — the root filesystem, used to check disk usage of mount points.
- `command` — flags that point node_exporter to the mounted paths:
  - `--collector.filesystem.mount-points-exclude` — a regex that excludes
    virtual/internal mount points from disk metrics so you only see real disks.
    The `$$` is how Compose escapes a literal `$` in a command string.

---

#### Volumes and networks

```yaml
volumes:
  prometheus_data:
  grafana_data:

networks:
  monitoring:
    driver: bridge
```

- Named volumes (`prometheus_data`, `grafana_data`) are managed by Docker.
  They persist data on disk even after containers are removed.
- The `monitoring` network is a Docker bridge network. Containers on the same
  bridge network can reach each other by container name (e.g., `prometheus`,
  `node_exporter`, `grafana`).

---

### 6.2 `prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
```

- `scrape_interval: 15s` — Prometheus polls each target every 15 seconds.
- `evaluation_interval: 15s` — How often Prometheus evaluates alerting rules
  (not used here, but set for completeness).

```yaml
scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node_exporter'
    static_configs:
      - targets: ['node_exporter:9100']
```

- `job_name: 'prometheus'` — Prometheus scrapes its own metrics. This lets you
  monitor Prometheus itself (how many samples it's storing, query durations, etc.)
- `job_name: 'node_exporter'` — Prometheus scrapes node_exporter at
  `node_exporter:9100`. Note: this uses the container name `node_exporter`, not
  `localhost` — because both containers are on the same `monitoring` Docker
  network, they resolve each other by name.

---

### 6.3 `grafana/provisioning/datasources/prometheus.yml`

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

Grafana reads this file on startup and automatically creates the Prometheus
data source. Without this, you'd have to manually add it through the Grafana UI.

- `access: proxy` — Grafana's backend makes the requests to Prometheus (not the
  browser directly). This is the standard and recommended mode.
- `url: http://prometheus:9090` — uses the container name `prometheus` since
  Grafana and Prometheus are on the same Docker network.
- `isDefault: true` — this data source is selected by default in new panels.
- `editable: false` — prevents the data source from being accidentally modified
  or deleted via the UI.

---

### 6.4 `grafana/provisioning/dashboards/dashboards.yml`

```yaml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: 'Node Metrics'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /etc/grafana/provisioning/dashboards
```

This tells Grafana where to look for dashboard JSON files.

- `folder: 'Node Metrics'` — dashboards loaded from this provider appear under
  a folder called "Node Metrics" in the Grafana UI.
- `type: file` — dashboards are loaded from the filesystem.
- `updateIntervalSeconds: 10` — Grafana checks for new or changed dashboard JSON
  files every 10 seconds. If you edit `node-metrics.json`, changes appear in
  Grafana automatically.
- `path` — the directory to scan for `.json` dashboard files. This must match
  where the volume is mounted in the container.

---

### 6.5 `grafana/provisioning/dashboards/node-metrics.json`

This is the Grafana dashboard definition. Grafana dashboards are stored as JSON.
The file defines 8 panels arranged in a grid.

#### Dashboard-level fields

```json
{
  "uid": "node-metrics",
  "title": "Node Exporter - Machine Metrics",
  "refresh": "15s",
  "time": { "from": "now-1h", "to": "now" }
}
```

- `uid` — a unique identifier for this dashboard. Grafana uses this to avoid
  creating duplicates if you restart.
- `refresh: "15s"` — the dashboard auto-refreshes every 15 seconds.
- `time` — the default time window shown is the last 1 hour.

#### Panel structure

Each panel has:
- `id` — unique number within the dashboard.
- `title` — label shown at the top of the panel.
- `type` — visualization type (`timeseries` = line graph, `bargauge` = horizontal bars).
- `gridPos` — position and size on the dashboard grid. `x`, `y` = column/row
  position; `w`, `h` = width/height (grid is 24 units wide).
- `datasource` — which Grafana data source to query.
- `fieldConfig` — visual settings (units, min/max, colors, thresholds).
- `targets` — the PromQL queries that fetch the data.

---

## 7. Starting the Stack

### Clone the repository (if starting fresh)

```bash
git clone https://github.com/sholotanoladipupo-star/Basic-Automation.git
cd Basic-Automation
```

### Install and start Colima

```bash
brew install colima
colima start
```

### Start all containers

```bash
docker compose up -d
```

The `-d` flag runs containers in the background (detached mode).

On first run, Docker pulls the three images from Docker Hub:
- `prom/prometheus:latest` (~90 MB)
- `grafana/grafana:latest` (~400 MB)
- `prom/node-exporter:latest` (~20 MB)

This takes a few minutes. Subsequent starts are instant (images are cached).

---

## 8. Verifying Everything Works

### Check all containers are running

```bash
docker ps
```

Expected output:
```
NAMES           STATUS          PORTS
grafana         Up X seconds    0.0.0.0:3000->3000/tcp
prometheus      Up X seconds    0.0.0.0:9090->9090/tcp
node_exporter   Up X seconds    0.0.0.0:9100->9100/tcp
```

All three must show `Up`.

### Check node_exporter is exposing metrics

Open in browser: http://localhost:9100/metrics

You will see hundreds of lines of text like:
```
# HELP node_cpu_seconds_total Seconds the CPUs spent in each mode.
# TYPE node_cpu_seconds_total counter
node_cpu_seconds_total{cpu="0",mode="idle"} 12345.67
...
```

This is the raw data Prometheus collects.

### Check Prometheus is scraping

Open: http://localhost:9090

Go to **Status → Targets**. You should see two targets:
- `prometheus (1/1 up)` — Prometheus scraping itself
- `node_exporter (1/1 up)` — Prometheus scraping node_exporter

Both must show green `UP` state.

### Check Grafana dashboard

Open: http://localhost:3000

Login: `admin` / `admin`

Navigate to **Dashboards → Node Metrics → Node Exporter - Machine Metrics**.

You should see 8 panels with live data.

---

## 9. What Each Dashboard Panel Shows

| Panel | Type | What it measures |
|---|---|---|
| CPU Usage % | Line graph | Overall CPU % used (all cores averaged) |
| Memory Usage % | Line graph | % of RAM currently in use |
| CPU Usage (by mode) | Line graph | CPU time split by mode: user, system, iowait, etc. |
| Memory Breakdown | Line graph | Total, available, and used RAM in bytes |
| Disk I/O (bytes/sec) | Line graph | How many bytes/sec are being read from and written to disk |
| Network I/O (bytes/sec) | Line graph | Bytes/sec received and transmitted on each network interface |
| Disk Space Used % | Bar gauge | % of disk space used per mount point (color: green/yellow/red) |
| System Load Average | Line graph | 1-minute, 5-minute, and 15-minute load averages |

---

## 10. PromQL Queries Explained

PromQL is Prometheus's query language. Every panel is driven by one or more
PromQL expressions.

### CPU Usage %

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

- `node_cpu_seconds_total{mode="idle"}` — a counter of how many seconds each
  CPU core has spent in idle state.
- `rate(...[5m])` — converts the counter to a per-second rate over 5 minutes.
  Rate of idle = fraction of time spent idle (0 to 1).
- `avg by (instance)` — averages across all CPU cores.
- `* 100` — converts the fraction to a percentage.
- `100 - (...)` — flips it from "idle %" to "used %".

### Memory Usage %

```promql
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100
```

- `node_memory_MemTotal_bytes` — total installed RAM.
- `node_memory_MemAvailable_bytes` — RAM available to applications (including
  reclaimable cache).
- Subtracting and dividing gives the fraction used; multiplying by 100 gives %.

### CPU by Mode

```promql
avg by (mode) (rate(node_cpu_seconds_total{mode!="idle"}[5m]))
```

Same as CPU usage but broken down by mode (user, system, iowait, steal, etc.)
instead of showing a single total. The `{mode!="idle"}` filter excludes idle
to keep the graph readable.

### Disk I/O

```promql
rate(node_disk_read_bytes_total[5m])
rate(node_disk_written_bytes_total[5m])
```

Counters of total bytes read/written to each disk device, converted to a
per-second rate over 5 minutes.

### Network I/O

```promql
rate(node_network_receive_bytes_total{device!~"lo|veth.*"}[5m])
rate(node_network_transmit_bytes_total{device!~"lo|veth.*"}[5m])
```

- `{device!~"lo|veth.*"}` — excludes the loopback interface (`lo`) and Docker
  virtual interfaces (`veth...`) so you only see real network traffic.

### Disk Space

```promql
(node_filesystem_size_bytes{fstype!~"tmpfs|overlay"} - node_filesystem_free_bytes{fstype!~"tmpfs|overlay"})
/ node_filesystem_size_bytes{fstype!~"tmpfs|overlay"} * 100
```

- Excludes `tmpfs` (RAM-backed temporary filesystems) and `overlay`
  (Docker's layered filesystem) to show only real disk partitions.

### Load Average

```promql
node_load1
node_load5
node_load15
```

These are direct gauge metrics (not counters). They represent the 1-minute,
5-minute, and 15-minute Unix load averages. A load of 1.0 on a single-core
machine means the CPU is fully saturated.

---

## 11. Useful Commands

### Start the stack
```bash
docker compose up -d
```

### Stop the stack (keeps data)
```bash
docker compose down
```

### Stop and delete all data (volumes)
```bash
docker compose down -v
```

### View live logs from all containers
```bash
docker compose logs -f
```

### View logs from one container
```bash
docker compose logs -f prometheus
docker compose logs -f grafana
docker compose logs -f node_exporter
```

### Reload Prometheus config without restart
```bash
curl -X POST http://localhost:9090/-/reload
```

### Check container resource usage
```bash
docker stats
```

### Stop Colima (shuts down Docker daemon)
```bash
colima stop
```

### Start Colima again later
```bash
colima start
```

---

## 12. Troubleshooting

### "Cannot connect to Docker daemon"
Colima is not running. Fix:
```bash
colima start
```

### Container shows "Exited" in `docker ps`
See why it crashed:
```bash
docker compose logs <service-name>
```

### Grafana shows "No data" in panels
1. Go to http://localhost:9090 → Status → Targets
2. Confirm node_exporter shows `UP`
3. If it shows `DOWN`, wait 30 seconds and refresh — Prometheus may not have
   scraped yet
4. Confirm Grafana datasource is connected: Grafana → Connections →
   Data Sources → Prometheus → "Save & Test"

### Port already in use
Another process is using port 3000, 9090, or 9100. Find it:
```bash
lsof -i :3000
```
Kill it or change the port in `docker-compose.yml` (left side of `HOST:CONTAINER`).

### Images fail to download (EOF error)
Transient network error. Just retry:
```bash
docker compose up -d
```
Docker resumes partial downloads.

### Dashboard folder is empty in Grafana
The provisioning volume mount may have failed. Check:
```bash
docker compose logs grafana | grep -i provision
```

---

## 13. How Data Flows (End-to-End)

Here is the complete path from your hardware to a graph in your browser:

```
1. Linux kernel (inside Colima VM)
   └── Maintains /proc/stat, /proc/meminfo, /sys/block/*/stat, etc.

2. node_exporter container
   └── Reads those kernel files every time someone requests /metrics
   └── Formats them as Prometheus exposition format (plain text)
   └── Serves them at http://node_exporter:9100/metrics

3. Prometheus container (every 15 seconds)
   └── Makes HTTP GET to http://node_exporter:9100/metrics
   └── Parses the text into time-series data points
   └── Stores them in its TSDB (Time-Series Database) on disk (prometheus_data volume)
   └── Old data beyond 15 days is automatically deleted

4. Grafana container (when your browser loads the dashboard)
   └── Reads the dashboard JSON from /etc/grafana/provisioning/dashboards/
   └── For each panel, sends a PromQL query to http://prometheus:9090/api/v1/query_range
   └── Prometheus evaluates the query against its stored data
   └── Returns a list of (timestamp, value) pairs
   └── Grafana renders this as a time-series line graph in your browser

5. Your browser
   └── Displays the dashboard at http://localhost:3000
   └── Auto-refreshes every 15 seconds (re-runs all queries)
```

---

## Summary

The whole system comes down to six files:

| File | Purpose |
|---|---|
| `docker-compose.yml` | Defines and wires all 3 containers |
| `prometheus/prometheus.yml` | Tells Prometheus what to scrape and how often |
| `grafana/provisioning/datasources/prometheus.yml` | Auto-connects Grafana to Prometheus |
| `grafana/provisioning/dashboards/dashboards.yml` | Tells Grafana where dashboard JSON files are |
| `grafana/provisioning/dashboards/node-metrics.json` | The actual dashboard with 8 panels |

Anyone with Docker (or Colima) can reproduce the full setup with:

```bash
git clone https://github.com/sholotanoladipupo-star/Basic-Automation.git
cd Basic-Automation
colima start        # or: docker desktop must be running
docker compose up -d
# open http://localhost:3000  →  admin / admin
```
