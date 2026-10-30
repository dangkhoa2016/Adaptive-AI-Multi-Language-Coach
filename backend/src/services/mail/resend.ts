import type { EmailProvider } from './types'
import { fetchMail } from './http'

export const resendProvider: EmailProvider = {
  async send({ to, subject, html, config, timeoutMs }) {
    const apiKey = config.apiKey
    if (!apiKey) return false

    return fetchMail(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.from ?? 'noreply@vocab.app',
          to: [to],
          subject,
          html,
        }),
      },
      timeoutMs,
    )
  },
}
