function findMediaInPage() {
  const media = {
    images: [],
    videos: [],
    profileImages: [],
    thumbnails: []
  };
  
  // 피드의 게시물 찾기 (포스트 내 이미지/비디오)
  const articles = document.querySelectorAll('article');
  articles.forEach(article => {
    // 이미지 찾기 - 여러 가능한 선택자 시도
    const images = Array.from(article.querySelectorAll('img'))
      .filter(img => {
        const rect = img.getBoundingClientRect();
        // 작은 아이콘이나 프로필 이미지 제외
        return rect.width > 100 && rect.height > 100 && !img.closest('header');
      });
    
    // 비디오 찾기
    const videos = Array.from(article.querySelectorAll('video'));
    
    media.images.push(...images);
    media.videos.push(...videos);
  });

  // 프로필 페이지의 썸네일 찾기 (그리드 뷰의 이미지들)
  const gridItems = document.querySelectorAll('div[style*="flex-direction: column"] img');
  gridItems.forEach(img => {
    const container = img.closest('div[style*="flex-direction: column"]');
    if (container && img.src.includes('instagram')) {
      media.thumbnails.push({
        element: img,
        container: container
      });
    }
  });

  // 프로필 이미지 찾기
  const profileImgs = Array.from(document.querySelectorAll('img'))
    .filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width <= 150 && rect.height <= 150 && img.src.includes('instagram');
    });
  media.profileImages.push(...profileImgs);
  
  return media;
}

