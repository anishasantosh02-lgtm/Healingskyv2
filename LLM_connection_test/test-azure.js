import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

console.log("Azure Endpoint:", endpoint);
console.log("Azure Deployment:", deployment);
console.log("API Version:", apiVersion);

if (!endpoint) {
  throw new Error("AZURE_OPENAI_ENDPOINT is missing");
}

if (!apiKey) {
  throw new Error("AZURE_OPENAI_API_KEY is missing");
}

if (!deployment) {
  throw new Error(
    "AZURE_OPENAI_DEPLOYMENT_NAME is missing"
  );
}

const client = new OpenAI({
  apiKey,

  baseURL:
    `${endpoint}/openai/deployments/${deployment}`,

  defaultQuery: {
    "api-version": apiVersion,
  },

  defaultHeaders: {
    "api-key": apiKey,
  },
});

const response =
  await client.chat.completions.create({
    model: deployment,

    messages: [
      {
        role: "user",
        content:
          "Reply with exactly: Azure connection successful",
      },
    ],

    max_tokens: 100,
  });

console.log(
  "\nAzure response:"
);

console.log(
  response.choices[0].message.content
);