import "./style.css";
import QRCode from "qrcode";
import {
  cleanUrl,
  createShortLink,
  deleteShortLink,
  testConnection,
  updateShortLink,
  type LinkRecord,
  type Settings
} from "../../lib/shortener";
import {
  createBackup,
  mergeImportedRecords,
  normalizeStoredRecord,
  parseBackup,
  recordKey
} from "../../lib/backup";
import {
  buildEditLinkChanges,
  type EditExpirationChoice
} from "../../lib/edit";

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
const toast = document.querySelector<HTMLElement>("#toast")!;
const toastMessage = document.querySelector<HTMLElement>("#toast-message")!;
const toastCloseButton = document.querySelector<HTMLButtonElement>("#toast-close")!;
const navButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-view]")];
const viewPanels = [...document.querySelectorAll<HTMLElement>("[data-view-panel]")];
const linksCount = document.querySelector<HTMLElement>("#links-count")!;
const historyList = document.querySelector<HTMLOListElement>("#history-list")!;
const clearHistoryButton = document.querySelector<HTMLButtonElement>("#clear-history")!;
const historySearchInput = document.querySelector<HTMLInputElement>("#history-search")!;
const showMoreLinksButton = document.querySelector<HTMLButtonElement>("#show-more-links")!;
const exportBackupButton = document.querySelector<HTMLButtonElement>("#export-backup")!;
const importBackupButton = document.querySelector<HTMLButtonElement>("#import-backup")!;
const backupFileInput = document.querySelector<HTMLInputElement>("#backup-file")!;
const qrDialog = document.querySelector<HTMLDialogElement>("#qr-dialog")!;
const qrUrl = document.querySelector<HTMLElement>("#qr-url")!;
const qrState = document.querySelector<HTMLElement>("#qr-state")!;
const qrImage = document.querySelector<HTMLImageElement>("#qr-image")!;
const downloadQrButton = document.querySelector<HTMLButtonElement>("#download-qr")!;
const closeQrButton = document.querySelector<HTMLButtonElement>("#close-qr")!;
const onboardingDialog = document.querySelector<HTMLDialogElement>("#onboarding-dialog")!;
const onboardingForm = document.querySelector<HTMLFormElement>("#onboarding-form")!;
const onboardingServiceUrlInput = document.querySelector<HTMLInputElement>("#onboarding-service-url")!;
const onboardingAccessTokenInput = document.querySelector<HTMLInputElement>("#onboarding-access-token")!;
const onboardingStatus = document.querySelector<HTMLElement>("#onboarding-status")!;
const finishOnboardingButton = document.querySelector<HTMLButtonElement>("#finish-onboarding")!;
const dismissOnboardingButton = document.querySelector<HTMLButtonElement>("#dismiss-onboarding")!;
const openOnboardingButton = document.querySelector<HTMLButtonElement>("#open-onboarding")!;
const aboutDialog = document.querySelector<HTMLDialogElement>("#about-dialog")!;
const openAboutButton = document.querySelector<HTMLButtonElement>("#open-about")!;
const closeAboutButton = document.querySelector<HTMLButtonElement>("#close-about")!;
const aboutVersions = [...document.querySelectorAll<HTMLElement>("[data-about-version]")];
const editDialog = document.querySelector<HTMLDialogElement>("#edit-dialog")!;
const editForm = document.querySelector<HTMLFormElement>("#edit-form")!;
const editShortUrl = document.querySelector<HTMLElement>("#edit-short-url")!;
const editState = document.querySelector<HTMLElement>("#edit-state")!;
const editDestinationInput = document.querySelector<HTMLTextAreaElement>("#edit-destination")!;
const editExpirationSelect = document.querySelector<HTMLSelectElement>("#edit-expiration")!;
const editCurrentExpiration = document.querySelector<HTMLElement>("#edit-current-expiration")!;
const editCustomExpirationField = document.querySelector<HTMLElement>("#edit-custom-expiration-field")!;
const editCustomExpirationInput = document.querySelector<HTMLInputElement>("#edit-custom-expiration")!;
const editStatus = document.querySelector<HTMLElement>("#edit-status")!;
const saveEditButton = document.querySelector<HTMLButtonElement>("#save-edit")!;
const cancelEditButton = document.querySelector<HTMLButtonElement>("#cancel-edit")!;

