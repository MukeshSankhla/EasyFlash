// flasher.js
// Orchestrates writing binary files to the ESP32 chip flash memory and resetting the device.

import { logger } from "./logger.js";

export const flasher = {
  /**
   * Writes a single binary file buffer to a specific flash address.
   * @param {ESPLoader} esploader - The active ESPLoader instance.
   * @param {Uint8Array} data - The binary data buffer.
   * @param {string|number} address - The target hex address (e.g. "0x1000" or 0x1000).
   * @param {function} onProgress - Progress callback receiving (writtenBytes, totalBytes).
   * @returns {Promise<void>}
   */
  async flashFile(esploader, data, address, onProgress) {
    // Convert hex string to integer if necessary
    const addrVal = typeof address === "string" ? parseInt(address, 16) : address;
    
    if (isNaN(addrVal)) {
      throw new Error(`Invalid flash address: ${address}. Address must be a valid hex string (e.g. 0x1000).`);
    }

    logger.log(`Preparing to write flash at address ${address}...`);

    const options = {
      fileArray: [
        {
          data: data,
          address: addrVal
        }
      ],
      flashMode: "keep", // Keep original flash mode or let esptool decide
      flashSize: "keep", // Keep original flash size or let esptool decide
      flashFreq: "keep", // Keep original flash frequency
      eraseAll: false,   // Do not erase whole chip (only erase region to write)
      compress: true,    // Use compression for faster transfer
      reportProgress: (fileIndex, written, total) => {
        if (onProgress) {
          onProgress(written, total);
        }
      }
    };

    try {
      await esploader.writeFlash(options);
      logger.log(`Success: Flashed and verified memory region at ${address}.`);
    } catch (error) {
      logger.error(`Flashing failed at address ${address}: ${error.message}`);
      
      // Specialize checksum/verification errors
      if (error.message.includes("MD5") || error.message.includes("checksum") || error.message.includes("hash")) {
        throw new Error(`Checksum Error: Flash verification failed for address ${address}. The memory write might have been corrupted.`);
      }
      throw error;
    }
  },

  /**
   * Resets the ESP32 chip to run the newly flashed firmware.
   * @param {ESPLoader} esploader - The active ESPLoader instance.
   * @returns {Promise<void>}
   */
  async resetDevice(esploader) {
    if (!esploader) return;
    
    try {
      logger.log("Executing hard reset to boot into firmware...");
      const transport = esploader.transport;
      if (transport) {
        logger.log("Toggling RTS/DTR pins for hardware reset...");
        // Assert EN low (reset state)
        await transport.setRTS(true);
        await transport.setDTR(false);
        await new Promise(r => setTimeout(r, 200));
        
        // Assert EN high (boot state)
        await transport.setRTS(false);
        await new Promise(r => setTimeout(r, 100));
        logger.log("Hard reset pins toggled successfully.");
      } else {
        await esploader.after("hard_reset");
      }
      logger.log("Hard reset completed successfully.");
    } catch (error) {
      logger.warn(`Failed to complete device reset: ${error.message}`);
      // Fallback to standard loader reset
      try {
        await esploader.after("hard_reset");
      } catch (fallbackError) {
        logger.error(`Fallback reset failed: ${fallbackError.message}`);
      }
    }
  }
};
