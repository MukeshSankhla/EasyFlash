// ui.js
// Handles DOM selection, visual state transitions, logs output, dashboard rendering, version switching, pipeline stepper, and table updates.

import { projects } from "./config.js";
import { 
  getProjectFlashCount, 
  getLocalFlashCount,
  subscribeProjectFlashCount, 
  subscribeAllProjectStats 
} from "./firebase.js";

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

/**
 * Helper to normalize and retrieve the list of firmwares for any project.
 * Supports both multi-firmware arrays and legacy single-firmware objects.
 */
export function getProjectFirmwares(project) {
  if (!project) return [];
  if (Array.isArray(project.firmwares) && project.firmwares.length > 0) {
    return project.firmwares;
  }
  return [
    {
      version: project.version || "v1.0.0",
      name: `${project.title} Firmware`,
      releaseDate: project.releaseDate || "—",
      firmwareUrl: project.firmwareUrl,
      flashAddress: project.flashAddress || "0x00",
      versionNote: project.versionNote || project.description || "Initial firmware build."
    }
  ];
}

export const ui = {
  elements: {},
  currentProject: null,
  currentStage: "idle",
  unsubProjectCount: null,
  unsubDashboardStats: null,

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
      projectHeaderBoard: document.getElementById("project-header-board"),
      projectHeaderDate: document.getElementById("project-header-date"),
      projectHeaderVersion: document.getElementById("project-header-version"),
      projectHeaderFlash: document.getElementById("project-header-flash"),
      projectPublishDate: document.getElementById("project-publish-date"),
      projectBoard: document.getElementById("project-board"),
      projectFlashCount: document.getElementById("project-flash-count"),
      projectAddress: document.getElementById("project-address"),
      projectDocLink: document.getElementById("project-doc-link"),
      projectGithubLink: document.getElementById("project-github-link"),
      
      // Firmware Version Selection & Release Notes
      fwVersionSelect: document.getElementById("fw-version-select"),
      fwSelectedBadge: document.getElementById("fw-selected-badge"),
      fwVersionNote: document.getElementById("fw-version-note"),
      fwReleaseDate: document.getElementById("fw-release-date"),
      
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
      
      // Flashing Station Stepper & Progress Panel
      flashingStationCard: document.getElementById("flashing-station-card"),
      flashStageBadge: document.getElementById("flash-stage-badge"),
      stepConnect: document.getElementById("step-connect"),
      stepDownload: document.getElementById("step-download"),
      stepFlash: document.getElementById("step-flash"),
      stepVerify: document.getElementById("step-verify"),
      stepComplete: document.getElementById("step-complete"),
      connector1: document.getElementById("connector-1"),
      connector2: document.getElementById("connector-2"),
      connector3: document.getElementById("connector-3"),
      connector4: document.getElementById("connector-4"),
      
      progressCard: document.getElementById("progress-container-inline"),
      progressBarFill: document.getElementById("progress-bar-fill"),
      progressPercent: document.getElementById("progress-percent"),
      progressText: document.getElementById("progress-text"),
      progressTargetName: document.getElementById("progress-target-name"),
      progressSubLeft: document.getElementById("progress-sub-left"),
      progressSubRight: document.getElementById("progress-sub-right"),
      
      // Single Action button
      flashBtn: document.getElementById("flash-btn"),
      flashBtnText: document.getElementById("flash-btn-text"),
      
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
      successVersionNote: document.getElementById("success-version-note"),
      successFlashCountBadge: document.getElementById("success-flash-count-badge"),
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
   * Renders the dashboard view project cards with multi-firmware badges and publish dates.
   */
  renderDashboard(projectsList) {
    const grid = this.elements.projectCardsGrid;
    if (!grid) return;
    grid.innerHTML = "";

    projectsList.forEach(project => {
      const card = document.createElement("div");
      card.className = "project-card";
      // Card Click Handler (Clean URL path navigation)
      card.addEventListener("click", () => {
        if (typeof this.onNavigate === "function") {
          this.onNavigate(`/project/${project.id}`);
        } else {
          window.history.pushState(null, "", `/EasyFlash/project/${project.id}`);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
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

      // Top Tag Row: Technical specs (Board, Version, Builds)
      const tagsTop = document.createElement("div");
      tagsTop.className = "project-card-tags";

      const boardBadge = document.createElement("span");
      boardBadge.className = "badge badge-board";
      boardBadge.textContent = project.compatibleBoard;
      tagsTop.appendChild(boardBadge);

      const firmwares = getProjectFirmwares(project);
      const latestFw = firmwares[0] || {};
      
      const versionBadge = document.createElement("span");
      versionBadge.className = "badge badge-version";
      versionBadge.textContent = latestFw.version || project.version || "v1.0.0";
      tagsTop.appendChild(versionBadge);

      if (firmwares.length > 1) {
        const countBadge = document.createElement("span");
        countBadge.className = "badge badge-count";
        countBadge.textContent = `${firmwares.length} Builds`;
        tagsTop.appendChild(countBadge);
      }

      // Clean Excerpt Description (plain text to avoid CSS line-clamp bullet distortion)
      const desc = document.createElement("div");
      desc.className = "project-card-desc";
      desc.textContent = getCleanExcerpt(project.description);

      // Bottom Footer Row: Date Bottom-Left, Flash Count Bottom-Right
      const footer = document.createElement("div");
      footer.className = "project-card-footer";

      const dateSpan = document.createElement("span");
      dateSpan.className = "card-footer-date";
      dateSpan.innerHTML = project.publishDate 
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7; margin-right: 3px; display: inline-block; vertical-align: -1px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>${project.publishDate}`
        : "—";

      const initialCount = getLocalFlashCount(project.id);
      const flashBadge = document.createElement("span");
      flashBadge.className = "badge badge-flash card-footer-flash";
      flashBadge.id = `badge-flash-${project.id}`;
      flashBadge.textContent = `⚡ ${initialCount} ${initialCount === 1 ? "Flash" : "Flashes"}`;

      footer.appendChild(dateSpan);
      footer.appendChild(flashBadge);

      content.appendChild(header);
      content.appendChild(tagsTop);
      content.appendChild(desc);
      content.appendChild(footer);

      card.appendChild(content);
      grid.appendChild(card);
    });

    // Real-time listener for all dashboard card flash counts
    if (this.unsubDashboardStats) {
      this.unsubDashboardStats();
    }
    this.unsubDashboardStats = subscribeAllProjectStats((statsMap) => {
      projectsList.forEach(p => {
        const badge = document.getElementById(`badge-flash-${p.id}`);
        if (badge) {
          const count = statsMap[p.id] || 0;
          badge.textContent = `⚡ ${count} ${count === 1 ? "Flash" : "Flashes"}`;
        }
      });
    });
  },

  /**
   * Renders a specific project flashing page.
   * @param {Object} project - The project object
   * @param {number} selectedIndex - The currently selected firmware index
   */
  renderProjectPage(project, selectedIndex = 0) {
    this.currentProject = project;

    // Set Text Contents
    if (this.elements.projectTitle) this.elements.projectTitle.textContent = project.title;
    if (this.elements.projectDesc) this.elements.projectDesc.innerHTML = parseDescription(project.description);
    if (this.elements.projectPublishDate) this.elements.projectPublishDate.textContent = project.publishDate || "—";
    if (this.elements.projectBoard) this.elements.projectBoard.textContent = project.compatibleBoard;
    
    // Header badges
    if (this.elements.projectHeaderBoard) this.elements.projectHeaderBoard.textContent = project.compatibleBoard;
    if (this.elements.projectHeaderDate) this.elements.projectHeaderDate.textContent = project.publishDate ? `Published: ${project.publishDate}` : "Latest";
    
    // Subscribe to live Firestore project flash count
    if (this.unsubProjectCount) {
      this.unsubProjectCount();
    }
    this.unsubProjectCount = subscribeProjectFlashCount(project.id, (count) => {
      const label = `⚡ ${count} ${count === 1 ? "Flash" : "Flashes"}`;
      if (this.elements.projectHeaderFlash) this.elements.projectHeaderFlash.textContent = label;
      if (this.elements.projectFlashCount) this.elements.projectFlashCount.textContent = `⚡ ${count}`;
    });

    // Project Doc Link
    if (this.elements.projectDocLink) {
      if (project.docLink) {
        const displayDoc = formatDisplayUrl(project.docLink);
        this.elements.projectDocLink.innerHTML = `<a href="${project.docLink}" target="_blank" rel="noopener noreferrer" title="${project.docLink}" class="spec-link"><span class="spec-link-text">${displayDoc}</span> <span class="spec-link-arrow">↗</span></a>`;
      } else {
        this.elements.projectDocLink.textContent = "—";
      }
    }

    // Firmware GitHub Link
    if (this.elements.projectGithubLink) {
      if (project.githubLink) {
        const displayGh = formatDisplayUrl(project.githubLink);
        this.elements.projectGithubLink.innerHTML = `<a href="${project.githubLink}" target="_blank" rel="noopener noreferrer" title="${project.githubLink}" class="spec-link"><span class="spec-link-text">${displayGh}</span> <span class="spec-link-arrow">↗</span></a>`;
      } else {
        this.elements.projectGithubLink.textContent = "—";
      }
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

    // Populate Firmware Version Selector dropdown
    const firmwares = getProjectFirmwares(project);
    const selectEl = this.elements.fwVersionSelect;
    if (selectEl) {
      selectEl.innerHTML = "";
      firmwares.forEach((fw, idx) => {
        const option = document.createElement("option");
        option.value = idx.toString();
        const namePart = fw.name ? ` — ${fw.name}` : "";
        const datePart = fw.releaseDate ? ` (${fw.releaseDate})` : "";
        option.textContent = `${fw.version}${namePart}${datePart}`;
        if (idx === selectedIndex) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      });
    }

    // Reset Stepper Pipeline to initial Idle state
    this.setFlowStage("idle");

    // Update active firmware details (specifications, notes, file list)
    this.updateSelectedFirmwareUI(project, selectedIndex);
  },

  /**
   * Updates firmware specifications, version notes, and files table when version is selected.
   * @param {Object} project - The current project
   * @param {number} selectedIndex - Index of the selected firmware
   */
  updateSelectedFirmwareUI(project, selectedIndex = 0) {
    const firmwares = getProjectFirmwares(project);
    const fw = firmwares[selectedIndex] || firmwares[0];
    if (!fw) return;

    if (this.elements.fwVersion) this.elements.fwVersion.textContent = fw.version;
    if (this.elements.fwSelectedBadge) this.elements.fwSelectedBadge.textContent = fw.version;
    if (this.elements.projectHeaderVersion) this.elements.projectHeaderVersion.textContent = fw.version;
    
    const flashAddr = fw.flashAddress || project.flashAddress || "0x00";
    if (this.elements.projectAddress) {
      this.elements.projectAddress.textContent = flashAddr;
      this.elements.projectAddress.style.fontFamily = "var(--font-mono)";
    }

    if (this.elements.fwReleaseDate) {
      this.elements.fwReleaseDate.textContent = fw.releaseDate || "Latest Build";
    }

    if (this.elements.fwVersionNote) {
      this.elements.fwVersionNote.innerHTML = parseDescription(fw.versionNote || "No specific version notes provided.");
    }

    if (this.elements.fwFileCount) this.elements.fwFileCount.textContent = "1 File";
    if (this.elements.fwTotalSize) this.elements.fwTotalSize.textContent = "Calculated after download";

    if (this.elements.progressTargetName) {
      this.elements.progressTargetName.textContent = fw.name || `${project.title} (${fw.version})`;
    }

    this.renderFilesTable([], fw);
  },

  /**
   * Sets the visual multi-step pipeline state and user feedback.
   * Stages: 'idle' | 'connecting' | 'downloading' | 'flashing' | 'verifying' | 'rebooting' | 'completed' | 'error'
   * @param {string} stage - Active flow stage
   * @param {Object} [details] - Optional contextual details (text, sub, targetName)
   */
  setFlowStage(stage, details = {}) {
    const el = this.elements;
    const steps = [el.stepConnect, el.stepDownload, el.stepFlash, el.stepVerify, el.stepComplete];
    const connectors = [el.connector1, el.connector2, el.connector3, el.connector4];

    // Helper to reset classes
    const resetStepper = () => {
      steps.forEach(s => { if (s) s.className = "step-item"; });
      connectors.forEach(c => { if (c) c.className = "step-connector"; });
    };

    this.currentStage = stage;

    if (stage === "idle") {
      resetStepper();
      if (el.progressBarFill) el.progressBarFill.className = "progress-bar-fill";
      if (el.flashStageBadge) {
        el.flashStageBadge.textContent = "Ready";
        el.flashStageBadge.className = "badge badge-stage stage-idle";
      }
      this.setProgressVisible(false);
      this.setProgress(0, "Ready");
      if (el.progressSubRight) el.progressSubRight.textContent = "Awaiting flash action";
    } else if (stage === "connecting") {
      resetStepper();
      if (el.progressBarFill) el.progressBarFill.className = "progress-bar-fill";
      if (el.stepConnect) el.stepConnect.className = "step-item active";
      if (el.flashStageBadge) {
        el.flashStageBadge.textContent = "Connecting";
        el.flashStageBadge.className = "badge badge-stage stage-active";
      }
      this.setProgressVisible(true);
      this.setProgress(15, details.text || "Connecting to ESP32 device...");
      if (el.progressSubRight) el.progressSubRight.textContent = details.sub || "Negotiating serial port...";
    } else if (stage === "downloading") {
      resetStepper();
      if (el.progressBarFill) el.progressBarFill.className = "progress-bar-fill";
      if (el.stepConnect) el.stepConnect.className = "step-item completed";
      if (el.connector1) el.connector1.className = "step-connector completed";
      if (el.stepDownload) el.stepDownload.className = "step-item active";
      if (el.flashStageBadge) {
        el.flashStageBadge.textContent = "Downloading";
        el.flashStageBadge.className = "badge badge-stage stage-active";
      }
      this.setProgressVisible(true);
      if (details.targetName && el.progressTargetName) el.progressTargetName.textContent = details.targetName;
      if (details.text) this.setProgress(0, details.text);
      if (details.sub && el.progressSubRight) el.progressSubRight.textContent = details.sub;
    } else if (stage === "flashing") {
      resetStepper();
      if (el.progressBarFill) el.progressBarFill.className = "progress-bar-fill";
      if (el.stepConnect) el.stepConnect.className = "step-item completed";
      if (el.connector1) el.connector1.className = "step-connector completed";
      if (el.stepDownload) el.stepDownload.className = "step-item completed";
      if (el.connector2) el.connector2.className = "step-connector completed";
      if (el.stepFlash) el.stepFlash.className = "step-item active";
      if (el.flashStageBadge) {
        el.flashStageBadge.textContent = "Flashing";
        el.flashStageBadge.className = "badge badge-stage stage-active";
      }
      this.setProgressVisible(true);
      if (details.text) this.setProgress(0, details.text);
      if (details.sub && el.progressSubRight) el.progressSubRight.textContent = details.sub;
    } else if (stage === "verifying") {
      resetStepper();
      if (el.stepConnect) el.stepConnect.className = "step-item completed";
      if (el.connector1) el.connector1.className = "step-connector completed";
      if (el.stepDownload) el.stepDownload.className = "step-item completed";
      if (el.connector2) el.connector2.className = "step-connector completed";
      if (el.stepFlash) el.stepFlash.className = "step-item completed";
      if (el.connector3) el.connector3.className = "step-connector completed";
      if (el.stepVerify) el.stepVerify.className = "step-item active";
      if (el.flashStageBadge) {
        el.flashStageBadge.textContent = "Verifying";
        el.flashStageBadge.className = "badge badge-stage stage-verifying";
      }
      this.setProgressVisible(true);
      if (el.progressBarFill) el.progressBarFill.className = "progress-bar-fill verifying";
      if (el.progressPercent) el.progressPercent.textContent = "Verifying...";
      if (el.progressText) el.progressText.textContent = details.text || "Verifying flash integrity (MD5 Checksum)...";
      if (el.progressSubRight) el.progressSubRight.textContent = details.sub || "Comparing memory blocks with source binary...";
    } else if (stage === "rebooting") {
      resetStepper();
      if (el.stepConnect) el.stepConnect.className = "step-item completed";
      if (el.connector1) el.connector1.className = "step-connector completed";
      if (el.stepDownload) el.stepDownload.className = "step-item completed";
      if (el.connector2) el.connector2.className = "step-connector completed";
      if (el.stepFlash) el.stepFlash.className = "step-item completed";
      if (el.connector3) el.connector3.className = "step-connector completed";
      if (el.stepVerify) el.stepVerify.className = "step-item completed";
      if (el.connector4) el.connector4.className = "step-connector completed";
      if (el.stepComplete) el.stepComplete.className = "step-item active";
      if (el.flashStageBadge) {
        el.flashStageBadge.textContent = "Rebooting";
        el.flashStageBadge.className = "badge badge-stage stage-active";
      }
      if (el.progressBarFill) el.progressBarFill.className = "progress-bar-fill completed";
      this.setProgress(98, details.text || "Rebooting device...", details.sub || "Toggling reset EN pin...");
    } else if (stage === "completed") {
      resetStepper();
      steps.forEach(s => { if (s) s.className = "step-item completed"; });
      connectors.forEach(c => { if (c) c.className = "step-connector completed"; });
      if (el.progressBarFill) el.progressBarFill.className = "progress-bar-fill completed";
      if (el.flashStageBadge) {
        el.flashStageBadge.textContent = "Completed";
        el.flashStageBadge.className = "badge badge-stage stage-success";
      }
      this.setProgress(100, "Firmware flashed and verified successfully!", "Device is running new build.");
    } else if (stage === "error") {
      if (el.progressBarFill) el.progressBarFill.className = "progress-bar-fill";
      if (el.flashStageBadge) {
        el.flashStageBadge.textContent = "Failed";
        el.flashStageBadge.className = "badge badge-stage stage-error";
      }
      if (el.progressSubRight) el.progressSubRight.textContent = "Execution halted.";
    }
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
   * @param {Object} [activeFirmware] - Selected firmware object
   */
  renderFilesTable(statuses = [], activeFirmware = null) {
    if (!this.elements.fwFilesBody || !this.currentProject) return;
    this.elements.fwFilesBody.innerHTML = "";

    const fw = activeFirmware || getProjectFirmwares(this.currentProject)[0];
    if (!fw) return;

    const files = [
      {
        name: fw.name || `${this.currentProject.title} (${fw.version})`,
        address: fw.flashAddress || this.currentProject.flashAddress || "0x00",
        url: fw.firmwareUrl
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
      
      if (el.flashBtnText) el.flashBtnText.textContent = "Connect & Flash";
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
      
      if (el.flashBtnText) el.flashBtnText.textContent = "Connecting...";
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
      
      if (el.flashBtnText) el.flashBtnText.textContent = "Flash Firmware";
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
      if (el.flashBtnText) el.flashBtnText.textContent = "Disconnecting...";
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
   * Sets progress bar fill, status label, and sub-details.
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} [text] - Main headline text
   * @param {string} [subText] - Secondary status detail
   */
  setProgress(percent, text = "", subText = "") {
    const el = this.elements;
    
    // If actively in verifying, rebooting, or completed stage, ignore late flashing progress calls
    if (this.currentStage === "verifying" || this.currentStage === "rebooting" || this.currentStage === "completed") {
      return;
    }

    const roundedPercent = Math.min(100, Math.max(0, Math.round(percent)));
    
    if (el.progressBarFill) el.progressBarFill.style.width = `${roundedPercent}%`;
    if (el.progressPercent) el.progressPercent.textContent = `${roundedPercent}%`;
    if (text && el.progressText) el.progressText.textContent = text;
    if (subText && el.progressSubRight) el.progressSubRight.textContent = subText;
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
   * Displays the success screen with Version.
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
      if (el.fwVersionSelect) el.fwVersionSelect.disabled = true;
      el.flashBtn.disabled = true;
      if (el.flashBtnText) el.flashBtnText.textContent = "Flashing...";
      el.baudRate.disabled = true;
      this.hideOverlays();
      this.setProgressVisible(true);
    } else {
      if (el.disconnectBtn) el.disconnectBtn.disabled = false;
      if (el.fwVersionSelect) el.fwVersionSelect.disabled = false;
      el.flashBtn.disabled = false;
      if (el.connStatusText && el.connStatusText.textContent === "Connected") {
        if (el.flashBtnText) el.flashBtnText.textContent = "Flash Firmware";
      } else {
        if (el.flashBtnText) el.flashBtnText.textContent = "Connect & Flash";
      }
    }
  }
};

/**
 * Simple parser to render description & version notes text supporting:
 * - '*' as bullet points (lines starting with '*' are grouped in a <ul>)
 * - '**bold**' as bold text
 * - '"bold"' (double quotes) as bold text
 */
export function parseDescription(text) {
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

/**
 * Extracts a clean, plain text paragraph for cards without list formatting
 * to avoid line-clamp CSS rendering glitches.
 */
export function getCleanExcerpt(text) {
  if (!text) return "";
  return text
    .split("\n")
    .map(line => line.replace(/^[\s*•-]+/, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/"([^"]+)"/g, "$1").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Formats a raw URL into a clean, display-friendly string (without https://www. prefixes).
 */
export function formatDisplayUrl(url) {
  if (!url) return "—";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return `${host}${parsed.pathname}`;
  } catch (e) {
    return url.replace(/^https?:\/\/(www\.)?/, "");
  }
}
