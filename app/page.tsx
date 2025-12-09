"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

export default function Home() {
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
  
  const trucks = useQuery(api.queries.getAllTrucks);
  const scans = useQuery(
    api.queries.getTruckScans,
    selectedTruck ? { truckId: selectedTruck as any } : "skip"
  );

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">TireTrack Admin</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trucks List */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Trucks</h2>
          {trucks === undefined ? (
            <p>Loading...</p>
          ) : (
            <div className="space-y-2">
              {trucks.map((truck) => (
                <button
                  key={truck._id}
                  onClick={() => setSelectedTruck(truck._id)}
                  className={`w-full text-left p-3 rounded ${
                    selectedTruck === truck._id
                      ? "bg-blue-600"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  <div className="font-medium">{truck.truckNumber}</div>
                  <div className="text-sm text-gray-400">
                    {truck.carrier} • {truck.status} • {truck.scanCount || 0} scans
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scans List */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            Scans {selectedTruck && `(${scans?.length || 0})`}
          </h2>
          {!selectedTruck ? (
            <p className="text-gray-400">Select a truck to view scans</p>
          ) : scans === undefined ? (
            <p>Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="pb-2">Tracking #</th>
                    <th className="pb-2">Vendor</th>
                    <th className="pb-2">Destination</th>
                    <th className="pb-2">Scanned At</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <tr key={scan._id} className="border-b border-gray-700">
                      <td className="py-2 font-mono">{scan.trackingNumber}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          scan.vendor === "Unknown" 
                            ? "bg-red-900 text-red-300"
                            : "bg-green-900 text-green-300"
                        }`}>
                          {scan.vendor || "Unknown"}
                        </span>
                      </td>
                      <td className="py-2">{scan.destination}</td>
                      <td className="py-2 text-gray-400">
                        {new Date(scan.scannedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
