const CompanytecClient = require('./companytec-client');
const readline = require('readline');

/**
 * Interactive test client for Companytec protocol
 */

// Configuration - modify these values for your setup
const CONFIG = {
    host: '127.0.0.1',  // Change to your device IP
    port: 2001          // Change to your device port
};

const client = new CompanytecClient(CONFIG.host, CONFIG.port);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function showMenu() {
    console.log('\n========================================');
    console.log('   COMPANYTEC CLIENT - TEST MENU');
    console.log('========================================');
    console.log('Supply Commands:');
    console.log('  1.  Read Supply (52 chars)');
    console.log('  2.  Read Supply Identified');
    console.log('  3.  Read Supply PAF1');
    console.log('  4.  Read Supply PAF2');
    console.log('  5.  Read Memory Pointers');
    console.log('  6.  Increment Supply Pointer');
    console.log('');
    console.log('Visualization:');
    console.log('  7.  Get Visualization');
    console.log('  8.  Get Visualization Identified');
    console.log('');
    console.log('Status & Info:');
    console.log('  9.  Get Status');
    console.log('  10. Read Calendar');
    console.log('  11. Read Extended Clock');
    console.log('');
    console.log('Pump Management:');
    console.log('  12. Read Total (Volume)');
    console.log('  13. Read Total (Value)');
    console.log('  14. Read Price');
    console.log('  15. Set Operating Mode');
    console.log('  16. Set Preset Value');
    console.log('  17. Change Price');
    console.log('');
    console.log('Identifier:');
    console.log('  18. Read Identifier');
    console.log('  19. Read Identifier from Memory');
    console.log('');
    console.log('Advanced:');
    console.log('  20. Send Custom Command');
    console.log('');
    console.log('  0.  Exit');
    console.log('========================================\n');
}

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function handleCommand(choice) {
    try {
        switch (choice) {
            case '1':
                console.log('\n--- Read Supply (52 chars) ---');
                const supply = await client.readSupply52();
                parseSupplyResponse(supply);
                break;

            case '2':
                console.log('\n--- Read Supply Identified ---');
                const supplyId = await client.readSupplyIdentified();
                parseSupplyIdentifiedResponse(supplyId);
                break;

            case '3':
                console.log('\n--- Read Supply PAF1 ---');
                await client.readSupplyPAF1();
                break;

            case '4':
                console.log('\n--- Read Supply PAF2 ---');
                await client.readSupplyPAF2();
                break;

            case '5':
                console.log('\n--- Read Memory Pointers ---');
                await client.readMemoryPointers();
                break;

            case '6':
                console.log('\n--- Increment Supply Pointer ---');
                await client.increment();
                break;

            case '7':
                console.log('\n--- Get Visualization ---');
                const viz = await client.getVisualization();
                parseVisualizationResponse(viz);
                break;

            case '8':
                console.log('\n--- Get Visualization Identified ---');
                await client.getVisualizationIdentified();
                break;

            case '9':
                console.log('\n--- Get Status ---');
                const status = await client.getStatus();
                parseStatusResponse(status);
                break;

            case '10':
                console.log('\n--- Read Calendar ---');
                await client.readCalendar();
                break;

            case '11':
                console.log('\n--- Read Extended Clock ---');
                await client.readClockExtended();
                break;

            case '12': {
                const nozzle = await askQuestion('Enter nozzle code (hex, e.g., 08): ');
                console.log('\n--- Read Total Volume ---');
                const totalVol = await client.readTotal(nozzle.padStart(2, '0'), 'L');
                parseTotalResponse(totalVol);
                break;
            }

            case '13': {
                const nozzle = await askQuestion('Enter nozzle code (hex, e.g., 08): ');
                console.log('\n--- Read Total Value ---');
                const totalVal = await client.readTotal(nozzle.padStart(2, '0'), '$');
                parseTotalResponse(totalVal);
                break;
            }

            case '14': {
                const nozzle = await askQuestion('Enter nozzle code (hex, e.g., 08): ');
                console.log('\n--- Read Price ---');
                await client.readPrice(nozzle.padStart(2, '0'), 'U');
                break;
            }

            case '15': {
                const nozzle = await askQuestion('Enter nozzle code (hex, e.g., 04): ');
                const mode = await askQuestion('Enter mode (L=release, B=block, A=authorize once): ');
                console.log('\n--- Set Operating Mode ---');
                await client.setOperatingMode(nozzle.padStart(2, '0'), mode);
                break;
            }

            case '16': {
                const nozzle = await askQuestion('Enter nozzle code (hex, e.g., 08): ');
                const value = await askQuestion('Enter preset value (e.g., 001000): ');
                console.log('\n--- Set Preset Value ---');
                await client.setPreset(nozzle.padStart(2, '0'), value);
                break;
            }

            case '17': {
                const nozzle = await askQuestion('Enter nozzle code (hex, e.g., 08): ');
                const level = await askQuestion('Enter price level (0=cash, 1=credit): ');
                const price = await askQuestion('Enter price (4 digits, e.g., 1234): ');
                console.log('\n--- Change Price ---');
                await client.changePrice(nozzle.padStart(2, '0'), level, price);
                break;
            }

            case '18':
                console.log('\n--- Read Identifier ---');
                await client.readIdentifier();
                break;

            case '19': {
                const position = await askQuestion('Enter memory position (e.g., 1): ');
                console.log('\n--- Read Identifier from Memory ---');
                await client.readIdentifierFromMemory(parseInt(position));
                break;
            }

            case '20': {
                const cmd = await askQuestion('Enter custom command (e.g., &S): ');
                console.log('\n--- Send Custom Command ---');
                const result = await client.sendCommand(cmd);
                console.log(`Result: ${result}`);
                break;
            }

            case '0':
                console.log('\nExiting...');
                client.disconnect();
                rl.close();
                process.exit(0);
                break;

            default:
                console.log('\nInvalid option!');
        }
    } catch (error) {
        console.error('Error executing command:', error.message);
    }
}

