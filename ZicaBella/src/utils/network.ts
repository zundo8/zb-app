/**
 * Network utilities for robust fetching
 */

export class NetworkError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Fetch with a timeout and robust error handling
 */
export async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(id);
    
    if (!response.ok) {
      throw new NetworkError(`Request failed with status ${response.status}`, response.status);
    }
    
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new NetworkError('Request timed out');
    }
    throw error;
  }
}
