import type { Metadata } from "next";
import { ProfileSettings } from "@/components/couple/profile-settings";

export const metadata: Metadata = { title: "Profile" };
export const instant = false;

export default function Page() {
  return <ProfileSettings />;
}
