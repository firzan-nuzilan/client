# Companytec Node.js TCP Client

Node.js implementation of the Companytec communication protocol (DT435) for fuel pump automation systems.

## Features

- Full implementation of Companytec protocol commands
- Automatic checksum calculation
- TCP socket communication
- Support for all major command categories:
  - Supply reading (multiple formats)
  - Visualization
  - Identifier management
  - Status reading
  - Pump management
  - Clock/Calendar operations
  - Blacklist management

## Requirements

- Node.js >= 12.0.0
- Network access to Companytec device

## Installation

No external dependencies required! This implementation uses only Node.js built-in modules.

```bash
# No npm install needed
```

## Configuration

Edit the IP address and port in the example files:

```javascript
const host = '192.168.1.100';  // Your device IP
const port = 2001;              // Your device port (1771 or 2001)
```

## Usage

### Basic Example

```javascript
const CompanytecClient = require('./companytec-client');

async function example() {
    const client = new CompanytecClient('192.168.1.100', 2001);
    
    try {
        // Connect to device
        await client.connect();
        
        // Read device status
        const status = await client.getStatus();
        console.log('Status:', status);
        
        // Read calendar
        const calendar = await client.readCalendar();
        console.log('Calendar:', calendar);
        
        // Read supply data
        const supply = await client.readSupply52();
        console.log('Supply:', supply);
        
        // Read total volume for nozzle 08
        const total = await client.readTotal('08', 'L');
        console.log('Total:', total);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.disconnect();
    }
}

example();
```

### Run the Basic Example

```bash
node companytec-client.js
```

### Run Interactive Test Client

```bash
node test-client.js
# or
npm test
```

The interactive test client provides a menu-driven interface to test all protocol commands.

### Run Monitoring Example

```bash
node monitor-example.js
# or
npm run monitor
```

This example continuously monitors pumps and displays:
- Real-time status of all nozzles
- Ongoing fuel dispensing
- Completed supply events with full details

### Run HTTP API Server

```bash
node api-example.js
# or
npm run api
```

This starts an HTTP API server that exposes Companytec functionality via REST endpoints on port 3000. You can then make requests like:

```bash
# Get pump status
curl http://localhost:3000/status

# Get latest supply
curl http://localhost:3000/supply

# Get ongoing dispensing
curl http://localhost:3000/visualization

# Get total for nozzle 08
curl http://localhost:3000/total/08/L

# Release pump 04
curl -X POST http://localhost:3000/mode \
  -H "Content-Type: application/json" \
  -d '{"nozzle":"04","mode":"L"}'

# Set preset value
curl -X POST http://localhost:3000/preset \
  -H "Content-Type: application/json" \
  -d '{"nozzle":"08","value":"001000"}'
```

## API Reference

### Connection Methods

#### `connect()`
Connect to the Companytec device.

```javascript
await client.connect();
```

#### `disconnect()`
Disconnect from the device.

```javascript
client.disconnect();
```

### Supply Commands

#### `readSupply52()`
Read supply data (52 characters format).

```javascript
const supply = await client.readSupply52();
// Returns: (TTTTTTLLLLLLPPPPVVCCCCBBDDHHMMNNRRREEEEEEEEEESSKK)
```

#### `readSupplyIdentified()`
Read supply data with identifier (75 characters).

```javascript
const supply = await client.readSupplyIdentified();
```

#### `readSupplyPAF1()`
Read PAF1 fuel supply (123 characters).

```javascript
const supply = await client.readSupplyPAF1();
```

#### `readSupplyPAF2()`
Read PAF2 fuel supply (127 characters).

```javascript
const supply = await client.readSupplyPAF2();
```

#### `readSupplyPointer(mode, position)`
Read supply from specific memory position.

```javascript
// mode: 'C' or 'R'
// position: memory record number
const supply = await client.readSupplyPointer('C', '0001');
```

#### `readMemoryPointers()`
Read memory write and read pointers.

```javascript
const pointers = await client.readMemoryPointers();
```

#### `increment()`
Move reading pointer to next refueling.

```javascript
await client.increment();
```

### Visualization Commands

#### `getVisualization()`
Read ongoing fuel dispensing.

```javascript
const viz = await client.getVisualization();
// Returns: (BBTTTTTT) for each active nozzle or (0)
```

#### `getVisualizationIdentified()`
Get identifier that released the nozzle.

```javascript
const viz = await client.getVisualizationIdentified();
```

### Status Commands

#### `getStatus()`
Read status of all nozzles.

```javascript
const status = await client.getStatus();
// Status codes:
// L = Available, B = Blocked, C = Finished
// A = Refueling, E = Waiting, F = Not present, P = Ready
```

### Pump Management Commands

#### `readTotal(nozzle, mode)`
Read totalizer data for a nozzle.

```javascript
// Modes: '$' (value), 'L' (volume), 'l' (extended volume),
//        'N' (serial), 'U' (price), 'P' (pointer)
const total = await client.readTotal('08', 'L'); // Volume
const value = await client.readTotal('08', '$'); // Value
```

#### `readPrice(nozzle, mode)`
Read price levels for a nozzle.

```javascript
// mode: 'U' (2 levels) or 'u' (3 levels)
const price = await client.readPrice('08', 'U');
```

#### `changePrice(nozzle, level, price)`
Change unit price of nozzle.

```javascript
// level: '0' (cash), '1' (credit)
// price: 4 digits
await client.changePrice('08', '0', '1234');
```

#### `changePriceExtended(nozzle, level, price)`
Change unit price with 6 digits.

```javascript
// level: '0' (cash), '1' (credit), '2' (debit)
// price: 6 digits
await client.changePriceExtended('08', '0', '123456');
```

