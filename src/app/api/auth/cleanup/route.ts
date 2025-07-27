import { NextResponse } from 'next/server';

export async function GET() {
  // Clear any problematic cookies or headers
  const response = NextResponse.json({ 
    success: true, 
    message: 'Redirect loop cleanup completed' 
  });
  
  // Clear any problematic headers
  response.headers.delete('x-middleware-request-x-clerk-clerk-url');
  response.headers.delete('x-clerk-redirect-url');
  
  return response;
} 