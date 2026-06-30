import { NextResponse } from 'next/server';
import {
  graphUrl,
  parseMetaError,
  validateTokenFormat,
  validatePixelIdFormat,
  META_GRAPH_API_VERSION,
} from '@/lib/metaErrors';

export const dynamic = 'force-dynamic';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  detail?: string;
}

export async function GET() {
  const PIXEL_ID = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;

  const checks: CheckResult[] = [];
  let overallStatus: 'pass' | 'fail' | 'warn' = 'pass';

  // ────────────────────────────────────────
  // 1. Check META_PIXEL_ID is configured
  // ────────────────────────────────────────
  const pixelError = validatePixelIdFormat(PIXEL_ID);
  if (pixelError) {
    checks.push({ name: 'Pixel ID Configuration', status: 'fail', message: pixelError });
    overallStatus = 'fail';
  } else {
    checks.push({ name: 'Pixel ID Configuration', status: 'pass', message: `META_PIXEL_ID is set: ${PIXEL_ID}` });
  }

  // ────────────────────────────────────────
  // 2. Check META_CAPI_ACCESS_TOKEN is configured
  // ────────────────────────────────────────
  const tokenError = validateTokenFormat(ACCESS_TOKEN);
  if (tokenError) {
    checks.push({ name: 'Access Token Configuration', status: 'fail', message: tokenError });
    overallStatus = 'fail';
  } else {
    checks.push({
      name: 'Access Token Configuration',
      status: 'pass',
      message: `META_CAPI_ACCESS_TOKEN is set (starts with EAA..., length: ${ACCESS_TOKEN!.length})`,
    });
  }

  // If either config is missing, we can't proceed with API checks
  if (overallStatus === 'fail') {
    return NextResponse.json({
      overall: overallStatus,
      checks,
      api_version: META_GRAPH_API_VERSION,
      timestamp: new Date().toISOString(),
    });
  }

  // ────────────────────────────────────────
  // 3. Test Graph API Connectivity
  // ────────────────────────────────────────
  try {
    const connectivityUrl = graphUrl(`/me?access_token=${ACCESS_TOKEN}`);
    const connectRes = await fetch(connectivityUrl, { cache: 'no-store' });
    const connectData = await connectRes.json().catch(() => null);

    if (connectRes.ok && connectData && !connectData.error) {
      checks.push({
        name: 'Graph API Connectivity',
        status: 'pass',
        message: `Connected to Graph API ${META_GRAPH_API_VERSION} successfully`,
        detail: connectData.name ? `Authenticated as: ${connectData.name} (ID: ${connectData.id})` : `Token ID: ${connectData.id}`,
      });
    } else if (connectData?.error) {
      const diagnostic = parseMetaError(connectData, '/me');
      checks.push({
        name: 'Graph API Connectivity',
        status: 'fail',
        message: diagnostic.summary,
        detail: diagnostic.detail,
      });
      overallStatus = 'fail';
    } else {
      checks.push({
        name: 'Graph API Connectivity',
        status: 'fail',
        message: `Graph API returned HTTP ${connectRes.status}`,
      });
      overallStatus = 'fail';
    }
  } catch (err: any) {
    checks.push({
      name: 'Graph API Connectivity',
      status: 'fail',
      message: `Network error connecting to Graph API: ${err.message}`,
    });
    overallStatus = 'fail';
  }

  // If Graph API connectivity failed, we can't proceed further
  if (overallStatus === 'fail') {
    return NextResponse.json({
      overall: overallStatus,
      checks,
      api_version: META_GRAPH_API_VERSION,
      timestamp: new Date().toISOString(),
    });
  }

  // ────────────────────────────────────────
  // 4. Test Token Permissions
  // ────────────────────────────────────────
  try {
    const permUrl = graphUrl(`/me/permissions?access_token=${ACCESS_TOKEN}`);
    const permRes = await fetch(permUrl, { cache: 'no-store' });
    const permData = await permRes.json().catch(() => null);

    if (permRes.ok && permData?.data) {
      const perms = permData.data as Array<{ permission: string; status: string }>;
      const grantedPerms = perms.filter(p => p.status === 'granted').map(p => p.permission);
      const declinedPerms = perms.filter(p => p.status === 'declined').map(p => p.permission);

      const hasAdsRead = grantedPerms.includes('ads_read');
      const hasAdsManagement = grantedPerms.includes('ads_management');

      if (hasAdsRead || hasAdsManagement) {
        checks.push({
          name: 'Token Permissions',
          status: 'pass',
          message: `Granted: ${grantedPerms.join(', ')}`,
          detail: declinedPerms.length > 0 ? `Declined: ${declinedPerms.join(', ')}` : undefined,
        });
      } else {
        // System User tokens may not return permissions via /me/permissions
        // but can still access pixels directly — mark as warning, not fail
        checks.push({
          name: 'Token Permissions',
          status: 'warn',
          message: 'Could not confirm ads_read permission via /me/permissions. System User tokens may not list permissions here — will verify via direct Pixel access.',
          detail: `Returned permissions: ${grantedPerms.length > 0 ? grantedPerms.join(', ') : 'none listed'}`,
        });
        if (overallStatus === 'pass') overallStatus = 'warn';
      }
    } else if (permData?.error) {
      // System User tokens sometimes can't access /me/permissions — not a critical failure
      checks.push({
        name: 'Token Permissions',
        status: 'warn',
        message: `Could not query /me/permissions: ${permData.error.message}. This is normal for some System User tokens.`,
      });
      if (overallStatus === 'pass') overallStatus = 'warn';
    }
  } catch (err: any) {
    checks.push({
      name: 'Token Permissions',
      status: 'warn',
      message: `Could not check permissions: ${err.message}`,
    });
    if (overallStatus === 'pass') overallStatus = 'warn';
  }

  // ────────────────────────────────────────
  // 5. Test Pixel/Dataset Accessibility
  // ────────────────────────────────────────
  try {
    const pixelUrl = graphUrl(`/${PIXEL_ID}?fields=name,id,creation_time&access_token=${ACCESS_TOKEN}`);
    const pixelRes = await fetch(pixelUrl, { cache: 'no-store' });
    const pixelData = await pixelRes.json().catch(() => null);

    if (pixelRes.ok && pixelData && !pixelData.error) {
      checks.push({
        name: 'Pixel/Dataset Access',
        status: 'pass',
        message: `Pixel accessible: "${pixelData.name}" (ID: ${pixelData.id})`,
        detail: pixelData.creation_time ? `Created: ${pixelData.creation_time}` : undefined,
      });
    } else if (pixelData?.error) {
      const diagnostic = parseMetaError(pixelData, `GET /${PIXEL_ID}`);
      checks.push({
        name: 'Pixel/Dataset Access',
        status: 'fail',
        message: diagnostic.summary,
        detail: `${diagnostic.detail}\n\nFix: ${diagnostic.fix}`,
      });
      overallStatus = 'fail';
    } else {
      checks.push({
        name: 'Pixel/Dataset Access',
        status: 'fail',
        message: `Pixel request returned HTTP ${pixelRes.status}`,
      });
      overallStatus = 'fail';
    }
  } catch (err: any) {
    checks.push({
      name: 'Pixel/Dataset Access',
      status: 'fail',
      message: `Network error accessing pixel: ${err.message}`,
    });
    overallStatus = 'fail';
  }

  // ────────────────────────────────────────
  // 6. Test Stats Edge Access
  // ────────────────────────────────────────
  try {
    const statsUrl = graphUrl(`/${PIXEL_ID}/stats?access_token=${ACCESS_TOKEN}`);
    const statsRes = await fetch(statsUrl, { cache: 'no-store' });
    const statsData = await statsRes.json().catch(() => null);

    if (statsRes.ok && statsData && !statsData.error) {
      const eventCount = statsData.data?.length || 0;
      checks.push({
        name: 'Stats Edge Access',
        status: 'pass',
        message: `Stats edge accessible. ${eventCount} event type(s) returned.`,
      });
    } else if (statsData?.error) {
      const diagnostic = parseMetaError(statsData, `GET /${PIXEL_ID}/stats`);
      checks.push({
        name: 'Stats Edge Access',
        status: 'warn',
        message: `Stats edge returned error: ${diagnostic.summary}`,
        detail: diagnostic.detail,
      });
      if (overallStatus === 'pass') overallStatus = 'warn';
    }
  } catch (err: any) {
    checks.push({
      name: 'Stats Edge Access',
      status: 'warn',
      message: `Could not access stats edge: ${err.message}`,
    });
    if (overallStatus === 'pass') overallStatus = 'warn';
  }

  // ────────────────────────────────────────
  // 7. Test CAPI Event Sending (dry check — POST with test_event_code)
  // ────────────────────────────────────────
  try {
    const capiUrl = graphUrl(`/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`);
    const testPayload = {
      data: [
        {
          event_name: 'PageView',
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_source_url: 'https://zicabella.com',
          user_data: {
            client_user_agent: 'Meta-Connection-Test/1.0',
            client_ip_address: '127.0.0.1',
          },
        },
      ],
      test_event_code: 'CONNECTION_TEST_' + Date.now(),
    };

    const capiRes = await fetch(capiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });
    const capiData = await capiRes.json().catch(() => null);

    if (capiRes.ok && capiData && !capiData.error) {
      checks.push({
        name: 'Conversions API (CAPI)',
        status: 'pass',
        message: `CAPI endpoint is accessible. Events processed: ${capiData.events_received || 0}`,
      });
    } else if (capiData?.error) {
      const diagnostic = parseMetaError(capiData, `POST /${PIXEL_ID}/events`);
      checks.push({
        name: 'Conversions API (CAPI)',
        status: 'fail',
        message: `CAPI error: ${diagnostic.summary}`,
        detail: diagnostic.detail,
      });
      overallStatus = 'fail';
    }
  } catch (err: any) {
    checks.push({
      name: 'Conversions API (CAPI)',
      status: 'warn',
      message: `Could not test CAPI endpoint: ${err.message}`,
    });
    if (overallStatus === 'pass') overallStatus = 'warn';
  }

  return NextResponse.json({
    overall: overallStatus,
    checks,
    api_version: META_GRAPH_API_VERSION,
    timestamp: new Date().toISOString(),
  });
}
