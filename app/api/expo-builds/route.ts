import { NextResponse } from "next/server";

const EXPO_PROJECT_ID = "db81ed28-c7a4-44a8-a2c4-ef40e4ed7502";

// Force dynamic - never cache build data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // EAS API to get builds - uses GraphQL
    const query = `
      query GetBuilds($appId: String!, $platform: AppPlatform!, $limit: Int!) {
        builds(appId: $appId, platform: $platform, limit: $limit, status: FINISHED) {
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
    `;

    const response = await fetch("https://api.expo.dev/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          appId: EXPO_PROJECT_ID,
          platform: "ANDROID",
          limit: 10, // Fetch more builds to ensure we get latest production
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

    const builds = data.data?.builds || [];

    // Sort by completedAt descending to ensure latest is first
    const sortedBuilds = [...builds].sort((a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    // Get the latest production build (prioritize production profile)
    const latestBuild = sortedBuilds.find(
      (b: { buildProfile: string }) => b.buildProfile === "production"
    ) || sortedBuilds[0];

    return NextResponse.json({
      success: true,
      latestBuild: latestBuild || null,
      allBuilds: sortedBuilds,
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
