import sanitizeHtml from 'sanitize-html';

/**
 * Strip ALL HTML tags from user input (plain text only).
 * Use as a class-transformer @Transform() callback.
 */
export const stripHtml = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    : value;
