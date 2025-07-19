
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