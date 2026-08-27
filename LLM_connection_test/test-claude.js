import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await client.messages.create({
  model: process.env.ANTHROPIC_MODEL,
  max_tokens: 500,
  messages: [
    {
      role: "user",
      content: "Reply with exactly: Claude connection successful",
    },
  ],
});

console.log(response.content[0].text);