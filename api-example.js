const http = require('http');
const url = require('url');
const CompanytecClient = require('./companytec-client');

/**
 * Simple HTTP API Example for Companytec Client
 * 
 * This example demonstrates how to expose Companytec functionality via HTTP API
 * 
 * Endpoints:
 *   GET  /status              - Get pump status
 *   GET  /calendar            - Get device calendar
 *   GET  /supply              - Get latest supply
 *   GET  /visualization       - Get ongoing dispensing
 *   GET  /total/:nozzle/:mode - Get total for nozzle
 *   GET  /price/:nozzle       - Get price for nozzle
 *   POST /preset              - Set preset value
 *   POST /mode                - Set operating mode
 *   POST /price               - Change price
 */

class CompanytecAPI {
    constructor(host, port, apiPort = 3000) {
        this.client = new CompanytecClient(host, port);
        this.apiPort = apiPort;
        this.server = null;
        this.connected = false;
    }

    async start() {
        // Connect to Companytec device
        try {
            await this.client.connect();
            this.connected = true;
            console.log('Connected to Companytec device');
        } catch (error) {
            console.error('Failed to connect to device:', error.message);
            throw error;
        }

        // Create HTTP server
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(this.apiPort, () => {
            console.log(`API server listening on port ${this.apiPort}`);
            console.log('\nAvailable endpoints:');
            console.log('  GET  /status');
            console.log('  GET  /calendar');
            console.log('  GET  /supply');
            console.log('  GET  /visualization');
            console.log('  GET  /total/:nozzle/:mode');
            console.log('  GET  /price/:nozzle');
            console.log('  POST /preset');
            console.log('  POST /mode');
            console.log('  POST /price');
            console.log('\n');
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
        this.client.disconnect();
        console.log('API server stopped');
    }

    async handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const path = parsedUrl.pathname;
        const method = req.method;

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        // Handle OPTIONS for CORS
        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            if (!this.connected) {
                this.sendError(res, 503, 'Not connected to device');
                return;
            }

            // Route requests
            if (method === 'GET') {
                await this.handleGetRequest(path, parsedUrl.query, res);
            } else if (method === 'POST') {
                await this.handlePostRequest(req, path, res);
            } else {
                this.sendError(res, 405, 'Method not allowed');
            }
        } catch (error) {
            console.error('Request error:', error);
            this.sendError(res, 500, error.message);
        }
    }

    async handleGetRequest(path, query, res) {
        if (path === '/status') {
            const status = await this.client.getStatus();
            const parsed = this.parseStatus(status);
            this.sendSuccess(res, parsed);

        } else if (path === '/calendar') {
            const calendar = await this.client.readCalendar();
            this.sendSuccess(res, { calendar });

        } else if (path === '/supply') {
            const supply = await this.client.readSupply52();
            const parsed = supply === '(0)' ? null : this.parseSupply(supply);
            this.sendSuccess(res, parsed);

        } else if (path === '/visualization') {
            const viz = await this.client.getVisualization();
            const parsed = viz === '(0)' ? [] : this.parseVisualization(viz);
            this.sendSuccess(res, parsed);

        } else if (path.startsWith('/total/')) {
            const parts = path.split('/');
            if (parts.length < 4) {
                this.sendError(res, 400, 'Invalid path. Use /total/:nozzle/:mode');
                return;
            }
            const nozzle = parts[2];
            const mode = parts[3];
            const total = await this.client.readTotal(nozzle, mode);
            const parsed = this.parseTotal(total);
            this.sendSuccess(res, parsed);

        } else if (path.startsWith('/price/')) {
            const parts = path.split('/');
            if (parts.length < 3) {
                this.sendError(res, 400, 'Invalid path. Use /price/:nozzle');
                return;
            }
            const nozzle = parts[2];
            const price = await this.client.readPrice(nozzle, 'U');
            this.sendSuccess(res, { price });

        } else {
            this.sendError(res, 404, 'Endpoint not found');
        }
    }

