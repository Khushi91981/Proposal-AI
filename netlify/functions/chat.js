exports.handler = async function(event) {
  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    if (!OPENROUTER_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Missing OpenRouter API key"
        })
      };
    }

    const body = JSON.parse(event.body);
    const { message, systemPrompt } = body;

const models = [
  "deepseek/deepseek-chat:free",
  "qwen/qwen2.5-7b-instruct:free",
  "google/gemma-2-9b-it:free"
];

    let lastError = null;

   for (const model of models) {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://pitchwithai.netlify.app",
          "X-Title": "ProposalAI"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: message
            }
          ]
        })
      }
    );

    const data = await response.json();

    console.log("Trying model:", model, data);

    /* Skip unavailable models */
    if (
      data?.error?.message?.includes("No endpoints found") ||
      data?.error?.message?.includes("Provider returned error") ||
      data?.error?.message?.includes("temporarily unavailable")
    ) {
      continue;
    }

    if (
      response.ok &&
      data?.choices?.[0]?.message?.content
    ) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          reply: data.choices[0].message.content,
          modelUsed: model
        })
      };
    }

    lastError =
      `${model}: ${data?.error?.message || "Unknown error"}`;

  } catch (err) {
    lastError = `${model}: ${err.message}`;
  }
}

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: lastError || "All fallback models failed"
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};