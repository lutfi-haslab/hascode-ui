import OpenAI from "openai";
import { env } from "~/env.mjs";
import { escapeRegExp } from "~/utils/utils";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY, // defaults to process.env["ANTHROPIC_API_KEY"]
});
const anthropicModelName = "claude-3-haiku-20240307";
// const anthropicModelName = "claude-3-sonnet-20240229";
// const anthropicModelName = "claude-3-opus-20240229";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});
// const openaiModelName = "gpt-4-0613";
const openaiModelName = "gpt-3.5-turbo-0125";

const extractFirstCodeBlock = (input: string) => {
  const pattern = /```(\w+)?\n([\s\S]+?)\n```/g;
  let matches;
  while ((matches = pattern.exec(input)) !== null) {
    const language = matches[1];
    const codeBlock = matches[2];
    if (
      language === undefined ||
      language === "tsx" ||
      language === "typescript" ||
      language === "json"
    ) {
      // console.log(codeBlock);
      return codeBlock as string;
    }
  }

  // console.log(input);
  throw new Error("No code block found in input");
};

const containsDiff = (message: string) => {
  return (
    message.includes("<<<<<<< ORIGINAL") &&
    message.includes(">>>>>>> UPDATED") &&
    message.includes("=======\n")
  );
};

const applyDiff = (code: string, diff: string) => {
  const regex = /<<<<<<< ORIGINAL\n(.*?)=======\n(.*?)>>>>>>> UPDATED/gs;

  let match;

  // debugger;
  while ((match = regex.exec(diff)) !== null) {
    const [, before, after] = match;

    // Convert match to a regex. We need to do this because
    // gpt returns the code with the tabs removed. The idea here is to
    // convert newlines to \s+ so that we catch even if the indentation
    // is different.
    // TODO: Before we replace, we can also check how indented the code is
    // and add the same indentation to the replacement.
    let regex = escapeRegExp(before!);
    regex = regex.replaceAll(/\r?\n/g, "\\s+");
    regex = regex.replaceAll(/\t/g, "");

    // Create the regex
    const replaceRegex = new RegExp(regex);

    // console.log(`Replacing $$$${replaceRegex}$$$ with $$$${after}$$$`);
    // console.log(`Code before: ${code}`);

    code = code.replace(replaceRegex, after!);
  }

  return code;
};

export async function reviseComponent(prompt: string, code: string) {
  const completion = await openai.chat.completions.create({
    model: openaiModelName,
    messages: [
      // {
      //   role: "system",
      //   content: [
      //     "You are an AI programming assistant.",
      //     "Follow the user's requirements carefully & to the letter.",
      //     "You're working on a react component using typescript and tailwind.",
      //     "Don't introduce any new components or files.",
      //     "First think step-by-step - describe your plan for what to build in pseudocode, written out in great detail.",
      //     "You must format every code change with an *edit block* like this:",
      //     "```",
      //     "<<<<<<< ORIGINAL",
      //     "    # some comment",
      //     "    # Func to multiply",
      //     "    def mul(a,b)",
      //     "=======",
      //     "    # updated comment",
      //     "    # Function to add",
      //     "    def add(a,b):",
      //     ">>>>>>> UPDATED",
      //     "```",
      //     "There can be multiple code changes.",
      //     "Modify as few characters as possible and use as few characters as possible on the diff.",
      //     "Minimize any other prose.",
      //     "Keep your answers short and impersonal.",
      //     "Never create a new component or file.",
      //     `Always give answers by modifying the following code:\n\`\`\`tsx\n${code}\n\`\`\``,
      //   ].join("\n"),
      // },
      {
        role: "system",
        content: [
          "You are an AI programming assistant.",
          "Follow the user's requirements carefully & to the letter.",
          "You're working on a react component using typescript and tailwind.",
          "Don't introduce any new components or files.",
          "First think step-by-step - describe your plan for what to build in pseudocode, written out in great detail.",
          "Minimize any other prose.",
          "Keep your answers short and impersonal.",
          "Never create a new component or file.",
          `Always give answers by modifying the following code:\n\`\`\`tsx\n${code}\n\`\`\``,
        ].join("\n"),
      },
      {
        role: "user",
        content: `${prompt}`,
      },
    ],
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 2000,
    n: 1,
  });

  const choices = completion.choices;

  if (
    !choices ||
    choices.length === 0 ||
    !choices[0] ||
    !choices[0].message ||
    !choices[0].message.content
  ) {
    throw new Error("No choices returned from OpenAI");
  }

  let newCode;
  const diff = choices[0].message.content;

  if (!containsDiff(diff)) {
    newCode = extractFirstCodeBlock(diff);
  } else {
    newCode = applyDiff(code, diff);
  }

  return newCode;
}

