/**
 * Removes lines that start with '#' from the given string.
 */
export function removeHashComments(input: string): string {
  return input
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}
