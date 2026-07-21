export interface Settings {
  serviceUrl: string;
  accessToken: string;
}

export interface LinkRecord {
  code: string;
  shortUrl: string;
  destination: string;
  createdAt: string;
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

export async function createShortLink(
  settings: Settings,
  destination: string,
  customCode?: string
): Promise<LinkRecord> {
  const serviceUrl = settings.serviceUrl.replace(/\/$/, "");
  const response = await fetch(`${serviceUrl}/api/links`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ destination, customCode: customCode || undefined })
  });

  const body = await response.json() as LinkRecord & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || "The short link could not be created.");
  }

  return body;
}

