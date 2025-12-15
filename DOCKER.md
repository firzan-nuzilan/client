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

**Host Network Mode (Default)**
- The docker-compose.yml is configured with `network_mode: host` by default
- This allows the container to access devices on the host network (including `127.0.0.1`)
- **Why?** The Companytec device on port 2001 is typically on the host network, and Docker's bridge network cannot access `127.0.0.1` or the host's network directly
- The API server will be accessible directly on the host's port (no port mapping needed)

**Alternative: Bridge Network (if host mode doesn't work)**
- If you need to use bridge networking, you'll need to:
  1. Use the device's actual IP address (not `127.0.0.1`)
  2. Ensure the device is accessible from Docker's network
  3. Update `docker-compose.yml` to remove `network_mode: host` and add port mappings

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

### Socket Connection Errors

**Problem:** Getting socket errors when trying to connect to port 2001

**Solution:** The docker-compose.yml is already configured with `network_mode: host` which should fix this. If you still have issues:

1. **Verify device is accessible from host**:
   ```bash
   # Test from your host machine (outside Docker)
   telnet 127.0.0.1 2001
   # or
   nc -zv 127.0.0.1 2001
   ```

2. **Check if device is on a different IP**:
   - If your device is not on `127.0.0.1`, update `DEVICE_HOST` in `.env` or docker-compose.yml
   - Example: `DEVICE_HOST=192.168.1.100`

3. **On Mac/Windows Docker Desktop**:
   - Host networking might not work the same way
   - Try using `host.docker.internal` instead of `127.0.0.1`:
     ```yaml
     environment:
       - DEVICE_HOST=host.docker.internal
     ```
   - Or use the actual IP address of your device

4. **Check container logs**:
   ```bash
   docker-compose logs -f companytec-client
   ```

5. **Verify network mode**:
   ```bash
   docker inspect companytec-client | grep NetworkMode
   # Should show: "NetworkMode": "host"
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

