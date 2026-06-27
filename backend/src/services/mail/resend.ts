import type { EmailProvider } from './types'

export const resendProvider: EmailProvider = {
  async send({ to, subject, html, config }) {
    const apiKey = config.apiKey
    if (!apiKey) return false

    const res = await fetch('https://api.resend.com/emails', {
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
    })

    return res.ok
  },
}
