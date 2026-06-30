/**
 * Meta Graph API Error Decoder & Utilities
 * Translates Meta error codes into actionable diagnostics.
 * Provides validation and Graph API helpers.
 */

export const META_GRAPH_API_VERSION = 'v25.0';

export interface MetaApiError {
  code: number;
  subcode?: number;
  error_subcode?: number;
  message: string;
  type?: string;
  fbtrace_id?: string;
}

export interface MetaDiagnostic {
  /** Human-readable summary */
  summary: string;
  /** Specific problem identified */
  detail: string;
  /** Actionable fix suggestion */
  fix: string;
  /** The original Meta error code */
  code: number;
  /** The original Meta error subcode */
  subcode?: number;
  /** Affected endpoint/resource */
  endpoint?: string;
  /** Raw error message from Meta */
  rawMessage: string;
  /** Meta request trace ID for support */
  fbtrace_id?: string;
  /** Requested fields that may have caused the issue */
  requestedFields?: string;
}

/**
 * Parse a Meta Graph API error response into an actionable diagnostic.
 */
export function parseMetaError(
  errorBody: any,
  endpoint?: string,
  requestedFields?: string
): MetaDiagnostic {
  const err: MetaApiError = errorBody?.error || errorBody || {};
  const code = err.code || 0;
  const subcode = err.subcode || err.error_subcode;
  const message = err.message || 'Unknown Meta API error';
  const fbtrace_id = err.fbtrace_id;

  const base = {
    code,
    subcode,
    endpoint,
    rawMessage: message,
    fbtrace_id,
    requestedFields,
  };

  // Map known error codes to diagnostics
  switch (code) {
    case 100:
      return {
        ...base,
        summary: 'Missing Permission or Invalid Parameter',
        detail: decodeMissingPermission(message, subcode),
        fix: decodeMissingPermissionFix(message, subcode),
      };

    case 190:
      return {
        ...base,
        summary: 'Invalid or Expired Access Token',
        detail: decodeTokenError(subcode, message),
        fix: 'Generate a new System User Access Token in Meta Business Manager → Business Settings → System Users → Generate Token. Ensure the token has ads_read permission and the Pixel is assigned as an asset.',
      };

    case 10:
      return {
        ...base,
        summary: 'Permission Denied',
        detail: `The access token does not have permission to access this endpoint. ${message}`,
        fix: 'The System User token needs the ads_read permission. Go to Business Manager → System Users → [Your System User] → Assets → Add Asset → Pixel → Grant Full Control.',
      };

    case 803:
      return {
        ...base,
        summary: 'Invalid Pixel/Dataset ID',
        detail: `The Pixel or Dataset ID provided does not exist or is not accessible. ${message}`,
        fix: 'Verify the META_PIXEL_ID environment variable matches the Pixel ID shown in Meta Events Manager. Go to Events Manager → Data Sources to find your correct Pixel/Dataset ID.',
      };

    case 4:
      return {
        ...base,
        summary: 'API Rate Limit Exceeded',
        detail: `Too many API requests. ${message}`,
        fix: 'Reduce the frequency of API calls. The dashboard auto-refresh interval should be at least 60 seconds.',
      };

    case 1:
      return {
        ...base,
        summary: 'Unknown Graph API Error',
        detail: `Meta returned a transient server error. ${message}`,
        fix: 'This is usually a temporary issue on Meta\'s side. Retry the request after a few seconds.',
      };

    case 2:
      return {
        ...base,
        summary: 'Graph API Service Unavailable',
        detail: `The Meta Graph API is temporarily unavailable. ${message}`,
        fix: 'Wait a few minutes and retry. Check https://metastatus.com for any outages.',
      };

    case 200:
      return {
        ...base,
        summary: 'Insufficient Permissions',
        detail: `The app or user does not have the required permissions. ${message}`,
        fix: 'Check that the token was generated with the correct permissions (ads_read, business_management). Re-generate the token if needed.',
      };

    case 294:
      return {
        ...base,
        summary: 'App Not Installed',
        detail: `The Meta App is not installed or not linked to this business. ${message}`,
        fix: 'Ensure the Meta App (META_APP_ID) is properly installed and the System User is associated with it.',
      };

    default:
      return {
        ...base,
        summary: `Meta API Error (Code ${code})`,
        detail: message,
        fix: `Review the Meta Graph API documentation for error code ${code}. Verify token permissions and Pixel ID configuration.`,
      };
  }
}

