// Standard envelopes from PROJECT.md "Coding standards" — every endpoint
// uses these shapes, never an ad-hoc response format.

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

export interface ListEnvelope<T> {
  data: T[];
  page: number;
  page_size: number;
  total: number;
}
