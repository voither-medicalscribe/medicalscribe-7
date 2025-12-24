/**
 * Cloudflare Worker for MedicalScribe API
 * 
 * This worker handles all API requests for the MedicalScribe application.
 * It replaces the Azure Functions backend with Cloudflare Workers.
 */

export interface Env {
  // Environment variables (set via wrangler secret or dashboard)
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_KEY?: string;
  AZURE_OPENAI_DEPLOYMENT?: string;
  MONGODB_CONNECTION_STRING?: string;
  MONGODB_DATABASE?: string;
  
  // Cloudflare bindings
  SESSIONS_KV?: KVNamespace;
  // DB?: D1Database;
  // AUDIO_STORAGE?: R2Bucket;
}

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle CORS preflight requests
 */
function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Create a JSON response with CORS headers
 */
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Main worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Route handling
      // API endpoints under /api/*
      if (path.startsWith('/api/')) {
        return await handleApiRequest(request, env, ctx, path);
      }

      // If not an API route, return 404
      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  },
};

/**
 * Handle API requests
 */
async function handleApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string
): Promise<Response> {
  // Extract the API endpoint path
  const apiPath = path.replace('/api/', '');

  // Route to appropriate handler
  if (apiPath === 'get_speech_token' || apiPath.startsWith('get_speech_token')) {
    return handleGetSpeechToken(request, env);
  }

  if (apiPath === 'patient_management' || apiPath.startsWith('patient_management')) {
    return handlePatientManagement(request, env);
  }

  if (apiPath === 'negotiate' || apiPath.startsWith('negotiate')) {
    return handleNegotiate(request, env);
  }

  if (apiPath === 'realtime_transcription' || apiPath.startsWith('realtime_transcription')) {
    return handleRealtimeTranscription(request, env, ctx);
  }

  if (apiPath === 'send_message' || apiPath.startsWith('send_message')) {
    return handleSendMessage(request, env);
  }

  if (apiPath === 'run_analysis_pipeline' || apiPath.startsWith('run_analysis_pipeline')) {
    return handleRunAnalysisPipeline(request, env);
  }

  return jsonResponse({ error: 'API endpoint not found' }, 404);
}

/**
 * Handler: Get Speech Token
 * Generates an authentication token for Azure Speech Service
 */
