# Docker Setup Guide

This guide explains how to run the Companytec client using Docker and Docker Compose.

## Prerequisites

- Docker installed on your system
- Docker Compose installed (usually comes with Docker Desktop)

## Quick Start

1. **Create a `.env` file** (optional, but recommended):
   ```bash
   DEVICE_HOST=192.168.1.100
   DEVICE_PORT=2001
   ```

2. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

3. **Run in detached mode** (background):
   ```bash
   docker-compose up -d
   ```

4. **View logs**:
   ```bash
   docker-compose logs -f
   ```

5. **Stop the container**:
   ```bash
   docker-compose down
   ```

## Configuration

### Environment Variables

The application uses the following environment variables (set in `docker-compose.yml` or `.env` file):

- `DEVICE_HOST`: IP address of the Companytec device (default: `127.0.0.1`)
- `DEVICE_PORT`: Port of the Companytec device (default: `2001`)

### Using .env File

Create a `.env` file in the project root:

```env
DEVICE_HOST=192.168.1.100
DEVICE_PORT=2001
```

Docker Compose will automatically load these variables.

### Network Configuration

**Option 1: Bridge Network (Default)**
- Works if your device is on the same Docker network or accessible via the host's IP
- Use the device's actual IP address (e.g., `192.168.1.100`)

**Option 2: Host Network**
- If your device is only accessible via `127.0.0.1` or you need direct host network access
- Uncomment `network_mode: host` in `docker-compose.yml`
- Comment out the `networks` section

## Running Different Services

### Test Client (Default)
```bash
docker-compose up
```

### API Server
Edit `docker-compose.yml` and uncomment:
```yaml
command: ["node", "api-example.js"]
ports:
  - "3000:3000"
environment:
  - API_PORT=${API_PORT:-3000}
```

Then run:
```bash
docker-compose up
```

The API will be available at `http://localhost:3000`

### Monitor Example
Edit `docker-compose.yml` and change:
```yaml
command: ["node", "monitor-example.js"]
```

## Troubleshooting

### Connection Issues

1. **Device not accessible from container**:
   - If device is on `127.0.0.1`, use `network_mode: host` in docker-compose.yml
   - If device is on a different network, ensure Docker can reach it

2. **Check container logs**:
   ```bash
   docker-compose logs companytec-client
   ```

3. **Test network connectivity**:
   ```bash
   docker-compose exec companytec-client ping <DEVICE_HOST>
   ```

### Rebuilding

If you make code changes:
```bash
docker-compose up --build
```

## Docker Commands Reference

```bash
# Build and start
docker-compose up --build

# Start in background
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Execute command in container
docker-compose exec companytec-client sh

# Rebuild without cache
docker-compose build --no-cache
```

