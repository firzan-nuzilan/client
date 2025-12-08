const CompanytecClient = require('./companytec-client');

/**
 * Pump Monitoring Example
 * 
 * This example demonstrates how to continuously monitor pumps:
 * - Real-time status monitoring
 * - Automatic supply reading
 * - Event handling for completed supplies
 */

class PumpMonitor {
    constructor(host, port) {
        this.client = new CompanytecClient(host, port);
        this.isRunning = false;
        this.lastSupplyRecord = null;
        
        // Monitoring intervals
        this.statusInterval = null;
        this.supplyInterval = null;
        this.visualizationInterval = null;
    }

    async start() {
        console.log('Starting Pump Monitor...\n');
        
        try {
            await this.client.connect();
            console.log('Connected to device\n');
            
            this.isRunning = true;
            
            // Start monitoring loops
            this.monitorStatus();
            this.monitorSupplies();
            this.monitorVisualization();
            
            console.log('Monitoring active. Press Ctrl+C to stop.\n');
            console.log('='.repeat(80));
            console.log('\n');
            
        } catch (error) {
            console.error('Failed to start monitor:', error.message);
            throw error;
        }
    }

    stop() {
        console.log('\nStopping monitor...');
        this.isRunning = false;
        
        if (this.statusInterval) clearInterval(this.statusInterval);
        if (this.supplyInterval) clearInterval(this.supplyInterval);
        if (this.visualizationInterval) clearInterval(this.visualizationInterval);
        
        this.client.disconnect();
        console.log('Monitor stopped.');
    }

    /**
     * Monitor pump status every second
     */
    monitorStatus() {
        this.statusInterval = setInterval(async () => {
            if (!this.isRunning) return;
            
            try {
                const status = await this.client.getStatus();
                this.parseAndDisplayStatus(status);
            } catch (error) {
                console.error('Status error:', error.message);
            }
        }, 1000);
    }

    /**
     * Monitor for completed supplies
     */
    monitorSupplies() {
        this.supplyInterval = setInterval(async () => {
            if (!this.isRunning) return;
            
            try {
                const supply = await this.client.readSupply52();
                
                if (supply !== '(0)') {
                    const record = this.parseSupplyRecord(supply);
                    
                    // Check if this is a new supply
                    if (!this.lastSupplyRecord || 
                        this.lastSupplyRecord.record !== record.record) {
                        
                        this.onNewSupply(record);
                        this.lastSupplyRecord = record;
                        
                        // Increment to next supply
                        await this.client.increment();
                    }
                }
            } catch (error) {
                console.error('Supply error:', error.message);
            }
        }, 2000);
    }

    /**
     * Monitor ongoing dispensing
     */
    monitorVisualization() {
        let lastVisualization = '';
        
        this.visualizationInterval = setInterval(async () => {
            if (!this.isRunning) return;
            
            try {
                const viz = await this.client.getVisualization();
                
                // Only display if changed
                if (viz !== lastVisualization) {
                    if (viz !== '(0)') {
                        this.parseAndDisplayVisualization(viz);
                    }
                    lastVisualization = viz;
                }
            } catch (error) {
                console.error('Visualization error:', error.message);
            }
        }, 500);
    }

    /**
     * Parse status response
     */
    parseAndDisplayStatus(response) {
        if (response.length < 5) return;
        
        const data = response.substring(1, response.length - 1);
        const statusCodes = data.substring(1, Math.min(33, data.length - 10));
        
        const activeNozzles = [];
        for (let i = 0; i < statusCodes.length; i++) {
            const code = statusCodes[i];
            if (code !== 'F' && code !== 'L' && code !== 'B') {
                activeNozzles.push({
                    position: i + 1,
                    nozzle: (i + 1).toString(16).padStart(2, '0').toUpperCase(),
                    status: this.getStatusDescription(code)
                });
            }
        }
        
        if (activeNozzles.length > 0) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] Active Nozzles:`);
            activeNozzles.forEach(n => {
                console.log(`  Nozzle ${n.nozzle}: ${n.status}`);
            });
            console.log('');
        }
    }

    /**
     * Parse and display ongoing dispensing
     */
    parseAndDisplayVisualization(response) {
        if (response === '(0)') return;
        
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] Dispensing:`);
        
        const data = response.substring(1, response.length - 1);
        for (let i = 0; i < data.length; i += 8) {
            if (i + 8 <= data.length) {
                const nozzle = data.substring(i, i + 2);
                const value = data.substring(i + 2, i + 8);
                const formattedValue = this.formatValue(value);
                console.log(`  Nozzle ${nozzle}: ${formattedValue}`);
            }
        }
        console.log('');
    }

    /**
     * Parse supply record
     */
    parseSupplyRecord(response) {
        const data = response.substring(1, response.length - 3);
        
        return {
            totalToPay: data.substring(0, 6),
            volume: data.substring(6, 12),
            price: data.substring(12, 16),
            commaCode: data.substring(16, 18),
            supplyTime: data.substring(18, 22),
            nozzle: data.substring(22, 24),
            day: data.substring(24, 26),
            hour: data.substring(26, 28),
            minute: data.substring(28, 30),
            month: data.substring(30, 32),
            record: data.substring(32, 36),
            finalTotal: data.substring(36, 46),
            status: data.substring(46, 48)
        };
    }

    /**
     * Handle new supply event
     */
    onNewSupply(record) {
        const timestamp = new Date().toLocaleTimeString();
        console.log('\n' + '='.repeat(80));
        console.log(`[${timestamp}] NEW SUPPLY COMPLETED!`);
        console.log('='.repeat(80));
        console.log(`  Nozzle:        ${record.nozzle}`);
        console.log(`  Date/Time:     ${record.day}/${record.month} ${record.hour}:${record.minute}`);
        console.log(`  Volume:        ${this.formatValue(record.volume)} L`);
        console.log(`  Price/L:       ${this.formatValue(record.price)}`);
        console.log(`  Total to Pay:  R$ ${this.formatValue(record.totalToPay)}`);
        console.log(`  Duration:      ${record.supplyTime} seconds`);
        console.log(`  Record #:      ${record.record}`);
        console.log(`  Final Total:   ${this.formatValue(record.finalTotal)}`);
        console.log('='.repeat(80));
        console.log('\n');
        
        // Here you could:
        // - Save to database
        // - Send notification
        // - Update UI
        // - Generate receipt
    }

    /**
     * Get status description
     */
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

    /**
     * Format numeric values
     */
    formatValue(value) {
        const num = parseInt(value);
        return (num / 100).toFixed(2);
    }
}

// ========== RUN MONITOR ==========

async function main() {
    // Configuration
    const HOST = '192.168.1.100';  // Change to your device IP
    const PORT = 2001;              // Change to your device port

    const monitor = new PumpMonitor(HOST, PORT);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nReceived SIGINT signal...');
        monitor.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\nReceived SIGTERM signal...');
        monitor.stop();
        process.exit(0);
    });

    try {
        await monitor.start();
    } catch (error) {
        console.error('Monitor error:', error);
        process.exit(1);
    }
}

// Run the monitor
if (require.main === module) {
    console.log('Companytec Pump Monitor');
    console.log('=======================\n');
    main().catch(console.error);
}

module.exports = PumpMonitor;

