"use client";

import { useState, useEffect } from "react";
import { Protected } from "../protected";
import Link from "next/link";

interface ExpoBuild {
  id: string;
  platform: string;
  status: string;
  appVersion: string;
  buildProfile: string;
  gitCommitHash: string;
  createdAt: string;
  completedAt: string;
  artifacts: {
    buildUrl: string;
  };
}

interface BuildsResponse {
  success: boolean;
  latestBuild: ExpoBuild | null;
  allBuilds: ExpoBuild[];
  error?: string;
}

export default function AppDownloadPage() {
  const [builds, setBuilds] = useState<BuildsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBuilds();
  }, []);

  const fetchBuilds = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/expo-builds");
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to fetch builds");
      } else {
        setBuilds(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Protected>
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                </Link>
                <div>
                  <h1 className="text-xl font-bold">TireTrack Lite App</h1>
                  <p className="text-slate-500 text-sm">
                    Download the latest Android APK
                  </p>
                </div>
              </div>
              <button
                onClick={fetchBuilds}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading && !builds ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
              <p className="text-red-400 font-medium">Error loading builds</p>
              <p className="text-slate-500 text-sm mt-1">{error}</p>
              <button
                onClick={fetchBuilds}
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : builds?.latestBuild ? (
            <>
              {/* Latest Build Card */}
              <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Latest Production Build
                    </h2>
                    <p className="text-purple-300 text-sm">
                      Version {builds.latestBuild.appVersion || "1.0.0"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider">
                      Profile
                    </p>
                    <p className="text-white font-medium capitalize">
                      {builds.latestBuild.buildProfile}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider">
                      Status
                    </p>
                    <p className="text-emerald-400 font-medium">
                      {builds.latestBuild.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider">
                      Built
                    </p>
                    <p className="text-white font-medium">
                      {formatDate(builds.latestBuild.completedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider">
                      Commit
                    </p>
                    <p className="text-slate-400 font-mono text-sm">
                      {builds.latestBuild.gitCommitHash?.slice(0, 7) || "N/A"}
                    </p>
                  </div>
                </div>

                {builds.latestBuild.artifacts?.buildUrl ? (
                  <a
                    href={builds.latestBuild.artifacts.buildUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download APK
                  </a>
                ) : (
                  <p className="text-slate-500">
                    No download available for this build
                  </p>
                )}
              </div>

              {/* All Builds */}
              {builds.allBuilds.length > 1 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-slate-300">
                    Recent Builds
                  </h3>
                  <div className="space-y-3">
                    {builds.allBuilds.slice(1).map((build) => (
                      <div
                        key={build.id}
                        className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-slate-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {build.buildProfile} - v
                              {build.appVersion || "1.0.0"}
                            </p>
                            <p className="text-slate-500 text-sm">
                              {formatDate(build.completedAt)}
                            </p>
                          </div>
                        </div>
                        {build.artifacts?.buildUrl && (
                          <a
                            href={build.artifacts.buildUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-slate-400 font-medium">No builds found</p>
              <p className="text-slate-600 text-sm mt-1">
                Run &quot;eas build --platform android&quot; to create a build
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 bg-slate-900/30 border border-slate-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-300">
              Installation Instructions
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-slate-400">
              <li>Download the APK file to your Android device</li>
              <li>
                Open the file (you may need to allow &quot;Install from unknown
                sources&quot;)
              </li>
              <li>Follow the installation prompts</li>
              <li>Open TireTrack Lite and sign in with your credentials</li>
            </ol>
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-400 text-sm">
                <strong>Note:</strong> If you see a &quot;Play Protect&quot;
                warning, tap &quot;Install anyway&quot; - this is normal for
                apps not from the Play Store.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Protected>
  );
}
