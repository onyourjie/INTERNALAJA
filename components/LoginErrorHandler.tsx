"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Swal from "sweetalert2"; // Import SweetAlert

export default function LoginErrorHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");

  useEffect(() => {
    if (error === "EmailNotStudentUB") {
      Swal.fire({
        icon: "error",
        title: "Login Gagal",
        text: "❌ Hanya email Student UB yang diizinkan login",
        confirmButtonText: "OK",
      }).then(() => {
        router.replace("/"); // Redirect to homepage
      });
    } else if (error === "NotRegisteredPanitia") {
      Swal.fire({
        icon: "error",
        title: "Login Gagal",
        text: "❌ Maaf anda belum terdaftar di sistem sebagai Panitia",
        confirmButtonText: "OK",
      }).then(() => {
        router.replace("/"); // Redirect to homepage
      });
    }
  }, [error, router]);

  return null; // This component only handles pop-up notifications
}