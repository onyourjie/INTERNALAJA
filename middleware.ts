import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth(
  async function middleware(req: NextRequest) {
    const token = req.nextauth.token;
    
    // Check jika mengakses panel panitia
    if (req.nextUrl.pathname.startsWith('/panel/panitia')) {
      if (!token?.email) {
        return NextResponse.redirect(new URL('/api/auth/signin', req.url));
      }

      // Di sini Anda bisa tambahkan logic untuk check divisi PIT
      // Tapi karena middleware tidak bisa akses database langsung,
      // lebih baik gunakan layout approach di atas
      
      return NextResponse.next();
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Basic auth check
        if (req.nextUrl.pathname.startsWith('/panel')) {
          return !!token;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/panel/:path*',
    '/dashboard/:path*'
  ]
};