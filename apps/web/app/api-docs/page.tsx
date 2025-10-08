import { Metadata } from "next";
// Import the client component directly; it's marked with "use client"

export const metadata: Metadata = {
  title: "API Documentation - Contract Intelligence",
  description: "Complete API reference and integration guides for developers",
};

import ApiDocsClient from "./ApiDocsClient";

export default function APIDocsPage() {
  return <ApiDocsClient />;
}
