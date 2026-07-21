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
  favorite: boolean;
  managementToken?: string;
  serviceUrl: string;
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
  let body: (T & { error?: string }) | null = null;
  try {
    body = await response.json() as T & { error?: string };
  } catch {
    // A wrong service address may return HTML or plain text instead of LinkWisp JSON.
  }
  if (!response.ok) throw new Error(body?.error || `The link service returned HTTP ${response.status}.`);
  if (!body) throw new Error("The service did not return a valid LinkWisp response.");
  return body;
}

export async function testConnection(settings: Settings): Promise<void> {
  let serviceUrl: string;
  try {
    const url = new URL(settings.serviceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    serviceUrl = url.toString().replace(/\/$/, "");
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS Worker address.");
  }

  if (!settings.accessToken) throw new Error("Enter the access code.");

  let response: Response;
  try {
    response = await fetch(`${serviceUrl}/api/session`, {
      headers: { "Authorization": `Bearer ${settings.accessToken}` }
    });
  } catch {
    throw new Error("Could not reach the Worker. Check its address and confirm it is running.");
  }

  await apiResponse<{ status: "ok" }>(response);
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

  return {
    ...await apiResponse<Omit<LinkRecord, "serviceUrl" | "favorite">>(response),
    favorite: false,
    serviceUrl
  };
}

export async function updateShortLink(
  settings: Settings,
  record: LinkRecord,
  update: LinkUpdate
): Promise<LinkRecord> {
  const serviceUrl = (record.serviceUrl || settings.serviceUrl).replace(/\/$/, "");
  const response = await fetch(`${serviceUrl}/api/links/${encodeURIComponent(record.code)}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${record.managementToken || settings.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(update)
  });

  return {
    ...record,
    ...await apiResponse<Omit<LinkRecord, "favorite" | "serviceUrl" | "managementToken">>(response)
  };
}

export async function deleteShortLink(settings: Settings, record: LinkRecord): Promise<void> {
  const serviceUrl = (record.serviceUrl || settings.serviceUrl).replace(/\/$/, "");
  const response = await fetch(`${serviceUrl}/api/links/${encodeURIComponent(record.code)}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${record.managementToken || settings.accessToken}`
    }
  });

  await apiResponse<void>(response);
}
