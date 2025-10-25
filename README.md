# Checkmail

A Next.js app that authenticates with Google, fetches Gmail messages, and classifies emails using OpenAI.

## Features
- Google OAuth via NextAuth (`gmail.readonly` scope)
- Server endpoint `GET /api/gmail` to list messages and fetch full content by `id`
- Email classification endpoint `POST /api/classify` using your OpenAI API key
- Dashboard with dropdown for count, login/logout, and click-to-view email details

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Environment
Create `.env.local` in the project root with:

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=any-strong-secret
OPENAI_API_KEY=your-openai-key
NEXTAUTH_URL=http://localhost:3000
```

Ensure the Gmail API is enabled on your Google Cloud project and the OAuth consent screen is configured.
