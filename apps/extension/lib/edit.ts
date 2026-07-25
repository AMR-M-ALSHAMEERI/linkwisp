import {
  cleanUrl,
  type LinkRecord,
  type LinkUpdate
} from "./shortener";

export type EditExpirationChoice =
  | "keep"
  | "never"
  | "hour"
  | "day"
  | "week"
  | "custom";

export interface EditLinkChanges {
  update: LinkUpdate;
  removedTrackingParameters: number;
}

const EXPIRATION_DURATIONS: Record<"hour" | "day" | "week", number> = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000
};

export function editExpirationValue(
  choice: EditExpirationChoice,
  customValue: string,
  now = Date.now()
): string | null | undefined {
  if (choice === "keep") return undefined;
  if (choice === "never") return null;

  if (choice === "custom") {
    const timestamp = Date.parse(customValue);
    if (!Number.isFinite(timestamp) || timestamp <= now) {
      throw new Error("Choose a custom expiration in the future.");
    }
    return new Date(timestamp).toISOString();
  }

  return new Date(now + EXPIRATION_DURATIONS[choice]).toISOString();
}

export function buildEditLinkChanges(
  record: Pick<LinkRecord, "destination" | "expiresAt">,
  destinationValue: string,
  expirationChoice: EditExpirationChoice,
  customExpirationValue: string,
  now = Date.now()
): EditLinkChanges {
  const enteredDestination = destinationValue.trim();
  if (!enteredDestination) throw new Error("Enter a destination URL.");

  let cleaned: ReturnType<typeof cleanUrl>;
  try {
    cleaned = cleanUrl(enteredDestination);
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS destination.");
  }

  const protocol = new URL(cleaned.url).protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("Enter a valid HTTP or HTTPS destination.");
  }

  const update: LinkUpdate = {};
  if (cleaned.url !== record.destination) update.destination = cleaned.url;

  const expiresAt = editExpirationValue(
    expirationChoice,
    customExpirationValue,
    now
  );
  if (expiresAt !== undefined && expiresAt !== record.expiresAt) {
    update.expiresAt = expiresAt;
  }

  if (Object.keys(update).length === 0) {
    throw new Error("Make at least one change before saving.");
  }

  return {
    update,
    removedTrackingParameters: cleaned.removed
  };
}
