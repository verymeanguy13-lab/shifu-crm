// Session 6: Authentication
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { queryUnsafe } from "./db";
import type { Business } from "@/types/crm";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // businesses table has no RLS (it IS the tenant root), so
        // businessId arg here is unused — pass 0 as a harmless placeholder.
        const rows = await queryUnsafe<Business & { email: string; password_hash: string }>(
          `SELECT * FROM businesses WHERE email = $1`,
          [credentials.email],
          0
        );
        const business = rows[0];
        if (!business) return null;

        const valid = await bcrypt.compare(credentials.password, business.password_hash);
        if (!valid) return null;

        return {
          id: String(business.id),
          email: business.email,
          name: business.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.businessId = Number(user.id);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).businessId = token.businessId;
      }
      return session;
    },
  },
};
