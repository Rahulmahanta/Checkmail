import NextAuth, { type NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

async function refreshAccessToken(token: any) {
  try {
    const url = "https://oauth2.googleapis.com/token"
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      grant_type: "refresh_token",
      refresh_token: token.refreshToken as string,
    })

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("Failed to refresh Google access token:", err)
      return { ...token, error: "RefreshAccessTokenError" }
    }

    const refreshed = await res.json()
    const expiresAt = Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600)

    return {
      ...token,
      accessToken: refreshed.access_token,
      expires_at: expiresAt,
      // Fall back to old refresh token if Google did not return a new one
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    }
  } catch (e) {
    console.error("Refresh token error:", e)
    return { ...token, error: "RefreshAccessTokenError" }
  }
}

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope:
            "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign-in
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          expires_at: account.expires_at,
          refreshToken: account.refresh_token,
        }
      }

      // If token hasn't expired, return it
      if (token.expires_at && Date.now() / 1000 < token.expires_at) {
        return token
      }

      // Token expired, try to refresh
      if (token.refreshToken) {
        return await refreshAccessToken(token)
      }

      // No refresh token, return token as-is
      return token
    },
    async session({ session, token }) {
      // Expose access token to the client
      session.accessToken = token.accessToken as string
      return session
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }