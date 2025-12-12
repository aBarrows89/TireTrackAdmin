import { NextResponse } from "next/server";

const EXPO_PROJECT_ID = "db81ed28-c7a4-44a8-a2c4-ef40e4ed7502";

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
          limit: 5,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Expo API error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch builds from Expo", details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return NextResponse.json(
        { error: "GraphQL error", details: data.errors },
        { status: 500 }
      );
    }

    const builds = data.data?.builds || [];

    // Get the latest production build
    const latestBuild = builds.find(
      (b: { buildProfile: string }) => b.buildProfile === "production"
    ) || builds[0];

    return NextResponse.json({
      success: true,
      latestBuild: latestBuild || null,
      allBuilds: builds,
    });
  } catch (error) {
    console.error("Error fetching Expo builds:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch builds",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
