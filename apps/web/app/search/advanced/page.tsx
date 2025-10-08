import { Metadata } from "next";
import AdvancedSearchClient from "./AdvancedSearchClient";

export const metadata: Metadata = {
  title: "Advanced Search - Contract Intelligence",
  description:
    "Advanced contract search with detailed filters and complex criteria",
};

export default function AdvancedSearchPage() {
  return <AdvancedSearchClient />;
}
