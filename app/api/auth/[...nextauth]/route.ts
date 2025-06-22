// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { AuthOptions } from "next-auth";
import { db } from "@/lib/db";

// Extend the Session user type to include 'id'
declare module "next-auth" {
  interface Session {
    user: {
      id?: number;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      if (!profile?.email) return false;

      const email = profile.email;
      const domain = email.split("@")[1];

      // Hanya izinkan email UB
      if (domain !== "student.ub.ac.id") {
        return "/?error=EmailNotStudentUB";
      }

      try {
        const userName = user.name || profile.name || "";

        // Cek apakah user sudah ada di tabel users
        const [userRows] = await db.query(
          "SELECT id FROM users WHERE email = ?",
          [email]
        );
        const userExists = Array.isArray(userRows) && userRows.length > 0;

        if (userExists) {
          // Update users table
          await db.query(
            "UPDATE users SET name = ?, image = ? WHERE email = ?",
            [userName, user.image || "", email]
          );
        } else {
          // Buat user baru jika tidak ada
          await db.query(
            "INSERT INTO users (email, name, image) VALUES (?, ?, ?)",
            [email, userName, user.image || ""]
          );
        }

        // Cek apakah user terdaftar sebagai panitia
        const [panitiaRows] = await db.query(
          "SELECT id FROM panitia WHERE email = ?",
          [email]
        );
        const isPanitia = Array.isArray(panitiaRows) && panitiaRows.length > 0;

        // Update name di panitia jika ada
        if (isPanitia && userName) {
          await db.query(
            "UPDATE panitia SET nama_lengkap = ? WHERE email = ?",
            [userName, email]
          );
        } else if (!isPanitia) {
          return "/?error=NotRegisteredPanitia";
        }

        return true;
      } catch (error) {
        console.error("Database error during sign-in:", error);
        return "/?error=DatabaseError";
      }
    },

    async session({ session }) {
      if (session?.user?.email) {
        try {
          const [rows] = await db.query(
            "SELECT id, email, name, image FROM users WHERE email = ?",
            [session.user.email]
          );

          if (Array.isArray(rows) && rows.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dbUser = rows[0] as any;
            
            // Update session dengan data dari database
            session.user.id = dbUser.id;
            if (dbUser.name) session.user.name = dbUser.name;
            if (dbUser.image) session.user.image = dbUser.image;
          }
        } catch (error) {
          console.error("Database error during session retrieval:", error);
        }
      }
      return session;
    },

    async jwt({ token, user }) {
      // Tambahkan data user ke token jika ada
      if (user) {
        token.id = user.id;
        token.picture = user.image;
      }
      return token;
    }
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
