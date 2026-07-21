export interface Settings {
  serviceUrl: string;
  accessToken: string;
}

export interface LinkRecord {
  code: string;
  shortUrl: string;
  destination: string;
  createdAt: string;
  expiresAt: string | null;
  disabled: boolean;
  managementToken?: string;
}

export interface LinkUpdate {
  destination?: string;
  expiresAt?: string | null;
  disabled?: boolean;
}

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid"
]);

export function cleanUrl(value: string): { url: string; removed: number } {
  const url = new URL(value);
  let removed = 0;

  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
      removed += 1;
    }
  }

  return { url: url.toString(), removed };
}

async function apiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "The link service request failed.");
  return body;
}

export async function createShortLink(
  settings: Settings,
  destination: string,
  customCode?: string,
  expiresAt?: string | null
): Promise<LinkRecord> {
  const serviceUrl = settings.serviceUrl.replace(/\/$/, "");
  const response = await fetch(`${serviceUrl}/api/links`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ destination, customCode: customCode || undefined, expiresAt })
  });

  return apiResponse<LinkRecord>(response);
}

export async function updateShortLink(
  settings: Settings,
  record: LinkRecord,
  update: LinkUpdate
): Promise<LinkRecord> {
  const serviceUrl = settings.serviceUrl.replace(/\/$/, "");
  const response = await fetch(`${serviceUrl}/api/links/${encodeURIComponent(record.code)}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${record.managementToken || settings.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(update)
  });

  return { ...record, ...await apiResponse<LinkRecord>(response) };
}

export async function deleteShortLink(settings: Settings, record: LinkRecord): Promise<void> {
  const serviceUrl = settings.serviceUrl.replace(/\/$/, "");
  const response = await fetch(`${serviceUrl}/api/links/${encodeURIComponent(record.code)}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${record.managementToken || settings.accessToken}`
    }
  });

  await apiResponse<void>(response);
}
