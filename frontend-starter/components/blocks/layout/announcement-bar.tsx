import { serverFetch } from "@/lib/api"

interface Announcement {
  id: string
  text: string
  link_url?: string | null
  link_text?: string | null
  is_active: boolean
}

interface Props {
  [key: string]: unknown
}

export async function AnnouncementBar(_props: Props) {
  let announcement: Announcement | null = null
  try {
    announcement = await serverFetch<Announcement | null>("/api/announcements/active")
  } catch {
    return null
  }
  if (!announcement) return null

  return (
    <div className="w-full bg-brand text-fg py-2 px-4 text-center text-sm font-medium">
      <span>{announcement.text}</span>
      {announcement.link_url && (
        <>
          {" "}
          <a
            href={announcement.link_url}
            className="underline hover:opacity-75 transition-opacity"
          >
            {announcement.link_text ?? "Learn more"}
          </a>
        </>
      )}
    </div>
  )
}
