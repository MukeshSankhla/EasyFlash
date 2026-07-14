// downloader.js
// Handles fetching binary firmware files from URLs with progress reporting and CORS error diagnosis.

export const downloader = {
  /**
   * Downloads a binary file from a URL with progress callbacks
   * @param {string} url - Target URL of the binary file
   * @param {function} onProgress - Progress callback receiving (downloadedBytes, totalBytes)
   * @returns {Promise<Uint8Array>} Resolved with binary data as Uint8Array
   */
  async downloadFile(url, onProgress) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      
      const contentLength = response.headers.get("content-length");
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (!response.body) {
        throw new Error("Response body is empty or readable streams are not supported.");
      }
      
      const reader = response.body.getReader();
      let receivedBytes = 0;
      const chunks = [];
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        chunks.push(value);
        receivedBytes += value.length;
        
        if (onProgress) {
          onProgress(receivedBytes, totalBytes);
        }
      }
      
      // Concatenate the chunks into a single Uint8Array
      const binaryData = new Uint8Array(receivedBytes);
      let position = 0;
      for (const chunk of chunks) {
        binaryData.set(chunk, position);
        position += chunk.length;
      }
      
      return binaryData;
    } catch (error) {
      // Enhance network/CORS error messages
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        throw new Error("Failed to download file. This is typically caused by CORS restrictions on the hosting server, or a network disconnection. Ensure your server permits CORS requests from your current domain.");
      }
      throw error;
    }
  },

  /**
   * Downloads multiple files and accumulates their total sizes and contents
   * @param {Array<{name: string, url: string, address: string}>} files - Configuration files list
   * @param {function} onFileStart - Callback when a file download begins (fileObj)
   * @param {function} onFileProgress - Callback during download (fileObj, downloadedBytes, totalBytes)
   * @param {function} onFileComplete - Callback when a file download is successful (fileObj, uint8Array)
   * @returns {Promise<{downloadedFiles: Array<{address: string, data: Uint8Array}>, totalSize: number}>}
   */
  async downloadAll(files, onFileStart, onFileProgress, onFileComplete) {
    const downloadedFiles = [];
    let totalSize = 0;
    
    for (const file of files) {
      if (onFileStart) onFileStart(file);
      
      const data = await this.downloadFile(file.url, (downloaded, total) => {
        if (onFileProgress) onFileProgress(file, downloaded, total);
      });
      
      totalSize += data.length;
      
      if (onFileComplete) onFileComplete(file, data);
      
      downloadedFiles.push({
        address: file.address,
        data: data,
        name: file.name
      });
    }
    
    return {
      downloadedFiles,
      totalSize
    };
  }
};
