import prisma from './db';

const DELHIVERY_PROD_URL = 'https://track.delhivery.com';

export interface DelhiveryShipment {
  name: string;
  add: string;
  pin: string;
  phone: string;
  order: string;
  payment_mode: 'Prepaid' | 'COD';
  total_amount: string;
  cod_amount: string;
  products_desc: string;
  weight: string; // in grams
  shipment_height?: string;
  shipment_width?: string;
  shipment_length?: string;
  shipping_mode: 'Surface' | 'Express';
  seller_name: string;
}

export async function getDelhiveryClient() {
  const shop = await prisma.shop.findFirst();
  if (!shop?.delhiveryApiKey) {
    throw new Error('Delhivery API Key not configured in Shop settings');
  }
  return {
    apiKey: shop.delhiveryApiKey,
    baseUrl: DELHIVERY_PROD_URL,
  };
}

export async function createDelhiveryShipment(shipment: DelhiveryShipment, pickupLocationName: string) {
  const { apiKey, baseUrl } = await getDelhiveryClient();

  const payload = {
    shipments: [shipment],
    pickup_location: {
      name: pickupLocationName
    }
  };

  const formData = new URLSearchParams();
  formData.append('format', 'json');
  formData.append('data', JSON.stringify(payload));

  const response = await fetch(`${baseUrl}/api/cmu/create.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
    },
    body: formData,
  });

  const data = await response.json();
  return data;
}

export async function trackDelhiveryShipment(waybills: string | string[]) {
  const { apiKey, baseUrl } = await getDelhiveryClient();
  const wbns = Array.isArray(waybills) ? waybills.join(',') : waybills;

  const response = await fetch(`${baseUrl}/api/v1/packages/json/?waybill=${wbns}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiKey}`,
    },
  });

  const data = await response.json();
  return data;
}

export async function getShippingLabel(waybills: string | string[], pdf: boolean = true) {
  const { apiKey, baseUrl } = await getDelhiveryClient();
  const wbns = Array.isArray(waybills) ? waybills.join(',') : waybills;

  const response = await fetch(`${baseUrl}/api/p/packing_slip?wbns=${wbns}&pdf=${pdf}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  const data = await response.json();
  return data;
}

export async function fetchWaybill() {
  const { apiKey, baseUrl } = await getDelhiveryClient();

  const response = await fetch(`${baseUrl}/waybill/api/fetch/json/?token=${apiKey}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  const data = await response.json();
  return data;
}

export async function getExpectedTAT(origin: string, destination: string, mot: 'S' | 'E' | 'N' = 'S') {
  const { apiKey, baseUrl } = await getDelhiveryClient();

  const response = await fetch(`${baseUrl}/api/dc/expected_tat?origin_pin=${origin}&destination_pin=${destination}&mot=${mot}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  const data = await response.json();
  return data;
}

export async function cancelDelhiveryShipment(waybill: string) {
  const { apiKey, baseUrl } = await getDelhiveryClient();

  const response = await fetch(`${baseUrl}/api/p/edit`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      waybill,
      cancellation: 'true'
    }),
  });

  const data = await response.json();
  return data;
}