// Helper functions to parse responses

function parseSupplyResponse(response) {
    if (response === '(0)') {
        console.log('No supply data available.');
        return;
    }
    
    // Remove delimiters and checksum
    const data = response.substring(1, response.length - 3);
    
    if (data.length >= 34) {
        console.log('\nSupply Data:');
        console.log(`  Total to Pay: ${data.substring(0, 6)}`);
        console.log(`  Volume: ${data.substring(6, 12)}`);
        console.log(`  Price: ${data.substring(12, 16)}`);
        console.log(`  Comma Code: ${data.substring(16, 18)}`);
        console.log(`  Supply Time: ${data.substring(18, 22)}`);
        console.log(`  Nozzle Code: ${data.substring(22, 24)}`);
        console.log(`  Day: ${data.substring(24, 26)}`);
        console.log(`  Hour: ${data.substring(26, 28)}`);
        console.log(`  Minute: ${data.substring(28, 30)}`);
        
        if (data.length >= 52) {
            console.log(`  Month: ${data.substring(30, 32)}`);
            console.log(`  Record: ${data.substring(32, 36)}`);
            console.log(`  Final Total: ${data.substring(36, 46)}`);
            console.log(`  Status: ${data.substring(46, 48)}`);
        }
    }
}

function parseSupplyIdentifiedResponse(response) {
    if (response === '(0)') {
        console.log('No supply data available.');
        return;
    }
    
    const data = response.substring(2, response.length - 3);
    
    if (data.length >= 70) {
        console.log('\nSupply Data (Identified):');
        console.log(`  Total: ${data.substring(0, 6)}`);
        console.log(`  Volume: ${data.substring(6, 12)}`);
        console.log(`  Price: ${data.substring(12, 16)}`);
        console.log(`  Nozzle: ${data.substring(22, 24)}`);
        console.log(`  Identifier: ${data.substring(50, 66)}`);
    }
}

function parseVisualizationResponse(response) {
    if (response === '(0)') {
        console.log('No dispensing in progress.');
        return;
    }
    
    const data = response.substring(1, response.length - 1);
    console.log('\nOngoing Dispensing:');
    
    for (let i = 0; i < data.length; i += 8) {
        const nozzle = data.substring(i, i + 2);
        const value = data.substring(i + 2, i + 8);
        console.log(`  Nozzle ${nozzle}: ${value}`);
    }
}

function parseStatusResponse(response) {
    const data = response.substring(1, response.length - 1);
    console.log('\nStatus Information:');
    console.log(`  Raw Status: ${data}`);
    
    // Extract status codes
    const statusCodes = data.substring(1, 33);
    console.log('\nNozzle Status:');
    for (let i = 0; i < statusCodes.length; i++) {
        const code = statusCodes[i];
        let status = 'Unknown';
        switch (code) {
            case 'L': status = 'Available'; break;
            case 'B': status = 'Blocked'; break;
            case 'C': status = 'Finished'; break;
            case 'A': status = 'Refueling'; break;
            case 'E': status = 'Waiting'; break;
            case 'F': status = 'Not present'; break;
            case 'P': status = 'Ready'; break;
        }
        if (code !== 'F') {
            console.log(`  Position ${i + 1}: ${code} (${status})`);
        }
    }
}

function parseTotalResponse(response) {
    const data = response.substring(1, response.length - 3);
    if (data.length >= 10) {
        const mode = data[0];
        const nozzle = data.substring(1, 3);
        const value = data.substring(3, 11);
        
        console.log('\nTotal Reading:');
        console.log(`  Mode: ${mode}`);
        console.log(`  Nozzle: ${nozzle}`);
        console.log(`  Value: ${value}`);
    }
}

async function main() {
    console.log('Companytec Test Client');
    console.log('======================\n');
    console.log(`Connecting to ${CONFIG.host}:${CONFIG.port}...`);

    try {
        await client.connect();
        console.log('Connected successfully!\n');

        while (true) {
            showMenu();
            const choice = await askQuestion('Select option: ');
            await handleCommand(choice.trim());
            
            if (choice === '0') break;
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.error('Connection error:', error.message);
        rl.close();
        process.exit(1);
    }
}

// Run the interactive test client
if (require.main === module) {
    main().catch(console.error);
}

