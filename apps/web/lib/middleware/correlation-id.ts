import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export function correlationIdMiddleware(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || uuidv4();
  
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-correlation-id', correlationId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('x-correlation-id', correlationId);
  
  return response;
}

export function getCorrelationId(request: NextRequest): string {
  return request.headers.get('x-correlation-id') || uuidv4();
}
