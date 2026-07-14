// ui.js
// Handles DOM selection, visual state transitions, logs output, dashboard rendering, and table updates.

import { projects } from "./config.js";

/**
 * Utility to convert GitHub repository blob links to raw file content links
 * so that they can be loaded directly in <img> tags.
 */
function getRawImageUrl(url) {
  if (!url) return "";
  if (url.includes("github.com") && url.includes("/blob/")) {
    return url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
  }
  return url;
}

export const ui = {
  elements: {},
  currentProject: null,

  /**
   * Selects all necessary DOM nodes and performs initial rendering.
   */
  init() {
    this.elements = {
      // Compatibility notice
      compatNotice: document.getElementById("compat-notice"),
      
      // Views
      dashboardView: document.getElementById("dashboard-view"),
      flasherView: document.getElementById("flasher-view"),
      projectCardsGrid: document.getElementById("project-cards-grid"),
      
      // Project Header Card & Info
      projectHeaderCard: document.getElementById("project-header-card"),
      projectTitle: document.getElementById("project-title"),
      projectDesc: document.getElementById("project-desc"),
      projectBoard: document.getElementById("project-board"),
      projectAddress: document.getElementById("project-address"),
      projectDocLink: document.getElementById("project-doc-link"),
      projectGithubLink: document.getElementById("project-github-link"),
      
      // Global Serial Monitor Button & Popup Modal
      headerSerialBtn: document.getElementById("header-serial-btn"),
      serialModal: document.getElementById("serial-modal"),
      closeSerialModalBtn: document.getElementById("close-serial-modal-btn"),
      
      // Firmware Meta (standard selectors)
      fwVersion: document.getElementById("fw-version"),
      fwFileCount: document.getElementById("fw-file-count"),
      fwTotalSize: document.getElementById("fw-total-size"),
      fwFilesBody: document.getElementById("fw-files-body"),
      
      // Connection Panel
      connStatusText: document.getElementById("conn-status-text"),
      connStatusDot: document.getElementById("conn-status-dot"),
      chipName: document.getElementById("chip-name"),
      disconnectBtn: document.getElementById("disconnect-btn"),
      baudRate: document.getElementById("baud-rate"),
      
      // Progress Panel (Inline under flash button)
      progressCard: document.getElementById("progress-container-inline"),
      progressBarFill: document.getElementById("progress-bar-fill"),
      progressPercent: document.getElementById("progress-percent"),
      progressText: document.getElementById("progress-text"),
      
      // Single Action button
      flashBtn: document.getElementById("flash-btn"),
      
      // Logs Console
      consoleToggle: document.getElementById("console-toggle"),
      consoleToggleText: document.getElementById("console-toggle-text") || document.getElementById("console-toggle"),
      consoleLogArea: document.getElementById("console-log-area"),
      clearLogsBtn: document.getElementById("clear-logs-btn"),
      copyLogsBtn: document.getElementById("copy-logs-btn"),
      
      // Serial monitor inputs
      serialRxArea: document.getElementById("serial-rx-area"),
      serialTxInput: document.getElementById("serial-tx-input"),
      serialTxBtn: document.getElementById("serial-tx-btn"),
      clearSerialBtn: document.getElementById("clear-serial-btn"),
      copySerialBtn: document.getElementById("copy-serial-btn"),
      serialAutoscroll: document.getElementById("serial-autoscroll"),
      serialLineEnding: document.getElementById("serial-line-ending"),
      
      // Success Overlay Card (mapped to success-modal overlay)
      successCard: document.getElementById("success-modal"),
      successVersion: document.getElementById("success-version"),
      flashAgainBtn: document.getElementById("flash-again-btn"),

      // Modal connect & board detail elements
      modalConnectBtn: document.getElementById("modal-connect-btn"),
      modalBoardDetails: document.getElementById("modal-board-details"),
      modalBoardChip: document.getElementById("modal-board-chip"),
      modalBoardMac: document.getElementById("modal-board-mac"),
      modalBaudRate: document.getElementById("modal-baud-rate"),
      
      // Error Overlay Card
      errorCard: document.getElementById("error-card"),
      errorMessage: document.getElementById("error-message"),
      errorRetryBtn: document.getElementById("error-retry-btn"),
    };

    // Render projects list in dashboard
    this.renderDashboard(projects);
  },

  /**
   * Renders the dashboard view project cards.
   */
  renderDashboard(projectsList) {
    const grid = this.elements.projectCardsGrid;
    if (!grid) return;
    grid.innerHTML = "";

    projectsList.forEach(project => {
      const card = document.createElement("div");
      card.className = "project-card";
      card.addEventListener("click", () => {
        window.location.hash = `/project/${project.id}`;
      });

      // Cover Image (optional)
      if (project.coverImage) {
        const imgWrapper = document.createElement("div");
        imgWrapper.className = "project-card-image-wrapper";
        
        const img = document.createElement("img");
        img.className = "project-card-image";
        img.src = getRawImageUrl(project.coverImage);
        img.alt = `${project.title} Cover`;
        img.loading = "lazy";
        
        imgWrapper.appendChild(img);
        card.appendChild(imgWrapper);
      }

      // Card Content
      const content = document.createElement("div");
      content.className = "project-card-content";

      // Card Header (Title)
      const header = document.createElement("div");
      header.className = "project-card-header";
      
      const title = document.createElement("div");
      title.className = "project-card-title";
      title.textContent = project.title;

      header.appendChild(title);

      // Badges
      const badges = document.createElement("div");
      badges.className = "badge-group";

      const boardBadge = document.createElement("span");
      boardBadge.className = "badge badge-board";
      boardBadge.textContent = project.compatibleBoard;
      
      const versionBadge = document.createElement("span");
      versionBadge.className = "badge badge-version";
      versionBadge.textContent = project.version;

      badges.appendChild(boardBadge);
      badges.appendChild(versionBadge);

      // Description
      const desc = document.createElement("div");
      desc.className = "project-card-desc";
      desc.innerHTML = parseDescription(project.description);

      content.appendChild(header);
      content.appendChild(badges);
      content.appendChild(desc);

      card.appendChild(content);
      grid.appendChild(card);
    });
  },

  /**
   * Renders a specific project flashing page.
   */
  renderProjectPage(project) {
    this.currentProject = project;

    // Set Text Contents
    if (this.elements.projectTitle) this.elements.projectTitle.textContent = project.title;
    if (this.elements.projectDesc) this.elements.projectDesc.innerHTML = parseDescription(project.description);
    
    if (this.elements.fwVersion) this.elements.fwVersion.textContent = project.version;
    if (this.elements.projectBoard) this.elements.projectBoard.textContent = project.compatibleBoard;
    if (this.elements.projectAddress) {
      this.elements.projectAddress.textContent = project.flashAddress;
      this.elements.projectAddress.style.fontFamily = "var(--font-mono)";
    }
    
    // Project Doc Link
    if (this.elements.projectDocLink) {
      this.elements.projectDocLink.innerHTML = `<a href="${project.docLink}" target="_blank" rel="noopener noreferrer">${project.docLink} ↗</a>`;
    }

    // Firmware GitHub Link
    if (this.elements.projectGithubLink) {
      this.elements.projectGithubLink.innerHTML = `<a href="${project.githubLink}" target="_blank" rel="noopener noreferrer">${project.githubLink} ↗</a>`;
    }

    // Project Cover Image background on Header Card
    if (this.elements.projectHeaderCard) {
      if (project.coverImage) {
        const rawUrl = getRawImageUrl(project.coverImage);
        this.elements.projectHeaderCard.style.backgroundImage = `url('${rawUrl}')`;
        this.elements.projectHeaderCard.classList.add("has-bg");
      } else {
        this.elements.projectHeaderCard.style.backgroundImage = "";
        this.elements.projectHeaderCard.classList.remove("has-bg");
      }
    }

    // Render files table & counter
    if (this.elements.fwFileCount) this.elements.fwFileCount.textContent = "1 File";
    if (this.elements.fwTotalSize) this.elements.fwTotalSize.textContent = "Calculated after download";

    this.renderFilesTable();
  },

  /**
   * Toggles visibility of the Serial Monitor popup overlay modal.
   */
  setSerialModalVisible(visible) {
    const el = this.elements;
    if (!el.serialModal) return;
    if (visible) {
      el.serialModal.classList.remove("hidden");
      if (el.serialRxArea) {
        el.serialRxArea.scrollTop = el.serialRxArea.scrollHeight;
      }
      if (el.serialTxInput) el.serialTxInput.focus();
    } else {
      el.serialModal.classList.add("hidden");
    }
  },

  /**
   * Switches the active view on the UI.
   * @param {string} view - 'dashboard' | 'flasher'
   */
  showView(view) {
    if (view === "dashboard") {
      this.elements.dashboardView.classList.remove("hidden");
      this.elements.flasherView.classList.add("hidden");
      this.currentProject = null;
    } else if (view === "flasher") {
      this.elements.dashboardView.classList.add("hidden");
      this.elements.flasherView.classList.remove("hidden");
    }
  },

  /**
   * Renders files table with optional status states.
   * @param {Array<{state: string, sizeLabel: string}>} [statuses] - Current file-by-file states
   */
  renderFilesTable(statuses = []) {
    if (!this.elements.fwFilesBody || !this.currentProject) return;
    this.elements.fwFilesBody.innerHTML = "";

    const files = [
      {
        name: `${this.currentProject.title} Firmware`,
        address: this.currentProject.flashAddress,
        url: this.currentProject.firmwareUrl
      }
    ];

    files.forEach((file, index) => {
      const status = statuses[index] || { state: "Pending", sizeLabel: "—" };
      const tr = document.createElement("tr");

      // File label
      const tdName = document.createElement("td");
      tdName.textContent = file.name || `Binary ${index + 1}`;
      tdName.style.fontWeight = "500";

      // Hex address
      const tdAddr = document.createElement("td");
      tdAddr.textContent = file.address;
      tdAddr.style.fontFamily = "var(--font-mono)";
      tdAddr.style.fontSize = "13px";

      // File size
      const tdSize = document.createElement("td");
      tdSize.textContent = status.sizeLabel;

      // Status text
      const tdStatus = document.createElement("td");
      tdStatus.textContent = status.state;
      tdStatus.className = this.getStatusClass(status.state);

      tr.appendChild(tdName);
      tr.appendChild(tdAddr);
      tr.appendChild(tdSize);
      tr.appendChild(tdStatus);

      this.elements.fwFilesBody.appendChild(tr);
    });
  },

  /**
   * Gets visual utility classes for statuses.
   */
  getStatusClass(state) {
    if (state.includes("Downloading") || state.includes("Writing") || state.includes("Verifying") || state.includes("Flashing")) {
      return "animate-pulse";
    }
    return "";
  },

  /**
   * Formats raw bytes to human-readable size labels.
   */
  formatBytes(bytes) {
    if (bytes === 0 || isNaN(bytes)) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Date.now() / k); // arbitrary placeholder, not used
    const idx = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, idx)).toFixed(2)) + " " + sizes[idx];
  },

  /**
   * Sets the visual status of the browser support alert.
   */
  setBrowserSupported(supported) {
    if (this.elements.compatNotice) {
      if (supported) {
        this.elements.compatNotice.classList.add("hidden");
      } else {
        this.elements.compatNotice.classList.remove("hidden");
      }
    }
  },

  /**
   * Updates UI based on connection state transitions.
   * @param {string} state - 'disconnected' | 'connecting' | 'connected' | 'disconnecting'
   * @param {string} [chipName] - Detected chip name (e.g. 'ESP32-S3')
   */
  setConnectionState(state, chipName = "") {
    const el = this.elements;
    if (!el.connStatusText || !el.connStatusDot || !el.flashBtn) return;

    if (state === "disconnected") {
      el.connStatusText.textContent = "Disconnected";
      el.connStatusDot.className = "status-dot disconnected";
      if (el.chipName) el.chipName.textContent = "None detected";
      
      el.flashBtn.textContent = "Connect & Flash";
      el.flashBtn.disabled = false;
      
      if (el.disconnectBtn) el.disconnectBtn.classList.add("hidden");
      el.baudRate.disabled = false;
      if (el.modalBaudRate) el.modalBaudRate.disabled = false;

      // Modal connection controls sync
      if (el.modalConnectBtn) {
        el.modalConnectBtn.textContent = "Connect";
        el.modalConnectBtn.className = "btn btn-primary";
        el.modalConnectBtn.disabled = false;
      }
      if (el.modalBoardDetails) {
        el.modalBoardDetails.classList.add("hidden");
      }
    } else if (state === "connecting") {
      el.connStatusText.textContent = "Connecting...";
      el.connStatusDot.className = "status-dot";
      if (el.chipName) el.chipName.textContent = "Detecting...";
      
      el.flashBtn.textContent = "Connecting...";
      el.flashBtn.disabled = true;
      
      if (el.disconnectBtn) el.disconnectBtn.classList.add("hidden");
      el.baudRate.disabled = true;
      if (el.modalBaudRate) el.modalBaudRate.disabled = true;

      // Modal connection controls sync
      if (el.modalConnectBtn) {
        el.modalConnectBtn.textContent = "Connecting...";
        el.modalConnectBtn.disabled = true;
      }
    } else if (state === "connected") {
      el.connStatusText.textContent = "Connected";
      el.connStatusDot.className = "status-dot connected";
      if (el.chipName) el.chipName.textContent = chipName || "ESP32 (Generic)";
      
      el.flashBtn.textContent = "Flash Firmware";
      el.flashBtn.disabled = false;
      
      if (el.disconnectBtn) {
        el.disconnectBtn.classList.remove("hidden");
        el.disconnectBtn.disabled = false;
      }
      el.baudRate.disabled = true;
      if (el.modalBaudRate) el.modalBaudRate.disabled = true;

      // Modal connection controls sync
      if (el.modalConnectBtn) {
        el.modalConnectBtn.textContent = "Disconnect";
        el.modalConnectBtn.className = "btn btn-error";
        el.modalConnectBtn.disabled = false;
      }
      if (el.modalBoardDetails) {
        el.modalBoardDetails.classList.remove("hidden");
        if (el.modalBoardChip) el.modalBoardChip.textContent = chipName || "ESP32 (Generic)";
      }
    } else if (state === "disconnecting") {
      el.connStatusText.textContent = "Disconnecting...";
      el.flashBtn.textContent = "Disconnecting...";
      el.flashBtn.disabled = true;
      if (el.disconnectBtn) el.disconnectBtn.disabled = true;
      if (el.modalBaudRate) el.modalBaudRate.disabled = true;

      // Modal connection controls sync
      if (el.modalConnectBtn) {
        el.modalConnectBtn.textContent = "Disconnecting...";
        el.modalConnectBtn.disabled = true;
      }
    }
  },

  /**
   * Updates total size metadata.
   */
  updateTotalSize(bytes) {
    if (this.elements.fwTotalSize) {
      this.elements.fwTotalSize.textContent = this.formatBytes(bytes);
    }
  },

  /**
   * Sets progress bar fill and status labels.
   */
  setProgress(percent, text) {
    const el = this.elements;
    const roundedPercent = Math.min(100, Math.max(0, Math.round(percent)));
    
    if (el.progressBarFill) el.progressBarFill.style.width = `${roundedPercent}%`;
    if (el.progressPercent) el.progressPercent.textContent = `${roundedPercent}%`;
    if (el.progressText) el.progressText.textContent = text;
  },

  /**
   * Toggles visibility of progress card.
   */
  setProgressVisible(visible) {
    if (this.elements.progressCard) {
      if (visible) {
        this.elements.progressCard.classList.remove("hidden");
      } else {
        this.elements.progressCard.classList.add("hidden");
      }
    }
  },

  /**
   * Toggles visibility of the log console text area.
   */
  setConsoleCollapsed(collapsed) {
    const el = this.elements;
    const consoleTextarea = document.getElementById("console-log-area");
    if (!consoleTextarea || !el.consoleToggle) return;

    if (collapsed) {
      consoleTextarea.classList.add("hidden");
    } else {
      consoleTextarea.classList.remove("hidden");
      this.scrollToBottom();
    }
  },

  /**
   * Appends raw serial received data (Rx/Tx) to the monitor log element.
   * @param {string} text - Message chunk
   * @param {string} [type] - 'rx' | 'tx'
   */
  appendSerialRx(text, type = "rx") {
    const el = this.elements.serialRxArea;
    if (!el) return;
    
    const span = document.createElement("span");
    span.textContent = text;
    if (type === "tx") {
      span.style.color = "#4ade80"; // Emerald green for Tx
    } else {
      span.style.color = "#38bdf8"; // Cyan blue for Rx
    }
    
    el.appendChild(span);
    
    const autoscroll = this.elements.serialAutoscroll;
    if (autoscroll && autoscroll.checked) {
      el.scrollTop = el.scrollHeight;
    }
  },

  /**
   * Appends log messages to the console log textarea.
   */
  updateConsoleLogs(logsList) {
    if (!this.elements.consoleLogArea) return;
    
    const formattedText = logsList
        .map(entry => `[${entry.timestamp}] ${entry.message}`)
        .join("\n");
      
    this.elements.consoleLogArea.value = formattedText;
    this.scrollToBottom();
  },

  scrollToBottom() {
    if (this.elements.consoleLogArea) {
      this.elements.consoleLogArea.scrollTop = this.elements.consoleLogArea.scrollHeight;
    }
  },

  /**
   * Displays the success screen.
   */
  showSuccess(version) {
    this.hideOverlays();
    if (this.elements.successCard) {
      this.elements.successCard.classList.remove("hidden");
      if (this.elements.successVersion) {
        this.elements.successVersion.textContent = version || (this.currentProject ? this.currentProject.version : "—");
      }
      this.elements.successCard.scrollIntoView({ behavior: "smooth" });
    }
  },

  /**
   * Displays the error card.
   */
  showError(message) {
    this.hideOverlays();
    if (this.elements.errorCard) {
      this.elements.errorCard.classList.remove("hidden");
      if (this.elements.errorMessage) {
        this.elements.errorMessage.textContent = message || "An unexpected error occurred.";
      }
      this.elements.errorCard.scrollIntoView({ behavior: "smooth" });
    }
  },

  /**
   * Hides success and error panels.
   */
  hideOverlays() {
    if (this.elements.successCard) this.elements.successCard.classList.add("hidden");
    if (this.elements.errorCard) this.elements.errorCard.classList.add("hidden");
  },

  /**
   * Set inputs to disabled during action sequence (e.g. flashing).
   */
  setFlashingState(isFlashing) {
    const el = this.elements;
    if (isFlashing) {
      if (el.disconnectBtn) el.disconnectBtn.disabled = true;
      el.flashBtn.disabled = true;
      el.flashBtn.textContent = "Flashing...";
      el.baudRate.disabled = true;
      this.hideOverlays();
      this.setProgressVisible(true);
      this.setProgress(0, "Starting flash process...");
    } else {
      if (el.disconnectBtn) el.disconnectBtn.disabled = false;
      el.flashBtn.disabled = false;
      if (el.connStatusText && el.connStatusText.textContent === "Connected") {
        el.flashBtn.textContent = "Flash Firmware";
      } else {
        el.flashBtn.textContent = "Connect & Flash";
      }
    }
  }
};

/**
 * Simple parser to render description text supporting:
 * - '*' as bullet points (lines starting with '*' are grouped in a <ul>)
 * - '**bold**' as bold text
 * - '"bold"' (double quotes) as bold text
 */
function parseDescription(text) {
  if (!text) return "";
  
  const lines = text.split("\n");
  let html = "";
  let inList = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parse bold text replacements:
    // 1. **bold** -> <strong>bold</strong>
    // 2. "bold" -> <strong>"bold"</strong>
    let parsed = trimmed
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/"([^"]+)"/g, '<strong>"$1"</strong>');

    if (trimmed.startsWith("*")) {
      let bulletContent = trimmed.substring(1).trim();
      bulletContent = bulletContent
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/"([^"]+)"/g, '<strong>"$1"</strong>');

      if (!inList) {
        html += '<ul class="desc-list" style="margin-left: 20px; margin-top: 4px; margin-bottom: 4px; list-style-type: disc;">';
        inList = true;
      }
      html += `<li style="margin-bottom: 2px; font-size: 13px;">${bulletContent}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<p style="margin-bottom: 4px; font-size: 13px; line-height: 1.5;">${parsed}</p>`;
    }
  }

  if (inList) {
    html += "</ul>";
  }

  return html;
}
