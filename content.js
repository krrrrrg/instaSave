function findMediaInPage() {
  // 이미지 찾기
  const images = Array.from(document.querySelectorAll('img[srcset]'))
    .filter(img => {
      const src = img.src || '';
      return src.includes('instagram.com') || src.includes('cdninstagram.com');
    });

  // 비디오 찾기
  const videos = Array.from(document.querySelectorAll('video source, video[src]'));
  
  return { images, videos };
}

function getHighestQualityUrl(element) {
  if (element.tagName === 'IMG' && element.srcset) {
    const sources = element.srcset.split(',')
      .map(src => {
        const [url, size] = src.trim().split(' ');
        return {
          url,
          size: parseInt(size || '0')
        };
      })
      .sort((a, b) => b.size - a.size);
    
    return sources[0]?.url || element.src;
  }
  
  return element.src || element.currentSrc;
}

function createDownloadButton(container, url, type) {
  const button = document.createElement('button');
  button.innerHTML = '다운로드';
  button.className = 'instagram-download-btn';
  button.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 9999;
    background: #0095f6;
    color: white;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  `;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = type === 'video' ? '.mp4' : '.jpg';
      const filename = `instagram_${type}_${timestamp}${extension}`;

      chrome.runtime.sendMessage({
        type: 'download',
        url: objectUrl,
        filename: filename
      });
    } catch (error) {
      console.error('다운로드 중 오류:', error);
    }
  });

  container.style.position = 'relative';
  container.appendChild(button);
}

function addDownloadButtons() {
  const { images, videos } = findMediaInPage();
  
  images.forEach(img => {
    const container = img.parentElement;
    if (!container.querySelector('.instagram-download-btn')) {
      const url = getHighestQualityUrl(img);
      createDownloadButton(container, url, 'image');
    }
  });

  videos.forEach(video => {
    const container = video.parentElement;
    if (!container.querySelector('.instagram-download-btn')) {
      const url = getHighestQualityUrl(video);
      createDownloadButton(container, url, 'video');
    }
  });
}

// 페이지 변경 감지
const observer = new MutationObserver(() => {
  addDownloadButtons();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 초기 실행
addDownloadButtons(); 