import {
  createInterface,
} from "node:readline";

export async function confirm(
  question: string,
): Promise<boolean> {
  if (
    !process.stdin.isTTY ||
    !process.stdout.isTTY
  ) {
    return false;
  }

  const readline =
    createInterface({
      input: process.stdin,
      output: process.stdout,
    });

  try {
    const answer =
      await new Promise<string>(resolve => {
        readline.question(
          `${question} [y/N] `,
          resolve,
        );
      });

    return (
      answer.trim().toLowerCase() === "y" ||
      answer.trim().toLowerCase() === "yes"
    );
  } finally {
    readline.close();
  }
}