function createDownloadButton(container, media, type) {
  const button = document.createElement('button');
  button.className = 'instagram-download-btn';
  button.innerHTML = '다운로드';
  button.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 999;
    background: #0095f6;
    color: white;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    opacity: 0;
    transition: opacity 0.3s;
  `;

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 현재 보이는 이미지/비디오 찾기
    const getCurrentMedia = () => {
      if (type === 'video') {
        const video = container.querySelector('video');
        return video ? { element: video, type: 'video' } : null;
      } else {
        // 캐러셀에서 현재 보이는 이미지 찾기
        const visibleImage = Array.from(container.querySelectorAll('img'))
          .find(img => {
            const rect = img.getBoundingClientRect();
            return rect.width > 100 && rect.height > 100 && 
                   !img.closest('header') && 
                   rect.x >= 0 && rect.x <= window.innerWidth;
          });
        return visibleImage ? { element: visibleImage, type: 'image' } : null;
      }
    };

    const currentMedia = getCurrentMedia();
    if (!currentMedia) return;

    let url;
    if (currentMedia.type === 'video') {
      const source = currentMedia.element.querySelector('source');
      url = source ? source.src : currentMedia.element.src;
    } else {
      url = currentMedia.element.srcset ? 
        currentMedia.element.srcset.split(',')
          .map(src => {
            const [sourceUrl, size] = src.trim().split(' ');
            return { url: sourceUrl, size: parseInt(size || '0') };
          })
          .sort((a, b) => b.size - a.size)[0].url
        : currentMedia.element.src;
    }

    if (url) {
      chrome.runtime.sendMessage({
        action: 'downloadMedia',
        url: url,
        type: currentMedia.type
      });
    }
  });

  container.style.position = 'relative';
  container.addEventListener('mouseenter', () => button.style.opacity = '1');
  container.addEventListener('mouseleave', () => button.style.opacity = '0');
  container.appendChild(button);
}

async function downloadMedia(url, type) {
  try {
    // Instagram CDN URL에서 실제 이미지/비디오 URL 추출
    const mediaUrl = url.split('?')[0];
    
    // 파일 이름 생성
    const timestamp = new Date().getTime();
    let extension;
    
    // 타입과 URL에 따른 확장자 결정
    if (type === 'video') {
      extension = '.mp4';
    } else {
      // URL에서 실제 확장자 추출 시도
      const urlExtension = mediaUrl.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif'].includes(urlExtension)) {
        extension = `.${urlExtension}`;
      } else {
        extension = '.jpg';  // 기본값
      }
    }

    const filename = `instagram_${type}_${timestamp}${extension}`;

    // background script에 다운로드 요청
    chrome.runtime.sendMessage({
      action: 'downloadMedia',
      url: mediaUrl,
      filename: filename,
      type: type
    });
  } catch (error) {
    console.error('다운로드 중 오류 발생:', error);
  }
}

function addDownloadButtons() {
  const { images, videos, profileImages, thumbnails } = findMediaInPage();
  
  // 게시물 이미지/비디오에 다운로드 버튼 추가
  images.forEach(img => {
    const article = img.closest('article');
    if (article && !article.querySelector('.instagram-download-btn')) {
      createDownloadButton(article, img, 'image');
    }
  });

  videos.forEach(video => {
    const article = video.closest('article');
    if (article && !article.querySelector('.instagram-download-btn')) {
      createDownloadButton(article, video, 'video');
    }
  });

  // 썸네일에 다운로드 버튼 추가
  thumbnails.forEach(thumbnail => {
    if (!thumbnail.container.querySelector('.instagram-download-btn')) {
      createDownloadButton(thumbnail.container, thumbnail, 'thumbnail');
    }
  });

  // 프로필 이미지에 다운로드 버튼 추가
  profileImages.forEach(img => {
    const container = img.parentElement;
    if (container && !container.querySelector('.instagram-profile-download-btn')) {
      createProfileImageButton(container, img);
    }
  });
}

// 페이지 변경 감지
const observer = new MutationObserver(() => {
  setTimeout(addDownloadButtons, 1000);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 초기 실행
setTimeout(addDownloadButtons, 1500);

// getHighestQualityUrl 함수 추가
function getHighestQualityUrl(element) {
  if (element.tagName === 'VIDEO') {
    // 비디오 소스 URL 가져오기
    const sources = Array.from(element.querySelectorAll('source'));
    if (sources.length > 0) {
      // 가장 높은 화질의 소스 선택
      const highestQualitySource = sources.reduce((prev, current) => {
        const prevQuality = parseInt(prev.getAttribute('size') || '0');
        const currentQuality = parseInt(current.getAttribute('size') || '0');
        return currentQuality > prevQuality ? current : prev;
      });
      return highestQualitySource.src;
    }
    return element.src || element.currentSrc;
  }
  
  // 이미지의 경우 srcset에서 가장 큰 이미지 URL 선택
  if (element.srcset) {
    const sources = element.srcset.split(',')
      .map(src => {
        const [url, size] = src.trim().split(' ');
        return { url, size: parseInt(size || '0') };
      })
      .sort((a, b) => b.size - a.size);
    
    if (sources.length > 0) {
      return sources[0].url;
    }
  }
  return element.src;
}

// 프로필 이미지 URL 가져오는 함수 추가
function getFullSizeProfileImage(url) {
  // 프로필 이미지 URL에서 크기 제한 파라미터 제거
  return url.replace(/\/s\d+x\d+(_\w+)?\//, '/').split('?')[0];
}

// createProfileImageButton 함수 수정
function createProfileImageButton(container, img) {
  const button = document.createElement('button');
  button.innerHTML = '프로필 저장';
  button.className = 'instagram-profile-download-btn';
  button.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    background: rgba(0, 149, 246, 0.8);
    color: white;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    opacity: 0;
    transition: opacity 0.2s;
  `;

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 프로필 이미지 URL 수정 (고화질 버전 가져오기)
    let fullSizeUrl = img.src;
    fullSizeUrl = fullSizeUrl.replace(/\/s150x150\//, '/');  // 크기 제한 제거
    fullSizeUrl = fullSizeUrl.split('?')[0];  // 쿼리 파라미터 제거
    
    console.log('Downloading profile:', fullSizeUrl);
    chrome.runtime.sendMessage({
      action: 'downloadMedia',
      url: fullSizeUrl,
      type: 'profile'
    });
  });

  container.style.position = 'relative';
  container.addEventListener('mouseenter', () => {
    button.style.opacity = '1';
    container.style.cursor = 'pointer';
  });
  container.addEventListener('mouseleave', () => button.style.opacity = '0');
  container.appendChild(button);
}

// 프로필 이미지 다운로드 버튼 추가
function addProfileDownloadButton(container, img) {
  const button = document.createElement('button');
  button.textContent = '프로필 다운로드';
  button.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    z-index: 9999;
    background: #0095f6;
    color: white;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.3s;
  `;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 고화질 버전 URL로 변경 (/s150x150 제거)
    const fullQualityUrl = img.src.replace('/s150x150', '');
    await downloadMedia(fullQualityUrl, 'profile');
  });

  container.style.position = 'relative';
  container.addEventListener('mouseenter', () => button.style.opacity = '1');
  container.addEventListener('mouseleave', () => button.style.opacity = '0');
  container.appendChild(button);
} 