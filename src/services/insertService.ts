export interface InsertResult {
  success: boolean
  message: string
}

function sendInsert(tabId: number, text: string): Promise<InsertResult> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'INSERT_SNIPPET', text }, (resp) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, message: chrome.runtime.lastError.message || 'Erro ao inserir' })
        return
      }
      if (resp?.success) resolve({ success: true, message: 'Inserido' })
      else if (resp?.reason === 'no_target') {
        resolve({ success: false, message: 'Clique em um campo da página antes de inserir' })
      } else resolve({ success: false, message: 'Falha ao inserir' })
    })
  })
}

export async function insertTextIntoPage(text: string): Promise<InsertResult> {
  if (!text.trim()) return { success: false, message: 'Nada para inserir' }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab?.id) return { success: false, message: 'Nenhuma aba ativa encontrada' }

  let result = await sendInsert(tab.id, text)
  if (result.success) return result

  const needsInject = result.message.includes('Receiving end does not exist')
  if (!needsInject) return result

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
  } catch {
    return { success: false, message: 'Não foi possível acessar a página' }
  }

  return sendInsert(tab.id, text)
}

export default insertTextIntoPage
