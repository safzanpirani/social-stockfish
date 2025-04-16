import { CONFIG } from "./config.js";

// Log when service worker is installed
self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  self.skipWaiting(); // Ensure the service worker activates immediately
});

// Log when service worker is activated
self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(clients.claim()); // Take control of all clients
});

// Handle messages from popup
self.addEventListener("message", (event) => {
  console.log("Service Worker received message:", event.data);
});

// Handle runtime messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Runtime message received:", request);

  if (request.type === "ANALYZE_CONVERSATION") {
    handleAnalysisRequest(request)
      .then(sendResponse)
      .catch((error) => {
        console.error("Full error details:", {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
        });
        sendResponse({
          error: `${error.message} - ${error.cause || "No additional details"}`,
        });
      });
    return true; // Keep the message channel open
  }
});

async function handleAnalysisRequest(request) {
  try {
    console.log("Processing analysis request:", {
      messageCount: request.messages.length,
      goal: request.chatGoal,
    });

    const analysis = await analyzeConversation(
      request.messages,
      request.chatGoal,
      request.romanceMode,
    );
    console.log("Analysis complete:", analysis);
    return analysis;
  } catch (error) {
    console.error("Analysis error:", error);
    throw error;
  }
}

async function analyzeConversation(messages, chatGoal, romanceMode) {
  try {
    const conversationHistory = messages
      .map((m) => `${m.sender}: ${m.text}`)
      .join("\n");

    const personalityInstructions = romanceMode ? 
      `You should optimize responses for romantic intentions and flirty behavior. Make suggestions that help build romantic connection and chemistry, while maintaining authenticity.` :
      `Maintain a balanced professional yet informal tone that builds rapport while staying focused on the conversation goals.`;

    const prompt = `
Given this conversation history:
${conversationHistory}

And the user's goal: ${chatGoal}

Personality Instructions: ${personalityInstructions}

Analyze the conversation and suggest the next 3 most effective responses.
Provide your response in JSON format strictly in the following JSON format:

{
    "analysis": {
        "context": "Brief analysis of the current conversation state",
        "suggestions": [
            {
                "response": "Suggested message text",
                "outcome": "Expected outcome of this response",
                "probability": 85,
                "reasoning": "Why this response would be effective"
            }
        ]
    }
}

Ensure each suggestion includes all fields and probability is a number between 0-100.
Do not include any other text or formatting in your response except for the JSON format.
`;

    console.log("Preparing API request with config:", {
      apiKey: CONFIG.GEMINI_API_KEY ? "Present" : "Missing",
      historyLength: conversationHistory.length,
      promptLength: prompt.length,
    });

    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1000,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    console.log(
      "Sending request to Google AI API with body:",
      JSON.stringify(requestBody, null, 2),
    );

    const headers = new Headers({
      "Content-Type": "application/json",
    });

    // Log headers to verify they're set
    console.log("Request headers:", [...headers.entries()]);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
      {
        method: "POST",
        mode: "cors", // Explicitly set CORS mode
        credentials: "omit", // Don't send credentials
        headers: headers,
        body: JSON.stringify(requestBody),
      },
    );

    // Log response headers
    console.log("Response headers:", [...response.headers.entries()]);

    const responseText = await response.text(); // Get raw response text
    console.log("Raw API Response:", responseText);

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
        {
          cause: responseText,
        },
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error("Failed to parse API response", {
        cause: `Status: ${response.status}, Raw response: ${responseText}`,
      });
    }

    console.log("Parsed API response:", data);
    return parseAnalysis(data);
  } catch (error) {
    console.error("Detailed error in analyzeConversation:", {
      message: error.message,
      cause: error.cause,
      stack: error.stack,
    });
    throw error;
  }
}

function parseAnalysis(apiResponse) {
  try {
    console.log("Parsing analysis from response:", apiResponse);
    
    if (!apiResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("Invalid API response structure", {
        cause: `Response: ${JSON.stringify(apiResponse)}`
      });
    }

    // Get the raw text from the API response
    let rawText = apiResponse.candidates[0].content.parts[0].text;
    console.log("Original API response text:", rawText);

    // Remove markdown code block formatting (```json and ```)
    const cleanText = rawText.replace(/^```json\s*|\s*```$/g, '').trim();
    console.log("Cleaned response text:", cleanText);

    // Parse the cleaned JSON string
    const analysisData = JSON.parse(cleanText);
    console.log("Parsed analysis data:", JSON.stringify(analysisData, null, 2));

    if (!analysisData.analysis?.suggestions) {
      throw new Error("Invalid analysis structure");
    }

    return {
      context: analysisData.analysis.context,
      suggestions: analysisData.analysis.suggestions.map((suggestion) => ({
        response: suggestion.response || "",
        outcome: suggestion.outcome || "",
        probability: suggestion.probability || 0,
        reasoning: suggestion.reasoning || ""
      }))
    };
  } catch (error) {
    console.error("Error parsing analysis:", {
      message: error.message,
      cause: error.cause,
      response: apiResponse
    });
    throw new Error("Failed to parse analysis results", { cause: error.message });
  }
}
