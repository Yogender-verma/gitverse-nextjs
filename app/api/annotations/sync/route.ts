import { NextRequest } from "next/server";
import { EventEmitter } from "events";

export const dynamic = "force-dynamic";

// Global emitter for single-process environments.
// For multi-instance, this should be replaced with Redis Pub/Sub.
const globalEmitter = global as unknown as { annotationEmitter?: EventEmitter };
if (!globalEmitter.annotationEmitter) {
  globalEmitter.annotationEmitter = new EventEmitter();
  globalEmitter.annotationEmitter.setMaxListeners(100);
}
const emitter = globalEmitter.annotationEmitter;

export function broadcastAnnotationEvent(repositoryId: string, event: any) {
  emitter.emit(`repo-${repositoryId}`, event);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get("repositoryId");
  const token = searchParams.get("token");

  // In a real app we'd verify the token via next-auth or JWT here for SSE.
  if (!repositoryId) {
    return new Response("Missing repositoryId", { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      
      const channel = `repo-${repositoryId}`;
      emitter.on(channel, sendEvent);
      
      // Ping to keep connection alive
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 30000);

      request.signal.addEventListener('abort', () => {
        emitter.off(channel, sendEvent);
        clearInterval(interval);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}
