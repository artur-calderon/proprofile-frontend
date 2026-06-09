// Content script implementation
// - tracks last active input/textarea/contenteditable element
// - handles messages to insert snippets and upload PDF files into file inputs

let lastActive: HTMLElement | null = null

function isEditable(el: Element | null) {
	if (!el) return false
	if (el instanceof HTMLInputElement) return el.type !== 'file' && !el.readOnly && !el.disabled
	if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
	if (el instanceof HTMLElement) return el.isContentEditable
	return false
}

document.addEventListener('focusin', (e) => {
	const target = e.target as HTMLElement | null
	if (isEditable(target)) lastActive = target
})

document.addEventListener('click', (e) => {
	const target = e.target as HTMLElement | null
	if (isEditable(target)) lastActive = target
})

function dispatchInputEvents(el: Element) {
	const input = new Event('input', { bubbles: true })
	const change = new Event('change', { bubbles: true })
	el.dispatchEvent(input)
	el.dispatchEvent(change)
}

function insertTextAtElement(el: HTMLElement, text: string) {
	if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
		const start = el.selectionStart ?? el.value.length
		const end = el.selectionEnd ?? start
		const value = el.value
		const newValue = value.slice(0, start) + text + value.slice(end)
		el.value = newValue
		const pos = start + text.length
		el.setSelectionRange(pos, pos)
		dispatchInputEvents(el)
		return true
	}

	if (el.isContentEditable) {
		const sel = window.getSelection()
		if (!sel || !sel.rangeCount) {
			el.textContent = (el.textContent || '') + text
		} else {
			const range = sel.getRangeAt(0)
			range.deleteContents()
			range.insertNode(document.createTextNode(text))
			range.collapse(false)
			sel.removeAllRanges()
			sel.addRange(range)
		}
		dispatchInputEvents(el)
		return true
	}

	return false
}

async function handleUploadPDF(buffer: ArrayBuffer, meta: { name?: string }) {
	// find visible file inputs
	const inputs = Array.from(document.querySelectorAll('input[type=file]')) as HTMLInputElement[]
	const visible = inputs.filter((i) => i.offsetParent !== null && !i.disabled)

	if (visible.length === 0) {
		return { success: false, reason: 'no_file_input' }
	}

	if (visible.length > 1) {
		return { success: false, reason: 'multiple_file_inputs', count: visible.length }
	}

	const input = visible[0]
	try {
		const file = new File([buffer], meta.name || 'resume.pdf', { type: 'application/pdf' })
		const dt = new DataTransfer()
		dt.items.add(file)
		input.files = dt.files
		dispatchInputEvents(input)
		return { success: true }
	} catch (err) {
		return { success: false, reason: 'failed_attach', error: String(err) }
	}
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (!msg || !msg.action) return

	if (msg.action === 'INSERT_SNIPPET') {
		const text = String(msg.text || '')
		const target = lastActive
		if (!target) {
			sendResponse({ success: false, reason: 'no_target' })
			return
		}
		const ok = insertTextAtElement(target, text)
		sendResponse({ success: ok })
		return
	}

	if (msg.action === 'UPLOAD_PDF') {
		const buffer: ArrayBuffer = msg.buffer
		const meta = msg.meta || {}
		handleUploadPDF(buffer, meta).then((result) => sendResponse(result))
		return true // indicate async response
	}
})

export {}
