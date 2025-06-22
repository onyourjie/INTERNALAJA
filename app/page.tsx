"use client";

import { useSession, signOut } from "next-auth/react";
import GoogleUbButton from "@/components/GoogleUbButton";
import LoginErrorHandler from "@/components/LoginErrorHandler"; // Import the error handler
import "./login.css";

export default function Page() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p className="text-center mt-10 text-gray-600">Loading…</p>;
  }

  return (
    <div className="relative w-full h-screen overflow-hidden text-white">
      {/* Error handling component */}
      <LoginErrorHandler />

      {/* 🎥 Background Video */}
      <iframe
        className="youtube-bg"
        src="https://www.youtube.com/embed/Fnpda4PMJKU?autoplay=1&mute=1&loop=1&playlist=Fnpda4PMJKU&controls=0&modestbranding=1"
        title="Background Video"
        allow="autoplay; muted; fullscreen"
        allowFullScreen
      />

      {/* 🧩 Login Content */}
      <div className="flex items-center justify-center min-h-screen px-4 bg-black/50">
        <div className="text-center absolute top-10 left-1/2 -translate-x-1/2 z-10">
          <h1 className="text-4xl font-bold mb-1">Login Panel Panitia</h1>
          <p className="text-xl text-blue-300">Raja Brawijaya 2025</p>
        </div>
        <div className="relative w-full max-w-md z-10 mt-28 sm:mt-36">
          <div className="p-8 shadow-2xl bg-black/80 rounded-md">
            <h2 className="text-center mb-6 text-2xl font-semibold">LOGIN</h2>
            {session ? (
              <>
                <p className="text-white text-center mb-4 break-words">
                  🟢 Halo, <strong>{session.user?.name}</strong> <br />
                  <span className="text-sm text-gray-300">{session.user?.email}</span>
                </p>
                <button
                  onClick={() => signOut()}
                  className="w-full py-3 px-6 text-white font-semibold bg-red-600 hover:bg-red-700 rounded-md transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <GoogleUbButton />
            )}
            <div className="flex justify-center mt-6 text-xs text-gray-300">
              <a href="#">REGISTER</a>
              <span className="mx-2">|</span>
              <a href="#">FORGOT PASSWORD</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}