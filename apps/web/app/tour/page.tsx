import { Metadata } from "next";
import TourClient from "./TourClient";

export const metadata: Metadata = {
  title: "App Tour - ConTigo",
  description:
    "Interactive walkthrough of ConTigo features - Learn how to use AI-powered contract intelligence",
};

export default function TourPage() {
  return <TourClient />;
}
