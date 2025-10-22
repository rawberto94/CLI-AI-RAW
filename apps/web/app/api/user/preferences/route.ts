import { NextResponse } from 'next/server';

export async function GET() {
  // Return default user preferences
  return NextResponse.json({
    theme: 'system',
    dataMode: 'mock',
    notifications: true,
    language: 'en'
  });
}

export async function POST(request: Request) {
  const preferences = await request.json();
  
  // In a real app, save to database
  // For now, just return success
  return NextResponse.json({
    success: true,
    preferences
  });
}
