"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useMemo } from "react";
import { Protected } from "./protected";
import { useAuth } from "./auth-context";

const LOCATIONS = [
  { id: "all", name: "All Locations" },
  { id: "latrobe", name: "Latrobe" },
  { id: "everson", name: "Everson" },
  { id: "chestnut", name: "Chestnut" },
];

function Dashboard() {
  const { admin, logout, canManageAdmins, canEdit } = useAuth();
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUsers, setShowUsers] = useState(false);
  const [showAdmins, setShowAdmins] = useState(false);
  const [showUnknownReport, setShowUnknownReport] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState<any | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userDeleteConfirm, setUserDeleteConfirm] = useState<string | null>(null);
  const [vendorExportTruck, setVendorExportTruck] = useState<string | null>(null);
  const [showNewAdmin, setShowNewAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: "", password: "", name: "", role: "admin" as const, locations: ["all"] });

  const trucks = useQuery(api.queries.getAllTrucks);
  const users = useQuery(api.queries.getAllUsers);
  const admins = useQuery(api.auth.getAllAdmins);
  const scans = useQuery(
    api.queries.getTruckScans,
    selectedTruck ? { truckId: selectedTruck as any } : "skip"
  );

  const deleteTruck = useMutation(api.mutations.deleteTruck);
  const updateUser = useMutation(api.mutations.updateUser);
  const deleteUser = useMutation(api.mutations.deleteUser);
  const createAdmin = useMutation(api.auth.createAdmin);
  const updateAdmin = useMutation(api.auth.updateAdmin);
  const deleteAdmin = useMutation(api.auth.deleteAdmin);

  // Filter by admin's allowed locations
  const effectiveLocationFilter = useMemo(() => {
    if (admin?.allowedLocations.includes("all")) return locationFilter;
    if (locationFilter === "all") return admin?.allowedLocations[0] || "all";
    if (admin?.allowedLocations.includes(locationFilter)) return locationFilter;
    return admin?.allowedLocations[0] || "all";
  }, [admin, locationFilter]);

  const availableLocations = useMemo(() => {
    if (admin?.allowedLocations.includes("all")) return LOCATIONS;
    return LOCATIONS.filter(
      (loc) => loc.id === "all" || admin?.allowedLocations.includes(loc.id)
    );
  }, [admin]);

  // Filter trucks by location and status
  const filteredTrucks = useMemo(() => {
    return trucks?.filter((truck) => {
      const matchesSearch = truck.truckNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || truck.status === statusFilter;
      const matchesLocation = effectiveLocationFilter === "all" ||
        truck.locationId?.toLowerCase().includes(effectiveLocationFilter.toLowerCase());
      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [trucks, searchQuery, statusFilter, effectiveLocationFilter]);

  // Filter users by location
  const filteredUsers = useMemo(() => {
    return users?.filter((user) => {
      const matchesLocation = effectiveLocationFilter === "all" ||
        user.locationId?.toLowerCase().includes(effectiveLocationFilter.toLowerCase()) ||
        user.locationName?.toLowerCase().includes(effectiveLocationFilter.toLowerCase());
      return matchesLocation;
    });
  }, [users, effectiveLocationFilter]);

  const filteredScans = scans?.filter((scan) =>
    scan.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  const trucksToday = filteredTrucks?.filter((t) => t.openedAt >= todayTimestamp).length || 0;
  const openTrucks = filteredTrucks?.filter((t) => t.status === "open").length || 0;
  const closedToday = filteredTrucks?.filter((t) =>
    t.status === "closed" && t.closedAt && t.closedAt >= todayTimestamp
  ).length || 0;
  const totalScans = filteredTrucks?.reduce((sum, t) => sum + (t.scanCount || 0), 0) || 0;

  // Group scans by vendor for export
  const scansByVendor = useMemo(() => {
    if (!scans) return {};
    return scans.reduce((acc, scan) => {
      const vendor = scan.vendor || "Unknown";
      if (!acc[vendor]) acc[vendor] = [];
      acc[vendor].push(scan);
      return acc;
    }, {} as Record<string, typeof scans>);
  }, [scans]);

  // Unknown scans analysis
  const unknownScansAnalysis = useMemo(() => {
    if (!scans) return [];
    const unknowns = scans.filter((s) => !s.vendor || s.vendor === "Unknown");
    const accountMap: Record<string, { count: number; samples: any[] }> = {};

    unknowns.forEach((scan) => {
      const raw = scan.rawBarcode || "";
      const matches = raw.match(/\d{6,10}/g) || [];
      matches.forEach((match) => {
        if (!accountMap[match]) {
          accountMap[match] = { count: 0, samples: [] };
        }
        accountMap[match].count++;
        if (accountMap[match].samples.length < 3) {
          accountMap[match].samples.push(scan);
        }
      });
    });

    return Object.entries(accountMap)
      .map(([account, data]) => ({ account, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }, [scans]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatExportDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLocationName = (locationId: string) => {
    if (locationId?.toLowerCase().includes("latrobe")) return "LATROBE";
    if (locationId?.toLowerCase().includes("everson")) return "EVERSON";
    if (locationId?.toLowerCase().includes("chestnut")) return "CHESTNUT";
    return locationId?.toUpperCase() || "UNKNOWN";
  };

  const handleDeleteTruck = async (truckId: string) => {
    if (!canEdit) return;
    await deleteTruck({ truckId: truckId as any });
    setDeleteConfirm(null);
    if (selectedTruck === truckId) {
      setSelectedTruck(null);
    }
  };

  const handleUpdateUser = async (userId: string, updates: any) => {
    if (!canEdit) return;
    await updateUser({ userId: userId as any, ...updates });
    setEditingUser(null);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!canEdit) return;
    await deleteUser({ userId: userId as any });
    setUserDeleteConfirm(null);
  };

  const handleCreateAdmin = async () => {
    if (!canManageAdmins) return;
    const result = await createAdmin({
      email: newAdmin.email,
      password: newAdmin.password,
      name: newAdmin.name,
      role: newAdmin.role as "admin" | "viewer",
      allowedLocations: newAdmin.locations,
    });
    if (result.success) {
      setShowNewAdmin(false);
      setNewAdmin({ email: "", password: "", name: "", role: "admin", locations: ["all"] });
    }
  };

  const downloadVendorExport = (vendor: string) => {
    const vendorScans = scansByVendor[vendor];
    if (!vendorScans || !selectedTruck) return;

    const truck = trucks?.find((t) => t._id === selectedTruck);
    const locationName = getLocationName(truck?.locationId || "");
    const preparedTime = formatExportDate(Date.now());

    const lines = [
      `Import Export Tire - ${locationName}`,
      `Truck Number: ${truck?.truckNumber || "Unknown"}`,
      `Vendor: ${vendor}`,
      `Time Prepared: ${preparedTime}`,
      ``,
      `Tracking,Vendor,Timestamp`,
    ];

    vendorScans.forEach((s) => {
      lines.push(`${s.trackingNumber},${s.vendor || "Unknown"},${formatExportDate(s.scannedAt)}`);
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${truck?.truckNumber}-${vendor.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllManifest = () => {
    if (!scans || !selectedTruck) return;

    const truck = trucks?.find((t) => t._id === selectedTruck);
    const locationName = getLocationName(truck?.locationId || "");
    const preparedTime = formatExportDate(Date.now());

    const lines = [
      `Import Export Tire - ${locationName}`,
      `Truck Number: ${truck?.truckNumber || "Unknown"}`,
      `Vendor: ALL`,
      `Time Prepared: ${preparedTime}`,
      ``,
      `Tracking,Vendor,Timestamp`,
    ];

    scans.forEach((s) => {
      lines.push(`${s.trackingNumber},${s.vendor || "Unknown"},${formatExportDate(s.scannedAt)}`);
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${truck?.truckNumber}-ALL-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadUnknownReport = () => {
    if (!scans || !selectedTruck) return;

    const truck = trucks?.find((t) => t._id === selectedTruck);
    const locationName = getLocationName(truck?.locationId || "");
    const preparedTime = formatExportDate(Date.now());
    const unknowns = scans.filter((s) => !s.vendor || s.vendor === "Unknown");

    const lines = [
      `Import Export Tire - ${locationName}`,
      `Truck Number: ${truck?.truckNumber || "Unknown"}`,
      `UNKNOWN VENDOR REPORT`,
      `Time Prepared: ${preparedTime}`,
      `Total Unknown: ${unknowns.length}`,
      ``,
      `Tracking,Timestamp,Raw Barcode (partial)`,
    ];

    unknowns.forEach((s) => {
      const rawPartial = (s.rawBarcode || "").substring(0, 100).replace(/,/g, ";");
      lines.push(`${s.trackingNumber},${formatExportDate(s.scannedAt)},"${rawPartial}"`);
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${truck?.truckNumber}-UNKNOWN-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unknownCount = scans?.filter((s) => !s.vendor || s.vendor === "Unknown").length || 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  TireTrack Admin
                </h1>
                <p className="text-sm text-slate-400">Warehouse Management Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Location Filter */}
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 transition-all"
              >
                {availableLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <div className="relative">
                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl w-48 focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>
              <button
                onClick={() => { setShowUsers(false); setShowAdmins(false); }}
                className={`px-4 py-2.5 rounded-xl font-medium transition-all ${
                  !showUsers && !showAdmins
                    ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/25"
                    : "bg-slate-800 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                📋 Manifests
              </button>
              <button
                onClick={() => { setShowUsers(true); setShowAdmins(false); }}
                className={`px-4 py-2.5 rounded-xl font-medium transition-all ${
                  showUsers && !showAdmins
                    ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/25"
                    : "bg-slate-800 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                👷 App Users
              </button>
              {canManageAdmins && (
                <button
                  onClick={() => { setShowAdmins(true); setShowUsers(false); }}
                  className={`px-4 py-2.5 rounded-xl font-medium transition-all ${
                    showAdmins
                      ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/25"
                      : "bg-slate-800 hover:bg-slate-700 border border-slate-700"
                  }`}
                >
                  🔐 Admins
                </button>
              )}
              <div className="border-l border-slate-700 pl-3 ml-1 flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">{admin?.name}</p>
                  <p className="text-xs text-slate-400">{admin?.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2.5 bg-slate-800 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/50 rounded-xl transition-all"
                  title="Logout"
                >
                  <svg className="w-5 h-5 text-slate-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Trucks Today</p>
                <p className="text-3xl font-bold mt-1">{trucksToday}</p>
              </div>
              <div className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🚚</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Open Trucks</p>
                <p className="text-3xl font-bold mt-1 text-emerald-400">{openTrucks}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📦</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Closed Today</p>
                <p className="text-3xl font-bold mt-1 text-slate-300">{closedToday}</p>
              </div>
              <div className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Scans</p>
                <p className="text-3xl font-bold mt-1 text-cyan-400">{totalScans.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
            </div>
          </div>
        </div>

        {showAdmins ? (
          /* Admin Management */
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Admin Users</h2>
              <button
                onClick={() => setShowNewAdmin(true)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-sm font-medium transition-all"
              >
                + Add Admin
              </button>
            </div>
            {admins === undefined ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                      <th className="pb-4 font-medium">Name</th>
                      <th className="pb-4 font-medium">Email</th>
                      <th className="pb-4 font-medium">Role</th>
                      <th className="pb-4 font-medium">Locations</th>
                      <th className="pb-4 font-medium">Status</th>
                      <th className="pb-4 font-medium">Last Login</th>
                      <th className="pb-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((a) => (
                      <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                        <td className="py-4 font-medium">{a.name}</td>
                        <td className="py-4 text-slate-400">{a.email}</td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            a.role === "superadmin"
                              ? "bg-purple-500/20 text-purple-400"
                              : a.role === "admin"
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-slate-700 text-slate-300"
                          }`}>
                            {a.role}
                          </span>
                        </td>
                        <td className="py-4 text-slate-300 text-sm">
                          {a.allowedLocations.includes("all") ? "All" : a.allowedLocations.join(", ")}
                        </td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            a.isActive
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {a.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-4 text-slate-500 text-sm">
                          {a.lastLoginAt ? formatDate(a.lastLoginAt) : "Never"}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateAdmin({ adminId: a.id as any, isActive: !a.isActive })}
                              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                              title={a.isActive ? "Deactivate" : "Activate"}
                            >
                              {a.isActive ? (
                                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </button>
                            {a.id !== admin?.id && (
                              <button
                                onClick={() => deleteAdmin({ adminId: a.id as any })}
                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : showUsers ? (
          /* App Users Management */
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">App Users (Warehouse)</h2>
              <span className="text-sm text-slate-400">{filteredUsers?.length || 0} users</span>
            </div>
            {users === undefined ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                      <th className="pb-4 font-medium">Name</th>
                      <th className="pb-4 font-medium">Employee ID</th>
                      <th className="pb-4 font-medium">Location</th>
                      <th className="pb-4 font-medium">PIN</th>
                      <th className="pb-4 font-medium">Role</th>
                      <th className="pb-4 font-medium">Status</th>
                      {canEdit && <th className="pb-4 font-medium">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers?.map((user) => (
                      <tr key={user._id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                        <td className="py-4 font-medium">{user.name}</td>
                        <td className="py-4 text-slate-400 font-mono text-sm">{user.empId}</td>
                        <td className="py-4 text-slate-300">{user.locationName || "-"}</td>
                        <td className="py-4 font-mono text-sm text-slate-400">••••</td>
                        <td className="py-4">
                          <span className="px-3 py-1 bg-slate-700 rounded-lg text-xs font-medium">
                            {user.role || "user"}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            user.isActive !== false
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {user.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingUser(user)}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleUpdateUser(user._id, { isActive: !user.isActive })}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                title={user.isActive ? "Deactivate" : "Activate"}
                              >
                                {user.isActive !== false ? (
                                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={() => setUserDeleteConfirm(user._id)}
                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Trucks & Scans */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trucks List */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Trucks</h2>
                <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1">
                  {(["all", "open", "closed"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        statusFilter === status
                          ? "bg-cyan-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {trucks === undefined ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {filteredTrucks?.map((truck) => (
                    <div
                      key={truck._id}
                      className={`relative group p-4 rounded-xl transition-all cursor-pointer ${
                        selectedTruck === truck._id
                          ? "bg-gradient-to-r from-cyan-600 to-blue-600 shadow-lg shadow-cyan-500/20"
                          : "bg-slate-700/50 hover:bg-slate-700"
                      }`}
                      onClick={() => {
                        setSelectedTruck(truck._id);
                        setVendorExportTruck(null);
                        setShowUnknownReport(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{truck.truckNumber}</div>
                          <div className="text-sm text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                            <span>{truck.carrier}</span>
                            <span className="text-slate-500">•</span>
                            <span className={truck.status === "open" ? "text-emerald-400" : "text-slate-400"}>
                              {truck.status}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span>{truck.scanCount || 0} scans</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {getLocationName(truck.locationId)}
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(truck._id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 rounded-lg transition-all"
                          >
                            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Delete Confirmation */}
                      {deleteConfirm === truck._id && (
                        <div className="absolute inset-0 bg-slate-900/95 rounded-xl flex items-center justify-center gap-3 z-10">
                          <span className="text-sm">Delete truck & all scans?</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTruck(truck._id);
                            }}
                            className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium"
                          >
                            Yes
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(null);
                            }}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium"
                          >
                            No
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scans Table */}
            <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold">
                    Scans {selectedTruck && <span className="text-cyan-400">({filteredScans?.length || 0})</span>}
                  </h2>
                  {selectedTruck && unknownCount > 0 && (
                    <button
                      onClick={() => setShowUnknownReport(!showUnknownReport)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                        showUnknownReport
                          ? "bg-amber-600 text-white"
                          : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                      }`}
                    >
                      <span>⚠️</span>
                      {unknownCount} Unknown
                    </button>
                  )}
                </div>
                {selectedTruck && scans && scans.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setVendorExportTruck(vendorExportTruck ? null : selectedTruck)}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl text-sm font-medium shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {vendorExportTruck === selectedTruck && (
                      <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden">
                        <div className="p-2">
                          <button
                            onClick={() => {
                              downloadAllManifest();
                              setVendorExportTruck(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-sm transition-colors flex items-center justify-between"
                          >
                            <span>📦 All Vendors</span>
                            <span className="text-slate-400">{scans.length}</span>
                          </button>
                          {unknownCount > 0 && (
                            <button
                              onClick={() => {
                                downloadUnknownReport();
                                setVendorExportTruck(null);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-sm transition-colors flex items-center justify-between text-amber-400"
                            >
                              <span>⚠️ Unknown Report</span>
                              <span>{unknownCount}</span>
                            </button>
                          )}
                          <div className="border-t border-slate-700 my-2"></div>
                          {Object.entries(scansByVendor)
                            .filter(([vendor]) => vendor !== "Unknown")
                            .map(([vendor, vendorScans]) => (
                              <button
                                key={vendor}
                                onClick={() => {
                                  downloadVendorExport(vendor);
                                  setVendorExportTruck(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-sm transition-colors flex items-center justify-between"
                              >
                                <span>{vendor}</span>
                                <span className="text-slate-400">{vendorScans.length}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!selectedTruck ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <svg className="w-16 h-16 mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p>Select a truck to view scans</p>
                </div>
              ) : scans === undefined ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : showUnknownReport ? (
                /* Unknown Vendor Analysis */
                <div>
                  <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <h3 className="font-medium text-amber-400 mb-2">Unknown Vendor Analysis</h3>
                    <p className="text-sm text-slate-400">
                      Potential account numbers from unknown scans. Higher counts = likely real vendor.
                    </p>
                  </div>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-slate-800">
                        <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                          <th className="pb-3 font-medium">Potential Account #</th>
                          <th className="pb-3 font-medium">Occurrences</th>
                          <th className="pb-3 font-medium">Sample Tracking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unknownScansAnalysis.map((item) => (
                          <tr key={item.account} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                            <td className="py-3 font-mono text-amber-300">{item.account}</td>
                            <td className="py-3">
                              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium">
                                {item.count}x
                              </span>
                            </td>
                            <td className="py-3 text-slate-400 text-sm">
                              {item.samples.map((s) => s.trackingNumber).join(", ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-800">
                      <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                        <th className="pb-3 font-medium">Tracking #</th>
                        <th className="pb-3 font-medium">Vendor</th>
                        <th className="pb-3 font-medium">Destination</th>
                        <th className="pb-3 font-medium">Time</th>
                        <th className="pb-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredScans?.map((scan) => (
                        <tr key={scan._id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="py-3 font-mono text-xs text-cyan-300">{scan.trackingNumber}</td>
                          <td className="py-3">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                              scan.vendor === "Unknown" || !scan.vendor
                                ? "bg-red-500/20 text-red-400"
                                : "bg-emerald-500/20 text-emerald-400"
                            }`}>
                              {scan.vendor || "Unknown"}
                            </span>
                          </td>
                          <td className="py-3 text-slate-300 text-sm">{scan.destination || "-"}</td>
                          <td className="py-3 text-slate-500 text-sm">{formatDate(scan.scannedAt)}</td>
                          <td className="py-3">
                            <button
                              onClick={() => setSelectedScan(scan)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {/* Scan Detail Modal */}
      {selectedScan && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedScan(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Scan Details</h3>
              <button onClick={() => setSelectedScan(null)} className="p-2 hover:bg-slate-700 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-sm">Tracking</p>
                  <p className="font-mono text-cyan-300">{selectedScan.trackingNumber}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Carrier</p>
                  <p>{selectedScan.carrier || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Vendor</p>
                  <p className={!selectedScan.vendor || selectedScan.vendor === "Unknown" ? "text-red-400" : "text-emerald-400"}>
                    {selectedScan.vendor || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Account</p>
                  <p className="font-mono text-sm">{selectedScan.vendorAccount || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Destination</p>
                  <p>{selectedScan.destination || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Recipient</p>
                  <p>{selectedScan.recipientName || "-"}</p>
                </div>
              </div>
              {selectedScan.address && (
                <div>
                  <p className="text-slate-400 text-sm">Address</p>
                  <p>{selectedScan.address}{selectedScan.city ? `, ${selectedScan.city}` : ""}{selectedScan.state ? `, ${selectedScan.state}` : ""}</p>
                </div>
              )}
              <div>
                <p className="text-slate-400 text-sm mb-1">Raw Barcode</p>
                <pre className="bg-slate-900 p-3 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">{selectedScan.rawBarcode}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditingUser(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit User</h3>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-700 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form
              className="p-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                const updates: any = {};
                const name = formData.get("name") as string;
                const pin = formData.get("pin") as string;
                if (name && name !== editingUser.name) updates.name = name;
                if (pin && pin.length === 4) updates.pin = pin;
                if (Object.keys(updates).length > 0) {
                  handleUpdateUser(editingUser._id, updates);
                } else {
                  setEditingUser(null);
                }
              }}
            >
              <div>
                <label className="block text-slate-400 text-sm mb-1">Name</label>
                <input type="text" name="name" defaultValue={editingUser.name} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">New PIN (4 digits)</label>
                <input type="text" name="pin" placeholder="Leave blank to keep" maxLength={4} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 font-mono" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {userDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setUserDeleteConfirm(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Delete User?</h3>
              <p className="text-slate-400 text-sm mb-6">Consider deactivating instead.</p>
              <div className="flex gap-3">
                <button onClick={() => setUserDeleteConfirm(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium">Cancel</button>
                <button onClick={() => handleDeleteUser(userDeleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-medium">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Admin Modal */}
      {showNewAdmin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewAdmin(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Admin</h3>
              <button onClick={() => setShowNewAdmin(false)} className="p-2 hover:bg-slate-700 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Name</label>
                <input
                  type="text"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Password</label>
                <input
                  type="password"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Role</label>
                <select
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value as "admin" | "viewer" })}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500"
                >
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Locations</label>
                <select
                  value={newAdmin.locations[0]}
                  onChange={(e) => setNewAdmin({ ...newAdmin, locations: [e.target.value] })}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Locations</option>
                  <option value="latrobe">Latrobe</option>
                  <option value="everson">Everson</option>
                  <option value="chestnut">Chestnut</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNewAdmin(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium">Cancel</button>
                <button onClick={handleCreateAdmin} className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-medium">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Protected>
      <Dashboard />
    </Protected>
  );
}
