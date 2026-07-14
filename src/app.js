// app.js
// Main Application Entry Point. Coordinates UI routing, serial connection, downloading, flashing, and serial monitor.

import { projects } from "./config.js";
import { logger } from "./logger.js";
import { downloader } from "./downloader.js";
import { serial } from "./serial.js";
import { flasher } from "./flasher.js";
import { ui } from "./ui.js";

// Application State
let appState = {
  connection: "disconnected", // 'disconnected' | 'connecting' | 'connected'
  chipName: "",
  isFlashing: false,
  consoleCollapsed: false,
  fileStatuses: [],
  downloadedData: {}, // Cache downloaded binary arrays: { url: Uint8Array }
  currentProjectId: null,
  currentProject: null,
  
  // Serial Monitor State
  serialMonitorActive: false,
  monitorInterval: null,
  // Telemetry details fetched from connected board (simplified to Chip and MAC)
  boardDetails: {
    chip: "—",
    mac: "—"
  }
};

// Initialize App
window.addEventListener("DOMContentLoaded", () => {
  // Initialize UI DOM references
  ui.init();
  
  // Route to initial page view
  handleRouting();

  // Listen for hash route updates
  window.addEventListener("hashchange", handleRouting);
  
  // Check browser Web Serial support
  const isSupported = serial.checkBrowserSupport();
  ui.setBrowserSupported(isSupported);
  if (!isSupported) {
    logger.error("Web Serial API is not supported in this browser. Please use Chrome or Edge.");
  }
  
  // Bind Event Listeners
  bindEvents();
  
  // Subscribe UI to Logger updates & capture MAC address automatically from logs
  logger.subscribe((newEntry, allLogs) => {
    ui.updateConsoleLogs(allLogs);
    
    if (newEntry && newEntry.message) {
      // Look for logs like: "MAC: aa:bb:cc:dd:ee:ff"
      const macMatch = newEntry.message.match(/MAC:\s*([0-9a-fA-F:]{17})/i);
      if (macMatch) {
        const detectedMac = macMatch[1];
        appState.boardDetails.mac = detectedMac;
        if (ui.elements.modalBoardMac) {
          ui.elements.modalBoardMac.textContent = detectedMac;
        }
      }
    }
  });
  
  logger.log("Easy Flash initialized.");
});

/**
 * Handles browser hash-based routing.
 */
