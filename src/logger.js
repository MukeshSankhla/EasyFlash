// logger.js
// Handles capturing and dispatching log messages to the UI log console and developer console.

let logs = [];
let listeners = [];

export const logger = {
  log(message) {
    this.addLog(message, "info");
  },
  
  info(message) {
    this.addLog(message, "info");
  },
  
  warn(message) {
    this.addLog(message, "warn");
  },
  
  error(message) {
    this.addLog(message, "error");
  },
  
  debug(message) {
    this.addLog(message, "debug");
  },
  
  addLog(message, type = "info") {
    // If the message is an object or array, stringify it
    const msgStr = typeof message === "object" ? JSON.stringify(message) : String(message);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEntry = { timestamp, message: msgStr, type };
    logs.push(logEntry);
    
    // Notify all subscribers
    listeners.forEach(callback => callback(logEntry, logs));
    
    // Also echo to developer console
    const consoleMsg = `[EasyFlasher] ${msgStr}`;
    if (type === "error") {
      console.error(consoleMsg);
    } else if (type === "warn") {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }
  },
  
  clear() {
    logs = [];
    listeners.forEach(callback => callback({ timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), message: "Console cleared", type: "system" }, logs));
  },
  
  getLogs() {
    return logs;
  },
  
  subscribe(callback) {
    listeners.push(callback);
    // Initialize subscriber with current log state
    callback(null, logs);
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  },
  
  // Custom terminal adapter for esptool-js IEspLoaderTerminal interface
  getTerminalAdapter() {
    return {
      clean: () => {
        this.clear();
      },
      writeLine: (data) => {
        this.log(data);
      },
      write: (data) => {
        if (data && data.trim()) {
          // Remove backspace characters or other terminal codes
          const cleaned = data.replace(/[\b\r]/g, "").trim();
          if (cleaned) {
            this.log(cleaned);
          }
        }
      }
    };
  }
};
