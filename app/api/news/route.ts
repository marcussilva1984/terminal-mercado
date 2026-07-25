import { NextResponse } from "next/server";
import { getNews, type NewsCategory } from "@/lib/sources/rss";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as NewsCategory | null;
  const limit = Number(searchParams.get("limit") ?? 20);

  const data = await getNews(category ?? undefined, limit);

  return NextResponse.json({
    available: true,
    updatedAt: new Date().toISOString(),
    data,
  });
}
