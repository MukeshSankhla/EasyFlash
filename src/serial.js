// serial.js
// Handles Web Serial connection, port requests, device lifecycle, and chip family detection.

import { ESPLoader, Transport } from "esptool-js";
import { logger } from "./logger.js";

let port = null;
let transport = null;
let esploader = null;
let deviceLostCallback = null;

export const serial = {
  /**
   * Checks if the Web Serial API is available in the current browser.
   * @returns {boolean}
   */
  checkBrowserSupport() {
    return typeof navigator !== "undefined" && "serial" in navigator;
  },

  /**
   * Requests a serial port from the browser.
   * Must be triggered directly by a user gesture.
   */
  async requestPort() {
    if (!this.checkBrowserSupport()) {
      throw new Error("Your browser doesn't support Web Serial. Please use Google Chrome, Microsoft Edge, or another Chromium-based browser.");
    }
    
    try {
      port = await navigator.serial.requestPort();
      logger.log("Serial port selected by user.");
      return port;
    } catch (error) {
      if (error.name === "NotFoundError" || error.message.includes("User cancelled")) {
        throw new Error("Permission Denied: No serial port selected.");
      }
      throw error;
    }
  },

  /**
   * Connects to the selected ESP32 device, synchronizes, and detects the chip family.
   * @param {number} baudRate - Connection baud rate (e.g. 115200, 921600)
   * @param {function} onDisconnect - Callback when device connection is lost
   * @returns {Promise<{chipName: string, esploader: ESPLoader}>}
   */
  async connectDevice(baudRate = 921600, onDisconnect = null) {
    if (!port) {
      throw new Error("No ESP32 Connected. Please select a port first.");
    }

    try {
      logger.log("Initializing Serial Transport layer...");
      // Initialize transport (port, tracing=false)
      transport = new Transport(port, false);
      
      // Register device lost callback
      deviceLostCallback = () => {
        logger.error("Serial Port Lost: Connection to the device was unplugged or interrupted.");
        if (onDisconnect) {
          onDisconnect();
        }
      };
      transport.setDeviceLostCallback(deviceLostCallback);

      logger.log("Connecting and syncing stub loader on ESP32...");
      
      const termAdapter = logger.getTerminalAdapter();
      esploader = new ESPLoader({
        transport: transport,
        baudrate: baudRate,
        terminal: termAdapter
      });

      // Establish sync and connection
      // 'default_reset' resets the board into flash mode (DTR/RTS toggling)
      await esploader.main("default_reset");
      
      // Get the detected chip family
      const chipName = esploader.chip ? esploader.chip.CHIP_NAME : "ESP32 (Generic)";
      logger.log(`Connected to target chip: ${chipName}`);
      
      return {
        chipName,
        esploader
      };
    } catch (error) {
      logger.error(`Failed to connect to ESP32: ${error.message}`);
      await this.disconnectDevice().catch(() => {});
      throw error;
    }
  },

  /**
   * Closes the active serial connections and resets state.
   */
  async disconnectDevice() {
    logger.log("Closing serial port...");
    
    if (transport) {
      try {
        // Clear callback
        transport.setDeviceLostCallback(null);
        await transport.disconnect();
      } catch (error) {
        logger.warn(`Error clean-disconnecting: ${error.message}`);
      }
      transport = null;
    }
    
    esploader = null;
    port = null;
    deviceLostCallback = null;
    logger.log("Serial port closed.");
  },

  /**
   * Checks if a device is currently connected.
   */
  isConnected() {
    return esploader !== null;
  },

  /**
   * Returns the active ESPLoader instance.
   */
  getLoader() {
    return esploader;
  }
};
