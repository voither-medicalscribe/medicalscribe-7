import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import fetch from "node-fetch";

app.http('get-azure-speech-token', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: getAzureSpeechToken
});

export async function getAzureSpeechToken(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    const speechKey = process.env.AZURE_SPEECH_KEY;
    const speechRegion = process.env.AZURE_SPEECH_REGION;

    if (!speechKey || !speechRegion) {
        return { status: 500, body: "Azure Speech credentials are not configured." };
    }

    try {
        const tokenUrl = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`;
        
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': speechKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const token = await response.text();
        return {
            status: 200,
            jsonBody: {
                token,
                region: speechRegion,
                endpoint: `https://${speechRegion}.stt.speech.microsoft.com`
            }
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        context.log('Error getting Azure Speech token:', errorMessage);
        return { status: 500, body: errorMessage };
    }
}