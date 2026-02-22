import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const SERVER_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  return handleRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return handleRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  return handleRequest(request, 'PATCH');
}

async function handleRequest(request: NextRequest, method: string) {
  try {
    // Get JWT token from NextAuth
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      raw: true
    });

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the target URL from query params
    const { searchParams } = new URL(request.url);
    const targetPath = searchParams.get('path');
    
    if (!targetPath) {
      return NextResponse.json(
        { error: 'Missing path parameter' },
        { status: 400 }
      );
    }

    // Construct the full URL to the backend server
    const targetUrl = `${SERVER_BASE_URL}${targetPath}`;
    
    // Forward query parameters (excluding 'path')
    const forwardParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (key !== 'path') {
        forwardParams.append(key, value);
      }
    });
    
    const finalUrl = forwardParams.toString() 
      ? `${targetUrl}?${forwardParams.toString()}`
      : targetUrl;

    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    // Add body for methods that support it
    if (method !== 'GET' && method !== 'DELETE') {
      const body = await request.text();
      if (body) {
        requestOptions.body = body;
      }
    }

    // Make the request to the backend server
    const response = await fetch(finalUrl, requestOptions);
    
    // Get the response data
    const data = await response.text();
    
    // Return the response with the same status and headers
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
