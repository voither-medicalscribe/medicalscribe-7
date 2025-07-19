

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import fetch from "node-fetch";

app.http('chat-with-azure-ai', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: chatWithAzureAI
});

export async function chatWithAzureAI(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // The full endpoint URL should be in the environment variable for security and flexibility.
    const endpoint = process.env.AZURE_AI_ENDPOINT;
    const apiKey = process.env.AZURE_AI_KEY;

    if (!endpoint || !apiKey) {
        context.log("ERROR: Azure AI credentials not configured in environment variables (AZURE_AI_ENDPOINT, AZURE_AI_KEY).");
        return { status: 500, body: "Azure AI credentials not configured." };
    }

    try {
        const requestBody = await request.json();

        // The backend function acts as a secure proxy.
        // It forwards the request body and adds authentication.
        const response = await fetch(endpoint, { // Assuming endpoint is the full URL
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'api-key': apiKey, // Some endpoints require this as well
            },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!response.ok) {
            context.log(`ERROR: Azure AI error: ${response.status}`, data);
            // Forward the error response from the AI service if possible
            return {
                status: response.status,
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' }
            };
        }
        
        return {
            status: 200,
            jsonBody: data
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        context.log('ERROR: Error in Azure AI chat proxy:', error);
        return { status: 500, body: errorMessage };
    }
};