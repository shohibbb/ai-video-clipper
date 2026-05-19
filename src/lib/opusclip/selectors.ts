function envSelector(name: string, fallback = "") {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export const opusClipSelectors = {
  uploadButton: envSelector("OPUSCLIP_UPLOAD_BUTTON_SELECTOR", 'button[aria-label="Upload file"]'),
  fileInput: envSelector("OPUSCLIP_FILE_INPUT_SELECTOR", 'input[aria-label="Input your file"], input[type="file"]'),
  urlInput: envSelector("OPUSCLIP_URL_INPUT_SELECTOR", 'input[aria-label="Input url"], input[type="url"], input[placeholder*="http"], textarea[placeholder*="http"]'),
  submitButton: envSelector("OPUSCLIP_SUBMIT_BUTTON_SELECTOR", 'button[aria-label="Get clips in 1 click"]'),
  processingCompleteIndicator: envSelector("OPUSCLIP_PROCESSING_COMPLETE_SELECTOR", "text=/Original clips/i"),
  generatedClipCard: envSelector("OPUSCLIP_GENERATED_CLIP_CARD_SELECTOR"),
  clipDownloadButton: envSelector("OPUSCLIP_CLIP_DOWNLOAD_BUTTON_SELECTOR", 'button:has-text("Download HD")'),
  newProjectButton: envSelector("OPUSCLIP_NEW_PROJECT_BUTTON_SELECTOR"),
  projectCard: envSelector("OPUSCLIP_PROJECT_CARD_SELECTOR", 'a[href^="/clip/"]'),
} as const;
