import { NextResponse } from "next/server";

const NANO_ENDPOINT = "https://api.nanobanana.ai/v1/generate";

interface NanoBananaRequest {
  prompt: string;
  apiKey: string;
  referenceImage?: string;
}

export async function POST(request: Request) {
  try {
    let body: Partial<NanoBananaRequest>;
    try {
      body = (await request.json()) as Partial<NanoBananaRequest>;
    } catch (parseError) {
      console.error("Failed to parse request body", parseError);
      return NextResponse.json(
        {
          error: "Invalid request body",
          message:
            parseError instanceof Error
              ? parseError.message
              : "Failed to parse JSON",
        },
        { status: 400 }
      );
    }

    if (!body.apiKey || typeof body.apiKey !== "string") {
      return NextResponse.json(
        { error: "Missing NanoBanana apiKey" },
        { status: 400 }
      );
    }

    if (!body.prompt || typeof body.prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      );
    }

    const requestBody: {
      prompt: string;
      size: string;
      referenceImage?: string;
    } = {
      prompt: body.prompt,
      size: "1080x608",
    };

    if (body.referenceImage && typeof body.referenceImage === "string") {
      // referenceImageがdata URI形式の場合、base64部分のみを抽出
      const base64Data = body.referenceImage.includes(",")
        ? body.referenceImage.split(",")[1]
        : body.referenceImage;
      requestBody.referenceImage = base64Data;
    }

    console.log("Sending request to NanoBanana API...", {
      endpoint: NANO_ENDPOINT,
      hasApiKey: !!body.apiKey,
      apiKeyLength: body.apiKey?.length,
      promptLength: body.prompt?.length,
      hasReferenceImage: !!body.referenceImage,
    });

    let upstream: Response;
    try {
      upstream = await fetch(NANO_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": body.apiKey,
        },
        body: JSON.stringify(requestBody),
        // タイムアウト設定を追加
        signal: AbortSignal.timeout(60000), // 60秒
      });
    } catch (fetchError) {
      console.error("Failed to fetch from NanoBanana API", {
        error: fetchError,
        errorName: fetchError instanceof Error ? fetchError.name : "Unknown",
        errorMessage:
          fetchError instanceof Error ? fetchError.message : String(fetchError),
        errorStack: fetchError instanceof Error ? fetchError.stack : undefined,
        endpoint: NANO_ENDPOINT,
        cause:
          fetchError instanceof Error && "cause" in fetchError
            ? fetchError.cause
            : undefined,
      });

      // より詳細なエラーメッセージを構築
      let errorMessage = "Failed to connect to NanoBanana API";
      if (fetchError instanceof Error) {
        errorMessage = fetchError.message;
        // DNSエラーの場合
        if (
          fetchError.message.includes("ENOTFOUND") ||
          fetchError.message.includes("getaddrinfo")
        ) {
          errorMessage =
            "DNS lookup failed. The API endpoint may be incorrect or unreachable.";
        }
        // タイムアウトの場合
        if (
          fetchError.message.includes("timeout") ||
          fetchError.name === "AbortError"
        ) {
          errorMessage =
            "Request timeout. The API server may be slow or unreachable.";
        }
        // SSL証明書エラーの場合
        if (
          fetchError.message.includes("certificate") ||
          fetchError.message.includes("SSL")
        ) {
          errorMessage =
            "SSL certificate error. There may be a security issue with the API endpoint.";
        }
      }

      return NextResponse.json(
        {
          error: "Network error",
          message: errorMessage,
          endpoint: NANO_ENDPOINT,
          details:
            process.env.NODE_ENV === "development"
              ? fetchError instanceof Error
                ? fetchError.stack
                : String(fetchError)
              : undefined,
        },
        { status: 500 }
      );
    }

    const text = await upstream.text();

    if (!upstream.ok) {
      console.error(
        `NanoBanana API error: ${upstream.status} ${upstream.statusText}`,
        text
      );
      return NextResponse.json(
        {
          error: `NanoBanana request failed: ${upstream.status} ${upstream.statusText}`,
          body: text,
        },
        { status: upstream.status }
      );
    }

    try {
      const json = JSON.parse(text);
      return NextResponse.json(json);
    } catch {
      return NextResponse.json({ base64: text });
    }
  } catch (error) {
    console.error("NanoBanana proxy error", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : String(error);
    return NextResponse.json(
      {
        error: "NanoBanana proxy error",
        message: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
