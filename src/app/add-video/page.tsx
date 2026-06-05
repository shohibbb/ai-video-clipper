import { redirect } from "next/navigation";

export default function AddVideoRedirectPage() {
  redirect("/videos/new");
}
