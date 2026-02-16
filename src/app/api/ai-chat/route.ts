import { NextRequest } from "next/server";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface TripContext {
  origin: string;
  destination: string;
  vehicle: string;
  distance: number;
  duration: number;
  totalChargeTime: number;
  arrivalCharge: number;
  stops: {
    name: string;
    address: string;
    chargeTime: number;
    distanceFromStart: number;
  }[];
}

function buildSystemPrompt(ctx: TripContext): string {
  const stopsInfo = ctx.stops
    .map(
      (s, i) =>
        `  ${i + 1}. ${s.name} — ${s.address} (${Math.round(s.distanceFromStart)} mi from start, ~${Math.round(s.chargeTime)} min charge)`
    )
    .join("\n");

  return `You are WattsWay AI — a witty, enthusiastic, and slightly cheeky road trip copilot. You help Tesla drivers make the most of their charging stops by recommending restaurants, coffee shops, hidden gems, attractions, road trip games, and fun activities.

TRIP CONTEXT:
- Route: ${ctx.origin} → ${ctx.destination}
- Vehicle: ${ctx.vehicle}
- Total distance: ${Math.round(ctx.distance)} miles
- Drive time: ${Math.round(ctx.duration)} min
- Total charging time: ${Math.round(ctx.totalChargeTime)} min
- Arrival charge: ${Math.round(ctx.arrivalCharge)}%

CHARGING STOPS:
${stopsInfo || "  No charging stops needed — direct drive!"}

RULES:
- Keep responses under 150 words
- Use **bold** for emphasis and bullet points for lists
- Reference actual stop names and locations from the trip data above
- Be helpful, fun, and conversational — you're a road trip buddy
- If asked about food/attractions near a stop, give general category suggestions for the area (e.g. "look for BBQ joints in this area" or "this town is known for its craft breweries")
- Do NOT make up specific business names, addresses, or phone numbers you're unsure about
- If the question is unrelated to road trips or travel, gently redirect to trip-related topics
- You can suggest road trip games, playlist vibes, and general travel tips`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey || apiKey === "xai-...") {
    return new Response(
      JSON.stringify({
        error:
          "AI chat is not configured. Add your xAI API key to .env.local as XAI_API_KEY.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages, tripContext } = (await request.json()) as {
      messages: ChatMessage[];
      tripContext: TripContext;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Security: validate and sanitize messages
    const MAX_MESSAGE_LENGTH = 1000;
    const sanitized = messages
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.slice(0, MAX_MESSAGE_LENGTH),
      }));

    if (sanitized.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid messages provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(tripContext);

    // Send only last 10 messages to avoid token limits
    const recentMessages = sanitized.slice(-10);

    const xaiResponse = await fetch(
      "https://api.x.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4-1-fast-reasoning",
          stream: true,
          temperature: 0.8,
          max_tokens: 800,
          messages: [
            { role: "system", content: systemPrompt },
            ...recentMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          ],
        }),
      }
    );

    if (!xaiResponse.ok) {
      const errorText = await xaiResponse.text();
      console.error("xAI API error:", xaiResponse.status, errorText);
      return new Response(
        JSON.stringify({
          error: "AI service temporarily unavailable. Please try again.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pass through the SSE stream
    return new Response(xaiResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
