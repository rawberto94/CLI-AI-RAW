import { Metadata } from "next";
import SettingsClient from "./SettingsClient";

export const metadata: Metadata = {
  title: "System Settings - Contract Intelligence",
  description:
    "Configure system parameters, user preferences, and integration settings",
};

export default function SettingsPage() {
  return <SettingsClient />;
}
