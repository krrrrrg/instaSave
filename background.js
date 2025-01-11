chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'download') {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('다운로드 오류:', chrome.runtime.lastError);
      }
      // Blob URL 정리
      URL.revokeObjectURL(message.url);
    });
  }
  return true;
}); 