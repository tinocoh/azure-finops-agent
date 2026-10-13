// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
export default function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return <div className="error-box">{message}</div>;
}
