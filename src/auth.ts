import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",

    maxAge: 24 * 60 * 60,
  },
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      issuer: "https://discord.com",
      authorization: { params: { prompt: "consent" } },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
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
        return true;
      }
    },
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",

      },
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
});