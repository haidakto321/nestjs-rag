/** class-transformer helper: trims strings and leaves every other value alone. */
export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
