export interface ClearHistoryCopy {
  heading: string;
  explanation: string;
}

export function clearHistoryCopy(recordCount: number): ClearHistoryCopy {
  const count = Math.max(0, Math.trunc(recordCount));
  const noun = count === 1 ? "link" : "links";

  return {
    heading: `Clear ${count} local ${noun}?`,
    explanation: "This removes history and link-management keys from this browser only. Your online short links will remain active."
  };
}
