// Background service worker (skeleton)
// Responsibilities (to implement later):
// - handle commands from popup/options
// - mediate between storage, content scripts and UI

import { pdfService } from '../services/pdfService'

// Background service worker mediates resume attachments and other cross-tab actions.

self.addEventListener('install', () => {
  // Service worker installed for extension background tasks
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return

  if (message.action === 'attachResume') {
    const { resumeId, tabId, meta } = message
    ;(async () => {
      try {
        const blob = await pdfService.getPdf(resumeId)
        if (!blob) {
          sendResponse({ success: false, reason: 'not_found' })
          return
        }
        const buffer = await blob.arrayBuffer()
        chrome.tabs.sendMessage(tabId, { action: 'UPLOAD_PDF', buffer, meta }, (resp) => {
          sendResponse(resp)
        })
      } catch (err) {
        sendResponse({ success: false, reason: 'error', error: String(err) })
      }
    })()
    return true // async
  }

  return
})

export {}
