import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Restrict to @berkeley.edu emails only
      if (user.email && user.email.endsWith('@berkeley.edu')) {
        // Ensure TAProfile exists
        try {
          await prisma.tAProfile.upsert({
            where: { userId: user.id },
            update: {},
            create: {
              userId: user.id,
              name: user.name ?? '',
              email: user.email ?? '',
            },
          });
        } catch (err) {
          console.error('TAProfile upsert error:', err);
        }
        return true;
      }
      return false; // Deny sign-in for non-Berkeley emails
    },
    async session({ session, user }) {
      // Attach user id to session as userId (custom property)
      if (session.user) {
        // @ts-ignore
        session.user.userId = user.id;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Create TAProfile when a new User record is created
      try {
        await prisma.tAProfile.create({
          data: {
            userId: user.id,
            name: user.name ?? '',
            email: user.email ?? '',
          },
        });
      } catch (err) {
        // Ignore if profile already exists
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error', // Error page for unauthorized
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 