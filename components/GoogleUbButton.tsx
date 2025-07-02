// File: components/GoogleUbButton.tsx (Updated)

"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";

export default function GoogleUbButton() {
  return (
    <button
      onClick={() =>
        signIn("google", {
          callbackUrl: "/auth/redirect-checker", // Redirect ke checker untuk divisi-based routing
        })
      }
      className="w-full max-w-sm mx-auto flex items-center justify-center gap-3 rounded-lg border border-gray-300 px-4 py-2 shadow-sm transition hover:bg-gray-100 active:scale-95 bg-white"
    >
      <Image
        src="/google.svg"
        alt="Google"
        width={20}
        height={20}
        priority
      />
      <span className="font-medium text-gray-800">
        Login dengan <span className="text-blue-600 font-semibold">UB</span>
      </span>
    </button>
  );
}