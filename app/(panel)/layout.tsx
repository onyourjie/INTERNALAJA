"use client";

import Sidebar from "@/components/Sidebar";
import React, { useState } from "react";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar Component */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={setSidebarOpen}
        onClose={closeSidebar}
      />
      
      {/* Main Content Area */}
      <main className="lg:ml-64 min-h-screen">
        {/* Content Container */}
        <div className="pt-16 lg:pt-0 min-h-screen">
          <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6 lg:py-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}