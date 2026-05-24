// Floating button, checkbox, and toast UI
let floatingBtn = null
let toastEl = null

function injectStyles() {
  const style = document.createElement("style")
  style.textContent = `
    #aija-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      background: #2563eb; color: white; padding: 10px 18px;
      border-radius: 10px; cursor: pointer; font-size: 14px;
      box-shadow: 0 4px 16px rgba(37,99,235,.35);
      display: flex; align-items: center; gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      border: none; transition: transform .15s, box-shadow .15s;
      user-select: none;
    }
    #aija-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37,99,235,.45); }
    #aija-btn:active { transform: translateY(0); }
    #aija-btn.loading { opacity: .7; pointer-events: none; }
    #aija-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
    .aija-checkbox {
      position: absolute; top: 8px; left: 8px; z-index: 10;
      width: 18px; height: 18px; cursor: pointer; accent-color: #2563eb;
    }
    .aija-toast {
      position: fixed; top: 16px; right: 16px; z-index: 99999;
      padding: 12px 20px; border-radius: 10px; color: white;
      font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,.15);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: aija-fadeIn .3s ease;
    }
    .aija-toast.success { background: #16a34a; }
    .aija-toast.error { background: #dc2626; }
    @keyframes aija-fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  `
  document.head.appendChild(style)
}

function createFloatingButton() {
  if (floatingBtn) return
  floatingBtn = document.createElement("button")
  floatingBtn.type = "button"
  floatingBtn.id = "aija-btn"
  floatingBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
    <span id="aija-btn-text">采集到Landr</span>
  `
  document.body.appendChild(floatingBtn)
  return floatingBtn
}

function updateButtonText(text) {
  const span = document.getElementById("aija-btn-text")
  if (span) span.textContent = text
}

function setButtonLoading(loading) {
  if (floatingBtn) {
    floatingBtn.classList.toggle("loading", loading)
    updateButtonText(loading ? "采集中..." : "采集到Landr")
  }
}

function showToast(message, type = "success") {
  if (toastEl) toastEl.remove()
  toastEl = document.createElement("div")
  toastEl.className = `aija-toast ${type}`
  toastEl.textContent = message
  document.body.appendChild(toastEl)
  setTimeout(() => toastEl?.remove(), 3000)
}

// Checkbox injection for list pages
function decorateListItems(containerSelector, itemSelector, extractor) {
  const items = document.querySelectorAll(itemSelector)
  items.forEach((item) => {
    if (item.querySelector(".aija-checkbox")) return
    const cb = document.createElement("input")
    cb.type = "checkbox"
    cb.className = "aija-checkbox"
    cb.title = "选择此岗位"
    const posStyle = window.getComputedStyle(item).position
    if (posStyle === "static") item.style.position = "relative"
    item.appendChild(cb)
  })
}

function getSelectedItems() {
  const checkboxes = document.querySelectorAll(".aija-checkbox:checked")
  return Array.from(checkboxes).map((cb) => cb.parentElement)
}

function getSelectedCount() {
  return document.querySelectorAll(".aija-checkbox:checked").length
}

function showBatchButton(extractor) {
  const count = getSelectedCount()
  if (count > 0) {
    updateButtonText(`批量采集 (已选${count})`)
  } else {
    updateButtonText("采集到Landr")
  }
}

// Watch for DOM changes (infinite scroll)
function observeListChanges(containerSelector, itemSelector, extractor) {
  const container = document.querySelector(containerSelector) || document.body
  let timeout
  const observer = new MutationObserver(() => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      decorateListItems(containerSelector, itemSelector, extractor)
    }, 500)
  })
  observer.observe(container, { childList: true, subtree: true })
  return observer
}
