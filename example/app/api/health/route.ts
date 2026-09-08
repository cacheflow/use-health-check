import { NextRequest, NextResponse } from 'next/server';

const respond = async (request: NextRequest, body: object | null) => {
  const { searchParams } = new URL(request.url);
  const fail = searchParams.get('fail') === 'true';
  const delay = Number(searchParams.get('delay') ?? 0);

  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const status = fail ? 503 : 200;

  return body
    ? NextResponse.json(body, { status })
    : new NextResponse(null, { status });
};

export async function GET(request: NextRequest) {
  return respond(request, { status: 'ok', timestamp: new Date().toISOString() });
}

export async function HEAD(request: NextRequest) {
  return respond(request, null);
}
