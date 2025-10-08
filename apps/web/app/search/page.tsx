import { Metadata } from "next";
import SearchClient from "./SearchClient";

export const metadata: Metadata = {
  title: "Contract Search - Contract Intelligence",
  description: "AI-powered semantic contract search and discovery platform",
};

export default function SearchPage() {
  return <SearchClient />;
}
