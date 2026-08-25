export const MAX_DEVICE_LABEL_LENGTH = 64;

export function normalizeDeviceLabel(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Device name must be text');
  }

  const label = value.trim().replace(/\s+/g, ' ');
  if (!label) {
    throw new Error('Device name is required');
  }
  if (Array.from(label).length > MAX_DEVICE_LABEL_LENGTH) {
    throw new Error(`Device name must be ${MAX_DEVICE_LABEL_LENGTH} characters or fewer`);
  }
  if (/\p{Cc}/u.test(label)) {
    throw new Error('Device name contains unsupported characters');
  }

  return label;
}

export function resolveAuthoritativeDeviceLabel(
  reportedLabel: string,
  savedLabel: string | null | undefined,
  isPaired: boolean
): string {
  return isPaired && savedLabel?.trim() ? savedLabel : reportedLabel;
}
