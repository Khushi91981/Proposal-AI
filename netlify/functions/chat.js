exports.handler = async function(event) {
  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    /* ---------------- API KEY CHECK ---------------- */
    if (!OPENROUTER_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Missing OpenRouter API key"
        })
      };
    }

    /* ---------------- PARSE REQUEST ---------------- */
    const body = JSON.parse(event.body);
    const { message, systemPrompt, attachments = [] } = body;

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Message is required"
        })
      };
    }

    /* ---------------- PREPARE FINAL MESSAGE ---------------- */
    let finalMessage = message;

    if (attachments.length > 0) {
      finalMessage +=
        "\n\nUploaded image(s): " +
        attachments.map(file => file.name).join(", ");
    }

    /* ---------------- PREFERRED CLEAN MODELS ---------------- */
    const preferredModels = [
      "google/gemma-3-12b-it:free",
      "mistralai/mistral-small-3.2-24b-instruct:free",
      "deepseek/deepseek-chat-v3-0324:free"
    ];

    let models = [];

    try {
      console.log("Fetching live free models...");

      const modelResponse = await fetch(
        "https://openrouter.ai/api/v1/models"
      );

      const modelData = await modelResponse.json();

      const liveModels = modelData.data
        .filter(model =>
          model.id.endsWith(":free") &&
          !model.id.includes("r1") &&
          !model.id.includes("reasoning") &&
          !model.id.includes("think") &&
          !model.id.includes("qwen3")
        )
        .map(model => model.id);

      /* Merge preferred models first */
      models = [
        ...preferredModels,
        ...liveModels.filter(m => !preferredModels.includes(m))
      ].slice(0, 10);

    } catch (err) {
      console.log("Model fetch failed, using fallback preferred models only");
      models = preferredModels;
    }

    console.log("Models to try:", models);

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
              temperature: 0.7,
              max_tokens: 1200,
              messages: [
                {
                  role: "system",
                  content:
                    systemPrompt ||
                    "You are ProposalAI. Always respond directly with polished final output only. Never show internal reasoning, analysis, thoughts, or planning steps."
                },
                {
                  role: "user",
                  content: finalMessage
                }
              ]
            })
          }
        );

        const data = await response.json();

        console.log("Response for model:", model, data);

        /* Skip unavailable/bad models */
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
              reply: data.choices[0].message.content.trim(),
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