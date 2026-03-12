/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "./index.css";

console.log(
  '👋 This message is being logged by "renderer.ts", included via Vite',
);

document.addEventListener("dragover", (event) => {
  event.preventDefault(); // Prevent default to allow drop
});

document.addEventListener("drop", (event) => {
  event.preventDefault(); // Prevent default to avoid browser opening the file
  console.log(event);
  if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    // Access the dropped files using event.dataTransfer.files
    const files = event.dataTransfer.files;
    for (const file of files) {
      console.log("Dropped file path:", file); // Use Node.js fs module in main process
      // You may want to send the file path to the main process via IPC
    }
  }
});