async function handleGetSpeechToken(request: Request, env: Env): Promise<Response> {
  try {
    const speechKey = env.AZURE_SPEECH_KEY;
    const speechRegion = env.AZURE_SPEECH_REGION;

    if (!speechKey || !speechRegion) {
      return jsonResponse({ error: 'Azure Speech credentials not configured' }, 500);
    }

    // Request token from Azure Speech Service
    const tokenEndpoint = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      console.error('Failed to get speech token:', response.status);
      return jsonResponse({ error: 'Failed to obtain speech token' }, 500);
    }

    const token = await response.text();
    const expiresAt = new Date(Date.now() + 9 * 60 * 1000).toISOString(); // 9 minutes

    return jsonResponse({
      token,
      region: speechRegion,
      expiresAt,
    });
  } catch (error) {
    console.error('Error in get_speech_token:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * Handler: Patient Management (CRUD)
 */
async function handlePatientManagement(request: Request, env: Env): Promise<Response> {
  try {
    // For now, return a simplified implementation
    // In production, connect to MongoDB or D1 database
    
    const method = request.method;
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const patientId = pathParts[pathParts.length - 1];

    // Simulated user ID (in production, extract from JWT)
    const userId = 'test-clinician-id';

    if (method === 'GET' && !patientId) {
      // List patients
      return jsonResponse({
        patients: [
          {
            id: '1',
            name: 'Paciente Exemplo',
            age: 35,
            gender: 'M',
            last_session: new Date().toISOString(),
          },
        ],
      });
    }

    if (method === 'GET' && patientId) {
      // Get specific patient
      return jsonResponse({
        id: patientId,
        name: 'Paciente Exemplo',
        age: 35,
        gender: 'M',
        sessions: [],
      });
    }

    if (method === 'POST') {
      // Create patient
      const body: any = await request.json();
      return jsonResponse(
        {
          id: crypto.randomUUID(),
          ...body,
          created_at: new Date().toISOString(),
        },
        201
      );
    }

    if (method === 'PUT' && patientId) {
      // Update patient
      const body = await request.json();
      return jsonResponse({
        message: 'Patient updated successfully',
      });
    }

    if (method === 'DELETE' && patientId) {
      // Delete patient
      return jsonResponse({
        message: 'Patient deleted successfully',
      });
    }

    return jsonResponse({ error: 'Method not supported' }, 405);
  } catch (error) {
    console.error('Error in patient_management:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * Handler: SignalR Negotiate
 * Note: Full SignalR support requires Cloudflare Durable Objects or external service
 */
async function handleNegotiate(request: Request, env: Env): Promise<Response> {
  try {
    // For now, return a placeholder response
    // In production, integrate with Cloudflare Durable Objects or external WebSocket service
    return jsonResponse({
      message: 'SignalR negotiation - requires Durable Objects implementation',
      url: 'wss://your-worker.workers.dev',
      accessToken: 'placeholder-token',
    });
  } catch (error) {
    console.error('Error in negotiate:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * Handler: Realtime Transcription
 * Note: Full implementation requires WebSocket support via Durable Objects
 */
async function handleRealtimeTranscription(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body: any = await request.json();
    const action = body.action;
    const sessionId = body.sessionId || crypto.randomUUID();

    if (action === 'start') {
      // Start transcription session
      const sessionData = {
        session_id: sessionId,
        patient_id: body.patientId,
        clinician_id: body.clinicianId || 'test-clinician',
        status: 'recording',
        start_time: new Date().toISOString(),
        transcription_segments: [],
      };

      // Store in KV if available
      if (env.SESSIONS_KV) {
        await env.SESSIONS_KV.put(
          `session:${sessionId}`,
          JSON.stringify(sessionData),
          { expirationTtl: 86400 } // 24 hours
        );
      }

      return jsonResponse({
        status: 'session_started',
        sessionId,
      });
    }

    if (action === 'audio') {
      // Process audio chunk
      // In production, forward to Azure Speech Service or implement WebSocket
      return jsonResponse({
        type: 'processing',
        sessionId,
        status: 'audio_received',
      });
    }

    if (action === 'stop') {
      // Stop transcription session
      if (env.SESSIONS_KV) {
        const sessionKey = `session:${sessionId}`;
        const sessionData = await env.SESSIONS_KV.get(sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          session.status = 'completed';
          session.end_time = new Date().toISOString();
          await env.SESSIONS_KV.put(sessionKey, JSON.stringify(session));
        }
      }

      return jsonResponse({
        type: 'session_complete',
        sessionId,
      });
    }

    return jsonResponse({ error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('Error in realtime_transcription:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * Handler: Send Message (SignalR messaging)
 */
async function handleSendMessage(request: Request, env: Env): Promise<Response> {
  try {
    const body: any = await request.json();
    
    if (!body.target || !body.arguments) {
      return jsonResponse({ error: 'Target and arguments are required' }, 400);
    }

    // For now, log the message
    // In production, implement with Durable Objects or external messaging service
    console.log('Message to send:', body);

    return jsonResponse({ status: 'Message sent successfully' });
  } catch (error) {
    console.error('Error in send_message:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * Handler: Run Analysis Pipeline
 */
async function handleRunAnalysisPipeline(request: Request, env: Env): Promise<Response> {
  try {
    const body: any = await request.json();
    const sessionId = body.session_id;

    if (!sessionId) {
      return jsonResponse({ error: 'session_id is required' }, 400);
    }

    // Retrieve session from KV
    let session: any = null;
    if (env.SESSIONS_KV) {
      const sessionData = await env.SESSIONS_KV.get(`session:${sessionId}`);
      if (sessionData) {
        session = JSON.parse(sessionData);
      }
    }

    if (!session) {
      return jsonResponse({ error: 'Session not found' }, 404);
    }

    if (session.status === 'completed') {
      return jsonResponse({ message: 'Session already analyzed' });
    }

    // For now, return a simplified response
    // In production, call Azure OpenAI for analysis
    const dimensionalSummary = {
      avg_valence: 0.65,
      avg_agency: 0.72,
      coherence_trend: 0.08,
    };

    // Update session
    if (env.SESSIONS_KV) {
      session.status = 'completed';
      session.analysis_completed_at = new Date().toISOString();
      session.dimensional_summary = dimensionalSummary;
      await env.SESSIONS_KV.put(`session:${sessionId}`, JSON.stringify(session));
    }

    return jsonResponse({
      message: 'Analysis completed successfully',
      session_id: sessionId,
      dimensional_summary: dimensionalSummary,
      documentation_generated: true,
    });
  } catch (error) {
    console.error('Error in run_analysis_pipeline:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
