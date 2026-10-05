import { getContactEmail } from "@/lib/contact-email"
import { ContactClient } from "./contact-client"

export default async function ContactPage() {
  return <ContactClient email={await getContactEmail()} />
}
