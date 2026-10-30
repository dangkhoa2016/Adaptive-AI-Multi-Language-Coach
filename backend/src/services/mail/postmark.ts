import type { EmailProvider } from './types'
import { fetchMail } from './http'

export const postmarkProvider: EmailProvider = {
  async send({ to, subject, html, config, timeoutMs }) {
    const serverToken = config.serverToken
    if (!serverToken) return false

    return fetchMail(
      'https://api.postmarkapp.com/email',
      {
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
      },
      timeoutMs,
    )
  },
}