export async function generateNewComponent(prompt: string) {
  const completion = await openai.chat.completions.create({
    model: openaiModelName,
    messages: [
      {
        role: "system",
        content: [
          "You are a helpful assistant.",
          "You're tasked with writing a react component using typescript and tailwind for a website.",
          "Only import React as a dependency.",
          "Be concise and only reply with code.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `- Component Name: Section`,
          `- Component Description: ${prompt}\n`,
          `- Do not use libraries or imports other than React.`,
          `- Do not have any dynamic data. Use placeholders as data. Do not use props.`,
          `- Write only a single component.`,
          `- if you need or have image url, replace with this path /images/background-auth.jpg`,
        ].join("\n"),
      },
    ],
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 2000,
    n: 1,
  });

  const choices = completion.choices;

  if (!choices || choices.length === 0 || !choices[0] || !choices[0].message) {
    throw new Error("No choices returned from OpenAI");
  }

  let result = choices[0].message.content || "";
  result = extractFirstCodeBlock(result);

  return result;
}

export async function reviseComponentClaude(prompt: string, code: string) {
  const msg = await anthropic.messages.create({
    model: anthropicModelName,
    max_tokens: 2000,
    messages: [
      { role: "user", content: "Hello, Claude" },
      // {
      //   role: "assistant",
      //   content: [
      //     "You are an AI programming assistant.",
      //     "Follow the user's requirements carefully & to the letter.",
      //     "You're working on a react component using typescript and tailwind.",
      //     "Don't introduce any new components or files.",
      //     "Just give me the code",
      //     "Never let you say 'Here's the updated code', just the code only",
      //     "First think step-by-step - describe your plan for what to build in pseudocode, written out in great detail.",
      //     "You must format every code change with an *edit block* like this:",
      //     "```",
      //     "<<<<<<< ORIGINAL",
      //     "    # some comment",
      //     "    # Func to multiply",
      //     "    def mul(a,b)",
      //     "=======",
      //     "    # updated comment",
      //     "    # Function to add",
      //     "    def add(a,b):",
      //     ">>>>>>> UPDATED",
      //     "```",
      //     "please remember to format every code changes like above",
      //     "await add pattern like above for every code changes, it can be multiple",
      //     "There can be multiple code changes.",
      //     "don not add update whole code, just add tag '<<<<<<< ORIGINAL', '=======', '>>>>>>> UPDATED' as diff, so i know where to change the code",
      //     "Modify as few characters as possible and use as few characters as possible on the diff.",
      //     "Minimize any other prose.",
      //     "Keep your answers short and impersonal.",
      //     "Never create a new component or file.",
      //     `if you need or have image url, replace with this path /images/background-auth.jpg`,
      //     "do not explain any code changes, just give the code",
      //     "do not put 'The key changes are:'",
      //     `Always give answers by modifying the following code:\n\`\`\`tsx\n${code}\n\`\`\``,
      //   ].join("\n"),
      // },
      {
        role: "assistant",
        content: [
          "You are an AI programming assistant.",
          "Follow the user's requirements carefully & to the letter.",
          "You're working on a react component using typescript and tailwind.",
          "Don't introduce any new components or files.",
          "Never let you say 'Here's the updated code', just the code only",
          "First think step-by-step - describe your plan for what to build in pseudocode, written out in great detail.",
          "Never create a new component or file.",
          `if you need or have image url, replace with this path /images/background-auth.jpg`,
          "do not explain any code changes, just give the code",
          "do not put 'The key changes are:'",
          `Always give answers by modifying the following code:\n\`\`\`tsx\n${code}\n\`\`\``,
        ].join("\n"),
      },
      {
        role: "user",
        content: `${prompt}`,
      },
    ],
  });

  const result = msg.content[0]?.text.trim() as string;
  // console.log(result);
  let newCode;

  if (!containsDiff(result)) {
    newCode = extractFirstCodeBlock(result);
  } else {
    newCode = applyDiff(code, result);
  }

  // if (!containsDiff(result)) {
  //   throw new Error("No diff found in message");
  // }

  // newCode = applyDiff(code, result);

  return newCode;
}

export async function generateNewComponentClaude(prompt: string) {
  const msg = await anthropic.messages.create({
    model: anthropicModelName,
    max_tokens: 2000,
    messages: [
      { role: "user", content: "Hello, Claude" },
      {
        role: "assistant",
        content: [
          "You are a helpful assistant.",
          "You're tasked with writing a react component using typescript and tailwind for a website.",
          "Only import React as a dependency.",
          "Be concise and only reply with code.",
          "the code is in react typescript",
          "Just give me the code",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `- Component Name: Section`,
          `- Component Description: ${prompt}`,
          `- Do not use libraries or imports other than React.`,
          `- Do not have any dynamic data. Use placeholders as data. Do not use props.`,
          `- Write only a single component.`,
          `Always give answers by modifying the following code:\n\`\`\`tsx\ncode\n\`\`\``,
        ].join("\n"),
      },
    ],
  });

  const result = msg.content[0]?.text as string;
  // console.log(msg.content);
  const codeBlock = extractFirstCodeBlock(result);

  return codeBlock;
}
