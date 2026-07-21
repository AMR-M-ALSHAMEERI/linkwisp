import "./style.css";
import {
  cleanUrl,
  createShortLink,
  deleteShortLink,
  updateShortLink,
  type LinkRecord,
  type Settings
} from "../../lib/shortener";

const form = document.querySelector<HTMLFormElement>("#shorten-form")!;
const destinationInput = document.querySelector<HTMLTextAreaElement>("#destination")!;
const customCodeInput = document.querySelector<HTMLInputElement>("#custom-code")!;
const expirationSelect = document.querySelector<HTMLSelectElement>("#expiration")!;
const customExpirationField = document.querySelector<HTMLElement>("#custom-expiration-field")!;
const customExpirationInput = document.querySelector<HTMLInputElement>("#custom-expiration")!;
const serviceUrlInput = document.querySelector<HTMLInputElement>("#service-url")!;
const accessTokenInput = document.querySelector<HTMLInputElement>("#access-token")!;
const saveSettingsButton = document.querySelector<HTMLButtonElement>("#save-settings")!;
const createButton = document.querySelector<HTMLButtonElement>("#create-button")!;
const cleaningMessage = document.querySelector<HTMLElement>("#cleaning-message")!;
const status = document.querySelector<HTMLElement>("#status")!;
const historyList = document.querySelector<HTMLOListElement>("#history-list")!;
const clearHistoryButton = document.querySelector<HTMLButtonElement>("#clear-history")!;

async function loadSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(["serviceUrl", "accessToken"]);
  return {
    serviceUrl: typeof result.serviceUrl === "string" ? result.serviceUrl : "",
    accessToken: typeof result.accessToken === "string" ? result.accessToken : ""
  };
}

function normalizeRecord(record: Partial<LinkRecord>): LinkRecord | null {
  if (!record.code || !record.shortUrl || !record.destination || !record.createdAt) return null;
  return {
    code: record.code,
    shortUrl: record.shortUrl,
    destination: record.destination,
    createdAt: record.createdAt,
    expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : null,
    disabled: Boolean(record.disabled),
    managementToken: record.managementToken
  };
}

async function loadHistory(): Promise<LinkRecord[]> {
  const result = await browser.storage.local.get("linkHistory");
  if (!Array.isArray(result.linkHistory)) return [];
  return result.linkHistory.map(normalizeRecord).filter((record): record is LinkRecord => record !== null);
}

async function saveHistory(records: LinkRecord[]): Promise<void> {
  await browser.storage.local.set({ linkHistory: records.slice(0, 200) });
  renderHistory(records);
}

function linkState(record: LinkRecord): "active" | "disabled" | "expired" {
  if (record.disabled) return "disabled";
  if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) return "expired";
  return "active";
}

function actionButton(label: string, action: string, code: string, danger = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.code = code;
  if (danger) button.className = "danger";
  return button;
}

function renderHistory(records: LinkRecord[]): void {
  historyList.replaceChildren();
  if (records.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No links created yet.";
    historyList.append(empty);
    return;
  }

  for (const record of records.slice(0, 8)) {
    const item = document.createElement("li");
    const top = document.createElement("div");
    const link = document.createElement("a");
    const badge = document.createElement("span");
    const destination = document.createElement("small");
    const metadata = document.createElement("div");
    const actions = document.createElement("div");
    const state = linkState(record);

    top.className = "history-top";
    link.href = record.shortUrl;
    link.target = "_blank";
    link.textContent = record.shortUrl;
    badge.className = "link-state";
    badge.dataset.state = state;
    badge.textContent = state;
    destination.textContent = record.destination;
    metadata.className = "history-meta";
    metadata.textContent = record.expiresAt
      ? `Expires ${new Date(record.expiresAt).toLocaleString()}`
      : `Created ${new Date(record.createdAt).toLocaleString()}`;
    actions.className = "history-actions";
    actions.append(
      actionButton("Copy", "copy", record.code),
      actionButton("Edit", "edit", record.code),
      actionButton(record.disabled ? "Enable" : "Disable", "toggle", record.code),
      actionButton("Delete", "delete", record.code, true)
    );

    top.append(link, badge);
    item.append(top, destination, metadata, actions);
    historyList.append(item);
  }
}

function setStatus(message: string, kind?: "success" | "error"): void {
  status.textContent = message;
  status.dataset.kind = kind || "";
}