function decodeMissingPermission(message: string, subcode?: number): string {
  const lower = message.toLowerCase();

  if (subcode === 33) {
    return 'The requested field or edge does not exist on this API version. The endpoint may have been deprecated or renamed in Graph API v25.0.';
  }
  if (subcode === 2018001) {
    return 'The System User does not have permission to access this Pixel/Dataset. The Pixel is not assigned as an asset to the System User in Business Manager.';
  }
  if (subcode === 1487851) {
    return 'The Pixel/Dataset belongs to a different Business Manager. The System User cannot access assets owned by another business.';
  }

  if (lower.includes('ads_read')) {
    return 'Missing ads_read permission. The System User token does not have read access to advertising data. The Pixel must also be assigned as an asset.';
  }
  if (lower.includes('ads_management')) {
    return 'Missing ads_management permission. The System User token does not have management access to advertising data.';
  }
  if (lower.includes('business_management')) {
    return 'Missing business_management permission. The System User token does not have access to Business Manager assets.';
  }
  if (lower.includes('does not exist') || lower.includes('nonexistent')) {
    return `The requested resource does not exist. This could mean an invalid Pixel ID, deprecated API edge, or unsupported field. ${message}`;
  }
  if (lower.includes('unsupported') && lower.includes('field')) {
    return `One or more requested fields are not supported on this object or API version. ${message}`;
  }
  if (lower.includes('pixel') || lower.includes('dataset')) {
    return 'The System User does not have access to this Pixel/Dataset. It may not be assigned as an asset in Business Manager.';
  }
  if (lower.includes('owner') || lower.includes('owned')) {
    return `The requested Pixel/Dataset is owned by a different Business Manager. ${message}`;
  }

  return `Missing permission or invalid parameter: ${message}. This often occurs when the System User lacks asset access, when the Pixel is not assigned to the System User, or when using deprecated Graph API fields/edges.`;
}

function decodeMissingPermissionFix(message: string, subcode?: number): string {
  if (subcode === 33) {
    return 'The requested field or edge may have been deprecated. Check the Meta Graph API v25.0 changelog and update to the correct field/edge name.';
  }
  if (subcode === 2018001) {
    return 'Go to Business Manager → Business Settings → System Users → [Your System User] → Assign Assets → Select the Pixel/Dataset → Grant Full Control. Then regenerate the token.';
  }
  if (subcode === 1487851) {
    return 'The Pixel belongs to another Business Manager. Either: (1) Request access from the owning business, or (2) Update META_PIXEL_ID to a Pixel owned by your business.';
  }

  return 'Verify your System User has been assigned to the Pixel/Dataset in Business Manager → Business Settings → System Users → Assets. Required permissions: ads_read. Also check that the Pixel ID is correct and belongs to your Business Manager.';
}

function decodeTokenError(subcode?: number, message?: string): string {
  switch (subcode) {
    case 460:
      return 'The access token has expired. System User tokens can expire after 60 days if not set to non-expiring.';
    case 463:
      return 'The access token has expired. Generate a new non-expiring System User token.';
    case 467:
      return 'The access token is invalid. It may have been revoked or was generated for a different app.';
    default:
      return `Invalid access token: ${message || 'The token could not be validated.'}`;
  }
}

/**
 * Validates the format of a Meta access token.
 * Returns null if valid, or an error message if invalid.
 */
export function validateTokenFormat(token: string | undefined): string | null {
  if (!token) {
    return 'META_CAPI_ACCESS_TOKEN is not set. Add it to your environment variables.';
  }
  if (token.length < 20) {
    return 'META_CAPI_ACCESS_TOKEN appears too short to be a valid Meta access token.';
  }
  if (!token.startsWith('EAA')) {
    return 'META_CAPI_ACCESS_TOKEN does not start with "EAA". System User tokens should start with "EAA". You may have an incorrect token format.';
  }
  return null;
}

/**
 * Validates the format of a Meta Pixel/Dataset ID.
 * Returns null if valid, or an error message if invalid.
 */
export function validatePixelIdFormat(pixelId: string | undefined): string | null {
  if (!pixelId) {
    return 'META_PIXEL_ID is not set. Add it to your environment variables.';
  }
  if (!/^\d{10,20}$/.test(pixelId)) {
    return `META_PIXEL_ID "${pixelId}" does not appear to be a valid numeric Pixel/Dataset ID. It should be a 10-20 digit number.`;
  }
  return null;
}

/**
 * Build a Graph API URL with the current version.
 */
export function graphUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `https://graph.facebook.com/${META_GRAPH_API_VERSION}${cleanPath}`;
}

/**
 * Extracts a human-readable token summary for diagnostics (without exposing the full token).
 */
export function tokenSummary(token: string | undefined): string {
  if (!token) return 'NOT SET';
  if (token.length < 10) return 'INVALID (too short)';
  return `${token.slice(0, 6)}...${token.slice(-4)} (length: ${token.length})`;
}
