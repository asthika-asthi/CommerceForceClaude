import { getContactDetails } from "@/lib/contact-details"
import { ContactClient } from "./contact-client"

export default async function ContactPage() {
  return <ContactClient details={await getContactDetails()} />
}
