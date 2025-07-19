
// This file no longer contains secrets. It provides configuration logic.
// The authentication is now handled via a token-fetching mechanism.

const AZURE_SPEECH_CONFIG = {
  region: 'brazilsouth',
  language: 'pt-BR',
};

/**
 * Creates and configures the Azure Speech SDK SpeechConfig object using a temporary auth token.
 * This function centralizes all speech service configuration.
 * @param token A short-lived authentication token from Azure Speech Services.
 * @returns A fully configured SpeechConfig object, or null if the SDK is not ready.
 */
export function getAzureSpeechConfig(token: string) {
    // Ensure the Microsoft SDK object is available on the window.
    if (typeof window.Microsoft === 'undefined' || !window.Microsoft.CognitiveServices?.Speech?.SpeechConfig) {
        console.error("Azure Speech SDK not loaded. Cannot create speech config.");
        return null;
    }

    const speechConfig = window.Microsoft.CognitiveServices.Speech.SpeechConfig.fromAuthorizationToken(
        token,
        AZURE_SPEECH_CONFIG.region
    );

    speechConfig.speechRecognitionLanguage = AZURE_SPEECH_CONFIG.language;

    // Future configurations can be added here easily.
    // e.g., speechConfig.enableDictation();
    
    return speechConfig;
}

/**
 * Fetches a temporary authentication token for the Azure Speech service.
 * This function should call your secure backend endpoint that generates the token.
 * @returns A promise that resolves to an object containing the token and region.
 */
export async function fetchAzureSpeechToken() {
    try {
        // The URL to your serverless function that provides the token
        const response = await fetch('/api/get-azure-speech-token');
        
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to fetch speech token. Status: ${response.status}. Body: ${errorBody}`);
        }
        
        const data = await response.json();
        
        if (!data.token || !data.region) {
            throw new Error("Invalid token data received from server.");
        }
        
        return {
            token: data.token,
            region: data.region,
        };
    } catch (error) {
        console.error("Error fetching Azure speech token:", error);
        // Re-throw the error to be handled by the calling function
        throw error;
    }
}