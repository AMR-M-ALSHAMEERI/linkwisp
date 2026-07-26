export interface ConfirmationCopy {
  eyebrow: string;
  heading: string;
  explanation: string;
  warning: string;
  confirmLabel: string;
}

export function clearHistoryConfirmation(recordCount: number): ConfirmationCopy {
  const count = Math.max(0, Math.trunc(recordCount));
  const noun = count === 1 ? "link" : "links";

  return {
    eyebrow: "LOCAL HISTORY",
    heading: `Clear ${count} local ${noun}?`,
    explanation: "This removes history and link-management keys from this browser only. Your online short links will remain active.",
    warning: "This cannot be undone unless you exported a backup.",
    confirmLabel: "Clear history"
  };
}

export function deleteLinkConfirmation(shortUrl: string): ConfirmationCopy {
  return {
    eyebrow: "ONLINE LINK",
    heading: "Delete this short link?",
    explanation: `${shortUrl} will stop redirecting for everyone. Its local record is removed only after the service confirms deletion.`,
    warning: "This permanently removes the online mapping and cannot be undone.",
    confirmLabel: "Delete link"
  };
}
