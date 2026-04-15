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

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Message is required"
        })
      };
    }

    /* ---------------- FETCH LIVE FREE MODELS ---------------- */
    console.log("Fetching live free models...");

    const modelResponse = await fetch(
      "https://openrouter.ai/api/v1/models"
    );

    const modelData = await modelResponse.json();

    const models = modelData.data
      .filter(model => model.id.endsWith(":free"))
      .map(model => model.id)
      .slice(0, 10);

    console.log("Live free models found:", models);

    if (!models.length) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "No free models currently available"
        })
      };
    }

    let lastError = null;

    /* ---------------- TRY MODELS ONE BY ONE ---------------- */
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
                  content:
                    systemPrompt ||
                    "You are ProposalAI, expert in writing professional business proposals."
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

        /* Skip unavailable models */
        if (
          data?.error?.message?.includes("No endpoints found") ||
          data?.error?.message?.includes("Provider returned error") ||
          data?.error?.message?.includes("temporarily unavailable") ||
          data?.error?.message?.includes("not a valid model ID")
        ) {
          console.log("Skipped model:", model);
          continue;
        }

        /* Success */
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

        lastError =
          `${model}: ${data?.error?.message || "Unknown error"}`;

      } catch (err) {
        console.log("FAILED MODEL:", model, err.message);
        lastError = `${model}: ${err.message}`;
      }
    }

    /* ---------------- ALL FAILED ---------------- */
    console.log("FINAL LAST ERROR:", lastError);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: lastError || "All fallback models failed"
      })
    };

  } catch (error) {
    console.log("CHAT FUNCTION ERROR:", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};