
import { SYSTEM_PROMPT } from './voitherAi';
import type { ChatMessage } from '../types';

// Centralized error handler for fetch requests
async function handleApiResponse(response: Response) {
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("API Error:", response.status, errorBody);
    throw new Error(`O servidor retornou um erro ${response.status}: ${errorBody || response.statusText}`);
  }
  return response.json();
}

/**
 * Fetches a short-lived authentication token for Azure Speech Services from our backend.
 * @returns A promise that resolves to an object containing the token and region.
 */
export async function getAzureSpeechToken(): Promise<{ token: string; region: string }> {
  const response = await fetch('/api/get-azure-speech-token');
  return handleApiResponse(response);
}

/**
 * Calls the backend AI service (which proxies to Azure AI) for chat and other text generation tasks.
 * @param messages The array of messages for the chat history.
 * @returns The AI's response content as a string.
 */
async function callAIProxy(messages: { role: string; content: string }[]): Promise<string> {
    const response = await fetch('/api/chat-with-azure-ai', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'grok-3',
            messages,
            max_completion_tokens: 2048, 
            temperature: 1,
            top_p: 1,
        }),
    });

    const data = await handleApiResponse(response);
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        throw new Error("A IA retornou uma resposta inválida.");
    }

    return data.choices[0].message.content;
}


export async function generateSoapDocument(transcript: string): Promise<string> {
    const systemPrompt = `Você é um assistente de IA especializado em documentação médica. Sua tarefa é analisar a transcrição de uma consulta e gerar uma nota clínica no formato SOAP (Subjetivo, Objetivo, Avaliação, Plano). Responda APENAS com um objeto JSON contendo as chaves "subjective", "objective", "assessment", e "plan". Não adicione explicações ou texto extra.`;

    const userPrompt = `Com base na seguinte transcrição clínica, preencha a nota SOAP.\n\n# TRANSCRIÇÃO:\n${transcript}`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    try {
        const jsonString = await callAIProxy(messages);
        const cleanedJsonString = jsonString.replace(/```json\n?|```/g, '').trim();
        const soapData = JSON.parse(cleanedJsonString);
        return `SUBJETIVO:\n${soapData.subjective}\n\nOBJETIVO:\n${soapData.objective}\n\nAVALIAÇÃO:\n${soapData.assessment}\n\nPLANO:\n${soapData.plan}`;
    } catch (error) {
        console.error("AI Docs Generation Error:", error);
        throw new Error("A IA não conseguiu processar a transcrição para o formato SOAP.");
    }
}


export async function getChatResponse(chatHistory: ChatMessage[], transcript: string): Promise<string> {
    const transcriptContext = `CONTEXTO DA SESSÃO ATUAL (Transcrição):\n${transcript || "(Nenhuma transcrição disponível para esta sessão.)"}\n\n--- FIM DO CONTEXTO ---`;
    
    const systemMessage = { role: 'system', content: `${SYSTEM_PROMPT}\n\n${transcriptContext}` };

    const messagesForApi = [
        systemMessage,
        ...chatHistory.map(msg => ({ role: msg.role, content: msg.content }))
    ];

    try {
        return await callAIProxy(messagesForApi);
    } catch (error) {
        console.error("AI Chat Error:", error);
        throw new Error("A IA não conseguiu processar a pergunta do chat.");
    }
}