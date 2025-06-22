"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, Variants } from "framer-motion";
import Image from "next/image";
import { User, LogOut } from "lucide-react";

// Variants for animations
const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item: Variants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 },
};

interface UserData {
  name: string;
  email: string;
  divisi: string;
  role: string;
  bergabung: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    // Redirect to home if unauthenticated
    if (status === "unauthenticated") {
      router.push("/");
    }

    // Fetch user details if authenticated
    if (status === "authenticated" && session?.user?.email) {
      const fetchUserDetails = async () => {
        try {
          const response = await fetch(`/api/panitia?email=${session.user?.email}`);
          if (response.ok) {
            const data = await response.json();
            setUserData(data);
          } else {
            console.error("Failed to fetch user details:", await response.text());
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      };
      fetchUserDetails();
    }
  }, [status, session, router]);

  if (status === "loading" || !userData) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="w-16 h-16 border-4 border-t-blue-600 border-r-amber-500 border-b-emerald-500 border-l-purple-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-[90vh] px-6 py-8 font-sans">
      {/* Header */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={container}
        className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 mb-10"
      >
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-800 mb-2">
            Dashboard Panitia PIT & SPV
          </h1>
          <p className="text-gray-600 max-w-2xl">
            Selamat datang di platform pengelolaan kepanitiaan RAJA Brawijaya. 
            Berikut ringkasan divisi dan peran dalam pelaksanaan event ini.
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
          <button
            onClick={() => signOut()}
            className="group bg-gradient-to-br from-red-500 to-orange-600 shadow-lg hover:shadow-red-300 text-white rounded-xl h-12 px-6 font-semibold flex items-center"
          >
            <LogOut className="mr-2" size={20} />
            Logout
          </button>
        </motion.div>
      </motion.div>

      {/* Informasi Akun Pengguna */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border-0 bg-gradient-to-tr from-blue-50 to-indigo-50 p-5">
        <div className="p-5 border-b border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white">
              <User size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Akun Anda</h2>
          </div>
        </div>

        <div className="p-5">
          <motion.div variants={item} className="flex items-center gap-4 mb-6">
            <div className="relative">
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  width={64}
                  height={64}
                  className="rounded-xl object-cover shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  {userData.name.charAt(0).toUpperCase()}
                </div>
              )}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
                className="absolute w-5 h-5 -top-1 -right-1 bg-green-400 rounded-full border-2 border-white"
              />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-lg text-gray-800">{userData.name}</p>
              <p className="text-indigo-600 font-medium">{userData.email}</p>
              <p className="text-sm text-gray-600">
                Status:{" "}
                <span className="bg-gradient-to-r from-green-400 to-emerald-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                  Aktif
                </span>
              </p>
            </div>
          </motion.div>

          {/* User Details */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 gap-3"
          >
            <motion.div
              whileHover={{ rotate: 5 }}
              className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md"
            >
              <p className="text-gray-600 text-sm">Divisi</p>
              <p className="font-bold text-xl text-emerald-600">{userData.divisi}</p>
            </motion.div>
            <motion.div
              whileHover={{ rotate: -5 }}
              className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md"
            >
              <p className="text-gray-600 text-sm">Role</p>
              <p className="font-bold text-xl text-purple-600">{userData.role}</p>
            </motion.div>
            <motion.div
              whileHover={{ rotate: 5 }}
              className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md"
            >
              <p className="text-gray-600 text-sm">Bergabung</p>
              <p className="font-bold text-xl text-pink-600">{userData.bergabung}</p>
            </motion.div>
            <motion.div
              whileHover={{ rotate: -5 }}
              className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md"
            >
              <p className="text-gray-600 text-sm">Total Kegiatan</p>
              <p className="font-bold text-xl text-blue-600">Belum ada</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}