let currentQrDataUrl = "";
let currentQrCode = "";
let historyExpanded = false;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastExitTimer: ReturnType<typeof setTimeout> | undefined;
let brandMarkPromise: Promise<HTMLImageElement> | undefined;
let currentEditRecordKey = "";
let editSaving = false;

type AppView = "create" | "links" | "settings";

async function loadSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(["serviceUrl", "accessToken"]);
  return {
    serviceUrl: typeof result.serviceUrl === "string" ? result.serviceUrl : "",
    accessToken: typeof result.accessToken === "string" ? result.accessToken : ""
  };
}

async function loadHistory(): Promise<LinkRecord[]> {
  const result = await browser.storage.local.get(["linkHistory", "serviceUrl"]);
  if (!Array.isArray(result.linkHistory)) return [];
  const fallbackServiceUrl = typeof result.serviceUrl === "string" ? result.serviceUrl : "";
  return result.linkHistory
    .map((record) => normalizeStoredRecord(record, fallbackServiceUrl))
    .filter((record): record is LinkRecord => record !== null);
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

function showEditDialog(record: LinkRecord): void {
  const state = linkState(record);
  currentEditRecordKey = recordKey(record);
  editShortUrl.textContent = record.shortUrl;
  editShortUrl.title = record.shortUrl;
  editState.dataset.state = state;
  editState.textContent = state;
  editDestinationInput.value = record.destination;
  editExpirationSelect.value = "keep";
  editCustomExpirationInput.value = "";
  editCustomExpirationField.classList.add("hidden");
  editCurrentExpiration.textContent = record.expiresAt
    ? `Current: ${new Date(record.expiresAt).toLocaleString()}`
    : "Current: never expires";
  editStatus.textContent = "";
  editStatus.dataset.kind = "";
  editDialog.showModal();
  editDestinationInput.focus();
  editDestinationInput.select();
}

function actionButton(label: string, action: string, record: LinkRecord, danger = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.recordKey = recordKey(record);
  if (danger) button.className = "danger";
  return button;
}

function renderHistory(records: LinkRecord[]): void {
  historyList.replaceChildren();
  linksCount.textContent = String(records.length);
  const query = historySearchInput.value.trim().toLocaleLowerCase();
  const visibleRecords = records
    .filter((record) => !query || [record.code, record.shortUrl, record.destination]
      .some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((left, right) => Number(right.favorite) - Number(left.favorite)
      || Date.parse(right.createdAt) - Date.parse(left.createdAt));

  if (visibleRecords.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = records.length === 0 ? "No links created yet." : "No matching links.";
    historyList.append(empty);
    showMoreLinksButton.classList.add("hidden");
    return;
  }

  const displayedRecords = query || historyExpanded ? visibleRecords : visibleRecords.slice(0, 8);
  for (const record of displayedRecords) {
    const item = document.createElement("li");
    const top = document.createElement("div");
    const link = document.createElement("a");
    const favorite = document.createElement("button");
    const badge = document.createElement("span");
    const destination = document.createElement("small");
    const metadata = document.createElement("div");
    const actions = document.createElement("div");
    const state = linkState(record);

    top.className = "history-top";
    link.href = record.shortUrl;
    link.target = "_blank";
    link.textContent = record.shortUrl;
    favorite.type = "button";
    favorite.className = "favorite-button";
    favorite.dataset.action = "favorite";
    favorite.dataset.recordKey = recordKey(record);
    favorite.dataset.favorite = String(record.favorite);
    favorite.textContent = record.favorite ? "★" : "☆";
    favorite.title = record.favorite ? "Remove from favorites" : "Add to favorites";
    favorite.setAttribute("aria-label", favorite.title);
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
      actionButton("Copy", "copy", record),
      actionButton("QR", "qr", record),
      actionButton("Edit", "edit", record),
      actionButton(record.disabled ? "Enable" : "Disable", "toggle", record),
      actionButton("Delete", "delete", record, true)
    );

    top.append(favorite, link, badge);
    item.append(top, destination, metadata, actions);
    historyList.append(item);
  }

  showMoreLinksButton.classList.toggle("hidden", Boolean(query) || visibleRecords.length <= 8);
  showMoreLinksButton.textContent = historyExpanded
    ? "Show less"
    : `Show ${visibleRecords.length - 8} more`;
}

function setStatus(message: string, kind?: "success" | "error"): void {
  if (toastTimer) clearTimeout(toastTimer);
  if (toastExitTimer) clearTimeout(toastExitTimer);
  if (!message) {
    toast.classList.remove("is-visible");
    toast.classList.add("is-leaving");
    const exitDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 140;
    toastExitTimer = setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove("is-leaving");
      toastMessage.textContent = "";
    }, exitDelay);
    return;
  }

  toast.classList.remove("is-visible", "is-leaving");
  toastMessage.textContent = message;
  toast.dataset.kind = kind || "info";
  toast.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  toast.hidden = false;
  void toast.offsetWidth;
  toast.classList.add("is-visible");

  if (kind !== "error") {
    toastTimer = setTimeout(() => setStatus(""), 4000);
  }
}

