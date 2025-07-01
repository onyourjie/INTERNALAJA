"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function LoginPage() {
    const router = useRouter();
    const { status } = useSession();

    useEffect(() => {
        // Redirect otomatis ke halaman utama
        console.log("🔄 Login page accessed, redirecting to home page...");
        router.replace("/"); // Gunakan replace agar tidak bisa back ke /login
    }, [router]);

    // Loading state while redirecting
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    Mengalihkan...
                </h2>
                <p className="text-gray-600">
                    Anda akan dialihkan ke halaman login utama
                </p>
            </div>
        </div>
    );
}