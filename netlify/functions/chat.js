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
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free"
];

    let lastError = null;

for (const model of models) {
  try {
    console.log("Trying model:", model);

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

    console.log("Response for model:", model, data);

    if (
      data?.error?.message?.includes("No endpoints found") ||
      data?.error?.message?.includes("Provider returned error") ||
      data?.error?.message?.includes("not a valid model ID")
    ) {
      console.log("Skipped model:", model);
      continue;
    }

    if (
      response.ok &&
      data?.choices?.[0]?.message?.content
    ) {
      console.log("SUCCESS MODEL:", model);

      return {
        statusCode: 200,
        body: JSON.stringify({
          reply: data.choices[0].message.content,
          modelUsed: model
        })
      };
    }

    lastError = `${model}: ${data?.error?.message || "Unknown error"}`;

  } catch (err) {
    console.log("FAILED MODEL:", model, err.message);
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