function handleRouting() {
  const hash = window.location.hash;
  const projectMatch = hash.match(/^#\/project\/([a-zA-Z0-9_-]+)$/);
  
  if (projectMatch) {
    const projectId = projectMatch[1];
    const project = projects.find(p => p.id === projectId);
    
    if (project) {
      appState.currentProjectId = projectId;
      appState.currentProject = project;
      
      ui.hideOverlays();
      ui.renderProjectPage(project);
      ui.showView("flasher");
      resetFileStatuses();
      
      // Start monitor if already connected
      if (serial.isConnected()) {
        startSerialMonitor();
      }
    } else {
      window.location.hash = "#/";
    }
  } else {
    // Default dashboard state
    appState.currentProjectId = null;
    appState.currentProject = null;
    ui.showView("dashboard");
  }
}

/**
 * Resets file statuses to initial 'Pending' state.
 */
function resetFileStatuses() {
  if (!appState.currentProject) return;

  const files = [
    {
      name: `${appState.currentProject.title} Firmware`,
      address: appState.currentProject.flashAddress,
      url: appState.currentProject.firmwareUrl
    }
  ];

  appState.fileStatuses = files.map(() => ({
    state: "Pending",
    sizeLabel: "—"
  }));
  ui.renderFilesTable(appState.fileStatuses);
}

/**
 * Starts the Serial Monitor reader loop by polling the esptool-js active read buffer.
 */
async function startSerialMonitor() {
  if (appState.serialMonitorActive) return;
  const esploader = serial.getLoader();
  if (!esploader || !esploader.transport) return;

  appState.serialMonitorActive = true;
  
  const transport = esploader.transport;
  const decoder = new TextDecoder();

  logger.log("Serial Monitor started.");

  // Clear any existing polling interval
  if (appState.monitorInterval) {
    clearInterval(appState.monitorInterval);
  }

  // Poll transport buffer every 50ms (non-blocking reader)
  appState.monitorInterval = setInterval(() => {
    if (!appState.serialMonitorActive) {
      if (appState.monitorInterval) {
        clearInterval(appState.monitorInterval);
        appState.monitorInterval = null;
      }
      return;
    }

    if (transport.buffer && transport.buffer.length > 0) {
      const chunk = transport.buffer;
      transport.flushInput(); // reset transport buffer count to 0
      
      try {
        const text = decoder.decode(chunk);
        ui.appendSerialRx(text, "rx");
      } catch (err) {
        // Safe catch for partial utf-8 sequences
      }
    }
  }, 50);
}

/**
 * Stops the Serial Monitor reader loop.
 */
function stopSerialMonitor() {
  appState.serialMonitorActive = false;
  if (appState.monitorInterval) {
    clearInterval(appState.monitorInterval);
    appState.monitorInterval = null;
  }
  logger.log("Serial Monitor stopped.");
}

/**
 * Sends user typed text (Tx) to the ESP32.
 */
async function sendSerialData() {
  const esploader = serial.getLoader();
  if (!esploader || !esploader.transport) {
    logger.error("Tx Failed: Serial port is not connected.");
    return;
  }

  const inputEl = ui.elements.serialTxInput;
  if (!inputEl) return;
  const text = inputEl.value;
  if (!text) return;

  const lineEnding = ui.elements.serialLineEnding ? ui.elements.serialLineEnding.value : "NL";
  let formattedText = text;
  if (lineEnding === "NL") formattedText += "\n";
  else if (lineEnding === "CR") formattedText += "\r";
  else if (lineEnding === "NLCR") formattedText += "\r\n";

  const encoder = new TextEncoder();
  const data = encoder.encode(formattedText);

  try {
    const transport = esploader.transport;
    if (transport && transport.device && transport.device.writable) {
      const writer = transport.device.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      
      // Echo input locally on the serial monitor
      ui.appendSerialRx(`[Tx] ${formattedText}`, "tx");
      
      // Clear input field
      inputEl.value = "";
    } else {
      logger.error("Failed to send serial data: Writable stream is not open.");
    }
  } catch (error) {
    logger.error(`Serial write error: ${error.message}`);
  }
}

/**
 * Queries target chip specifications and registers connection status.
 */
async function registerConnection(connectionInfo) {
  appState.connection = "connected";
  appState.chipName = connectionInfo.chipName;

  let chipDesc = connectionInfo.chipName;
  let macAddr = "—";

  try {
    const chip = connectionInfo.esploader.chip;
    const loader = connectionInfo.esploader;

    if (chip) {
      if (chip.getChipDescription) chipDesc = await chip.getChipDescription(loader);
      if (chip.readMac) {
        macAddr = await chip.readMac(loader);
      }
    }
  } catch (err) {
    logger.warn(`Could not read chip features: ${err.message}`);
  }

  appState.boardDetails = {
    chip: chipDesc,
    mac: macAddr
  };

  // Update UI with connection details
  ui.setConnectionState("connected", chipDesc);
  
  if (ui.elements.modalBoardChip) ui.elements.modalBoardChip.textContent = chipDesc;
  if (ui.elements.modalBoardMac) ui.elements.modalBoardMac.textContent = macAddr;
}

/**
 * Handles combined Connect & Flash or Flash action.
 */
async function handleFlashAction() {
  if (appState.isFlashing) return;
  
  if (!serial.isConnected()) {
    // Connect first, then flash automatically
    try {
      ui.setConnectionState("connecting");
      
      // Request Port (will prompt browser dialog)
      await serial.requestPort();
      
      // Get selected baud rate
      const baudVal = parseInt(ui.elements.baudRate.value, 10) || 921600;
      
      // Connect to device
      const connectionInfo = await serial.connectDevice(baudVal, handleDeviceLost);
      
      // Query advanced features and sync state
      await registerConnection(connectionInfo);
      
      // Reset files table
      resetFileStatuses();
      
      // Start serial monitor
      startSerialMonitor();
      
      // Start flashing immediately
      await startFlashingSequence();
      
    } catch (error) {
      stopSerialMonitor();
      appState.connection = "disconnected";
      appState.chipName = "";
      ui.setConnectionState("disconnected");
      
      let errMsg = error.message;
      if (errMsg.includes("Permission Denied")) {
        errMsg = "Permission Denied: Serial port selection was cancelled or access was rejected.";
      }
      ui.showError(errMsg);
    }
  } else {
    // Already connected, just run the flashing sequence
    await startFlashingSequence();
  }
}

/**
 * Handles explicit serial disconnection.
 */
async function handleDisconnectExplicit() {
  if (appState.isFlashing) return;
  
  stopSerialMonitor();
  ui.setConnectionState("disconnecting");
  await serial.disconnectDevice();
  appState.connection = "disconnected";
  appState.chipName = "";
  ui.setConnectionState("disconnected");
  resetFileStatuses();
}

/**
 * Handles connection toggling inside the Serial Monitor Modal directly.
 */
async function handleModalConnectToggle() {
  if (appState.isFlashing) return;

  if (!serial.isConnected()) {
    try {
      ui.setConnectionState("connecting");
      await serial.requestPort();
      const baudVal = parseInt(ui.elements.baudRate.value, 10) || 921600;
      const connectionInfo = await serial.connectDevice(baudVal, handleDeviceLost);

      // Register connection details
      await registerConnection(connectionInfo);

      resetFileStatuses();
      startSerialMonitor();
    } catch (error) {
      stopSerialMonitor();
      appState.connection = "disconnected";
      appState.chipName = "";
      ui.setConnectionState("disconnected");

      let errMsg = error.message;
      if (errMsg.includes("Permission Denied")) {
        errMsg = "Permission Denied: Serial port selection was cancelled or access was rejected.";
      }
      ui.showError(errMsg);
    }
  } else {
    await handleDisconnectExplicit();
  }
}

/**
 * Bind UI interactions to their handlers.
 */
function bindEvents() {
  const el = ui.elements;
  
  // Combined Connect & Flash Button
  if (el.flashBtn) {
    el.flashBtn.addEventListener("click", handleFlashAction);
  }
  
  // Explicit Disconnect Button
  if (el.disconnectBtn) {
    el.disconnectBtn.addEventListener("click", handleDisconnectExplicit);
  }

  // Baud Rate Select Synchronization (Header/Page & Modal)
  if (el.baudRate && el.modalBaudRate) {
    el.baudRate.addEventListener("change", () => {
      el.modalBaudRate.value = el.baudRate.value;
    });
    el.modalBaudRate.addEventListener("change", () => {
      el.baudRate.value = el.modalBaudRate.value;
    });
  }
  
  // Console Log Toggle
  if (el.consoleToggle) {
    el.consoleToggle.addEventListener("click", () => {
      appState.consoleCollapsed = !appState.consoleCollapsed;
      ui.setConsoleCollapsed(appState.consoleCollapsed);
    });
  }
  
  // Clear Console Logs
  if (el.clearLogsBtn) {
    el.clearLogsBtn.addEventListener("click", () => {
      logger.clear();
    });
  }
  
  // Copy Console Logs
  if (el.copyLogsBtn) {
    el.copyLogsBtn.addEventListener("click", () => {
      const logText = el.consoleLogArea ? el.consoleLogArea.value : "";
      if (logText) {
        navigator.clipboard.writeText(logText)
          .then(() => {
            const origSVG = el.copyLogsBtn.innerHTML;
            el.copyLogsBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="#10b981" stroke-width="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            `;
            setTimeout(() => {
              el.copyLogsBtn.innerHTML = origSVG;
            }, 1500);
          });
      }
    });
  }

  // Header Serial Monitor Popup Button
  if (el.headerSerialBtn) {
    el.headerSerialBtn.addEventListener("click", () => {
      ui.setSerialModalVisible(true);
    });
  }

  // Modal Connect / Disconnect Action
  if (el.modalConnectBtn) {
    el.modalConnectBtn.addEventListener("click", handleModalConnectToggle);
  }

  // Modal Close Button
  if (el.closeSerialModalBtn) {
    el.closeSerialModalBtn.addEventListener("click", () => {
      ui.setSerialModalVisible(false);
    });
  }

  // Close modal when clicking on dark backdrop
  if (el.serialModal) {
    el.serialModal.addEventListener("click", (e) => {
      if (e.target === el.serialModal) {
        ui.setSerialModalVisible(false);
      }
    });
  }

  // Close success modal when clicking backdrop
  const successModal = document.getElementById("success-modal");
  if (successModal) {
    successModal.addEventListener("click", (e) => {
      if (e.target === successModal) {
        ui.hideOverlays();
      }
    });
  }

  // Flash Success Modal: Done button
  const closeSuccessBtn = document.getElementById("close-success-btn");
  if (closeSuccessBtn) {
    closeSuccessBtn.addEventListener("click", () => {
      ui.hideOverlays();
      resetFileStatuses();
    });
  }

  // Serial Monitor: Send Tx Button
  if (el.serialTxBtn) {
    el.serialTxBtn.addEventListener("click", sendSerialData);
  }

  // Serial Monitor: Send on Enter key
  if (el.serialTxInput) {
    el.serialTxInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        sendSerialData();
      }
    });
  }

  // Serial Monitor: Clear Rx area
  if (el.clearSerialBtn) {
    el.clearSerialBtn.addEventListener("click", () => {
      if (el.serialRxArea) {
        el.serialRxArea.innerHTML = "";
      }
    });
  }

  // Serial Monitor: Copy Rx area
  if (el.copySerialBtn) {
    el.copySerialBtn.addEventListener("click", () => {
      const logText = el.serialRxArea ? el.serialRxArea.textContent : "";
      if (logText) {
        navigator.clipboard.writeText(logText)
          .then(() => {
            const origSVG = el.copySerialBtn.innerHTML;
            el.copySerialBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            `;
            setTimeout(() => {
              el.copySerialBtn.innerHTML = origSVG;
            }, 1500);
          });
      }
    });
  }
  
  // Error Retry
  if (el.errorRetryBtn) {
    el.errorRetryBtn.addEventListener("click", () => {
      ui.hideOverlays();
      handleFlashAction();
    });
  }
}

/**
 * Handles sudden serial port disconnections.
 */
function handleDeviceLost() {
  stopSerialMonitor();
  appState.connection = "disconnected";
  appState.chipName = "";
  appState.isFlashing = false;
  
  ui.setConnectionState("disconnected");
  ui.setFlashingState(false);
  ui.setProgressVisible(false);
  ui.showError("Serial Port Lost: The ESP32 device was disconnected. Please check your USB cable and reconnect.");
}

/**
 * Orchestrates the sequential download-and-flash procedure.
 */
async function startFlashingSequence() {
  const esploader = serial.getLoader();
  if (!esploader) {
    ui.showError("No ESP32 Connected. Please connect your device before flashing.");
    return;
  }

  if (!appState.currentProject) {
    ui.showError("No project selected.");
    return;
  }

  // Stop serial monitor reader to release port lock so esploader can write
  stopSerialMonitor();
  // Wait for monitor poll interval to fully stop
  await new Promise(r => setTimeout(r, 60));
  
  const files = [
    {
      name: `${appState.currentProject.title} Firmware`,
      address: appState.currentProject.flashAddress,
      url: appState.currentProject.firmwareUrl
    }
  ];

  appState.isFlashing = true;
  ui.setFlashingState(true);
  resetFileStatuses();
  
  let totalFirmwareBytes = 0;
  
  try {
    // Process files sequentially: Download -> Flash -> Verify
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Step 1: Downloading
      logger.log(`[File ${i+1}/${files.length}] Downloading ${file.name}...`);
      appState.fileStatuses[i].state = "Downloading...";
      ui.renderFilesTable(appState.fileStatuses);
      
      let binaryData = appState.downloadedData[file.url];
      
      if (!binaryData) {
        try {
          binaryData = await downloader.downloadFile(file.url, (downloaded, total) => {
            let percent = 0;
            let percentText = "";
            if (total > 0) {
              percent = (downloaded / total) * 100;
              percentText = `(${Math.round(percent)}%)`;
            }
            ui.setProgress(percent, "");
            appState.fileStatuses[i].state = `Downloading ${percentText}`;
            ui.renderFilesTable(appState.fileStatuses);
          });
          
          // Cache data so we don't redownload on subsequent flash retries
          appState.downloadedData[file.url] = binaryData;
        } catch (dlError) {
          appState.fileStatuses[i].state = "Failed";
          ui.renderFilesTable(appState.fileStatuses);
          throw new Error(`Failed to download firmware file (${file.name}): ${dlError.message}`);
        }
      } else {
        logger.log("Using cached binary.");
      }
      
      totalFirmwareBytes += binaryData.length;
      appState.fileStatuses[i].sizeLabel = ui.formatBytes(binaryData.length);
      appState.fileStatuses[i].state = "Downloaded";
      ui.renderFilesTable(appState.fileStatuses);
      
      // Step 2: Flashing
      ui.setProgress(0, "");
      appState.fileStatuses[i].state = "Flashing...";
      ui.renderFilesTable(appState.fileStatuses);
      
      try {
        await flasher.flashFile(esploader, binaryData, file.address, (written, total) => {
          let percent = 0;
          let percentText = "";
          if (total > 0) {
            percent = (written / total) * 100;
            percentText = `(${Math.round(percent)}%)`;
          }
          ui.setProgress(percent, "");
          appState.fileStatuses[i].state = `Flashing ${percentText}`;
          ui.renderFilesTable(appState.fileStatuses);
        });
        
        appState.fileStatuses[i].state = "Verified";
        ui.renderFilesTable(appState.fileStatuses);
        
      } catch (flashError) {
        appState.fileStatuses[i].state = "Failed";
        ui.renderFilesTable(appState.fileStatuses);
        throw flashError;
      }
    }
    
    // Complete download size update
    ui.updateTotalSize(totalFirmwareBytes);
    
    // Step 3: Device Reboot
    ui.setProgress(90, "");
    await flasher.resetDevice(esploader);
    
    ui.setProgress(100, "");
    logger.log("Flash completed successfully.");
    
    // Restart serial monitor reader loop
    if (serial.isConnected()) {
      startSerialMonitor();
    }
    
    // Smooth transition to Success Screen
    setTimeout(() => {
      ui.setProgressVisible(false);
      ui.setFlashingState(false);
      ui.showSuccess(appState.currentProject.version);
      appState.isFlashing = false;
    }, 1000);
    
  } catch (error) {
    logger.error(`Flash process aborted: ${error.message}`);
    ui.setProgressVisible(false);
    ui.setFlashingState(false);
    ui.showError(error.message);
    appState.isFlashing = false;
    
    // Restart serial monitor reader loop on failure as well
    if (serial.isConnected()) {
      startSerialMonitor();
    }
  }
}
