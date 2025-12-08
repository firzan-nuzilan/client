/**
 * Companytec Client Configuration
 * 
 * Copy this file to config.js and update with your device settings
 */

module.exports = {
    // Device connection settings
    connection: {
        host: '192.168.1.100',  // IP address of Companytec device
        port: 2001,             // Port (1771 for older DLL, 2001 for newer)
        timeout: 5000           // Response timeout in milliseconds
    },

    // Nozzle configuration (optional, for reference)
    nozzles: {
        // Example nozzle mapping
        '01': { name: 'Pump 1 - Nozzle 1', fuel: 'Gasoline' },
        '02': { name: 'Pump 1 - Nozzle 2', fuel: 'Diesel' },
        '03': { name: 'Pump 2 - Nozzle 1', fuel: 'Gasoline' },
        '04': { name: 'Pump 2 - Nozzle 2', fuel: 'Ethanol' },
        '05': { name: 'Pump 3 - Nozzle 1', fuel: 'Gasoline' },
        '06': { name: 'Pump 3 - Nozzle 2', fuel: 'Diesel' },
        '07': { name: 'Pump 4 - Nozzle 1', fuel: 'Gasoline' },
        '08': { name: 'Pump 4 - Nozzle 2', fuel: 'Diesel' }
    },

    // Polling intervals (in milliseconds)
    polling: {
        status: 1000,           // Status check interval
        supply: 500,            // Supply reading interval
        visualization: 200      // Ongoing dispensing check interval
    },

    // Logging options
    logging: {
        enabled: true,
        showRawCommands: true,
        showTimestamps: true
    }
};

