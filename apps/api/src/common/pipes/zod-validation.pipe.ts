import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

// Validates request bodies against the Zod schemas in
// @timesheet/shared-types directly, rather than re-declaring the same
// shape as class-validator DTOs — PROJECT.md: shared request/response
// types "are imported by both apps and never redefined separately."
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body failed validation.",
          details: result.error.flatten(),
        },
      });
    }
    return result.data;
  }
}
