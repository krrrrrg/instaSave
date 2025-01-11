chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadMedia') {
    // 미디어 타입에 따른 파일명과 확장자 설정
    const getFileInfo = (url, type) => {
      const timestamp = new Date().getTime();
      let filename, extension;

      // 타입별 파일명 형식 지정
      switch(type) {
        case 'profile':
          filename = `instagram_profile_${timestamp}`;
          break;
        case 'video':
          filename = `instagram_video_${timestamp}`;
          extension = 'mp4';  // 비디오는 항상 mp4로 저장
          return `${filename}.${extension}`;
        case 'thumbnail':
          filename = `instagram_post_${timestamp}`;
          break;
        default:
          filename = `instagram_image_${timestamp}`;
      }

      // 이미지 확장자 결정
      const urlExtension = url.split('?')[0].split('.').pop().toLowerCase();
      extension = ['jpg', 'jpeg', 'png', 'gif'].includes(urlExtension) ? urlExtension : 'jpg';
      
      return `${filename}.${extension}`;
    };

    // 다운로드 실행
    try {
      const filename = getFileInfo(request.url, request.type);
      
      // 단순화된 다운로드 요청
      chrome.downloads.download({
        url: request.url,
        filename: filename
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
        } else {
          console.log('Download success:', downloadId);
          sendResponse({ success: true, downloadId });
        }
      });
    } catch (error) {
      console.error('Download setup failed:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }

    return true;
  }
}); 