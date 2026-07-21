import "./style.css";
import { cleanUrl, createShortLink, type LinkRecord, type Settings } from "../../lib/shortener";

const form = document.querySelector<HTMLFormElement>("#shorten-form")!;
const destinationInput = document.querySelector<HTMLTextAreaElement>("#destination")!;
const customCodeInput = document.querySelector<HTMLInputElement>("#custom-code")!;
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

async function loadHistory(): Promise<LinkRecord[]> {
  const result = await browser.storage.local.get("linkHistory");
  return Array.isArray(result.linkHistory) ? result.linkHistory : [];
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
    const link = document.createElement("a");
    const destination = document.createElement("small");
    link.href = record.shortUrl;
    link.target = "_blank";
    link.textContent = record.shortUrl;
    destination.textContent = record.destination;
    item.append(link, destination);
    historyList.append(item);
  }
}

function setStatus(message: string, kind?: "success" | "error"): void {
  status.textContent = message;
  status.dataset.kind = kind || "";
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
    const record = await createShortLink(settings, cleaned.url, customCodeInput.value.trim());
    await navigator.clipboard.writeText(record.shortUrl);

    const history = await loadHistory();
    const nextHistory = [record, ...history.filter((item) => item.code !== record.code)].slice(0, 200);
    await browser.storage.local.set({ linkHistory: nextHistory });
    renderHistory(nextHistory);
    setStatus("Short link created and copied.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Something went wrong.", "error");
  } finally {
    createButton.disabled = false;
  }
});

clearHistoryButton.addEventListener("click", async () => {
  await browser.storage.local.remove("linkHistory");
  renderHistory([]);
  setStatus("Local history cleared.", "success");
});

void initialize();