function selectedExpiration(): string | null {
  const durations: Record<string, number> = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000
  };

  if (expirationSelect.value === "never") return null;
  if (expirationSelect.value === "custom") {
    const timestamp = Date.parse(customExpirationInput.value);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      throw new Error("Choose a custom expiration in the future.");
    }
    return new Date(timestamp).toISOString();
  }

  return new Date(Date.now() + durations[expirationSelect.value]).toISOString();
}

async function initialize(): Promise<void> {
  const [settings, history, tabs, session] = await Promise.all([
    loadSettings(),
    loadHistory(),
    browser.tabs.query({ active: true, currentWindow: true }),
    browser.storage.session.get("pendingDestination")
  ]);

  serviceUrlInput.value = settings.serviceUrl;
  accessTokenInput.value = settings.accessToken;

  const pendingDestination = typeof session.pendingDestination === "string"
    ? session.pendingDestination
    : undefined;
  const activeUrl = pendingDestination || tabs[0]?.url;
  if (activeUrl?.startsWith("http://") || activeUrl?.startsWith("https://")) {
    const cleaned = cleanUrl(activeUrl);
    destinationInput.value = cleaned.url;
    cleaningMessage.textContent = cleaned.removed
      ? `${cleaned.removed} tracking parameter${cleaned.removed === 1 ? "" : "s"} removed.`
      : "No common tracking parameters found.";
  }

  if (pendingDestination) await browser.storage.session.remove("pendingDestination");
  renderHistory(history);
}

expirationSelect.addEventListener("change", () => {
  customExpirationField.classList.toggle("hidden", expirationSelect.value !== "custom");
});

saveSettingsButton.addEventListener("click", async () => {
  const serviceUrl = serviceUrlInput.value.trim().replace(/\/$/, "");
  const accessToken = accessTokenInput.value.trim();
  await browser.storage.local.set({ serviceUrl, accessToken });
  setStatus("Connection settings saved.", "success");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");
  createButton.disabled = true;

  try {
    const settings = await loadSettings();
    if (!settings.serviceUrl || !settings.accessToken) {
      throw new Error("Save the Worker address and access code first.");
    }

    const cleaned = cleanUrl(destinationInput.value.trim());
    const record = await createShortLink(
      settings,
      cleaned.url,
      customCodeInput.value.trim(),
      selectedExpiration()
    );
    await navigator.clipboard.writeText(record.shortUrl);

    const history = await loadHistory();
    await saveHistory([record, ...history.filter((item) => item.code !== record.code)]);
    customCodeInput.value = "";
    setStatus("Short link created and copied.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Something went wrong.", "error");
  } finally {
    createButton.disabled = false;
  }
});

historyList.addEventListener("click", async (event) => {
  const target = event.target as Element | null;
  const button = target?.closest("button[data-action]") as HTMLButtonElement | null;
  if (!button?.dataset.code || !button.dataset.action) return;

  const history = await loadHistory();
  const record = history.find((item) => item.code === button.dataset.code);
  if (!record) return;

  button.disabled = true;
  setStatus("");

  try {
    if (button.dataset.action === "copy") {
      await navigator.clipboard.writeText(record.shortUrl);
      setStatus("Short link copied.", "success");
      return;
    }

    const settings = await loadSettings();
    let nextHistory = history;

    if (button.dataset.action === "edit") {
      const entered = window.prompt("New destination URL", record.destination);
      if (entered === null) return;
      const cleaned = cleanUrl(entered.trim());
      const updated = await updateShortLink(settings, record, { destination: cleaned.url });
      nextHistory = history.map((item) => item.code === record.code ? updated : item);
      setStatus("Destination updated.", "success");
    }

    if (button.dataset.action === "toggle") {
      const updated = await updateShortLink(settings, record, { disabled: !record.disabled });
      nextHistory = history.map((item) => item.code === record.code ? updated : item);
      setStatus(updated.disabled ? "Link disabled." : "Link enabled.", "success");
    }

    if (button.dataset.action === "delete") {
      if (!window.confirm(`Permanently delete ${record.shortUrl}?`)) return;
      await deleteShortLink(settings, record);
      nextHistory = history.filter((item) => item.code !== record.code);
      setStatus("Link deleted.", "success");
    }

    await saveHistory(nextHistory);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The link could not be updated.", "error");
  } finally {
    button.disabled = false;
  }
});

clearHistoryButton.addEventListener("click", async () => {
  await browser.storage.local.remove("linkHistory");
  renderHistory([]);
  setStatus("Local history cleared. Online links were not deleted.", "success");
});

void initialize();