function switchView(view: AppView): void {
  for (const button of navButtons) {
    button.setAttribute("aria-selected", String(button.dataset.view === view));
  }
  for (const panel of viewPanels) {
    const selected = panel.dataset.viewPanel === view;
    panel.classList.toggle("hidden", !selected);
    panel.classList.remove("panel-enter");
    if (selected) {
      void panel.offsetWidth;
      panel.classList.add("panel-enter");
    }
  }
  void browser.storage.session.set({ activeView: view });
}

function loadBrandMark(): Promise<HTMLImageElement> {
  if (!brandMarkPromise) {
    brandMarkPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The LinkWisp QR mark could not be loaded."));
      image.src = browser.runtime.getURL("/brand/wisp-link.svg");
    });
  }
  return brandMarkPromise;
}

function roundedSquare(context: CanvasRenderingContext2D, x: number, y: number, size: number, radius: number): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + size - radius, y);
  context.quadraticCurveTo(x + size, y, x + size, y + radius);
  context.lineTo(x + size, y + size - radius);
  context.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
  context.lineTo(x + radius, y + size);
  context.quadraticCurveTo(x, y + size, x, y + size - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

async function createBrandedQrCode(shortUrl: string): Promise<string> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, shortUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 320,
    color: { dark: "#215F42", light: "#F4F7F2" }
  });

  const context = canvas.getContext("2d");
  if (!context) throw new Error("The QR drawing surface is unavailable.");
  const plateSize = 58;
  const platePosition = (canvas.width - plateSize) / 2;
  context.fillStyle = "#F4F7F2";
  roundedSquare(context, platePosition, platePosition, plateSize, 12);
  context.fill();

  const mark = await loadBrandMark();
  const markSize = 46;
  const markPosition = (canvas.width - markSize) / 2;
  context.drawImage(mark, markPosition, markPosition, markSize, markSize);
  return canvas.toDataURL("image/png");
}

function candidateSettings(serviceUrl: string, accessToken: string): Settings {
  return {
    serviceUrl: serviceUrl.trim().replace(/\/$/, ""),
    accessToken: accessToken.trim()
  };
}

function showOnboarding(settings: Settings): void {
  onboardingServiceUrlInput.value = settings.serviceUrl;
  onboardingAccessTokenInput.value = settings.accessToken;
  onboardingStatus.textContent = "";
  onboardingStatus.dataset.kind = "";
  if (!onboardingDialog.open) onboardingDialog.showModal();
}

