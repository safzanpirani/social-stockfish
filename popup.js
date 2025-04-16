window.onload = () => {
  console.log("Window loaded");
  console.log("Chrome APIs available:", {
    tabs: typeof chrome.tabs !== "undefined",
    scripting: typeof chrome.scripting !== "undefined",
    chrome: typeof chrome !== "undefined",
  });

  // Add keyboard event handler for the textarea
  document.getElementById("chatGoal").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      if (!event.shiftKey) {
        event.preventDefault(); // Prevent default newline
        document.getElementById("clickMe").click(); // Trigger the start button
      }
      // If Shift+Enter, let the default behavior happen (newline)
    }
  });
};

document.getElementById("clickMe").addEventListener("click", async () => {
  try {
    const button = document.getElementById("clickMe");
    const loadingIndicator = document.getElementById("loading");
    const suggestionsDiv = document.getElementById("suggestions");
    const contextDiv = document.getElementById("analysis-context");

    // Clear previous results
    suggestionsDiv.innerHTML = "";
    contextDiv.innerHTML = "";

    // Show loading state
    button.disabled = true;
    loadingIndicator.style.display = "block";

    // Additional debugging
    if (!chrome.scripting) {
      throw new Error(
        "chrome.scripting api is not available. check manifest permissions.",
      );
    }

    // Query the active tab in the current window
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab) {
      throw new Error("no active tab found");
    }

    // Check if url is web.whatsapp.com
    if (!tab.url.includes("web.whatsapp.com")) {
      alert("please open whatsapp web to use this extension");
      return;
    }
    console.log("url is web.whatsapp.com");

    const chatGoal = document.getElementById("chatGoal").value.trim();
    const romanceMode = document.getElementById("romanceMode").checked;

    // Optional: Validate if chat goal is not empty
    if (!chatGoal) {
      alert("please enter your chat goal");
      return;
    }

    // Execute script in the active tab using chrome.scripting
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    });

    if (!results || !results[0]) {
      throw new Error("script execution failed to return results");
    }

    const messages = extractMessages(results[0].result);

    console.log("sending messages to background script:", messages);

    // Check if service worker is active
    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
      throw new Error("service worker not ready");
    }

    // Send messages to service worker for analysis
    const analysis = await new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      chrome.runtime.sendMessage(
        {
          type: "ANALYZE_CONVERSATION",
          messages,
          chatGoal,
          romanceMode,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        },
      );
    });

    console.log("received analysis:", analysis);

    // Display context
    if (analysis.context) {
      contextDiv.innerHTML = `
                <h3>context analysis</h3>
                <p>${analysis.context}</p>
            `;
    }

    // Display suggestions to user
    const suggestionsHtml = analysis.suggestions
      .map(
        (s, i) => `
                <div class="suggestion">
                    <h3>suggestion ${i + 1}</h3>
                    <p><strong>response:</strong> ${s.response}</p>
                    <p><strong>likely outcome:</strong> ${s.outcome}</p>
                    <p class="probability">success probability: ${s.probability}%</p>
                    <p class="reasoning"><strong>reasoning:</strong> ${s.reasoning}</p>
                </div>
            `,
      )
      .join("");

    suggestionsDiv.innerHTML = suggestionsHtml;
  } catch (error) {
    console.error("error:", error);
    alert("an error occurred: " + error.message);
  } finally {
    // Hide loading state
    document.getElementById("loading").style.display = "none";
    document.getElementById("clickMe").disabled = false;
  }
});

function extractMessages(html) {
  // Create a new dom parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Find the main container with tabindex="0" and role="application"
  const mainContainer = doc.querySelector(
    'div[tabindex="0"][role="application"]',
  );
  if (!mainContainer) {
    return [];
  }

  // Find all message containers
  const messageContainers = mainContainer.querySelectorAll('div[role="row"]');

  // Extract messages
  const messages = [];
  messageContainers.forEach((container) => {
    const messageIn = container.querySelector(".message-in");
    const messageOut = container.querySelector(".message-out");
    const message = messageIn || messageOut;

    if (message) {
      // Update sender extraction to handle empty span with aria-label
      const senderElement = message.querySelector("span[aria-label]");
      const sender = senderElement
        ? senderElement.getAttribute("aria-label")
        : "";
      let mockSender = "You";
      if (sender.includes("You")) {
        mockSender = "Our User";
      } else {
        mockSender = "Other User";
      }
      const textElement = message.querySelector(".selectable-text");
      const timeElement = message.querySelector(".x1rg5ohu");
      const text = textElement ? textElement.textContent.trim() : "";
      const time = timeElement ? timeElement.textContent.trim() : "";

      messages.push({
        sender: mockSender,
        text,
        time,
      });
    }
  });

  return messages;
}
