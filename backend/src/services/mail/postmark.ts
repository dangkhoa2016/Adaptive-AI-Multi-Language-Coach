import type { EmailProvider } from './types'

export const postmarkProvider: EmailProvider = {
  async send({ to, subject, html, config }) {
    const serverToken = config.serverToken
    if (!serverToken) return false

    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': serverToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        From: config.from ?? 'noreply@vocab.app',
        To: to,
        Subject: subject,
        HtmlBody: html,
      }),
    })

    return res.ok
  },
}
