# Social Stockfish

A Chrome Extension that analyzes your WhatsApp Web conversations using AI (Gemini Flash via Google AI Studio) to help guide the chat towards achieving a specific, user-defined goal.

## Project Structure

This project consists of the following main files:

*   `manifest.json`: The extension manifest file defining metadata, permissions, and components.
*   `background.js`: Handles background tasks and event handling for the extension.
*   `background-wrapper.js`: A wrapper for the background script.
*   `popup.html` / `popup.js`: Defines the structure and behavior of the extension's popup interface.
*   `service-worker.js`: Modern replacement for background scripts in Manifest V3 extensions.
*   `ai-service.js`: Suggests integration with an AI service, possibly for analysis or interaction.
*   `config.js`: Configuration file for the extension, requires user setup.

## Configuration

Before using the extension, you need to configure your Google AI Studio API key:

1.  Open the `config.js` file in the project directory.
2.  Replace `"<insert key here>"` with your actual Gemini API key obtained from Google AI Studio.
    ```javascript
    // config.js
    export const CONFIG = {
      GEMINI_API_KEY: "YOUR_ACTUAL_API_KEY_HERE", 
      // ... other config settings
    };
    ```
3.  Save the `config.js` file.
4.  Reload the extension in `chrome://extensions/` if it's already loaded.

## Installation

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" in the top right corner.
4.  Click "Load unpacked".
5.  Select the directory containing the cloned/downloaded project files.

## Usage

1.  Ensure you are logged into [WhatsApp Web](https://web.whatsapp.com/) and have a chat open.
2.  Click the extension icon in your Chrome toolbar to open the popup.
3.  In the popup, enter your objective for the current conversation in the text area (e.g., "Arrange a meeting," "Understand their feelings," "De-escalate the conflict").
4.  (Optional) Toggle the "Romantic" switch if you want the AI suggestions optimized for romantic interactions.
5.  Click the "Delve" button.
6.  The extension will read the recent messages, send them along with your goal to the Gemini API via Google AI Studio, and display the analysis and suggested responses in the popup.