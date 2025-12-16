import { NextResponse } from "next/server";

const EXPO_PROJECT_ID = "db81ed28-c7a4-44a8-a2c4-ef40e4ed7502";

// Force dynamic - never cache build data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Get Expo session from environment variable (from ~/.expo/state.json sessionSecret)
    // Alternatively, use EXPO_TOKEN for API access tokens
    const expoSession = process.env.EXPO_SESSION;
    const expoToken = process.env.EXPO_TOKEN;

    if (!expoSession && !expoToken) {
      console.error("No Expo authentication configured");
      return NextResponse.json(
        {
          success: false,
          error: "Expo API authentication not configured",
          details: "EXPO_SESSION or EXPO_TOKEN environment variable is required",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Updated EAS API GraphQL query for new schema
    const query = `
      query GetBuilds($appId: String!, $offset: Int!, $limit: Int!) {
        app {
          byId(appId: $appId) {
            builds(offset: $offset, limit: $limit, filter: { platform: ANDROID, status: FINISHED }) {
              id
              platform
              status
              appVersion
              buildProfile
              gitCommitHash
              createdAt
              completedAt
              artifacts {
                buildUrl
              }
            }
          }
        }
      }
    `;

    // Build headers based on which auth method is available
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (expoToken) {
      headers["Authorization"] = `Bearer ${expoToken}`;
    } else if (expoSession) {
      headers["expo-session"] = expoSession;
    }

    const response = await fetch("https://api.expo.dev/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables: {
          appId: EXPO_PROJECT_ID,
          offset: 0,
          limit: 10,
        },
      }),
      // Disable Next.js fetch caching
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Expo API error:", errorText);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch builds from Expo",
          details: errorText,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return NextResponse.json(
        {
          success: false,
          error: "GraphQL error",
          details: data.errors,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const builds = data.data?.app?.byId?.builds || [];

    // Sort by completedAt descending to ensure latest is first
    const sortedBuilds = [...builds].sort((a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    // Filter for APK builds only (preview profile generates APKs, production generates AABs)
    // APK files end with .apk, AAB files end with .aab
    const apkBuilds = sortedBuilds.filter(
      (b: { artifacts?: { buildUrl?: string } }) =>
        b.artifacts?.buildUrl?.endsWith('.apk')
    );

    // Get the latest APK build (preview profile)
    const latestBuild = apkBuilds[0] || null;

    return NextResponse.json({
      success: true,
      latestBuild: latestBuild,
      allBuilds: apkBuilds,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching Expo builds:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch builds",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
