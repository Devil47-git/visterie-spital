import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    // Nu punem maxAge: 0 aici. Folosim setarile de cookies de mai jos.
    maxAge: 24 * 60 * 60, // Sesiunea expira dupa 24h daca browserul ramane deschis
  },
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { prompt: "consent" } },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Cand utilizatorul se logheaza (user obiectul exista doar la login)
      if (user) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { discordId: true, callsign: true, rol: true, username: true, avatar: true },
          });

          if (dbUser) {
            token.id = user.id;
            token.discordId = dbUser.discordId;
            token.callsign = dbUser.callsign;
            token.rol = dbUser.rol;
            token.username = dbUser.username;
            token.avatar = dbUser.avatar;
          }
        } catch (error) {
          console.error("=== JWT CALLBACK ERROR ===", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.discordId = token.discordId as string;
        session.user.callsign = token.callsign as string;
        session.user.rol = token.rol as string;
        session.user.username = token.username as string;
        session.user.avatar = token.avatar as string;
      }
      return session;
    },
    async signIn({ account, profile }) {
      try {
        if (account?.provider === "discord" && profile) {
          const discordProfile = profile as any;
          const discordId = discordProfile.id;

          const username = discordProfile.discriminator === "0"
            ? `@${discordProfile.username}`
            : `@${discordProfile.username}#${discordProfile.discriminator}`;

          const avatar = discordProfile.avatar
            ? `https://cdn.discordapp.com/avatars/${discordId}/${discordProfile.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/0.png`;

          const whitelist = await prisma.whitelist.findUnique({
            where: { discordId },
          });

          const existingUser = await prisma.user.findFirst({
            where: {
              accounts: {
                some: {
                  provider: "discord",
                  providerAccountId: discordId,
                },
              },
            },
          });

          if (existingUser) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                discordId,
                username,
                avatar,
                callsign: whitelist?.callsign ?? null,
                rol: whitelist?.rol ?? "user",
              },
            });
          }
        }
        return true;
      } catch (error) {
        console.error("=== SIGNIN CALLBACK ERROR ===", error);
        // Lasam true temporar ca sa nu mascam eroarea cu AccessDenied.
        // Dupa ce gasim cauza, revenim la "return false" daca e nevoie.
        return true;
      }
    },
  },
  // --- ACEASTA PARTE REZOLVA STERGEREA LA INCHIDEREA BROWSERULUI ---
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // FARA maxAge aici = Session Cookie (se sterge cand inchizi browserul)
      },
    },
  },
  // ----------------------------------------------------------------
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
});
