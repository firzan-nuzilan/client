const net = require("net");

/**
 * Companytec TCP Client
 * Implementation of Companytec communication protocol for Node.js
 * Based on DT435 protocol specification
 */
class CompanytecClient {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.client = null;
    this.connected = false;
  }

  /**
   * Calculate checksum for Companytec protocol
   * Sum of ASCII values of characters (ignoring most significant byte)
   */
  calculateChecksum(command) {
    let sum = 0;
    // Sum ASCII values of all characters except the delimiters
    for (let i = 1; i < command.length; i++) {
      sum += command.charCodeAt(i);
    }
    // Keep only the least significant byte and convert to hex
    const checksum = (sum & 0xff).toString(16).toUpperCase().padStart(2, "0");
    return checksum;
  }

  /**
   * Build a command with proper format and checksum
   */
  buildCommand(header, parameters = "") {
    const commandBody = `(${header}${parameters}`;
    const checksum = this.calculateChecksum(commandBody);
    return `${commandBody}${checksum})`;
  }

  /**
   * Connect to the Companytec device
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.client = new net.Socket();
      this.client.on("error", (e) => console.error("Socket error:", e));
      this.client.on("timeout", () => console.warn("Socket timed out"));
      this.client.on("status", (e) => console.log("STATUS:", e.status, e));
      this.client.on("fueling.start", (e) =>
        console.log("▶️  Fueling start:", e)
      );
      this.client.on("fueling.end", (e) => {
        console.log("⏹️  Fueling end:", e);
        // After 'C' (completed), you typically request final totals via the protocol/DLL.
        // e.g., send a 'read finalized sale' command here if needed.
      });

      this.client.on("error", (error) => {
        console.error("Connection error:", error.message);
        this.connected = false;
        reject(error);
      });

      this.client.on("close", () => {
        console.log("Connection closed");
        this.connected = false;
      });

      this.client.connect(this.port, this.host, () => {
        console.log(`Connected to ${this.host}:${this.port}`);
        this.connected = true;
        resolve();
      });
    });
  }

  /**
   * Disconnect from the device
   */
  disconnect() {
    if (this.client) {
      this.client.destroy();
      this.connected = false;
    }
  }

  /**
   * Send command and receive response
   */
  sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error("Not connected to device"));
        return;
      }

      console.log(`TX: ${command}`);

      // Write command
      this.client.write(command, "ascii");

      // Wait for response
      const timeout = setTimeout(() => {
        reject(new Error("Response timeout"));
      }, 5000);

      this.client.once("data", (data) => {
        clearTimeout(timeout);
        const response = data.toString("ascii");
        console.log(`RX: ${response}`);
        resolve(response);
      });
    });
  }

  // ========== SUPPLY COMMANDS ==========

  /**
   * Water Supply Reading (52 characters)
   * Header: &A
   * Returns supply data or (0) if no data
   */
  async readSupply52() {
    const command = this.buildCommand("&A");
    return await this.sendCommand(command);
  }

  /**
   * Water Supply Reading identified (75 characters)
   * Returns supply data with identifier
   */
  async readSupplyIdentified() {
    const command = this.buildCommand("&A");
    return await this.sendCommand(command);
  }

  /**
   * Fuel supply with dual identification (87 characters)
   * Header: &@
   */
  async readSupplyDualIdentification() {
    const command = this.buildCommand("&@");
    return await this.sendCommand(command);
  }

  /**
   * PAF1 fuel supply reading (123 characters)
   * Header: &A2
   */
  async readSupplyPAF1() {
    const command = this.buildCommand("&A2");
    return await this.sendCommand(command);
  }

  /**
   * PAF2 fuel supply reading (127 characters)
   * Header: &A3
   */
  async readSupplyPAF2() {
    const command = this.buildCommand("&A3");
    return await this.sendCommand(command);
  }

  /**
   * Pointer reading of supply
   * Header: &L
   * @param {string} mode - Reading mode (C or R)
   * @param {string} position - Memory record number (4 digits)
   */
  async readSupplyPointer(mode, position) {
    const positionStr = position.toString().padStart(4, "0");
    const command = this.buildCommand("&L", `${mode}${positionStr}`);
    return await this.sendCommand(command);
  }

  /**
   * Reading the memory pointers (writing and reading)
   * Header: &T99
   */
  async readMemoryPointers() {
    const command = this.buildCommand("&T99", "P");
    return await this.sendCommand(command);
  }

  /**
   * Increment - Move reading pointer to next refueling
   * Header: &I
   */
  async increment() {
    const command = "(&I)";
    return await this.sendCommand(command);
  }

  // ========== VISUALIZATION COMMANDS ==========

  /**
   * Visualization - Read ongoing fuel dispensing
   * Header: &V
   * Returns nozzle code and value/volume or (0)
   */
  async getVisualization() {
    const command = "(&V)";
    return await this.sendCommand(command);
  }

  /**
   * View identified - Check identifier during dispensing
   * Header: ?V
   */
  async getVisualizationIdentified() {
    const command = this.buildCommand("?V");
    return await this.sendCommand(command);
  }

  // ========== IDENTIFIER COMMANDS ==========

  /**
   * Identifier reading
   * Header: ?A
   * Returns unregistered identifier code
   */
  async readIdentifier() {
    const command = this.buildCommand("?A");
    return await this.sendCommand(command);
  }

  /**
   * Recording of identifiers
   * Header: ?F
   * @param {string} control - Control code (2 hex chars)
   * @param {string} parameter - Parameter for recording (1 char)
   * @param {string} identifier - Identifier code (16 hex chars)
   * @param {string} shiftA_start - Initial shift A (hhmm)
   * @param {string} shiftA_end - Final shift A (hhmm)
   * @param {string} shiftB_start - Initial shift B (hhmm)
   * @param {string} shiftB_end - Final shift B (hhmm)
   */
  async recordIdentifier(
    control,
    parameter,
    identifier,
    shiftA_start,
    shiftA_end,
    shiftB_start,
    shiftB_end
  ) {
    const params = `${control}${parameter}${identifier}${shiftA_start}${shiftA_end}${shiftB_start}${shiftB_end}`;
    const command = this.buildCommand("?F", params);
    return await this.sendCommand(command);
  }

  /**
   * Identifier deletion
   * Header: ?F
   * @param {string} control - Control code (2 hex chars)
   * @param {string} identifier - Identifier code (16 hex chars)
   * @param {string} position - Record position (6 digits, 0 for fixed)
   */
  async deleteIdentifier(control, identifier, position = "000000") {
    const params = `${control}A${identifier}00${position}00000000`;
    const command = this.buildCommand("?F", params);
    return await this.sendCommand(command);
  }

  /**
   * Identifier increment
   * Header: ?I
   */
  async incrementIdentifier() {
    const command = this.buildCommand("?I");
    return await this.sendCommand(command);
  }

  /**
   * Memory cleanup of identifiers
   * Header: ?F
   */
  async clearIdentifierMemory() {
    const command = this.buildCommand(
      "?F",
      "00L0000000000000000000000100000000"
    );
    return await this.sendCommand(command);
  }

  /**
   * Read identifier register from memory
   * Header: ?LF
   * @param {number} position - Memory location (6 digits)
   */
  async readIdentifierFromMemory(position) {
    const positionStr = position.toString().padStart(6, "0");
    const command = this.buildCommand("?LF", positionStr);
    return await this.sendCommand(command);
  }

  // ========== STATUS COMMANDS ==========

  /**
   * Status - Read status information of each nozzle
   * Header: &S
   */
  async getStatus() {
    const command = "(&S)";
    return await this.sendCommand(command);
  }

  // ========== PUMP MANAGEMENT COMMANDS ==========

  /**
   * Reading totals
   * Header: &T
   * @param {string} nozzle - Nozzle code (2 hex chars)
   * @param {string} mode - Command mode ($, L, l, N, U, P)
   */
  async readTotal(nozzle, mode) {
    const command = this.buildCommand("&T", `${nozzle}${mode}`);
    return await this.sendCommand(command);
  }

  /**
   * Price change
   * Header: &U
   * @param {string} nozzle - Nozzle code (2 hex chars)
   * @param {string} level - Price level (0=cash, 1=credit)
   * @param {string} price - Unit price (4 digits)
   */
  async changePrice(nozzle, level, price) {
    const priceStr = price.toString().padStart(4, "0");
    const command = this.buildCommand("&U", `${nozzle}${level}0${priceStr}`);
    return await this.sendCommand(command);
  }

  /**
   * Extended price change (6 digits)
   * Header: &U
   * @param {string} nozzle - Nozzle code (2 hex chars)
   * @param {string} level - Price level (0=cash, 1=credit, 2=debit)
   * @param {string} price - Unit price (6 digits)
   */
  async changePriceExtended(nozzle, level, price) {
    const priceStr = price.toString().padStart(6, "0");
    const command = this.buildCommand("&U", `${nozzle}${level}0${priceStr}`);
    return await this.sendCommand(command);
  }

  /**
   * Price reading
   * Header: &T
   * @param {string} nozzle - Nozzle code (2 hex chars)
   * @param {string} mode - U (2 levels) or u (3 levels)
   */
  async readPrice(nozzle, mode = "U") {
    const command = this.buildCommand("&T", `${nozzle}${mode}`);
    return await this.sendCommand(command);
  }

  /**
   * Value Preset - Authorize supply with maximum value
   * Header: &P
   * @param {string} nozzle - Nozzle code (2 hex chars)
   * @param {string} value - Preset value (6 digits)
   */
  async setPreset(nozzle, value) {
    const valueStr = value.toString().padStart(6, "0");
    const command = this.buildCommand("&P", `${nozzle}${valueStr}`);
    return await this.sendCommand(command);
  }

  /**
   * Preset identified
   * Header: ?F
   * @param {string} nozzle - Nozzle code (2 hex chars)
   * @param {string} identifier - Identifier (16 hex chars)
   * @param {string} identifierType - Type (0=attendant, 1=customer, 2=odometer)
   * @param {string} authorization - Authorization (S=yes, N=no)
   * @param {string} presetValue - Preset value (6 digits)
   * @param {string} timeout - Time until nozzle removal (2 digits)
   * @param {string} presetType - Type ($=money, V=volume)
   */
  async setPresetIdentified(
    nozzle,
    identifier,
    identifierType,
    authorization,
    presetValue,
    timeout,
    presetType
  ) {
    const valueStr = presetValue.toString().padStart(6, "0");
    const timeoutStr = timeout.toString().padStart(2, "0");
    const params = `${nozzle}P${identifier}${identifierType}${authorization}${valueStr}${timeoutStr}${presetType}00000`;
    const command = this.buildCommand("?F", params);
    return await this.sendCommand(command);
  }

  /**
   * Operating mode - Manage pump operating mode
   * Header: &M
   * @param {string} nozzle - Nozzle code (2 hex chars)
   * @param {string} mode - Mode (L=release, B=block, S=stop, A=authorize once, P=pause, H=enable sensor, I=disable sensor)
   */
  async setOperatingMode(nozzle, mode) {
    const command = this.buildCommand("&M", `${nozzle}${mode}`);
    return await this.sendCommand(command);
  }

  // ========== CLOCK COMMANDS ==========

  /**
   * Calendar reading
   * Header: &R
   */
  async readCalendar() {
    const command = "(&R)";
    return await this.sendCommand(command);
  }

  /**
   * Extended clock reading
   * Header: &KR1
   */
  async readClockExtended() {
    const command = this.buildCommand("&KR1");
    return await this.sendCommand(command);
  }

  /**
   * Calendar adjustment
   * Header: &H
   * @param {string} day - Day (2 digits)
   * @param {string} hour - Hour (2 digits)
   * @param {string} minute - Minute (2 digits)
   */
  async setCalendar(day, hour, minute) {
    const command = `(&H${day}${hour}${minute})`;
    return await this.sendCommand(command);
  }

  /**
   * Extended calendar adjustment
   * Header: &KW1
   * @param {string} year - Year (2 digits)
   * @param {string} month - Month (2 digits)
   * @param {string} day - Day (2 digits)
   * @param {string} weekday - Day of week (01-07)
   * @param {string} hour - Hour (2 digits)
   * @param {string} minute - Minute (2 digits)
   * @param {string} second - Second (2 digits)
   */
  async setCalendarExtended(year, month, day, weekday, hour, minute, second) {
    const params = `${year}${month}${day}${weekday}${hour}${minute}${second}`;
    const command = this.buildCommand("&KW1", params);
    return await this.sendCommand(command);
  }

  // ========== BLACKLIST COMMANDS ==========

  /**
   * Blacklist management
   * Header: &M99
   * @param {string} mode - Mode (c=clear, b=add, l=remove)
   * @param {string} identifier - Identifier code (16 hex chars, optional for clear)
   */
  async manageBlacklist(mode, identifier = "") {
    const command = this.buildCommand("&M99", `${mode}${identifier}`);
    return await this.sendCommand(command);
  }
}

// ========== EXAMPLE USAGE ==========

async function main() {
  // Read configuration from file or use defaults
  const host = "192.168.1.100"; // Change to your device IP
  const port = 2001; // Change to your device port

  const client = new CompanytecClient(host, port);

  try {
    // Connect to device
    await client.connect();

    console.log("\n=== EXAMPLE COMMANDS ===\n");

    // 1. Read device status
    console.log("1. Reading device status...");
    const status = await client.getStatus();
    console.log(`Status: ${status}\n`);

    // 2. Read calendar
    console.log("2. Reading calendar...");
    const calendar = await client.readCalendar();
    console.log(`Calendar: ${calendar}\n`);

    // 3. Read visualization (ongoing dispensing)
    console.log("3. Reading visualization...");
    const visualization = await client.getVisualization();
    console.log(`Visualization: ${visualization}\n`);

    // 4. Read totals for nozzle 08 (volume)
    console.log("4. Reading volume total for nozzle 08...");
    const totalVolume = await client.readTotal("08", "L");
    console.log(`Total Volume: ${totalVolume}\n`);

    // 5. Read price for nozzle 08
    console.log("5. Reading price for nozzle 08...");
    const price = await client.readPrice("08", "U");
    console.log(`Price: ${price}\n`);

    // 6. Read supply data (52 chars)
    console.log("6. Reading supply data...");
    const supply = await client.readSupply52();
    console.log(`Supply: ${supply}\n`);

    // 7. Example: Set operating mode (release pump 04)
    // Uncomment to test:
    // console.log('7. Releasing pump 04...');
    // const modeResult = await client.setOperatingMode('04', 'L');
    // console.log(`Mode Result: ${modeResult}\n`);

    // 8. Example: Set preset value
    // Uncomment to test:
    // console.log('8. Setting preset value...');
    // const presetResult = await client.setPreset('08', '001000');
    // console.log(`Preset Result: ${presetResult}\n`);

    // 9. Example: Change price
    // Uncomment to test:
    // console.log('9. Changing price...');
    // const priceChangeResult = await client.changePrice('08', '0', '1234');
    // console.log(`Price Change Result: ${priceChangeResult}\n`);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    // Disconnect
    client.disconnect();
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

// Export for use as module
module.exports = CompanytecClient;