async function verifyAndSave(settings: Settings): Promise<void> {
  await testConnection(settings);
  await browser.storage.local.set({
    serviceUrl: settings.serviceUrl,
    accessToken: settings.accessToken,
    onboardingComplete: true
  });
  serviceUrlInput.value = settings.serviceUrl;
  accessTokenInput.value = settings.accessToken;
  onboardingServiceUrlInput.value = settings.serviceUrl;
  onboardingAccessTokenInput.value = settings.accessToken;
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
  for (const version of aboutVersions) version.textContent = browser.runtime.getManifest().version;
  const [settings, history, tabs, session, onboarding] = await Promise.all([
    loadSettings(),
    loadHistory(),
    browser.tabs.query({ active: true, currentWindow: true }),
    browser.storage.session.get(["pendingDestination", "activeView"]),
    browser.storage.local.get("onboardingComplete")
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
  const rememberedView = session.activeView;
  switchView(pendingDestination || (rememberedView !== "links" && rememberedView !== "settings")
    ? "create"
    : rememberedView);
  if (onboarding.onboardingComplete !== true) showOnboarding(settings);
}

expirationSelect.addEventListener("change", () => {
  customExpirationField.classList.toggle("hidden", expirationSelect.value !== "custom");
});

historySearchInput.addEventListener("input", async () => renderHistory(await loadHistory()));

for (const button of navButtons) {
  button.addEventListener("click", () => switchView(button.dataset.view as AppView));
}

toastCloseButton.addEventListener("click", () => setStatus(""));

openAboutButton.addEventListener("click", () => aboutDialog.showModal());
closeAboutButton.addEventListener("click", () => aboutDialog.close());
aboutDialog.addEventListener("click", (event) => {
  if (event.target !== aboutDialog) return;
  const bounds = aboutDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left
    || event.clientX > bounds.right
    || event.clientY < bounds.top
    || event.clientY > bounds.bottom;
  if (outside) aboutDialog.close();
});

editExpirationSelect.addEventListener("change", () => {
  editCustomExpirationField.classList.toggle(
    "hidden",
    editExpirationSelect.value !== "custom"
  );
  editStatus.textContent = "";
  editStatus.dataset.kind = "";
  if (editExpirationSelect.value === "custom") {
    editCustomExpirationInput.focus();
  }
});

editDestinationInput.addEventListener("input", () => {
  editStatus.textContent = "";
  editStatus.dataset.kind = "";
});

cancelEditButton.addEventListener("click", () => {
  if (!editSaving) editDialog.close();
});

editDialog.addEventListener("cancel", (event) => {
  if (editSaving) event.preventDefault();
});

editDialog.addEventListener("close", () => {
  currentEditRecordKey = "";
  editForm.reset();
  editCustomExpirationField.classList.add("hidden");
  editStatus.textContent = "";
  editStatus.dataset.kind = "";
});

editDialog.addEventListener("click", (event) => {
  if (event.target !== editDialog) return;
  const bounds = editDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left
    || event.clientX > bounds.right
    || event.clientY < bounds.top
    || event.clientY > bounds.bottom;
  if (outside && !editSaving) editDialog.close();
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentEditRecordKey) return;

  editSaving = true;
  saveEditButton.disabled = true;
  cancelEditButton.disabled = true;
  editStatus.textContent = "Saving changes...";
  editStatus.dataset.kind = "";

  try {
    const history = await loadHistory();
    const record = history.find((item) => recordKey(item) === currentEditRecordKey);
    if (!record) throw new Error("This link is no longer in local history.");

    const changes = buildEditLinkChanges(
      record,
      editDestinationInput.value,
      editExpirationSelect.value as EditExpirationChoice,
      editCustomExpirationInput.value
    );
    const settings = await loadSettings();
    const updated = await updateShortLink(settings, record, changes.update);
    await saveHistory(history.map((item) =>
      recordKey(item) === currentEditRecordKey ? updated : item
    ));

    editDialog.close();
    const trackingMessage = changes.removedTrackingParameters
      ? ` ${changes.removedTrackingParameters} tracking parameter${changes.removedTrackingParameters === 1 ? "" : "s"} removed.`
      : "";
    setStatus(`Link updated.${trackingMessage}`, "success");
  } catch (error) {
    editStatus.textContent = error instanceof Error
      ? error.message
      : "The link could not be updated.";
    editStatus.dataset.kind = "error";
  } finally {
    editSaving = false;
    saveEditButton.disabled = false;
    cancelEditButton.disabled = false;
  }
});

showMoreLinksButton.addEventListener("click", async () => {
  historyExpanded = !historyExpanded;
  renderHistory(await loadHistory());
});

saveSettingsButton.addEventListener("click", async () => {
  saveSettingsButton.disabled = true;
  setStatus("");
  try {
    await verifyAndSave(candidateSettings(serviceUrlInput.value, accessTokenInput.value));
    setStatus("Connection verified and saved.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Connection verification failed.", "error");
  } finally {
    saveSettingsButton.disabled = false;
  }
});

openOnboardingButton.addEventListener("click", async () => showOnboarding(await loadSettings()));

dismissOnboardingButton.addEventListener("click", () => onboardingDialog.close());

onboardingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  finishOnboardingButton.disabled = true;
  onboardingStatus.textContent = "Testing connection...";
  onboardingStatus.dataset.kind = "";

  try {
    await verifyAndSave(candidateSettings(
      onboardingServiceUrlInput.value,
      onboardingAccessTokenInput.value
    ));
    onboardingStatus.textContent = "Connection verified. Setup is complete.";
    onboardingStatus.dataset.kind = "success";
    setStatus("Connection verified and saved.", "success");
    onboardingDialog.close();
  } catch (error) {
    onboardingStatus.textContent = error instanceof Error ? error.message : "Connection verification failed.";
    onboardingStatus.dataset.kind = "error";
  } finally {
    finishOnboardingButton.disabled = false;
  }
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
    await saveHistory([record, ...history.filter((item) => recordKey(item) !== recordKey(record))]);
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
  if (!button?.dataset.recordKey || !button.dataset.action) return;

  const history = await loadHistory();
  const record = history.find((item) => recordKey(item) === button.dataset.recordKey);
  if (!record) return;

  button.disabled = true;
  setStatus("");

  try {
    if (button.dataset.action === "copy") {
      await navigator.clipboard.writeText(record.shortUrl);
      setStatus("Short link copied.", "success");
      return;
    }

    if (button.dataset.action === "qr") {
      const state = linkState(record);
      currentQrDataUrl = await createBrandedQrCode(record.shortUrl);
      currentQrCode = record.code;
      qrImage.src = currentQrDataUrl;
      qrUrl.textContent = record.shortUrl;
      qrState.dataset.state = state;
      qrState.textContent = state === "disabled"
        ? "This link is disabled. The QR will redirect after you enable the link."
        : state === "expired"
          ? `This link expired ${new Date(record.expiresAt!).toLocaleString()}. The QR currently opens an expired-link response.`
          : "This link is active and ready to scan.";
      qrDialog.showModal();
      return;
    }

    if (button.dataset.action === "favorite") {
      const nextHistory = history.map((item) => recordKey(item) === recordKey(record)
        ? { ...item, favorite: !item.favorite }
        : item);
      await saveHistory(nextHistory);
      setStatus(record.favorite ? "Removed from favorites." : "Added to favorites.", "success");
      return;
    }

    const settings = await loadSettings();
    let nextHistory = history;

    if (button.dataset.action === "edit") {
      showEditDialog(record);
      return;
    }

    if (button.dataset.action === "toggle") {
      const updated = await updateShortLink(settings, record, { disabled: !record.disabled });
      nextHistory = history.map((item) => recordKey(item) === recordKey(record) ? updated : item);
      setStatus(updated.disabled ? "Link disabled." : "Link enabled.", "success");
    }

    if (button.dataset.action === "delete") {
      if (!window.confirm(`Permanently delete ${record.shortUrl}?`)) return;
      await deleteShortLink(settings, record);
      nextHistory = history.filter((item) => recordKey(item) !== recordKey(record));
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

exportBackupButton.addEventListener("click", async () => {
  try {
    const history = await loadHistory();
    if (history.length === 0) throw new Error("There are no local links to export.");

    const contents = JSON.stringify(createBackup(history), null, 2);
    const objectUrl = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const download = document.createElement("a");
    download.href = objectUrl;
    download.download = `linkwisp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    download.click();
    URL.revokeObjectURL(objectUrl);
    setStatus(`${history.length} link${history.length === 1 ? "" : "s"} exported.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The backup could not be exported.", "error");
  }
});

importBackupButton.addEventListener("click", () => backupFileInput.click());

backupFileInput.addEventListener("change", async () => {
  const file = backupFileInput.files?.[0];
  if (!file) return;

  try {
    if (file.size > 5_000_000) throw new Error("The selected backup is too large.");
    const imported = parseBackup(await file.text());
    if (!window.confirm(
      `Import ${imported.length} link${imported.length === 1 ? "" : "s"}? Matching records will be updated.`
    )) return;

    const current = await loadHistory();
    const result = mergeImportedRecords(current, imported);
    await saveHistory(result.records);
    switchView("links");
    setStatus(`Import complete: ${result.added} added, ${result.updated} updated.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The backup could not be imported.", "error");
  } finally {
    backupFileInput.value = "";
  }
});

downloadQrButton.addEventListener("click", () => {
  if (!currentQrDataUrl || !currentQrCode) return;
  const download = document.createElement("a");
  download.href = currentQrDataUrl;
  download.download = `linkwisp-${currentQrCode}-qr.png`;
  download.click();
  setStatus("QR code downloaded.", "success");
});

closeQrButton.addEventListener("click", () => qrDialog.close());

void initialize();
