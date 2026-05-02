// Background service worker — message relay between popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_JOB") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) {
        sendResponse({ error: "No active tab" })
        return
      }
      chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB" }, (result) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message })
        } else {
          sendResponse(result || {})
        }
      })
    })
    return true // keep channel open for async
  }

  if (message.type === "GET_PLATFORM") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.url) {
        sendResponse({ platform: "unknown" })
        return
      }
      const url = tab.url
      if (/zhipin\.com/.test(url)) sendResponse({ platform: "Boss直聘" })
      else if (/linkedin\.com/.test(url)) sendResponse({ platform: "LinkedIn" })
      else if (/lagou\.com/.test(url)) sendResponse({ platform: "拉勾" })
      else if (/zhaopin\.com/.test(url)) sendResponse({ platform: "智联" })
      else if (/xiaohongshu\.com/.test(url)) sendResponse({ platform: "小红书" })
      else sendResponse({ platform: "非招聘平台" })
    })
    return true
  }
})
