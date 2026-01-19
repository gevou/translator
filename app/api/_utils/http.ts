import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const jsonError = (
  message: string,
  status: number,
  details?: string,
) => {
  return NextResponse.json(
    details ? { error: message, details } : { error: message },
    { status },
  );
};
