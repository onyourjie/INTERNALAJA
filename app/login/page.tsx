// resources/js/Pages/Auth/Login.tsx

"use client";

import { useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Link from 'next/link';

export default function Login() {
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.get('email'),
                    password: formData.get('password'),
                    remember: formData.get('remember') === 'on',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.errors) {
                    setErrors(data.errors);
                    Object.values(data.errors).forEach((errorMessage: unknown) => {
                        if (typeof errorMessage === 'string') {
                            toast.error(errorMessage);
                        }
                    });
                } else {
                    toast.error(data.message || 'An error occurred');
                }
            } else {
                // Successful login
                window.location.href = '/dashboard';
            }
        } catch {
            toast.error('An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative h-screen w-full overflow-hidden text-white">
            {/* Background Video */}
            <iframe
                className="pointer-events-none absolute h-full w-full object-cover object-center"
                src="https://www.youtube.com/embed/Fnpda4PMJKU?autoplay=1&mute=1&controls=0&loop=1&playlist=Fnpda4PMJKU&modestbranding=1&showinfo=0"
                title="Background Video"
                allow="autoplay; fullscreen"
                allowFullScreen
            />

            {/* Overlay untuk membuat video lebih gelap */}
            <div className="absolute inset-0 bg-black/50" />

            {/* Login Content */}
            <div className="flex min-h-screen items-center justify-center px-4">
                <div className="absolute left-1/2 top-10 z-40 -translate-x-1/2 text-center">
                    <h1 className="mb-1 text-4xl font-bold drop-shadow-lg md:text-5xl">
                        Login Panel Panitia
                    </h1>
                    <p className="text-xl font-medium text-blue-300 drop-shadow md:text-2xl">
                        Raja Brawijaya 2025
                    </p>
                </div>

                <div className="relative z-40 mt-32 w-full max-w-md sm:mt-40">
                    <ToastContainer position="top-center" autoClose={5000} />
                    <div className="rounded-2xl border border-white/10 bg-black/70 p-8 shadow-2xl backdrop-blur-md">
                        <h2 className="mb-6 text-center text-2xl font-bold text-white">
                            LOGIN
                        </h2>

                        {/* Form Login Standard */}
                        <form
                            onSubmit={handleSubmit}
                            className="space-y-6"
                        >
                            <div>
                                <label
                                    htmlFor="email"
                                    className="mb-1 block text-sm font-medium text-gray-300"
                                >
                                    Email Student UB
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    autoComplete="username"
                                    required
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                    placeholder="email_student@student.ub.ac.id"
                                />
                                {errors.email && (
                                    <p className="mt-1 text-sm text-red-500">
                                        {errors.email}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="mb-1 block text-sm font-medium text-gray-300"
                                >
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    autoComplete="current-password"
                                    required
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                    placeholder="Password"
                                />
                                {errors.password && (
                                    <p className="mt-1 text-sm text-red-500">
                                        {errors.password}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="remember"
                                        className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-300">
                                        Remember me
                                    </span>
                                </label>

                                <Link
                                    href="/forgot-password"
                                    className="text-sm text-blue-400 hover:underline"
                                >
                                    Forgot password?
                                </Link>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full transform rounded-lg bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3 font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-lg disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Signing in...' : 'Sign in to account'}
                                </button>
                            </div>
                        </form>

                        {/* OR Divider */}
                        <div className="relative my-6 flex items-center justify-center">
                            <div className="flex-1 border-t border-gray-700"></div>
                            <div className="px-3 text-sm text-gray-400">
                                or continue with
                            </div>
                            <div className="flex-1 border-t border-gray-700"></div>
                        </div>

                        {/* Google Login Button */}
                        <div className="mt-4 w-full">
                            <Link
                                href="/api/auth/signin/google"
                                className="flex w-full transform items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-800 transition duration-300 hover:-translate-y-0.5 hover:bg-gray-100"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 48 48"
                                    className="h-5 w-5"
                                >
                                    <path
                                        fill="#EA4335"
                                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                                    />
                                    <path
                                        fill="#4285F4"
                                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                                    />
                                    <path fill="none" d="M0 0h48v48H0z" />
                                </svg>
                                <span>Sign in with Google</span>
                            </Link>
                        </div>

                        {/* Footer Links */}
                        <div className="mt-6 flex justify-center gap-4 text-sm text-gray-300">
                            <Link
                                href="/register"
                                className="text-blue-400 hover:text-blue-300 hover:underline"
                            >
                                Create new account
                            </Link>
                            <span>|</span>
                            <Link
                                href="/terms"
                                className="text-blue-400 hover:text-blue-300 hover:underline"
                            >
                                Terms & Privacy
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