    async handlePostRequest(req, path, res) {
        const body = await this.readBody(req);
        let data;
        
        try {
            data = JSON.parse(body);
        } catch (e) {
            this.sendError(res, 400, 'Invalid JSON');
            return;
        }

        if (path === '/preset') {
            if (!data.nozzle || !data.value) {
                this.sendError(res, 400, 'Missing nozzle or value');
                return;
            }
            const result = await this.client.setPreset(data.nozzle, data.value);
            this.sendSuccess(res, { result });

        } else if (path === '/mode') {
            if (!data.nozzle || !data.mode) {
                this.sendError(res, 400, 'Missing nozzle or mode');
                return;
            }
            const result = await this.client.setOperatingMode(data.nozzle, data.mode);
            this.sendSuccess(res, { result });

        } else if (path === '/price') {
            if (!data.nozzle || !data.level || !data.price) {
                this.sendError(res, 400, 'Missing nozzle, level, or price');
                return;
            }
            const result = await this.client.changePrice(data.nozzle, data.level, data.price);
            this.sendSuccess(res, { result });

        } else {
            this.sendError(res, 404, 'Endpoint not found');
        }
    }

    readBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', reject);
        });
    }

    parseStatus(response) {
        const data = response.substring(1, response.length - 1);
        const statusCodes = data.substring(1, Math.min(33, data.length - 10));
        
        const nozzles = [];
        for (let i = 0; i < statusCodes.length; i++) {
            const code = statusCodes[i];
            if (code !== 'F') {
                nozzles.push({
                    position: i + 1,
                    nozzle: (i + 1).toString(16).padStart(2, '0').toUpperCase(),
                    statusCode: code,
                    status: this.getStatusDescription(code)
                });
            }
        }
        
        return { nozzles };
    }

    parseSupply(response) {
        const data = response.substring(1, response.length - 3);
        
        return {
            totalToPay: parseInt(data.substring(0, 6)),
            volume: parseInt(data.substring(6, 12)),
            price: parseInt(data.substring(12, 16)),
            commaCode: data.substring(16, 18),
            supplyTime: parseInt(data.substring(18, 22)),
            nozzle: data.substring(22, 24),
            day: parseInt(data.substring(24, 26)),
            hour: parseInt(data.substring(26, 28)),
            minute: parseInt(data.substring(28, 30)),
            month: data.length >= 32 ? parseInt(data.substring(30, 32)) : null,
            record: data.length >= 36 ? parseInt(data.substring(32, 36)) : null,
            finalTotal: data.length >= 46 ? data.substring(36, 46) : null,
            status: data.length >= 48 ? data.substring(46, 48) : null
        };
    }

    parseVisualization(response) {
        const data = response.substring(1, response.length - 1);
        const nozzles = [];
        
        for (let i = 0; i < data.length; i += 8) {
            if (i + 8 <= data.length) {
                nozzles.push({
                    nozzle: data.substring(i, i + 2),
                    value: parseInt(data.substring(i + 2, i + 8))
                });
            }
        }
        
        return nozzles;
    }

    parseTotal(response) {
        const data = response.substring(1, response.length - 3);
        return {
            mode: data[0],
            nozzle: data.substring(1, 3),
            value: data.substring(3)
        };
    }

    getStatusDescription(code) {
        const descriptions = {
            'L': 'Available',
            'B': 'Blocked',
            'C': 'Finished',
            'A': 'Refueling',
            'E': 'Waiting',
            'F': 'Not Present',
            'P': 'Ready'
        };
        return descriptions[code] || 'Unknown';
    }

    sendSuccess(res, data) {
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            data: data
        }, null, 2));
    }

    sendError(res, code, message) {
        res.writeHead(code);
        res.end(JSON.stringify({
            success: false,
            error: message
        }, null, 2));
    }
}

// ========== RUN API SERVER ==========

async function main() {
    // Configuration
    const DEVICE_HOST = '192.168.1.100';  // Companytec device IP
    const DEVICE_PORT = 2001;              // Companytec device port
    const API_PORT = 3000;                 // API server port

    const api = new CompanytecAPI(DEVICE_HOST, DEVICE_PORT, API_PORT);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down...');
        api.stop();
        process.exit(0);
    });

    try {
        await api.start();
        console.log('API server started successfully');
        console.log('\nExample requests:');
        console.log('  curl http://localhost:3000/status');
        console.log('  curl http://localhost:3000/supply');
        console.log('  curl http://localhost:3000/visualization');
        console.log('  curl http://localhost:3000/total/08/L');
        console.log('  curl -X POST http://localhost:3000/mode -H "Content-Type: application/json" -d \'{"nozzle":"04","mode":"L"}\'');
        console.log('\n');
    } catch (error) {
        console.error('Failed to start API:', error);
        process.exit(1);
    }
}

// Run the API server
if (require.main === module) {
    console.log('Companytec HTTP API Server');
    console.log('==========================\n');
    main().catch(console.error);
}

module.exports = CompanytecAPI;

