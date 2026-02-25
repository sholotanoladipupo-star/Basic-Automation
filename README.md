# Local Monitoring Stack

Prometheus + Grafana + node_exporter running via Docker Compose.

## What's included

| Service | Purpose | Port |
|---|---|---|
| Prometheus | Scrapes & stores metrics | http://localhost:9090 |
| Grafana | Visualizes metrics | http://localhost:3000 |
| node_exporter | Exposes machine metrics | http://localhost:9100 |

## Start the stack

```bash
docker compose up -d
```

Then open Grafana at **http://localhost:3000**
- Username: `admin`
- Password: `admin`

The "Node Exporter - Machine Metrics" dashboard loads automatically.

## Stop the stack

```bash
docker compose down
```

To also wipe stored data (Prometheus + Grafana volumes):

```bash
docker compose down -v
```

## Reload Prometheus config without restarting

```bash
curl -X POST http://localhost:9090/-/reload
```

## File structure

```
.
├── docker-compose.yml
├── prometheus/
│   └── prometheus.yml          # Scrape config
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── prometheus.yml  # Auto-connects Grafana to Prometheus
        └── dashboards/
            ├── dashboards.yml  # Tells Grafana where to find dashboards
            └── node-metrics.json  # Pre-built dashboard (CPU/mem/disk/net)
```

## Dashboard panels

- CPU Usage % (overall + by mode)
- Memory Usage % + breakdown
- Disk I/O (read/write bytes/sec)
- Network I/O (receive/transmit bytes/sec)
- Disk Space Used % per mount
- System Load Average (1m / 5m / 15m)

## Note on macOS

On macOS, Docker containers run inside a Linux VM (Docker Desktop).
node_exporter will report the VM's metrics, not your Mac's native metrics.
This is normal and still great for learning — the data is real.
