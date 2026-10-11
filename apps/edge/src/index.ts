import { RoomDO } from './room-do';

export { RoomDO };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    // Route API requests
    if (url.pathname.startsWith('/api/rooms')) {
      return handleRooms(request, env);
    }
    
    if (url.pathname.startsWith('/api/ice')) {
      return handleICE(request, env);
    }
    
    if (url.pathname.startsWith('/ws/')) {
      const roomId = url.pathname.slice(4);
      const doId = env.ROOM_DO.idFromName(roomId);
      const stub = env.ROOM_DO.get(doId);
      return stub.fetch(request);
    }
    
    // Serve static assets
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleRooms(req: Request, env: Env): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (req.method === 'POST') {
    const roomId = crypto.randomUUID();
    const url = new URL(req.url);
    const inviteUrl = `${url.origin}/room/${roomId}`;
    return Response.json({ roomId, inviteUrl }, { 
      status: 201,
      headers: corsHeaders,
    });
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}

async function handleICE(_req: Request, _env: Env): Promise<Response> {
  // TODO: Return TURN credentials from Cloudflare Realtime API
  const iceServers = [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ];
  return Response.json({ iceServers }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

interface Env {
  ROOM_DO: DurableObjectNamespace;
  ASSETS: Fetcher;
}