#### `setPreset(nozzle, value)`
Authorize supply with maximum value.

```javascript
// value: 6 digits
await client.setPreset('08', '001000');
```

#### `setOperatingMode(nozzle, mode)`
Manage pump operating mode.

```javascript
// Modes:
// L = Release, B = Block, S = Stop, A = Authorize once
// P = Pause, H = Enable sensor, I = Disable sensor
await client.setOperatingMode('04', 'L'); // Release pump 04
await client.setOperatingMode('04', 'B'); // Block pump 04
```

### Identifier Commands

#### `readIdentifier()`
Read unregistered identifier.

```javascript
const identifier = await client.readIdentifier();
```

#### `recordIdentifier(control, parameter, identifier, shiftA_start, shiftA_end, shiftB_start, shiftB_end)`
Record identifier in memory.

```javascript
await client.recordIdentifier(
    '27',                  // control code
    'G',                   // parameter
    'B328000000000001',    // identifier (16 hex chars)
    '2300',                // shift A start (hhmm)
    '0000',                // shift A end (hhmm)
    '0000',                // shift B start (hhmm)
    '0000'                 // shift B end (hhmm)
);
```

#### `deleteIdentifier(control, identifier, position)`
Delete identifier from memory.

```javascript
await client.deleteIdentifier(
    '27',                  // control code
    'B328000000000005',    // identifier
    '000005'               // position (optional)
);
```

#### `readIdentifierFromMemory(position)`
Read identifier from specific memory position.

```javascript
const identifier = await client.readIdentifierFromMemory(2);
```

#### `clearIdentifierMemory()`
Delete all identifiers from memory.

```javascript
await client.clearIdentifierMemory();
```

#### `incrementIdentifier()`
Move to next identifier read.

```javascript
await client.incrementIdentifier();
```

### Clock Commands

#### `readCalendar()`
Read time and date.

```javascript
const calendar = await client.readCalendar();
// Returns: (REL HH:mm:SS DD/MM/AA)
```

#### `readClockExtended()`
Read time, date and day of week.

```javascript
const clock = await client.readClockExtended();
// Returns: (KR1AAMMDDWWHHmmSSKK)
```

#### `setCalendar(day, hour, minute)`
Set date and time.

```javascript
await client.setCalendar('15', '09', '56');
```

#### `setCalendarExtended(year, month, day, weekday, hour, minute, second)`
Set date, time and day of week.

```javascript
// weekday: 01=Sunday, 02=Monday, ..., 07=Saturday
await client.setCalendarExtended('20', '02', '13', '01', '09', '00', '00');
```

### Blacklist Commands

#### `manageBlacklist(mode, identifier)`
Manage identifier blacklist.

```javascript
// Clear blacklist
await client.manageBlacklist('c');

// Add identifier to blacklist
await client.manageBlacklist('b', 'B328000000000001');

// Remove identifier from blacklist
await client.manageBlacklist('l', 'B328000000000001');
```

### Low-Level Methods

#### `sendCommand(command)`
Send raw command string.

```javascript
const response = await client.sendCommand('(&S)');
```

#### `buildCommand(header, parameters)`
Build command with checksum.

```javascript
const command = client.buildCommand('&T', '08L');
// Returns: (&T08L2E)
```

#### `calculateChecksum(command)`
Calculate protocol checksum.

```javascript
const checksum = client.calculateChecksum('(&T08L');
// Returns: '2E'
```

## Protocol Information

### Command Structure

All commands follow this structure:
```
(CCPP...KK)
```

- `(` - Initial delimiter
- `CC` - Command header (2 chars)
- `PP...` - Parameters (variable length)
- `KK` - Checksum (2 hex chars)
- `)` - Final delimiter

### Checksum Calculation

The checksum is the sum of ASCII values of all characters between delimiters, keeping only the least significant byte, represented as 2 hexadecimal characters.

### Nozzle Codes

Nozzle codes are 2-character hexadecimal values:
- `01`, `02`, `03`, `04` - Individual nozzles
- `05`, `06`, `07`, `08` - Additional nozzles
- Use uppercase hexadecimal (A-F)

### Status Codes

- `L` - Available for refueling
- `B` - Blocked
- `C` - Finished refueling
- `A` - Currently refueling
- `E` - Waiting for authorization
- `F` - Not present / Communication failure
- `P` - Ready to refuel

## Troubleshooting

### Connection Issues

1. Verify IP address and port
2. Check network connectivity: `ping 192.168.1.100`
3. Ensure device is powered on
4. Check firewall settings

### Common Ports

- Port 1771: CBC with older DLL
- Port 2001: CBC with newer DLL

### Timeout Errors

If you get timeout errors:
- Increase timeout in `sendCommand()` method
- Check if device is responding
- Verify command format

### Response Parsing

All responses maintain the delimiters `(` and `)`. Parse accordingly:
```javascript
const response = '(SBBFF00)';
const data = response.substring(1, response.length - 3); // Remove delimiters and checksum
```

## Examples

See the following files for complete examples:
- `companytec-client.js` - Main client class with basic usage example
- `test-client.js` - Interactive test client with menu-driven interface
- `monitor-example.js` - Real-time pump monitoring application
- `api-example.js` - HTTP REST API server wrapper
- `config.example.js` - Configuration file template

## Protocol Reference

This implementation is based on:
- **DT435** - Companytec Communication Protocol
- **DT432** - Software Partner Manual

For complete protocol specification, refer to the PDF documentation in the `Manuais` folder.

## License

MIT

## Support

For issues related to:
- **Protocol**: Refer to DT435 documentation
- **Device**: Contact Companytec support
- **Code**: Check examples and test client

