import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

interface PanitiaLayoutProps {
  children: React.ReactNode;
}

async function checkPITAccess(email: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rows]: any = await db.query(`
      SELECT p.id, p.nama_lengkap, d.nama as divisi_nama
      FROM panitia p
      JOIN divisi d ON p.divisi_id = d.id
      WHERE p.email = ? AND d.nama = 'PIT'
    `, [email]);

    return rows.length > 0;
  } catch (error) {
    console.error("Error checking PIT access:", error);
    return false;
  }
}

export default async function PanitiaLayout({ children }: PanitiaLayoutProps) {
  const session = await getServerSession(authOptions);

  // Redirect jika tidak ada session - gunakan halaman utama, bukan /api/auth/signin
  if (!session || !session.user?.email) {
    redirect("/"); // NextAuth akan handle redirect ke Google sign-in
  }

  // Check apakah user adalah anggota divisi PIT
  const hasPITAccess = await checkPITAccess(session.user.email);

  if (!hasPITAccess) {
    // Redirect ke halaman unauthorized
    redirect("/unauthorized");
  }
  
  return <>{children}</>;
}