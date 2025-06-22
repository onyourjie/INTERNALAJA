/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// app/(panel)/dashboardkestari/page.tsx
'use client';

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo, useRef } from "react";
import { Calendar, Clock, QrCode, Scan, ArrowUp, ChevronDown, UserCheck, UserX } from "lucide-react";

const DashboardKestari = () => {
  const [selectedEvent, setSelectedEvent] = useState("PKKMB");
  const [selectedDay, setSelectedDay] = useState("DAY 1");
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [showDayDropdown, setShowDayDropdown] = useState(false);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<"divisi" | "status" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  const eventDropdownRef = useRef<HTMLDivElement>(null);
  const dayDropdownRef = useRef<HTMLDivElement>(null);

  // Event configuration with dates
  const eventConfig = {
    PKKMB: ["DAY 1", "DAY 2", "DAY 3"],
    "OPEN HOUSE": ["DAY 1", "DAY 2"]
  };

  // Date mapping for each event and day
  const eventDates = {
    PKKMB: {
      "DAY 1": "Senin, 11 Agustus 2025",
      "DAY 2": "Selasa, 12 Agustus 2025", 
      "DAY 3": "Rabu, 13 Agustus 2025"
    },
    "OPEN HOUSE": {
      "DAY 1": "Sabtu, 30 Agustus 2025",
      "DAY 2": "Minggu, 31 Agustus 2025"
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (eventDropdownRef.current && !eventDropdownRef.current.contains(event.target as Node)) {
        setShowEventDropdown(false);
      }
      if (dayDropdownRef.current && !dayDropdownRef.current.contains(event.target as Node)) {
        setShowDayDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        duration: 0.5, 
        ease: "easeOut",
        type: "spring",
        damping: 15,
        stiffness: 150
      } 
    }
  };

  const dropdownItem = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  };

  const dropdownContainer = {
    hidden: { opacity: 0, scale: 0.95, y: -5 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.2,
        ease: "easeOut",
        staggerChildren: 0.05
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: -5,
      transition: { duration: 0.15 }
    }
  };

  const cardHover = {
    rest: { 
      transform: "translateY(0) scale(1)",
      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.05)"
    },
    hover: { 
      transform: "translateY(-5px) scale(1.02)",
      boxShadow: "0 20px 40px rgba(120, 86, 255, 0.15)",
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  const buttonHover = {
    rest: { scale: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" },
    hover: { 
      scale: 1.03,
      boxShadow: "0 6px 20px rgba(120, 86, 255, 0.25)",
      transition: {
        duration: 0.2,
        ease: "easeInOut"
      }
    },
    tap: { scale: 0.97 }
  };

  // Handle event change
  const handleEventChange = (event: string) => {
    setSelectedEvent(event);
    setSelectedDay(eventConfig[event as keyof typeof eventConfig][0]);
    setShowEventDropdown(false);
  };

  // Handle day change
  const handleDayChange = (day: string) => {
    setSelectedDay(day);
    setShowDayDropdown(false);
  };

  // Handle QR scan simulation
  const handleQRScan = () => {
    const newAttendee = {
      id: Date.now(),
      nim: `22515020011${Math.floor(Math.random() * 9000) + 1000}`,
      name: `Peserta Baru ${Math.floor(Math.random() * 100)}`,
      divisi: ["Acara", "Konsumsi", "Dokumentasi", "Keamanan", "Humas"][Math.floor(Math.random() * 5)],
      status: "Hadir",
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      isPresent: true
    };

    setAttendanceData(prevData => [newAttendee, ...prevData]);
  };

  // Sorting functionality
  const handleSort = (field: "divisii" | "status") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sorted data
  const sortedAttendanceData = useMemo(() => {
    if (!sortField) return attendanceData;
    
    return [...attendanceData].sort((a, b) => {
      if (sortField === "divisi") {
        const nameA = a.divisi.toLowerCase();
        const nameB = b.divisi.toLowerCase();
        return sortDirection === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      else if (sortField === "status") {
        const order = { "Hadir": 1, "Terlambat": 2, "Belum Absen": 3 };
        const valueA = order[a.status] || 4;
        const valueB = order[b.status] || 4;
        return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
      }
      return 0;
    });
  }, [attendanceData, sortField, sortDirection]);

  // Generate mock data
  const generateMockData = () => {
    return [
      { 
        id: 1, 
        nim: "225150200111001", 
        name: "Ahmad Fauzi Rahman", 
        divisi: "Acara",
        status: "Hadir", 
        time: "07:45",
        isPresent: true
      },
      { 
        id: 2, 
        nim: "225150200111002", 
        name: "Budi Santoso Wijaya", 
        divisi: "Konsumsi",
        status: "Belum Absen", 
        time: "-",
        isPresent: false
      },
      { 
        id: 3, 
        nim: "225150200111003", 
        name: "Citra Dewi Maharani", 
        divisi: "Dokumentasi",
        status: "Hadir", 
        time: "08:10",
        isPresent: true
      },
      { 
        id: 4, 
        nim: "225150200111004", 
        name: "Dian Permana Sari", 
        divisi: "Keamanan",
        status: "Belum Absen", 
        time: "-",
        isPresent: false
      },
      { 
        id: 5, 
        nim: "225150200111005", 
        name: "Eko Prasetyo Nugroho", 
        divisi: "Humas",
        status: "Hadir", 
        time: "07:55",
        isPresent: true
      },
      { 
        id: 6, 
        nim: "225150200111006", 
        name: "Fajar Nugroho Santoso", 
        divisi: "Acara",
        status: "Hadir", 
        time: "08:00",
        isPresent: true
      },
      { 
        id: 7, 
        nim: "225150200111007", 
        name: "Gita Maharani Putri", 
        divisi: "Konsumsi",
        status: "Belum Absen", 
        time: "-",
        isPresent: false
      },
      { 
        id: 8, 
        nim: "225150200111008", 
        name: "Hendra Wijaya Kusuma", 
        divisi: "Dokumentasi",
        status: "Hadir", 
        time: "08:15",
        isPresent: true
      }
    ];
  };

  // Fetch data
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setAttendanceData(generateMockData());
      setLoading(false);
    }, 800);
  }, [selectedEvent, selectedDay]);

  // Calculate stats
  const presentCount = attendanceData.filter(a => a.isPresent).length;
  const absentCount = attendanceData.filter(a => !a.isPresent).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-25 to-white p-4 md:p-6">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-6xl mx-auto"
      >
        {/* Top Bar */}
        <motion.div variants={item} className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-indigo-900">
              Absensi KESTARI
            </h1>
            <p className="text-sm text-gray-600">
              Dashboard pemantauan kehadiran panitia Raja Brawijaya 2025
            </p>
          </div>
          
          <motion.button
            variants={buttonHover}
            whileHover="hover"
            onClick={handleQRScan}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-lg transition-colors"
          >
            <motion.div
              animate={{ 
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 1] 
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-5 h-5"
            >
              <Scan />
            </motion.div>
            Scan QR Absensi
          </motion.button>
        </motion.div>

        {/* Event Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Event Selector */}
          <motion.div 
            variants={item}
            className="bg-white rounded-2xl p-5 shadow-lg relative"
            ref={eventDropdownRef}
          >
            <div className="text-sm font-semibold text-gray-500 mb-3">Acara Kegiatan</div>
            
            <button 
              className="w-full flex justify-between items-center px-4 py-3 bg-indigo-50 rounded-xl text-indigo-700 font-medium"
              onClick={() => setShowEventDropdown(!showEventDropdown)}
            >
              <span>{selectedEvent}</span>
              <motion.span
                animate={{ rotate: showEventDropdown ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown />
              </motion.span>
            </button>
            
            <AnimatePresence>
              {showEventDropdown && (
                <motion.div
                  variants={dropdownContainer}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute z-10 mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
                >
                  {Object.keys(eventConfig).map((event) => (
                    <motion.button
                      key={event}
                      variants={dropdownItem}
                      className={`w-full px-4 py-3 text-left ${
                        selectedEvent === event
                          ? "bg-indigo-600 text-white"
                          : "hover:bg-indigo-50 text-gray-700"
                      }`}
                      onClick={() => handleEventChange(event)}
                    >
                      {event}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          {/* Day Selector */}
          <motion.div 
            variants={item}
            className="bg-white rounded-2xl p-5 shadow-lg relative"
            ref={dayDropdownRef}
          >
            <div className="text-sm font-semibold text-gray-500 mb-3">Hari Kegiatan</div>
            
            <button 
              className="w-full flex justify-between items-center px-4 py-3 bg-indigo-50 rounded-xl text-indigo-700 font-medium"
              onClick={() => setShowDayDropdown(!showDayDropdown)}
            >
              <span>{selectedDay}</span>
              <motion.span
                animate={{ rotate: showDayDropdown ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown />
              </motion.span>
            </button>
            
            <AnimatePresence>
              {showDayDropdown && (
                <motion.div
                  variants={dropdownContainer}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute z-10 mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
                >
                  {eventConfig[selectedEvent as keyof typeof eventConfig].map((day) => (
                    <motion.button
                      key={day}
                      variants={dropdownItem}
                      className={`w-full px-4 py-3 text-left ${
                        selectedDay === day
                          ? "bg-indigo-600 text-white"
                          : "hover:bg-indigo-50 text-gray-700"
                      }`}
                      onClick={() => handleDayChange(day)}
                    >
                      {day}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          {/* Date Info */}
          <motion.div 
            variants={item}
            className="bg-white rounded-2xl p-5 shadow-lg flex items-center"
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <Calendar />
            </div>
            <div className="ml-4">
              <div className="text-indigo-900 font-bold">
                {selectedEvent} • {selectedDay}
              </div>
              <div className="text-gray-600 text-sm">
                {eventDates[selectedEvent as keyof typeof eventDates][selectedDay as keyof typeof eventDates[keyof typeof eventDates]]}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <motion.div
            variants={item}
            whileHover="hover"
            className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-6 border-l-4 border-indigo-500 shadow-lg"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-bold text-gray-700">Kehadiran Sekarang</div>
                <div className="text-3xl font-extrabold text-indigo-800 mt-1">
                  {presentCount} <span className="text-xl font-normal">/ {attendanceData.length}</span>
                </div>
                <div className="text-gray-600 mt-3 flex items-center">
                  <div className="h-3 w-16 rounded-full bg-indigo-100 overflow-hidden mr-2">
                    {attendanceData.length > 0 && (
                      <motion.div 
                        className="h-full bg-indigo-600 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(presentCount / attendanceData.length) * 100}%` }}
                        transition={{ duration: 1 }}
                      />
                    )}
                  </div>
                  {attendanceData.length > 0 ? 
                    `${Math.round((presentCount / attendanceData.length) * 100)}%` : 
                    "0%"}
                </div>
              </div>
              <div className="bg-white p-4 rounded-full">
                <UserCheck className="text-indigo-600 w-6 h-6" />
              </div>
            </div>
          </motion.div>
          
          <motion.div
            variants={item}
            whileHover="hover"
            className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border-l-4 border-amber-500 shadow-lg"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-bold text-gray-700">Belum Absen</div>
                <div className="text-3xl font-extrabold text-amber-800 mt-1">
                  {absentCount}
                </div>
                <div className="text-gray-600 mt-3">
                  {absentCount > 0 ? "Perlu tindak lanjut" : "Semua telah hadir"}
                </div>
              </div>
              <div className="bg-white p-4 rounded-full">
                <UserX className="text-amber-600 w-6 h-6" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Table Section */}
        <motion.div
          variants={item}
          className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
        >
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Data Kehadiran Panitia</h2>
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="w-4 h-4 mr-2" />
              {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          
          {/* Attendance Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-indigo-50 text-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">NIM</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">NAMA PANITIA</th>
                  
                  {/* Sortable Divisi Header */}
                  <th 
                    className="px-6 py-3 text-left text-sm font-semibold cursor-pointer"
                    onClick={() => handleSort("divisi")}
                  >
                    <div className="flex items-center">
                      DIVISI
                      {sortField === "divisi" && (
                        <motion.div 
                          animate={{ rotate: sortDirection === "asc" ? 0 : 180 }}
                          className="ml-1"
                        >
                          <ChevronDown size={16} />
                        </motion.div>
                      )}
                      {(!sortField || sortField !== "divisi") && (
                        <div className="ml-1">
                          <ArrowUp size={16} />
                        </div>
                      )}
                    </div>
                  </th>
                  
                  {/* Sortable Status Header */}
                  <th 
                    className="px-6 py-3 text-left text-sm font-semibold cursor-pointer"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center">
                      STATUS
                      {sortField === "status" && (
                        <motion.div 
                          animate={{ rotate: sortDirection === "asc" ? 0 : 180 }}
                          className="ml-1"
                        >
                          <ChevronDown size={16} />
                        </motion.div>
                      )}
                      {(!sortField || sortField !== "status") && (
                        <div className="ml-1">
                          <ArrowUp size={16} />
                        </div>
                      )}
                    </div>
                  </th>
                  
                  <th className="px-6 py-3 text-left text-sm font-semibold">WAKTU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/70">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                        <p className="text-gray-600">Memuat data kehadiran...</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedAttendanceData.map((record, index) => (
                    <motion.tr 
                      key={record.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-indigo-50/30"
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                        {record.nim}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{record.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1.5 inline-flex text-xs font-medium rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100">
                          {record.divisi}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <motion.span 
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className={`px-3 py-1.5 inline-flex text-xs font-semibold rounded-full ${
                            record.isPresent 
                              ? "bg-green-100 text-green-800 border border-green-200" 
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {record.status}
                        </motion.span>
                      </td>
                      <td className="px-6 py-4 font-mono whitespace-nowrap text-gray-500 text-sm">
                        {record.time}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Table Footer */}
          <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Menampilkan <span className="font-semibold">{attendanceData.length}</span> panitia
            </div>
            <div className="flex space-x-2">
              <motion.button 
                className="px-4 py-2 text-sm rounded-lg bg-white border border-gray-300 text-gray-700"
                whileHover={{ backgroundColor: "#f3f4f6" }}
              >
                Previous
              </motion.button>
              <motion.button 
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white"
                whileHover={{ backgroundColor: "#4338ca" }}
              >
                Next
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          variants={item}
          className="mt-8 bg-gradient-to-r from-indigo-700 to-indigo-800 rounded-2xl p-6 text-white"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg md:text-xl font-bold mb-2">Butuh Bantuan?</h3>
              <p className="text-indigo-200 opacity-90">
                Tim KESTARI siap membantu Anda untuk masalah terkait sistem absensi kehadiran.
              </p>
            </div>
            <motion.button
              variants={buttonHover}
              className="px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg flex items-center gap-2 shadow-sm"
            >
              Hubungi Tim
              <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center">
                <ArrowUp className="w-3 h-3 rotate-45" />
              </div>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default DashboardKestari;
