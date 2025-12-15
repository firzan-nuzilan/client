# Companytec Go Client

A robust Go implementation of the Companytec protocol client, featuring an interactive CLI and a RESTful API server. This project is a port of the original Node.js client, designed for performance and ease of distribution (single binary).

## Features

- **Interactive CLI**: Menu-driven interface for manual testing and device management.
- **REST API**: Built with [Gin](https://github.com/gin-gonic/gin), exposing full device functionality via HTTP.
- **Cross-Platform**: Compiles to a single binary for Windows, macOS, and Linux.
- **Robustness**: Proper checksum calculation, timeout handling, and error management.

## Project Structure

- `cmd/companytec`: Main entry point. Combines the CLI and API server.
- `pkg/companytec`: Core library implementing the TCP protocol and commands.
- `pkg/api`: API server implementation.

## Getting Started

### Prerequisites

- Go 1.21 or higher

### Installation

1. Clone the repository
2. Navigate to the `go-client` directory:
   ```bash
   cd go-client
   ```
3. Install dependencies:
   ```bash
   go mod tidy
   ```

### Building

**For macOS/Linux:**
```bash
go build -o companytec ./cmd/companytec
```

**For Windows:**
```bash
GOOS=windows GOARCH=amd64 go build -o companytec.exe ./cmd/companytec
```

## Usage

The application runs both the interactive CLI and the API server simultaneously.

### Running

```bash
# Default (Connects to localhost:2001, API on port 3000)
./companytec

# Custom Configuration
./companytec -host 192.168.1.100 -port 2001 -api-port 8080
```

### Interactive CLI

Once started, you will see a menu options:
```text
   COMPANYTEC CLIENT - TEST MENU
========================================
...
  1.  Read Supply
...
Select option:
```

### HTTP API

The API server listens on port 3000 by default.

**Examples:**

- **Get Status:**
  ```bash
  curl http://localhost:3000/status
  ```

- **Read Volume Total (Nozzle 08):**
  ```bash
  curl http://localhost:3000/total/08/L
  ```

- **Set Operating Mode (Release Nozzle 04):**
  ```bash
  curl -X POST http://localhost:3000/mode \
       -H "Content-Type: application/json" \
       -d '{"nozzle":"04","mode":"L"}'
  ```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Get status of all nozzles |
| GET | `/supply` | Read latest supply data |
| GET | `/visualization` | Read ongoing dispensing data |
| GET | `/total/:nozzle/:mode` | Read total (Volume/Value) |
| POST | `/preset` | Set preset value |
| POST | `/mode` | Set operating mode |
| POST | `/price` | Change price |
